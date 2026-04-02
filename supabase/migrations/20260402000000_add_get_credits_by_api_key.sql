-- Migration to add API key auth + credit checks.
-- This function only CHECKS credits, it does not decrement them.
-- Credits are decremented separately via decrement_credits_by_api_key after success.

CREATE OR REPLACE FUNCTION get_credits_by_api_key(p_api_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_plan TEXT;
  v_is_unlimited BOOLEAN;
  v_credits_remaining INT;
BEGIN
  -- 1. Validate API key and get user_id
  SELECT user_id INTO v_user_id
  FROM api_keys
  WHERE api_key = p_api_key AND revoked_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid API key');
  END IF;

  -- 2. Fetch current credits + plan
  SELECT
    subscription_tier,
    CASE
      WHEN subscription_tier = 'business' THEN 999999
      WHEN subscription_tier = 'plus' THEN 20 - daily_credits_used
      ELSE 5 - daily_credits_used
    END as credits,
    CASE
      WHEN subscription_tier = 'business' THEN true
      ELSE false
    END as unlimited
  INTO v_plan, v_credits_remaining, v_is_unlimited
  FROM user_credits
  WHERE user_id = v_user_id;

  IF v_credits_remaining IS NULL THEN
    -- Fallback: user_credits row may not exist yet
    v_credits_remaining := 5;
    v_plan := 'free';
  END IF;

  IF NOT v_is_unlimited AND v_credits_remaining <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Daily limit reached');
  END IF;

  RETURN json_build_object(
    'success', true,
    'credits_remaining', v_credits_remaining,
    'plan', v_plan
  );
END;
$$;
