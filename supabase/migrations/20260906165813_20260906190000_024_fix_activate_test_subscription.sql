/*
# Fix: activate_test_subscription — same ambiguous column fix
# Also rewrite to use scalar vars + CTE for INSERT
*/

DROP FUNCTION IF EXISTS public.activate_test_subscription();

CREATE OR REPLACE FUNCTION public.activate_test_subscription()
RETURNS TABLE (
  out_id uuid, out_user_id uuid, out_status text,
  out_start_at timestamptz, out_end_at timestamptz, out_amount_ron numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r_id uuid;
  r_user_id uuid;
  r_status text;
  r_start_at timestamptz;
  r_end_at timestamptz;
  r_amount_ron numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;

  -- Caută abonament activ existent
  SELECT s.id, s.user_id, s.status, s.start_at, s.end_at, s.amount_ron
    INTO r_id, r_user_id, r_status, r_start_at, r_end_at, r_amount_ron
  FROM public.subscriptions AS s
  WHERE s.user_id = auth.uid() AND s.status = 'active' AND s.end_at > now()
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT r_id, r_user_id, r_status, r_start_at, r_end_at, r_amount_ron;
    RETURN;
  END IF;

  -- Creează abonament nou de test folosind CTE pentru a evita ambiguitatea
  WITH ins AS (
    INSERT INTO public.subscriptions (user_id, status, start_at, end_at, amount_ron)
    VALUES (auth.uid(), 'active', now(), now() + interval '30 days', 0)
    RETURNING *
  )
  SELECT i.id, i.user_id, i.status, i.start_at, i.end_at, i.amount_ron
    INTO r_id, r_user_id, r_status, r_start_at, r_end_at, r_amount_ron
  FROM ins i;

  RETURN QUERY SELECT r_id, r_user_id, r_status, r_start_at, r_end_at, r_amount_ron;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_test_subscription() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_test_subscription() FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_test_subscription() TO authenticated;