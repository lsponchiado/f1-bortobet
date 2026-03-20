WITH season_config AS (
  SELECT
    sc."seasonId",
    sc."potStroll",
    sc."pctGps",
    sc."pctFinal",
    sc."gpPctP1",
    sc."gpPctP2",
    sc."gpPctP3",
    sc."finalPctP1",
    sc."finalPctP2",
    sc."finalPctP3",
    sc."finalPctP4",
    sc."finalPctP5"
  FROM
    "SeasonConfig" sc
),
stroll_count AS (
  SELECT
    count(*) AS cnt
  FROM
    "User"
  WHERE
    ("User".category = 'STROLL' :: "Category")
),
total_pot AS (
  SELECT
    cfg."seasonId",
    (cfg."potStroll" * sc.cnt) AS total,
    (
      ((cfg."potStroll" * sc.cnt) * cfg."pctGps") / 100
    ) AS gp_pot_total,
    (
      ((cfg."potStroll" * sc.cnt) * cfg."pctFinal") / 100
    ) AS final_pot_base,
    cfg."gpPctP1",
    cfg."gpPctP2",
    cfg."gpPctP3",
    cfg."finalPctP1",
    cfg."finalPctP2",
    cfg."finalPctP3",
    cfg."finalPctP4",
    cfg."finalPctP5"
  FROM
    (
      season_config cfg
      CROSS JOIN stroll_count sc
    )
),
gp_count_total AS (
  SELECT
    s."seasonId",
    count(DISTINCT s."grandPrixId") AS total_gps
  FROM
    "Session" s
  WHERE
    (s.type = 'RACE' :: "SessionType")
  GROUP BY
    s."seasonId"
),
cancelled_gps AS (
  SELECT
    s."seasonId",
    count(DISTINCT s."grandPrixId") AS cancelled_count
  FROM
    (
      "Session" s
      JOIN "GrandPrix" gp ON ((gp.id = s."grandPrixId"))
    )
  WHERE
    (
      (s.type = 'RACE' :: "SessionType")
      AND (gp.cancelled = TRUE)
    )
  GROUP BY
    s."seasonId"
),
gps_with_results AS (
  SELECT
    s."seasonId",
    count(DISTINCT s."grandPrixId") AS completed_gps
  FROM
    (
      (
        "Session" s
        JOIN "SessionEntry" se_1 ON ((se_1."sessionId" = s.id))
      )
      JOIN "GrandPrix" gp ON ((gp.id = s."grandPrixId"))
    )
  WHERE
    (
      (
        s.type = ANY (
          ARRAY ['RACE'::"SessionType", 'SPRINT'::"SessionType"]
        )
      )
      AND (NOT s.cancelled)
      AND (NOT gp.cancelled)
    )
  GROUP BY
    s."seasonId"
),
per_gp_pot AS (
  SELECT
    tp."seasonId",
    COALESCE(gct.total_gps, (0) :: bigint) AS total_gps,
    COALESCE(cgp.cancelled_count, (0) :: bigint) AS cancelled_gps,
    COALESCE(gwr.completed_gps, (0) :: bigint) AS completed_gps,
    (
      COALESCE(gct.total_gps, (0) :: bigint) - COALESCE(cgp.cancelled_count, (0) :: bigint)
    ) AS effective_gps,
    CASE
      WHEN (COALESCE(gct.total_gps, (0) :: bigint) > 0) THEN (
        (tp.gp_pot_total) :: numeric / (gct.total_gps) :: numeric
      )
      ELSE (0) :: numeric
    END AS gp_prize_pool,
    (
      (tp.final_pot_base) :: numeric + CASE
        WHEN (COALESCE(gct.total_gps, (0) :: bigint) > 0) THEN (
          (
            (tp.gp_pot_total) :: numeric / (gct.total_gps) :: numeric
          ) * (COALESCE(cgp.cancelled_count, (0) :: bigint)) :: numeric
        )
        ELSE (0) :: numeric
      END
    ) AS final_pot,
    tp."gpPctP1",
    tp."gpPctP2",
    tp."gpPctP3",
    tp."finalPctP1",
    tp."finalPctP2",
    tp."finalPctP3",
    tp."finalPctP4",
    tp."finalPctP5"
  FROM
    (
      (
        (
          total_pot tp
          LEFT JOIN gp_count_total gct ON ((gct."seasonId" = tp."seasonId"))
        )
        LEFT JOIN cancelled_gps cgp ON ((cgp."seasonId" = tp."seasonId"))
      )
      LEFT JOIN gps_with_results gwr ON ((gwr."seasonId" = tp."seasonId"))
    )
),
gp_user_totals AS (
  SELECT
    usv."userId",
    usv."seasonId",
    usv."grandPrixId",
    sum(usv.points) AS gp_points
  FROM
    (
      user_scores_view usv
      JOIN "GrandPrix" gp ON ((gp.id = usv."grandPrixId"))
    )
  WHERE
    (
      (usv.category = 'STROLL' :: "Category")
      AND (NOT gp.cancelled)
    )
  GROUP BY
    usv."userId",
    usv."seasonId",
    usv."grandPrixId"
),
gp_ranked AS (
  SELECT
    gut."userId",
    gut."seasonId",
    gut."grandPrixId",
    gut.gp_points,
    dense_rank() OVER (
      PARTITION BY gut."seasonId",
      gut."grandPrixId"
      ORDER BY
        gut.gp_points DESC
    ) AS rank
  FROM
    gp_user_totals gut
),
gp_tie_groups AS (
  SELECT
    gr."seasonId",
    gr."grandPrixId",
    gr.rank,
    count(*) AS tied_count
  FROM
    gp_ranked gr
  WHERE
    (gr.rank <= 3)
  GROUP BY
    gr."seasonId",
    gr."grandPrixId",
    gr.rank
),
gp_earnings AS (
  SELECT
    gr."userId",
    gr."seasonId",
    gr."grandPrixId",
    gr.gp_points,
    gr.rank,
    CASE
      WHEN (gr.rank > 3) THEN (0) :: numeric
      ELSE (
        (
          (
            pgp.gp_prize_pool * (
              (
                (
                  CASE
                    WHEN (
                      (gr.rank <= 1)
                      AND (((gr.rank + tg.tied_count) - 1) >= 1)
                    ) THEN pgp."gpPctP1"
                    ELSE 0
                  END + CASE
                    WHEN (
                      (gr.rank <= 2)
                      AND (((gr.rank + tg.tied_count) - 1) >= 2)
                    ) THEN pgp."gpPctP2"
                    ELSE 0
                  END
                ) + CASE
                  WHEN (
                    (gr.rank <= 3)
                    AND (((gr.rank + tg.tied_count) - 1) >= 3)
                  ) THEN pgp."gpPctP3"
                  ELSE 0
                END
              )
            ) :: numeric
          ) / 100.0
        ) / (tg.tied_count) :: numeric
      )
    END AS gp_earning
  FROM
    (
      (
        gp_ranked gr
        JOIN per_gp_pot pgp ON ((pgp."seasonId" = gr."seasonId"))
      )
      LEFT JOIN gp_tie_groups tg ON (
        (
          (tg."seasonId" = gr."seasonId")
          AND (tg."grandPrixId" = gr."grandPrixId")
          AND (tg.rank = gr.rank)
        )
      )
    )
),
season_user_totals AS (
  SELECT
    usv."userId",
    usv."seasonId",
    sum(usv.points) AS season_points
  FROM
    (
      user_scores_view usv
      JOIN "GrandPrix" gp ON ((gp.id = usv."grandPrixId"))
    )
  WHERE
    (
      (usv.category = 'STROLL' :: "Category")
      AND (NOT gp.cancelled)
    )
  GROUP BY
    usv."userId",
    usv."seasonId"
),
season_ranked AS (
  SELECT
    sut."userId",
    sut."seasonId",
    sut.season_points,
    dense_rank() OVER (
      PARTITION BY sut."seasonId"
      ORDER BY
        sut.season_points DESC
    ) AS rank
  FROM
    season_user_totals sut
),
season_tie_groups AS (
  SELECT
    sr."seasonId",
    sr.rank,
    count(*) AS tied_count
  FROM
    season_ranked sr
  WHERE
    (sr.rank <= 5)
  GROUP BY
    sr."seasonId",
    sr.rank
),
season_earnings AS (
  SELECT
    sr."userId",
    sr."seasonId",
    sr.rank,
    CASE
      WHEN (
        (pgp.completed_gps + pgp.cancelled_gps) < pgp.total_gps
      ) THEN (0) :: numeric
      WHEN (sr.rank > 5) THEN (0) :: numeric
      ELSE (
        (
          (
            pgp.final_pot * (
              (
                (
                  (
                    (
                      CASE
                        WHEN (
                          (sr.rank <= 1)
                          AND (((sr.rank + stg.tied_count) - 1) >= 1)
                        ) THEN pgp."finalPctP1"
                        ELSE 0
                      END + CASE
                        WHEN (
                          (sr.rank <= 2)
                          AND (((sr.rank + stg.tied_count) - 1) >= 2)
                        ) THEN pgp."finalPctP2"
                        ELSE 0
                      END
                    ) + CASE
                      WHEN (
                        (sr.rank <= 3)
                        AND (((sr.rank + stg.tied_count) - 1) >= 3)
                      ) THEN pgp."finalPctP3"
                      ELSE 0
                    END
                  ) + CASE
                    WHEN (
                      (sr.rank <= 4)
                      AND (((sr.rank + stg.tied_count) - 1) >= 4)
                    ) THEN pgp."finalPctP4"
                    ELSE 0
                  END
                ) + CASE
                  WHEN (
                    (sr.rank <= 5)
                    AND (((sr.rank + stg.tied_count) - 1) >= 5)
                  ) THEN pgp."finalPctP5"
                  ELSE 0
                END
              )
            ) :: numeric
          ) / 100.0
        ) / (stg.tied_count) :: numeric
      )
    END AS season_earning
  FROM
    (
      (
        season_ranked sr
        JOIN per_gp_pot pgp ON ((pgp."seasonId" = sr."seasonId"))
      )
      LEFT JOIN season_tie_groups stg ON (
        (
          (stg."seasonId" = sr."seasonId")
          AND (stg.rank = sr.rank)
        )
      )
    )
)
SELECT
  row_number() OVER (
    ORDER BY
      ge."userId",
      ge."grandPrixId"
  ) AS id,
  ge."userId",
  ge."seasonId",
  ge."grandPrixId",
  (round(ge.gp_earning, 2)) :: double precision AS "gpEarning",
  (
    round(COALESCE(se.season_earning, (0) :: numeric), 2)
  ) :: double precision AS "seasonEarning",
  (
    round(
      (
        sum(ge.gp_earning) OVER (PARTITION BY ge."userId", ge."seasonId") + COALESCE(se.season_earning, (0) :: numeric)
      ),
      2
    )
  ) :: double precision AS "totalEarning"
FROM
  (
    gp_earnings ge
    LEFT JOIN season_earnings se ON (
      (
        (se."userId" = ge."userId")
        AND (se."seasonId" = ge."seasonId")
      )
    )
  );