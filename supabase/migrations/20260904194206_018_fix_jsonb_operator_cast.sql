/*
# Corectare operator jsonb ->> în submit_exam_attempt

Problema: `v_answers ->> q.id` eșuează pentru că `q.id` este uuid,
dar operatorul `->>` cere text. Se adaugă cast explicit `q.id::text`.
*/

CREATE OR REPLACE FUNCTION public.submit_exam_attempt(
  p_simulation_id uuid,
  p_answers jsonb DEFAULT NULL,
  p_expired boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  simulation_id uuid,
  answers jsonb,
  score integer,
  max_score integer,
  started_at timestamptz,
  submitted_at timestamptz,
  expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sim public.simulations%ROWTYPE;
  v_existing public.attempts%ROWTYPE;
  v_score integer := 0;
  v_max integer := 0;
  v_answers jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Trebuie să fii autentificat';
  END IF;

  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN
    RAISE EXCEPTION 'Simularea nu este disponibilă';
  END IF;

  IF v_sim.requires_subscription = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions AS sub
      WHERE sub.user_id = auth.uid()
        AND sub.status = 'active'
        AND sub.end_at > now()
    ) THEN
      RAISE EXCEPTION 'Abonament necesar';
    END IF;
  END IF;

  IF v_sim.requires_subscription = true THEN
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id
        AND a.user_id = auth.uid()
      FOR UPDATE
      LIMIT 1;
  ELSE
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id
        AND a.user_id = auth.uid()
        AND a.submitted_at IS NULL
      ORDER BY a.started_at DESC
      FOR UPDATE
      LIMIT 1;
  END IF;

  v_answers := COALESCE(p_answers, '{}'::jsonb);
  v_max := (SELECT count(*) FROM public.questions AS q WHERE q.simulation_id = p_simulation_id);

  SELECT count(*) INTO v_score
    FROM public.questions AS q
    WHERE q.simulation_id = p_simulation_id
      AND (v_answers ->> q.id::text) = q.correct_answer;

  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL THEN
    UPDATE public.attempts AS att SET
      answers = v_answers,
      score = v_score,
      max_score = v_max,
      submitted_at = now(),
      expired = p_expired
    WHERE att.id = v_existing.id AND att.user_id = auth.uid();

    RETURN QUERY
      SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
      FROM public.attempts AS a WHERE a.id = v_existing.id;
  ELSIF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NOT NULL THEN
    RETURN QUERY
      SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
      FROM public.attempts AS a WHERE a.id = v_existing.id;
  ELSE
    INSERT INTO public.attempts AS att (user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired)
    VALUES (auth.uid(), p_simulation_id, v_answers, v_score, v_max, now(), now(), p_expired)
    RETURNING att.id, att.user_id, att.simulation_id, att.answers, att.score, att.max_score, att.started_at, att.submitted_at, att.expired
    INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;

    RETURN QUERY
      SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) TO authenticated;
