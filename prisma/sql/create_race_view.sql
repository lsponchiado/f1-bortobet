CREATE OR REPLACE VIEW bet_race_results_view AS
WITH
-- Pontuação configurada da temporada
pts AS (
  SELECT
    sc."seasonId",
    ARRAY[sc."ptsP1", sc."ptsP2", sc."ptsP3", sc."ptsP4", sc."ptsP5",
          sc."ptsP6", sc."ptsP7", sc."ptsP8", sc."ptsP9", sc."ptsP10"] AS race_pts,
    sc."ptsHailMary",
    sc."ptsUnderdog",
    sc."ptsFreefall",
    sc."ptsFastestLap",
    sc."ptsSafetyCar",
    sc."ptsDNF"
  FROM "SeasonConfig" sc
),

-- Contagem de DNFs por sessão
dnf_counts AS (
  SELECT "sessionId", COUNT(*) FILTER (WHERE dnf) AS cnt
  FROM "SessionEntry"
  GROUP BY "sessionId"
),

-- Cada item do grid da aposta cruzado com o resultado real
grid_detail AS (
  SELECT
    bg."betId",
    bg."predictedPosition" AS pos,        
    bg."driverId",
    bg."fastestLap"        AS bet_fl,
    br."sessionId",        -- ADICIONADO: Trazemos o sessionId para evitar re-joins futuros
    se."startPosition",
    se."finishPosition",
    se."dnf",
    se."fastestLap"        AS actual_fl
  FROM "BetRaceGridItem" bg
  JOIN "BetRace" br ON br.id = bg."betId"
  -- CORREÇÃO: LEFT JOIN garante que o array final sempre terá o tamanho correto mesmo com DNS
  LEFT JOIN "SessionEntry" se ON se."sessionId" = br."sessionId"
                             AND se."driverId"  = bg."driverId"
),

-- Pontos por posição + flags de mecânicas por item
grid_scored AS (
  SELECT
    gd."betId",
    gd."sessionId",
    gd.pos,
    
    -- Grid: acertou posição exata?
    CASE WHEN gd."finishPosition" = gd.pos
         THEN pts.race_pts[gd.pos]  
         ELSE 0
    END AS pos_pts,

    CASE WHEN gd.bet_fl AND gd.actual_fl THEN pts."ptsFastestLap" ELSE 0 END AS fl_pts,

    -- Hail Mary: acertou posição + predicted top 5, started P20+, finished top 5
    CASE WHEN gd."finishPosition" = gd.pos
          AND gd.pos <= 5
          AND gd."startPosition" >= 20
          AND gd."finishPosition" <= 5
         THEN pts."ptsHailMary"
         ELSE 0
    END AS hm_raw,

    -- Underdog: acertou posição + predicted top 3, climbed 10+, finished top 3
    CASE WHEN gd."finishPosition" = gd.pos
          AND gd.pos <= 3
          AND (gd."startPosition" - gd."finishPosition") >= 10
          AND gd."finishPosition" <= 3
         THEN pts."ptsUnderdog"
         ELSE 0
    END AS ud_raw,

    -- Freefall: acertou posição + predicted drop 5+ from start AND actually dropped 5+
    CASE WHEN gd."finishPosition" = gd.pos
          AND (gd.pos - gd."startPosition") >= 5
          AND (gd."finishPosition" - gd."startPosition") >= 5
         THEN pts."ptsFreefall"
         ELSE 0
    END AS ff_raw

  FROM grid_detail gd
  -- OTIMIZAÇÃO: Usando o sessionId diretamente, sem precisar de JOIN com BetRace
  JOIN "Session"  s   ON s.id  = gd."sessionId"
  JOIN pts              ON pts."seasonId" = s."seasonId"
),

-- Aplicar limites (HM max 1, UD max 3, prioridade HM > UD, FF não concorre)
grid_with_limits AS (
  SELECT
    gs."betId",
    gs."sessionId",
    gs.pos,
    gs.pos_pts,
    gs.fl_pts,
    gs.ff_raw,
    gs.hm_raw,
    gs.ud_raw,

    CASE WHEN gs.hm_raw > 0
         THEN ROW_NUMBER() OVER (PARTITION BY gs."betId", (gs.hm_raw > 0) ORDER BY gs.pos)
         ELSE NULL
    END AS hm_rank,

    CASE WHEN gs.ud_raw > 0 AND gs.hm_raw = 0  
         THEN ROW_NUMBER() OVER (PARTITION BY gs."betId", (gs.ud_raw > 0 AND gs.hm_raw = 0) ORDER BY gs.pos)
         ELSE NULL
    END AS ud_rank

  FROM grid_scored gs
),

-- Resultado final por posição
grid_final AS (
  SELECT
    gl."betId",
    gl."sessionId",
    gl.pos,
    gl.pos_pts,
    gl.fl_pts,

    CASE WHEN rc."allowHailMary" AND gl.hm_raw > 0 AND gl.hm_rank = 1
         THEN gl.hm_raw ELSE 0
    END AS hm_pts,

    CASE WHEN rc."allowUnderdog" AND gl.ud_raw > 0 AND gl.hm_raw = 0 AND gl.ud_rank <= 3
         THEN gl.ud_raw ELSE 0
    END AS ud_pts,

    CASE WHEN rc."allowFreefall" AND gl.ff_raw > 0 AND gl.hm_raw = 0 AND gl.ud_raw = 0
         THEN gl.ff_raw ELSE 0
    END AS ff_pts

  FROM grid_with_limits gl
  -- OTIMIZAÇÃO: Join direto com RaceConfig
  LEFT JOIN "RaceConfig" rc ON rc."sessionId" = gl."sessionId"
),

-- Agregar arrays por aposta
bet_arrays AS (
  SELECT
    gf."betId",
    ARRAY_AGG(gf.pos_pts ORDER BY gf.pos) AS "somaPos",
    ARRAY_AGG(gf.hm_pts  ORDER BY gf.pos) AS "hailMary",
    ARRAY_AGG(gf.ud_pts  ORDER BY gf.pos) AS "underdog",
    ARRAY_AGG(gf.ff_pts  ORDER BY gf.pos) AS "freefall",
    SUM(gf.fl_pts) AS fl_total
  FROM grid_final gf
  GROUP BY gf."betId"
)

SELECT
  br.id                                         AS id,
  br.id                                         AS "betId",
  br."userId",
  br."sessionId",
  ba."somaPos",
  ba."hailMary",
  ba."underdog",
  ba."freefall",

  CASE WHEN COALESCE(rc."allowFastestLap", true)
       THEN COALESCE(ba.fl_total, 0)
       ELSE 0
  END::int                                      AS "fastestLap",

  CASE WHEN COALESCE(rc."allowSafetyCar", true)
        AND (
          (br."predictedSC" >= 3 AND (s."scCount" + s."vscCount") >= 3)
          OR (br."predictedSC" < 3 AND br."predictedSC" = s."scCount" + s."vscCount")
        )
       THEN pts."ptsSafetyCar"
       ELSE 0
  END::int                                      AS "safetyCar",

  CASE WHEN COALESCE(rc."allowDNF", true)
        AND (
          (br."predictedDNF" >= 3 AND COALESCE(dc.cnt, 0) >= 3)
          OR (br."predictedDNF" < 3 AND br."predictedDNF" = COALESCE(dc.cnt, 0))
        )
       THEN pts."ptsDNF"
       ELSE 0
  END::int                                      AS "abandonos",

  (
    (
      COALESCE((SELECT SUM(v) FROM UNNEST(ba."somaPos") v), 0)
      + COALESCE((SELECT SUM(v) FROM UNNEST(ba."hailMary") v), 0)
      + COALESCE((SELECT SUM(v) FROM UNNEST(ba."underdog") v), 0)
      + COALESCE((SELECT SUM(v) FROM UNNEST(ba."freefall") v), 0)
      + CASE WHEN COALESCE(rc."allowFastestLap", true) THEN COALESCE(ba.fl_total, 0) ELSE 0 END
      + CASE WHEN COALESCE(rc."allowSafetyCar", true)
             AND (
               (br."predictedSC" >= 3 AND (s."scCount" + s."vscCount") >= 3)
               OR (br."predictedSC" < 3 AND br."predictedSC" = s."scCount" + s."vscCount")
             )
            THEN pts."ptsSafetyCar" ELSE 0 END
      + CASE WHEN COALESCE(rc."allowDNF", true)
             AND (
               (br."predictedDNF" >= 3 AND COALESCE(dc.cnt, 0) >= 3)
               OR (br."predictedDNF" < 3 AND br."predictedDNF" = COALESCE(dc.cnt, 0))
             )
            THEN pts."ptsDNF" ELSE 0 END
    ) * CASE WHEN br."doublePoints" AND COALESCE(rc."allowDoublePoints", true) THEN 2 ELSE 1 END
  )::int                                        AS "somaTotal"

FROM "BetRace" br
JOIN "Session"       s   ON s.id  = br."sessionId"
JOIN pts                   ON pts."seasonId" = s."seasonId"
LEFT JOIN "RaceConfig"  rc  ON rc."sessionId" = s.id
LEFT JOIN dnf_counts    dc  ON dc."sessionId" = s.id
LEFT JOIN bet_arrays    ba  ON ba."betId" = br.id;