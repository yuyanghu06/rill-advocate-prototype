-- Backfill ranking_score for all existing users using the canonical formula:
--   ranking_score = (total helper URLs across all blocks × 3) + (block count × 1)
--
-- This mirrors lib/ranking.ts: computeRankingScore()
--   const HELPER_URL_WEIGHT = 3;
--   const BLOCK_WEIGHT     = 1;

update user_profiles up
set ranking_score = coalesce(agg.helper_url_total, 0) * 3
                  + coalesce(agg.block_count, 0)      * 1
from (
  select
    user_id,
    count(*)                               as block_count,
    sum(cardinality(helper_urls))          as helper_url_total
  from experience_blocks
  group by user_id
) agg
where up.user_id = agg.user_id;

-- Also zero out any users with no blocks whose score is somehow non-zero.
update user_profiles
set ranking_score = 0
where ranking_score <> 0
  and user_id not in (select distinct user_id from experience_blocks);
