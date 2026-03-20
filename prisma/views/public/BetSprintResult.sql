WITH pts AS (
  SELECT
    sc."seasonId",
    ARRAY [sc."sprintPtsP1", sc."sprintPtsP2", sc."sprintPtsP3", sc."sprintPtsP4", sc."sprintPtsP5", sc."sprintPtsP6", sc."sprintPtsP7", sc."sprintPtsP8"] AS sprint_pts
  FROM
    "SeasonConfig" sc
),
grid_detail AS (
  SELECT
    bg."betId",
    bg."predictedPosition" AS pos,
    bg."driverId",
    bs_1."sessionId",
    sess."seasonId",
    se."finishPosition"
  FROM
    (
      (
        (
          "BetSprintGridItem" bg
          JOIN "BetSprint" bs_1 ON ((bs_1.id = bg."betId"))
        )
        JOIN "Session" sess ON ((sess.id = bs_1."sessionId"))
      )
      LEFT JOIN "SessionEntry" se ON (
        (
          (se."sessionId" = bs_1."sessionId")
          AND (se."driverId" = bg."driverId")
        )
      )
    )
),
grid_scored AS (
  SELECT
    gd."betId",
    gd.pos,
    CASE
      WHEN (gd."finishPosition" = gd.pos) THEN pts.sprint_pts [gd.pos]
      ELSE 0
    END AS pos_pts
  FROM
    (
      grid_detail gd
      JOIN pts ON ((pts."seasonId" = gd."seasonId"))
    )
),
bet_arrays AS (
  SELECT
    grid_scored."betId",
    array_agg(
      grid_scored.pos_pts
      ORDER BY
        grid_scored.pos
    ) AS "somaPos",
    sum(grid_scored.pos_pts) AS "somaTotal"
  FROM
    grid_scored
  GROUP BY
    grid_scored."betId"
)
SELECT
  bs.id,
  bs.id AS "betId",
  bs."userId",
  bs."sessionId",
  ba."somaPos",
  (COALESCE(ba."somaTotal", (0) :: bigint)) :: integer AS "somaTotal"
FROM
  (
    "BetSprint" bs
    LEFT JOIN bet_arrays ba ON ((ba."betId" = bs.id))
  );