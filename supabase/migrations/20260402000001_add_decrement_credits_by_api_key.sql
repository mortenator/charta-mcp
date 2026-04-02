-- Add atomic credit decrement function. This is intentionally separate from
-- get_credits_by_api_key to prevent TOCTOU race conditions:
--   1. check credits (get)
--   2. generate chart
--   3. decrement credits (this function)
--
-- The UPDATE...RETURNING statement + WHERE clause ensures the decrement is
-- atomic: if credits are already at 0, no rows are updated and result is 0.

CREATE OR REPLACE FUNCTION decrement_credits_by_api_key(p_api_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_credits_used INT;
  v_plan TEXT;
  v_limit INT;
  v_is_unlimited BOOLEAN;
BEGIN
  -- 1. Validate API key
  SELECT user_id INTO v_user_id
  FROM api_keys
  WHERE api_key = p_api_key AND revoked_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid API key');
  END IF;

  -- 2. Fetch current state and check for unlimited plan
  SELECT subscription_tier, daily_credits_used,
    CASE
      WHEN subscription_tier = 'business' THEN true
      ELSE false
    END
  INTO v_plan, v_credits_used, v_is_unlimited
  FROM user_credits
  WHERE user_id = v_user_id;

  IF v_is_unlimited THEN
    RETURN json_build_object('success', true, 'credits_remaining', 'unlimited');
  END IF;

  -- 3. Atomically update credits iff daily limit not reached
  UPDATE user_credits
  SET daily_credits_used = daily_credits_used + 1
  WHERE user_id = v_user_id AND (
    CASE
      WHEN subscription_tier = 'plus' THEN daily_credits_used < 20
      ELSE daily_credits_used < 5
    END
  )
  RETURNING daily_credits_used INTO v_credits_used;

  IF v_credits_used IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Daily limit reached');
  END IF;

  RETURN json_build_object('success', true, 'credits_remaining', (CASE WHEN v_plan = 'plus' THEN 20 ELSE 5 END) - v_credits_used);
END;
$$;
