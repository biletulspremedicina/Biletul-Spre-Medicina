/*
# Fix: jsonb ->> uuid operator error in practice RPCs

The `->>` operator requires text keys, but `v_q_id` is declared as uuid.
Fix: cast `v_q_id::text` when extracting from jsonb in submit_practice_attempt.
Also apply the same fix to start_practice_attempt (answers extraction is fine
since it reads whole jsonb, but the pattern is consistent).
*/

-- 5.7 submit_practice_attempt (fixed)
CREATE OR REPLACE FUNCTION public.submit_practice_attempt(
  p_set_id uuid,
  p_answers jsonb
)
RETURNS TABLE (
  out_id uuid,
  out_set_id uuid,
  out_score integer,
  out_max_score integer,
  out_started_at timestamptz,
  out_submitted_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt_id uuid;
  v_score integer := 0;
  v_max integer := 0;
  v_q_id uuid;
  v_correct text;
  v_user_ans text;
  v_started_at timestamptz;
  v_submitted_at timestamptz;
  v_requires_sub boolean;
  v_has_sub boolean;
  v_set_active boolean;
  v_lesson_active boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie sa fii autentificat'; END IF;

  SELECT ps.requires_subscription, ps.is_active INTO v_requires_sub, v_set_active
  FROM public.practice_sets ps WHERE ps.id = p_set_id;
  IF NOT FOUND OR NOT v_set_active THEN RAISE EXCEPTION 'Setul nu este disponibil'; END IF;

  SELECT pl.is_active INTO v_lesson_active
  FROM public.practice_lessons pl
  JOIN public.practice_sets ps ON ps.lesson_id = pl.id
  WHERE ps.id = p_set_id;
  IF NOT v_lesson_active THEN RAISE EXCEPTION 'Lectia nu este disponibila'; END IF;

  IF v_requires_sub THEN
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid() AND s.status = 'active' AND s.end_at > now()
    ) INTO v_has_sub;
    IF NOT v_has_sub THEN RAISE EXCEPTION 'Abonament necesar pentru a accesa acest set'; END IF;
  END IF;

  SELECT pa.id INTO v_attempt_id
  FROM public.practice_attempts pa
  WHERE pa.set_id = p_set_id AND pa.user_id = auth.uid() AND pa.submitted_at IS NULL
  ORDER BY pa.started_at DESC LIMIT 1;

  FOR v_q_id, v_correct IN
    SELECT pq.id, pq.correct_answer FROM public.practice_questions pq
    WHERE pq.set_id = p_set_id ORDER BY pq.position ASC
  LOOP
    v_max := v_max + 1;
    v_user_ans := p_answers ->> (v_q_id::text);
    IF v_user_ans = v_correct THEN v_score := v_score + 1; END IF;
  END LOOP;

  IF v_attempt_id IS NOT NULL THEN
    UPDATE public.practice_attempts
    SET answers = p_answers, score = v_score, max_score = v_max, submitted_at = now()
    WHERE id = v_attempt_id AND user_id = auth.uid();
    SELECT pa.started_at, pa.submitted_at INTO v_started_at, v_submitted_at
    FROM public.practice_attempts pa WHERE pa.id = v_attempt_id;
  ELSE
    WITH ins AS (
      INSERT INTO public.practice_attempts (user_id, set_id, answers, score, max_score, started_at, submitted_at)
      VALUES (auth.uid(), p_set_id, p_answers, v_score, v_max, now(), now())
      RETURNING id, started_at, submitted_at
    )
    SELECT i.id, i.started_at, i.submitted_at INTO v_attempt_id, v_started_at, v_submitted_at FROM ins i;
  END IF;

  RETURN QUERY SELECT v_attempt_id, p_set_id, v_score, v_max, v_started_at, v_submitted_at;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_practice_attempt(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_practice_attempt(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_practice_attempt(uuid, jsonb) TO authenticated;
