CREATE OR REPLACE VIEW user_earnings_view AS

WITH
-- 1. Configuração de prêmios da temporada
season_config AS (
  SELECT
    sc."seasonId",
    sc."potStroll",
    sc."pctGps",
    sc."pctFinal",
    sc."gpPctP1", sc."gpPctP2", sc."gpPctP3",
    sc."finalPctP1", sc."finalPctP2", sc."finalPctP3", sc."finalPctP4", sc."finalPctP5"
  FROM "SeasonConfig" sc
),

-- 2. Contagem de participantes STROLL
stroll_count AS (
  SELECT COUNT(*) AS cnt
  FROM "User"
  WHERE category = 'STROLL'
),

-- 3. Cálculo dos pots base
total_pot AS (
  SELECT
    cfg."seasonId",
    cfg."potStroll" * sc.cnt                         AS total,
    (cfg."potStroll" * sc.cnt * cfg."pctGps")  / 100 AS gp_pot_total,
    (cfg."potStroll" * sc.cnt * cfg."pctFinal") / 100 AS final_pot_base,
    cfg."gpPctP1", cfg."gpPctP2", cfg."gpPctP3",
    cfg."finalPctP1", cfg."finalPctP2", cfg."finalPctP3", cfg."finalPctP4", cfg."finalPctP5"
  FROM season_config cfg
  CROSS JOIN stroll_count sc
),

-- 4. Total de GPs na temporada (RACE sessions, não cancelados + cancelados)
gp_count_total AS (
  SELECT
    s."seasonId",
    COUNT(DISTINCT s."grandPrixId") AS total_gps
  FROM "Session" s
  WHERE s.type = 'RACE'
  GROUP BY s."seasonId"
),

-- 5. GPs cancelados na temporada
cancelled_gps AS (
  SELECT
    s."seasonId",
    COUNT(DISTINCT s."grandPrixId") AS cancelled_count
  FROM "Session" s
  JOIN "GrandPrix" gp ON gp.id = s."grandPrixId"
  WHERE s.type = 'RACE'
    AND gp.cancelled = true
  GROUP BY s."seasonId"
),

-- 6. GPs não-cancelados que já tiveram resultados
gps_with_results AS (
  SELECT
    s."seasonId",
    COUNT(DISTINCT s."grandPrixId") AS completed_gps
  FROM "Session" s
  JOIN "SessionEntry" se ON se."sessionId" = s.id
  JOIN "GrandPrix" gp ON gp.id = s."grandPrixId"
  WHERE s.type IN ('RACE', 'SPRINT')
    AND NOT s.cancelled
    AND NOT gp.cancelled
  GROUP BY s."seasonId"
),

-- 7. Pot por GP e pot final ajustado (pot dos cancelados vai pro final)
per_gp_pot AS (
  SELECT
    tp."seasonId",
    COALESCE(gct.total_gps, 0)        AS total_gps,
    COALESCE(cgp.cancelled_count, 0)   AS cancelled_gps,
    COALESCE(gwr.completed_gps, 0)     AS completed_gps,
    -- GPs efetivos = total - cancelados
    COALESCE(gct.total_gps, 0) - COALESCE(cgp.cancelled_count, 0) AS effective_gps,
    -- Pot por GP: fixo = gp_pot_total / total_gps (não muda com cancelamentos)
    CASE
      WHEN COALESCE(gct.total_gps, 0) > 0
      THEN tp.gp_pot_total::numeric / gct.total_gps
      ELSE 0
    END AS gp_prize_pool,
    -- Pot final = base + pot dos GPs cancelados (que é gp_per_gp * cancelled)
    tp.final_pot_base + CASE
      WHEN COALESCE(gct.total_gps, 0) > 0
      THEN (tp.gp_pot_total::numeric / gct.total_gps) * COALESCE(cgp.cancelled_count, 0)
      ELSE 0
    END AS final_pot,
    tp."gpPctP1", tp."gpPctP2", tp."gpPctP3",
    tp."finalPctP1", tp."finalPctP2", tp."finalPctP3", tp."finalPctP4", tp."finalPctP5"
  FROM total_pot tp
  LEFT JOIN gp_count_total gct ON gct."seasonId" = tp."seasonId"
  LEFT JOIN cancelled_gps cgp ON cgp."seasonId" = tp."seasonId"
  LEFT JOIN gps_with_results gwr ON gwr."seasonId" = tp."seasonId"
),

-- 8. Pontos por GP por usuário STROLL (exclui GPs cancelados)
gp_user_totals AS (
  SELECT
    usv."userId",
    usv."seasonId",
    usv."grandPrixId",
    SUM(usv.points) AS gp_points
  FROM user_scores_view usv
  JOIN "GrandPrix" gp ON gp.id = usv."grandPrixId"
  WHERE usv.category = 'STROLL'
    AND NOT gp.cancelled
  GROUP BY usv."userId", usv."seasonId", usv."grandPrixId"
),

-- 9. Ranking por GP com DENSE_RANK (empates = mesmo rank)
gp_ranked AS (
  SELECT
    gut.*,
    DENSE_RANK() OVER (
      PARTITION BY gut."seasonId", gut."grandPrixId"
      ORDER BY gut.gp_points DESC
    ) AS rank
  FROM gp_user_totals gut
),

-- 10. Contagem de empatados por rank por GP
gp_tie_groups AS (
  SELECT
    gr."seasonId",
    gr."grandPrixId",
    gr.rank,
    COUNT(*) AS tied_count
  FROM gp_ranked gr
  WHERE gr.rank <= 3
  GROUP BY gr."seasonId", gr."grandPrixId", gr.rank
),

-- 11. Ganhos por GP: soma % das posições ocupadas, divide por tied_count
gp_earnings AS (
  SELECT
    gr."userId",
    gr."seasonId",
    gr."grandPrixId",
    gr.gp_points,
    gr.rank,
    CASE
      WHEN gr.rank > 3 THEN 0
      ELSE (
        pgp.gp_prize_pool * (
          CASE WHEN gr.rank <= 1 AND gr.rank + tg.tied_count - 1 >= 1 THEN pgp."gpPctP1" ELSE 0 END
        + CASE WHEN gr.rank <= 2 AND gr.rank + tg.tied_count - 1 >= 2 THEN pgp."gpPctP2" ELSE 0 END
        + CASE WHEN gr.rank <= 3 AND gr.rank + tg.tied_count - 1 >= 3 THEN pgp."gpPctP3" ELSE 0 END
        ) / 100.0 / tg.tied_count
      )
    END AS gp_earning
  FROM gp_ranked gr
  JOIN per_gp_pot pgp ON pgp."seasonId" = gr."seasonId"
  LEFT JOIN gp_tie_groups tg
    ON tg."seasonId" = gr."seasonId"
   AND tg."grandPrixId" = gr."grandPrixId"
   AND tg.rank = gr.rank
),

-- 12. Pontos totais da temporada por STROLL user (exclui GPs cancelados)
season_user_totals AS (
  SELECT
    usv."userId",
    usv."seasonId",
    SUM(usv.points) AS season_points
  FROM user_scores_view usv
  JOIN "GrandPrix" gp ON gp.id = usv."grandPrixId"
  WHERE usv.category = 'STROLL'
    AND NOT gp.cancelled
  GROUP BY usv."userId", usv."seasonId"
),

-- 13. Ranking geral da temporada
season_ranked AS (
  SELECT
    sut.*,
    DENSE_RANK() OVER (
      PARTITION BY sut."seasonId"
      ORDER BY sut.season_points DESC
    ) AS rank
  FROM season_user_totals sut
),

-- 14. Empates no ranking geral
season_tie_groups AS (
  SELECT
    sr."seasonId",
    sr.rank,
    COUNT(*) AS tied_count
  FROM season_ranked sr
  WHERE sr.rank <= 5
  GROUP BY sr."seasonId", sr.rank
),

-- 15. Prêmio final (só quando completed + cancelled = total, i.e. temporada acabou)
season_earnings AS (
  SELECT
    sr."userId",
    sr."seasonId",
    sr.rank,
    CASE
      WHEN (pgp.completed_gps + pgp.cancelled_gps) < pgp.total_gps THEN 0
      WHEN sr.rank > 5 THEN 0
      ELSE (
        pgp.final_pot::numeric * (
          CASE WHEN sr.rank <= 1 AND sr.rank + stg.tied_count - 1 >= 1 THEN pgp."finalPctP1" ELSE 0 END
        + CASE WHEN sr.rank <= 2 AND sr.rank + stg.tied_count - 1 >= 2 THEN pgp."finalPctP2" ELSE 0 END
        + CASE WHEN sr.rank <= 3 AND sr.rank + stg.tied_count - 1 >= 3 THEN pgp."finalPctP3" ELSE 0 END
        + CASE WHEN sr.rank <= 4 AND sr.rank + stg.tied_count - 1 >= 4 THEN pgp."finalPctP4" ELSE 0 END
        + CASE WHEN sr.rank <= 5 AND sr.rank + stg.tied_count - 1 >= 5 THEN pgp."finalPctP5" ELSE 0 END
        ) / 100.0 / stg.tied_count
      )
    END AS season_earning
  FROM season_ranked sr
  JOIN per_gp_pot pgp ON pgp."seasonId" = sr."seasonId"
  LEFT JOIN season_tie_groups stg
    ON stg."seasonId" = sr."seasonId"
   AND stg.rank = sr.rank
)

-- Output: uma row por (userId, grandPrixId) + totalEarning acumulado
SELECT
  ROW_NUMBER() OVER (ORDER BY ge."userId", ge."grandPrixId") AS id,
  ge."userId",
  ge."seasonId",
  ge."grandPrixId",
  ROUND(ge.gp_earning::numeric, 2)::float AS "gpEarning",
  ROUND(COALESCE(se.season_earning, 0)::numeric, 2)::float AS "seasonEarning",
  ROUND((
    SUM(ge.gp_earning) OVER (PARTITION BY ge."userId", ge."seasonId")
    + COALESCE(se.season_earning, 0)
  )::numeric, 2)::float AS "totalEarning"
FROM gp_earnings ge
LEFT JOIN season_earnings se
  ON se."userId" = ge."userId"
 AND se."seasonId" = ge."seasonId";
