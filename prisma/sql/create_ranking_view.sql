CREATE OR REPLACE VIEW user_scores_view AS

WITH raw_scores AS (
  SELECT
    u.id          AS "userId",
    u.username,
    u.name,
    u.category,
    s."seasonId",
    s.id          AS "sessionId",
    s.type::text  AS "sessionType",
    gp.id         AS "grandPrixId",
    gp.name       AS "grandPrixName",
    brv."somaTotal" AS points

  FROM "BetRace" br
  JOIN "User"                  u   ON u.id  = br."userId"
  JOIN bet_race_results_view   brv ON brv."betId" = br.id
  JOIN "Session"               s   ON s.id  = br."sessionId"
  JOIN "GrandPrix"             gp  ON gp.id = s."grandPrixId"
  WHERE NOT gp.cancelled
    AND EXISTS (SELECT 1 FROM "SessionEntry" se WHERE se."sessionId" = s.id)

  UNION ALL

  SELECT
    u.id          AS "userId",
    u.username,
    u.name,
    u.category,
    s."seasonId",
    s.id          AS "sessionId",
    s.type::text  AS "sessionType",
    gp.id         AS "grandPrixId",
    gp.name       AS "grandPrixName",
    bsv."somaTotal" AS points

  FROM "BetSprint" bs
  JOIN "User"                  u   ON u.id  = bs."userId"
  JOIN bet_sprint_results_view bsv ON bsv."betId" = bs.id
  JOIN "Session"               s   ON s.id  = bs."sessionId"
  JOIN "GrandPrix"             gp  ON gp.id = s."grandPrixId"
  WHERE NOT gp.cancelled
    AND EXISTS (SELECT 1 FROM "SessionEntry" se WHERE se."sessionId" = s.id)
)

SELECT
  ROW_NUMBER() OVER (ORDER BY "userId", "sessionId") AS id,
  "userId",
  username,
  name,
  category,
  "seasonId",
  "sessionId",
  "sessionType",
  "grandPrixId",
  "grandPrixName",
  points,
  SUM(points) OVER (PARTITION BY "userId", "seasonId") AS "totalPoints"
FROM raw_scores;
