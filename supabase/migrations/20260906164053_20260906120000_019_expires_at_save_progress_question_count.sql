/*
# Timer fix, auto-save progress, question count RPC, premium unique constraint
*/

-- 1. Adaugă expires_at și attempt_requires_sub pe attempts
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS attempt_requires_sub boolean NOT NULL DEFAULT false;

-- Backfill: expires_at = started_at + duration_minutes
UPDATE public.attempts AS att
  SET expires_at = att.started_at + (s.duration_minutes * interval '1 minute')
  FROM public.simulations AS s
  WHERE att.simulation_id = s.id AND att.expires_at IS NULL;

-- Backfill: attempt_requires_sub din simulare
UPDATE public.attempts AS att
  SET attempt_requires_sub = s.requires_subscription
  FROM public.simulations AS s
  WHERE att.simulation_id = s.id;

CREATE INDEX IF NOT EXISTS idx_attempts_expires_at ON public.attempts(expires_at);

-- 2. DROP funcții vechi (schimbă return type — adaugă expires_at)
DROP FUNCTION IF EXISTS public.start_exam_attempt(uuid);
DROP FUNCTION IF EXISTS public.submit_exam_attempt(uuid, jsonb, boolean);

-- 3. Index unic parțial: doar premium, doar non-retake
CREATE UNIQUE INDEX IF NOT EXISTS uniq_premium_attempt_per_user_sim
  ON public.attempts (user_id, simulation_id)
  WHERE is_archive_retake = false AND attempt_requires_sub = true;

-- 4. RPC: get_exam_question_count
CREATE OR REPLACE FUNCTION public.get_exam_question_count(p_simulation_id uuid)
RETURNS TABLE (sim_id uuid, question_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sim public.simulations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN RETURN; END IF;
  RETURN QUERY
    SELECT s.id, COUNT(q.id) AS question_count
    FROM public.simulations AS s
    LEFT JOIN public.questions AS q ON q.simulation_id = s.id
    WHERE s.id = p_simulation_id
    GROUP BY s.id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_exam_question_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_question_count(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_exam_question_count(uuid) TO authenticated;

-- 5. RPC: save_attempt_progress
CREATE OR REPLACE FUNCTION public.save_attempt_progress(p_attempt_id uuid, p_answers jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_sim public.simulations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;
  SELECT * INTO v_attempt FROM public.attempts AS a WHERE a.id = p_attempt_id;
  IF NOT FOUND OR v_attempt.user_id != auth.uid() THEN RAISE EXCEPTION 'Încercarea nu a fost găsită'; END IF;
  IF v_attempt.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Încercarea este deja finalizată'; END IF;
  IF v_attempt.expires_at IS NOT NULL AND v_attempt.expires_at < now() THEN RAISE EXCEPTION 'Timpul a expirat'; END IF;
  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = v_attempt.simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN RAISE EXCEPTION 'Simularea nu este disponibilă'; END IF;
  UPDATE public.attempts AS att SET answers = p_answers
    WHERE att.id = p_attempt_id AND att.user_id = auth.uid();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.save_attempt_progress(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_attempt_progress(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_attempt_progress(uuid, jsonb) TO authenticated;

-- 6. start_exam_attempt (cu expires_at)
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
  v_existing public.attempts%ROWTYPE;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;
  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN RAISE EXCEPTION 'Simularea nu este disponibilă'; END IF;

  IF v_sim.requires_subscription = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions AS sub
      WHERE sub.user_id = auth.uid() AND sub.status = 'active' AND sub.end_at > now()
    ) THEN RAISE EXCEPTION 'Abonament necesar'; END IF;

    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id AND a.user_id = auth.uid() AND a.is_archive_retake = false
      FOR UPDATE LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
        a.started_at, a.submitted_at, a.expired, a.expires_at
        FROM public.attempts AS a WHERE a.id = v_existing.id;
      RETURN;
    END IF;

    v_expires_at := now() + (v_sim.duration_minutes * interval '1 minute');
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at, expires_at, is_archive_retake, attempt_requires_sub)
    VALUES (auth.uid(), p_simulation_id, '{}'::jsonb, 0, 0, now(), v_expires_at, false, true)
    RETURNING id, user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired, expires_at
    INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers,
         v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at,
         v_existing.expired, v_existing.expires_at;
    RETURN QUERY SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers,
      v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at,
      v_existing.expired, v_existing.expires_at;
  ELSE
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id AND a.user_id = auth.uid() AND a.submitted_at IS NULL
      ORDER BY a.started_at DESC FOR UPDATE LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
        a.started_at, a.submitted_at, a.expired, a.expires_at
        FROM public.attempts AS a WHERE a.id = v_existing.id;
      RETURN;
    END IF;

    v_expires_at := now() + (v_sim.duration_minutes * interval '1 minute');
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at, expires_at, is_archive_retake, attempt_requires_sub)
    VALUES (auth.uid(), p_simulation_id, '{}'::jsonb, 0, 0, now(), v_expires_at, false, false)
    RETURNING id, user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired, expires_at
    INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers,
         v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at,
         v_existing.expired, v_existing.expires_at;
    RETURN QUERY SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers,
      v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at,
      v_existing.expired, v_existing.expires_at;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;

-- 7. submit_exam_attempt (cu validare expirare server-side)
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
  v_existing public.attempts%ROWTYPE;
  v_score integer := 0;
  v_max integer := 0;
  v_answers jsonb;
  v_is_expired boolean := false;
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
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id AND a.user_id = auth.uid() AND a.is_archive_retake = false
      FOR UPDATE LIMIT 1;
  ELSE
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id AND a.user_id = auth.uid() AND a.submitted_at IS NULL
      ORDER BY a.started_at DESC FOR UPDATE LIMIT 1;
  END IF;

  IF v_existing.expires_at IS NOT NULL AND v_existing.expires_at < now() THEN
    v_is_expired := true;
  END IF;

  v_answers := COALESCE(p_answers, v_existing.answers, '{}'::jsonb);
  v_max := (SELECT count(*) FROM public.questions AS q WHERE q.simulation_id = p_simulation_id);
  SELECT count(*) INTO v_score
    FROM public.questions AS q
    WHERE q.simulation_id = p_simulation_id AND (v_answers ->> q.id::text) = q.correct_answer;

  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL THEN
    UPDATE public.attempts AS att SET
      answers = v_answers, score = v_score, max_score = v_max,
      submitted_at = now(), expired = (p_expired OR v_is_expired)
    WHERE att.id = v_existing.id AND att.user_id = auth.uid();
    RETURN QUERY SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
      a.started_at, a.submitted_at, a.expired, a.expires_at
      FROM public.attempts AS a WHERE a.id = v_existing.id;
  ELSIF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NOT NULL THEN
    RETURN QUERY SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score,
      a.started_at, a.submitted_at, a.expired, a.expires_at
      FROM public.attempts AS a WHERE a.id = v_existing.id;
  ELSE
    INSERT INTO public.attempts AS att (user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired, expires_at, attempt_requires_sub)
    VALUES (auth.uid(), p_simulation_id, v_answers, v_score, v_max, now(), now(), (p_expired OR v_is_expired),
            now() + (v_sim.duration_minutes * interval '1 minute'), v_sim.requires_subscription)
    RETURNING att.id, att.user_id, att.simulation_id, att.answers, att.score, att.max_score,
              att.started_at, att.submitted_at, att.expired, att.expires_at
    INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers,
         v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at,
         v_existing.expired, v_existing.expires_at;
    RETURN QUERY SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers,
      v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at,
      v_existing.expired, v_existing.expires_at;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) TO authenticated;