/*
# Fix: return columns with proper names for frontend compatibility
*/

-- 1. start_exam_attempt
CREATE OR REPLACE FUNCTION public.start_exam_attempt(p_simulation_id uuid)
RETURNS TABLE (
  id uuid, user_id uuid, simulation_id uuid, answers jsonb,
  score integer, max_score integer, started_at timestamptz,
  submitted_at timestamptz, expired boolean, expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sim public.simulations%ROWTYPE;
  r_id uuid;
  r_user_id uuid;
  r_sim_id uuid;
  r_answers jsonb;
  r_score integer;
  r_max_score integer;
  r_started_at timestamptz;
  r_submitted_at timestamptz;
  r_expired boolean;
  r_expires_at timestamptz;
  r_is_archive_retake boolean;
  v_calc_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;
  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN RAISE EXCEPTION 'Simularea nu este disponibilă'; END IF;

  IF v_sim.requires_subscription = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions AS sub
      WHERE sub.user_id = auth.uid() AND sub.status = 'active' AND sub.end_at > now()
    ) THEN RAISE EXCEPTION 'Abonament necesar'; END IF;

    SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
           a.started_at, a.submitted_at, a.expired, a.expires_at, a.is_archive_retake
      INTO r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
           r_started_at, r_submitted_at, r_expired, r_expires_at, r_is_archive_retake
    FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id AND a.user_id = auth.uid() AND a.is_archive_retake = false
      FOR UPDATE LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
        r_started_at, r_submitted_at, r_expired, r_expires_at;
      RETURN;
    END IF;

    v_calc_expires := now() + (v_sim.duration_minutes * interval '1 minute');
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at, expires_at, is_archive_retake, attempt_requires_sub)
    VALUES (auth.uid(), p_simulation_id, '{}'::jsonb, 0, 0, now(), v_calc_expires, false, true)
    RETURNING id, user_id, simulation_id, answers, score, max_score,
              started_at, submitted_at, expired, expires_at
    INTO r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
         r_started_at, r_submitted_at, r_expired, r_expires_at;

    RETURN QUERY SELECT r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
      r_started_at, r_submitted_at, r_expired, r_expires_at;
  ELSE
    SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
           a.started_at, a.submitted_at, a.expired, a.expires_at, a.is_archive_retake
      INTO r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
           r_started_at, r_submitted_at, r_expired, r_expires_at, r_is_archive_retake
    FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id AND a.user_id = auth.uid() AND a.submitted_at IS NULL
      ORDER BY a.started_at DESC FOR UPDATE LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
        r_started_at, r_submitted_at, r_expired, r_expires_at;
      RETURN;
    END IF;

    v_calc_expires := now() + (v_sim.duration_minutes * interval '1 minute');
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at, expires_at, is_archive_retake, attempt_requires_sub)
    VALUES (auth.uid(), p_simulation_id, '{}'::jsonb, 0, 0, now(), v_calc_expires, false, false)
    RETURNING id, user_id, simulation_id, answers, score, max_score,
              started_at, submitted_at, expired, expires_at
    INTO r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
         r_started_at, r_submitted_at, r_expired, r_expires_at;

    RETURN QUERY SELECT r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
      r_started_at, r_submitted_at, r_expired, r_expires_at;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;

-- 2. submit_exam_attempt
CREATE OR REPLACE FUNCTION public.submit_exam_attempt(
  p_simulation_id uuid, p_answers jsonb DEFAULT NULL, p_expired boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, user_id uuid, simulation_id uuid, answers jsonb,
  score integer, max_score integer, started_at timestamptz,
  submitted_at timestamptz, expired boolean, expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sim public.simulations%ROWTYPE;
  r_id uuid;
  r_user_id uuid;
  r_sim_id uuid;
  r_answers jsonb;
  r_score integer;
  r_max_score integer;
  r_started_at timestamptz;
  r_submitted_at timestamptz;
  r_expired boolean;
  r_expires_at timestamptz;
  v_calc_score integer := 0;
  v_calc_max integer := 0;
  v_final_answers jsonb;
  v_is_expired boolean := false;
  v_calc_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;
  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN RAISE EXCEPTION 'Simularea nu este disponibilă'; END IF;

  IF v_sim.requires_subscription = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions AS sub
      WHERE sub.user_id = auth.uid() AND sub.status = 'active' AND sub.end_at > now()
    ) THEN RAISE EXCEPTION 'Abonament necesar'; END IF;
  END IF;

  IF v_sim.requires_subscription = true THEN
    SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
           a.started_at, a.submitted_at, a.expired, a.expires_at
      INTO r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
           r_started_at, r_submitted_at, r_expired, r_expires_at
    FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id AND a.user_id = auth.uid() AND a.is_archive_retake = false
      FOR UPDATE LIMIT 1;
  ELSE
    SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
           a.started_at, a.submitted_at, a.expired, a.expires_at
      INTO r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
           r_started_at, r_submitted_at, r_expired, r_expires_at
    FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id AND a.user_id = auth.uid() AND a.submitted_at IS NULL
      ORDER BY a.started_at DESC FOR UPDATE LIMIT 1;
  END IF;

  IF r_expires_at IS NOT NULL AND r_expires_at < now() THEN
    v_is_expired := true;
  END IF;

  v_final_answers := COALESCE(p_answers, r_answers, '{}'::jsonb);
  v_calc_max := (SELECT count(*) FROM public.questions AS q WHERE q.simulation_id = p_simulation_id);
  SELECT count(*) INTO v_calc_score
    FROM public.questions AS q
    WHERE q.simulation_id = p_simulation_id AND (v_final_answers ->> q.id::text) = q.correct_answer;

  IF r_id IS NOT NULL AND r_submitted_at IS NULL THEN
    UPDATE public.attempts AS att SET
      answers = v_final_answers, score = v_calc_score, max_score = v_calc_max,
      submitted_at = now(), expired = (p_expired OR v_is_expired)
    WHERE att.id = r_id AND att.user_id = auth.uid();
    RETURN QUERY SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
      a.started_at, a.submitted_at, a.expired, a.expires_at
      FROM public.attempts AS a WHERE a.id = r_id;
  ELSIF r_id IS NOT NULL AND r_submitted_at IS NOT NULL THEN
    RETURN QUERY SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
      a.started_at, a.submitted_at, a.expired, a.expires_at
      FROM public.attempts AS a WHERE a.id = r_id;
  ELSE
    v_calc_expires := now() + (v_sim.duration_minutes * interval '1 minute');
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired, expires_at, attempt_requires_sub)
    VALUES (auth.uid(), p_simulation_id, v_final_answers, v_calc_score, v_calc_max, now(), now(), (p_expired OR v_is_expired),
            v_calc_expires, v_sim.requires_subscription)
    RETURNING id, user_id, simulation_id, answers, score, max_score,
              started_at, submitted_at, expired, expires_at
    INTO r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
         r_started_at, r_submitted_at, r_expired, r_expires_at;
    RETURN QUERY SELECT r_id, r_user_id, r_sim_id, r_answers, r_score, r_max_score,
      r_started_at, r_submitted_at, r_expired, r_expires_at;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) TO authenticated;