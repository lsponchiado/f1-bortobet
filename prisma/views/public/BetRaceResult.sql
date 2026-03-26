WITH pts AS (
  SELECT
    sc."seasonId",
    ARRAY [sc."ptsP1", sc."ptsP2", sc."ptsP3", sc."ptsP4", sc."ptsP5", sc."ptsP6", sc."ptsP7", sc."ptsP8", sc."ptsP9", sc."ptsP10"] AS race_pts,
    sc."ptsHailMary",
    sc."ptsUnderdog",
    sc."ptsFreefall",
    sc."ptsFastestLap",
    sc."ptsSafetyCar",
    sc."ptsDNF"
  FROM
    "SeasonConfig" sc
),
dnf_counts AS (
  SELECT
    "SessionEntry"."sessionId",
    count(*) FILTER (
      WHERE
        "SessionEntry".dnf
    ) AS cnt
  FROM
    "SessionEntry"
  GROUP BY
    "SessionEntry"."sessionId"
),
grid_detail AS (
  SELECT
    bg."betId",
    bg."predictedPosition" AS pos,
    bg."driverId",
    bg."fastestLap" AS bet_fl,
    br_1."sessionId",
    se."startPosition",
    se."finishPosition",
    se.dnf,
    se."fastestLap" AS actual_fl
  FROM
    (
      (
        "BetRaceGridItem" bg
        JOIN "BetRace" br_1 ON ((br_1.id = bg."betId"))
      )
      LEFT JOIN "SessionEntry" se ON (
        (
          (se."sessionId" = br_1."sessionId")
          AND (se."driverId" = bg."driverId")
        )
      )
    )
),
grid_scored AS (
  SELECT
    gd."betId",
    gd."sessionId",
    gd.pos,
    CASE
      WHEN (gd."finishPosition" = gd.pos) THEN pts_1.race_pts [gd.pos]
      ELSE 0
    END AS pos_pts,
    CASE
      WHEN (
        gd.bet_fl
        AND gd.actual_fl
      ) THEN pts_1."ptsFastestLap"
      ELSE 0
    END AS fl_pts,
    CASE
      WHEN (
        (gd.pos <= 5)
        AND (gd."startPosition" >= 20)
        AND (gd."finishPosition" <= 5)
      ) THEN pts_1."ptsHailMary"
      ELSE 0
    END AS hm_raw,
    CASE
      WHEN (
        (gd.pos <= 3)
        AND ((gd."startPosition" - gd."finishPosition") >= 10)
        AND (gd."finishPosition" <= 3)
      ) THEN pts_1."ptsUnderdog"
      ELSE 0
    END AS ud_raw,
    CASE
      WHEN (
        ((gd.pos - gd."startPosition") >= 5)
        AND ((gd."finishPosition" - gd."startPosition") >= 5)
      ) THEN pts_1."ptsFreefall"
      ELSE 0
    END AS ff_raw
  FROM
    (
      (
        grid_detail gd
        JOIN "Session" s_1 ON ((s_1.id = gd."sessionId"))
      )
      JOIN pts pts_1 ON ((pts_1."seasonId" = s_1."seasonId"))
    )
),
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
    CASE
      WHEN (gs.hm_raw > 0) THEN row_number() OVER (
        PARTITION BY gs."betId",
        (gs.hm_raw > 0)
        ORDER BY
          gs.pos
      )
      ELSE NULL :: bigint
    END AS hm_rank,
    CASE
      WHEN (
        (gs.ud_raw > 0)
        AND (gs.hm_raw = 0)
      ) THEN row_number() OVER (
        PARTITION BY gs."betId",
        (
          (gs.ud_raw > 0)
          AND (gs.hm_raw = 0)
        )
        ORDER BY
          gs.pos
      )
      ELSE NULL :: bigint
    END AS ud_rank
  FROM
    grid_scored gs
),
grid_final AS (
  SELECT
    gl."betId",
    gl."sessionId",
    gl.pos,
    gl.pos_pts,
    gl.fl_pts,
    CASE
      WHEN (
        rc_1."allowHailMary"
        AND (gl.hm_raw > 0)
        AND (gl.hm_rank = 1)
      ) THEN gl.hm_raw
      ELSE 0
    END AS hm_pts,
    CASE
      WHEN (
        rc_1."allowUnderdog"
        AND (gl.ud_raw > 0)
        AND (gl.hm_raw = 0)
        AND (gl.ud_rank <= 3)
      ) THEN gl.ud_raw
      ELSE 0
    END AS ud_pts,
    CASE
      WHEN (
        rc_1."allowFreefall"
        AND (gl.ff_raw > 0)
        AND (gl.hm_raw = 0)
        AND (gl.ud_raw = 0)
      ) THEN gl.ff_raw
      ELSE 0
    END AS ff_pts
  FROM
    (
      grid_with_limits gl
      LEFT JOIN "RaceConfig" rc_1 ON ((rc_1."sessionId" = gl."sessionId"))
    )
),
bet_arrays AS (
  SELECT
    gf."betId",
    array_agg(
      gf.pos_pts
      ORDER BY
        gf.pos
    ) AS "somaPos",
    array_agg(
      gf.hm_pts
      ORDER BY
        gf.pos
    ) AS "hailMary",
    array_agg(
      gf.ud_pts
      ORDER BY
        gf.pos
    ) AS underdog,
    array_agg(
      gf.ff_pts
      ORDER BY
        gf.pos
    ) AS freefall,
    sum(gf.fl_pts) AS fl_total
  FROM
    grid_final gf
  GROUP BY
    gf."betId"
)
SELECT
  br.id,
  br.id AS "betId",
  br."userId",
  br."sessionId",
  ba."somaPos",
  ba."hailMary",
  ba.underdog,
  ba.freefall,
  (
    CASE
      WHEN COALESCE(rc."allowFastestLap", TRUE) THEN COALESCE(ba.fl_total, (0) :: bigint)
      ELSE (0) :: bigint
    END
  ) :: integer AS "fastestLap",
  CASE
    WHEN (
      COALESCE(rc."allowSafetyCar", TRUE)
      AND (
        (
          (br."predictedSC" >= 3)
          AND ((s."scCount" + s."vscCount") >= 3)
        )
        OR (
          (br."predictedSC" < 3)
          AND (br."predictedSC" = (s."scCount" + s."vscCount"))
        )
      )
    ) THEN pts."ptsSafetyCar"
    ELSE 0
  END AS "safetyCar",
  CASE
    WHEN (
      COALESCE(rc."allowDNF", TRUE)
      AND (
        (
          (br."predictedDNF" >= 3)
          AND (COALESCE(dc.cnt, (0) :: bigint) >= 3)
        )
        OR (
          (br."predictedDNF" < 3)
          AND (
            br."predictedDNF" = COALESCE(dc.cnt, (0) :: bigint)
          )
        )
      )
    ) THEN pts."ptsDNF"
    ELSE 0
  END AS abandonos,
  (
    (
      (
        (
          (
            (
              (
                COALESCE(
                  (
                    SELECT
                      sum(v.v) AS sum
                    FROM
                      unnest(ba."somaPos") v(v)
                  ),
                  (0) :: bigint
                ) + COALESCE(
                  (
                    SELECT
                      sum(v.v) AS sum
                    FROM
                      unnest(ba."hailMary") v(v)
                  ),
                  (0) :: bigint
                )
              ) + COALESCE(
                (
                  SELECT
                    sum(v.v) AS sum
                  FROM
                    unnest(ba.underdog) v(v)
                ),
                (0) :: bigint
              )
            ) + COALESCE(
              (
                SELECT
                  sum(v.v) AS sum
                FROM
                  unnest(ba.freefall) v(v)
              ),
              (0) :: bigint
            )
          ) + CASE
            WHEN COALESCE(rc."allowFastestLap", TRUE) THEN COALESCE(ba.fl_total, (0) :: bigint)
            ELSE (0) :: bigint
          END
        ) + CASE
          WHEN (
            COALESCE(rc."allowSafetyCar", TRUE)
            AND (
              (
                (br."predictedSC" >= 3)
                AND ((s."scCount" + s."vscCount") >= 3)
              )
              OR (
                (br."predictedSC" < 3)
                AND (br."predictedSC" = (s."scCount" + s."vscCount"))
              )
            )
          ) THEN pts."ptsSafetyCar"
          ELSE 0
        END
      ) + CASE
        WHEN (
          COALESCE(rc."allowDNF", TRUE)
          AND (
            (
              (br."predictedDNF" >= 3)
              AND (COALESCE(dc.cnt, (0) :: bigint) >= 3)
            )
            OR (
              (br."predictedDNF" < 3)
              AND (
                br."predictedDNF" = COALESCE(dc.cnt, (0) :: bigint)
              )
            )
          )
        ) THEN pts."ptsDNF"
        ELSE 0
      END
    ) * CASE
        WHEN (br."doublePoints" AND COALESCE(rc."allowDoublePoints", TRUE)) THEN 2
        ELSE 1
      END
  ) :: integer AS "somaTotal"
FROM
  (
    (
      (
        (
          (
            "BetRace" br
            JOIN "Session" s ON ((s.id = br."sessionId"))
          )
          JOIN pts ON ((pts."seasonId" = s."seasonId"))
        )
        LEFT JOIN "RaceConfig" rc ON ((rc."sessionId" = s.id))
      )
      LEFT JOIN dnf_counts dc ON ((dc."sessionId" = s.id))
    )
    LEFT JOIN bet_arrays ba ON ((ba."betId" = br.id))
  );