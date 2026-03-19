CREATE OR REPLACE VIEW bet_sprint_results_view AS
WITH
-- 1. Configuração (Usando a mesma estrutura de Array do Race View)
pts AS (
  SELECT
    sc."seasonId",
    ARRAY[sc."sprintPtsP1", sc."sprintPtsP2", sc."sprintPtsP3", sc."sprintPtsP4",
          sc."sprintPtsP5", sc."sprintPtsP6", sc."sprintPtsP7", sc."sprintPtsP8"] AS sprint_pts
  FROM "SeasonConfig" sc
),

-- 2. Itens cruzados (Corrigido para LEFT JOIN e economizando joins futuros)
grid_detail AS (
  SELECT
    bg."betId",
    bg."predictedPosition" AS pos,
    bg."driverId",
    bs."sessionId",
    sess."seasonId",
    se."finishPosition"
  FROM "BetSprintGridItem" bg
  JOIN "BetSprint" bs ON bs.id = bg."betId"
  JOIN "Session" sess ON sess.id = bs."sessionId"
  -- PROTEÇÃO CONTRA DNS: Mantemos o LEFT JOIN para o array não encolher
  LEFT JOIN "SessionEntry" se ON se."sessionId" = bs."sessionId"
                             AND se."driverId"  = bg."driverId"
),

-- 3. Pontuação (Usando o índice do array, igual ao Race)
grid_scored AS (
  SELECT
    gd."betId",
    gd.pos,
    CASE
      WHEN gd."finishPosition" = gd.pos THEN pts.sprint_pts[gd.pos]
      ELSE 0
    END AS pos_pts
  FROM grid_detail gd
  JOIN pts ON pts."seasonId" = gd."seasonId"
),

-- 4. Agregação
bet_arrays AS (
  SELECT
    "betId",
    ARRAY_AGG(pos_pts ORDER BY pos) AS "somaPos",
    SUM(pos_pts) AS "somaTotal"
  FROM grid_scored
  GROUP BY "betId"
)

-- 5. Resultado Final (Baseado na tabela raiz)
SELECT
  bs.id                                         AS id,
  bs.id                                         AS "betId",
  bs."userId",
  bs."sessionId",
  ba."somaPos",
  COALESCE(ba."somaTotal", 0)::int              AS "somaTotal"
FROM "BetSprint" bs
LEFT JOIN bet_arrays ba ON ba."betId" = bs.id;