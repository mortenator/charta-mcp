-- Read-only RPC: validate API key and return current credit balance without decrementing.
-- Used by validateKeyAndFetchCredits middleware to check auth before work is done.
-- Credits are decremented separately via decrement_credits_by_api_key after success.

CREATE OR REPLACE FUNCTION get_credits_by_api_key(p_api_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_credits_remaining INT;
  v_plan TEXT;
BEGIN
  -- Look up the user by API key
  SELECT user_id INTO v_user_id
  FROM api_keys
  WHERE api_key = p_api_key AND revoked_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid API key');
  END IF;

  -- Fetch current credit balance and plan
  SELECT credits_remaining, plan INTO v_credits_remaining, v_plan
  FROM user_credits
  WHERE user_id = v_user_id;

  IF v_credits_remaining IS NULL OR v_credits_remaining <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Daily limit reached');
  END IF;

  RETURN json_build_object(
    'success', true,
    'credits_remaining', v_credits_remaining,
    'plan', v_plan
  );
END;
$$;
