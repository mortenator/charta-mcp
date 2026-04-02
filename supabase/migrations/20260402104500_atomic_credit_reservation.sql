-- Atomic credit reservation: validates key, upserts user_credits row,
-- checks plan, and decrements in a single transaction.
-- Replaces the old get + decrement split that had a TOCTOU race.

-- Drop the split functions introduced earlier in this feature branch.
-- No external callers exist — these were only used by validateKeyAndFetchCredits
-- and consumeCredit, both of which are also removed in this commit.
DROP FUNCTION IF EXISTS get_credits_by_api_key(TEXT);
DROP FUNCTION IF EXISTS decrement_credits_by_api_key(TEXT);

CREATE OR REPLACE FUNCTION reserve_credit_by_api_key(p_api_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_plan TEXT;
  v_credits_used INT;
  v_credits_limit INT;
BEGIN
  -- 1. Validate API key → get user_id
  SELECT user_id INTO v_user_id
  FROM api_keys
  WHERE api_key = p_api_key AND revoked_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid API key');
  END IF;

  -- 2. Ensure user_credits row exists (solves missing-row bug)
  INSERT INTO user_credits (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Read plan and lock the row for the subsequent UPDATE.
  --    FOR UPDATE prevents concurrent requests from reading stale tier/credits.
  SELECT subscription_tier INTO v_plan
  FROM user_credits
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_plan = 'business' THEN
    RETURN json_build_object('success', true, 'credits_remaining', 'unlimited', 'plan', v_plan);
  END IF;

  -- 4. Determine limit for this plan
  -- NOTE: limits are hardcoded here for simplicity. If plan tiers change
  -- frequently, consider moving to a plan_limits table. Unknown/NULL tiers
  -- default to the free limit (5) as a safe fallback.
  v_credits_limit := CASE WHEN v_plan = 'plus' THEN 20 ELSE 5 END;

  -- 5. Atomic check-and-decrement in a single UPDATE (solves TOCTOU).
  --    The WHERE clause ensures we only increment if below the limit.
  --    If no rows match (already at limit), RETURNING yields NULL → limit reached.
  UPDATE user_credits
  SET daily_credits_used = daily_credits_used + 1
  WHERE user_id = v_user_id
    AND daily_credits_used < v_credits_limit
  RETURNING daily_credits_used INTO v_credits_used;

  IF v_credits_used IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Daily limit reached');
  END IF;

  RETURN json_build_object(
    'success', true,
    'credits_remaining', v_credits_limit - v_credits_used,
    'plan', v_plan
  );
END;
$$;
