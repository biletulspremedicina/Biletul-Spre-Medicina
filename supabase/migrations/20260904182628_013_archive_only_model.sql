/*
# Elimină sistemul de perioade de acces — trece la model exclusiv arhivă

## Ce se schimbă
1. start_at / end_at devin nullable (datele istorice se păstrează)
2. RLS nou pentru simulations: elevii văd doar is_active=true
3. RLS nou pentru questions: doar admin are SELECT direct (pentru a nu expune correct_answer)
4. RLS nou pentru attempts: free=nelimitat, premium=max 1 per user+sim
5. RLS nou pentru subscriptions: elevii nu pot crea/activa abonamente
6. Funcție SECURITY DEFINER get_exam_questions — întrebări FĂRĂ correct_answer/explanation
7. Funcție SECURITY DEFINER start_exam_attempt — creează sau continuă încercare
8. Funcție SECURITY DEFINER submit_exam_attempt — calculează scor server-side
9. Funcție SECURITY DEFINER get_attempt_results — întrebări CU correct_answer/explanation după finalizare
*/

-- 1. Face start_at și end_at nullable
ALTER TABLE public.simulations ALTER COLUMN start_at DROP NOT NULL;
ALTER TABLE public.simulations ALTER COLUMN end_at DROP NOT NULL;

-- 2. Politici RLS pentru simulations
DROP POLICY IF EXISTS "select_simulations" ON public.simulations;
DROP POLICY IF EXISTS "insert_simulations" ON public.simulations;
DROP POLICY IF EXISTS "update_simulations" ON public.simulations;
DROP POLICY IF EXISTS "delete_simulations" ON public.simulations;

CREATE POLICY "select_simulations" ON public.simulations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR is_active = true
  );

CREATE POLICY "insert_simulations" ON public.simulations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "update_simulations" ON public.simulations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "delete_simulations" ON public.simulations
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 3. Politici RLS pentru questions — doar admin are SELECT direct
DROP POLICY IF EXISTS "select_questions" ON public.questions;
DROP POLICY IF EXISTS "insert_questions" ON public.questions;
DROP POLICY IF EXISTS "update_questions" ON public.questions;
DROP POLICY IF EXISTS "delete_questions" ON public.questions;

CREATE POLICY "select_questions" ON public.questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "insert_questions" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "update_questions" ON public.questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "delete_questions" ON public.questions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 4. Politici RLS pentru attempts
DROP POLICY IF EXISTS "select_own_attempts" ON public.attempts;
DROP POLICY IF EXISTS "insert_own_attempt" ON public.attempts;
DROP POLICY IF EXISTS "update_own_attempt" ON public.attempts;
DROP POLICY IF EXISTS "delete_own_attempt" ON public.attempts;

CREATE POLICY "select_own_attempts" ON public.attempts
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "insert_own_attempt" ON public.attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.simulations s
      WHERE s.id = attempts.simulation_id AND s.is_active = true
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = attempts.simulation_id AND s.requires_subscription = false
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.simulations s
          WHERE s.id = attempts.simulation_id AND s.requires_subscription = true
        )
        AND EXISTS (
          SELECT 1 FROM public.subscriptions sub
          WHERE sub.user_id = auth.uid()
            AND sub.status = 'active'
            AND sub.end_at > now()
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.attempts a
          WHERE a.simulation_id = attempts.simulation_id
            AND a.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "update_own_attempt" ON public.attempts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_attempt" ON public.attempts
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 5. Politici RLS pentru subscriptions — elevii nu pot crea/activa
DROP POLICY IF EXISTS "select_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "insert_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "update_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "delete_own_subscriptions" ON public.subscriptions;

CREATE POLICY "select_own_subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "insert_own_subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "update_own_subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "delete_own_subscriptions" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 6. Funcție: get_exam_questions (FĂRĂ correct_answer/explanation)
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_simulation_id uuid)
RETURNS TABLE (
  id uuid,
  simulation_id uuid,
  type text,
  q_position integer,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_e text,
  statement_1 text,
  statement_2 text,
  statement_3 text,
  statement_4 text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.simulations s
    WHERE s.id = p_simulation_id AND s.is_active = true
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.simulations s
    WHERE s.id = p_simulation_id AND s.requires_subscription = true
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions sub
      WHERE sub.user_id = auth.uid()
        AND sub.status = 'active'
        AND sub.end_at > now()
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
    SELECT
      q.id, q.simulation_id, q.type, q.position,
      q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
      q.statement_1, q.statement_2, q.statement_3, q.statement_4
    FROM public.questions q
    WHERE q.simulation_id = p_simulation_id
    ORDER BY q.position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_questions TO authenticated;

-- 7. Funcție: start_exam_attempt
CREATE OR REPLACE FUNCTION public.start_exam_attempt(p_simulation_id uuid)
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
BEGIN
  SELECT * INTO v_sim FROM public.simulations WHERE id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN
    RAISE EXCEPTION 'Simularea nu este disponibilă';
  END IF;

  IF v_sim.requires_subscription = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions sub
      WHERE sub.user_id = auth.uid()
        AND sub.status = 'active'
        AND sub.end_at > now()
    ) THEN
      RAISE EXCEPTION 'Abonament necesar';
    END IF;

    SELECT * INTO v_existing FROM public.attempts
      WHERE simulation_id = p_simulation_id AND user_id = auth.uid()
      LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
        SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
        FROM public.attempts a WHERE a.id = v_existing.id;
      RETURN;
    END IF;
  ELSE
    SELECT * INTO v_existing FROM public.attempts
      WHERE simulation_id = p_simulation_id AND user_id = auth.uid()
        AND submitted_at IS NULL
      ORDER BY started_at DESC LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
        SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
        FROM public.attempts a WHERE a.id = v_existing.id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at)
  VALUES (auth.uid(), p_simulation_id, '{}'::jsonb, 0, 0, now())
  RETURNING id, user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired
  INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;

  RETURN QUERY
    SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_exam_attempt TO authenticated;

-- 8. Funcție: submit_exam_attempt (scor server-side)
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
  SELECT * INTO v_sim FROM public.simulations WHERE id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN
    RAISE EXCEPTION 'Simularea nu este disponibilă';
  END IF;

  IF v_sim.requires_subscription = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions sub
      WHERE sub.user_id = auth.uid()
        AND sub.status = 'active'
        AND sub.end_at > now()
    ) THEN
      RAISE EXCEPTION 'Abonament necesar';
    END IF;
  END IF;

  IF v_sim.requires_subscription = true THEN
    SELECT * INTO v_existing FROM public.attempts
      WHERE simulation_id = p_simulation_id AND user_id = auth.uid()
      LIMIT 1;
  ELSE
    SELECT * INTO v_existing FROM public.attempts
      WHERE simulation_id = p_simulation_id AND user_id = auth.uid()
        AND submitted_at IS NULL
      ORDER BY started_at DESC LIMIT 1;
  END IF;

  v_answers := COALESCE(p_answers, '{}'::jsonb);
  v_max := (SELECT count(*) FROM public.questions WHERE simulation_id = p_simulation_id);

  SELECT count(*) INTO v_score
    FROM public.questions q
    WHERE q.simulation_id = p_simulation_id
      AND (v_answers ->> q.id) = q.correct_answer;

  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL THEN
    UPDATE public.attempts SET
      answers = v_answers,
      score = v_score,
      max_score = v_max,
      submitted_at = now(),
      expired = p_expired
    WHERE id = v_existing.id AND user_id = auth.uid();

    RETURN QUERY
      SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
      FROM public.attempts a WHERE a.id = v_existing.id;
  ELSIF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NOT NULL THEN
    RETURN QUERY
      SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
      FROM public.attempts a WHERE a.id = v_existing.id;
  ELSE
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired)
    VALUES (auth.uid(), p_simulation_id, v_answers, v_score, v_max, now(), now(), p_expired)
    RETURNING id, user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired
    INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;

    RETURN QUERY
      SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_exam_attempt TO authenticated;

-- 9. Funcție: get_attempt_results (CU correct_answer/explanation)
CREATE OR REPLACE FUNCTION public.get_attempt_results(p_attempt_id uuid)
RETURNS TABLE (
  attempt_id uuid,
  sim_id uuid,
  answers jsonb,
  score integer,
  max_score integer,
  started_at timestamptz,
  submitted_at timestamptz,
  expired boolean,
  question_id uuid,
  q_type text,
  q_pos integer,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_e text,
  statement_1 text,
  statement_2 text,
  statement_3 text,
  statement_4 text,
  correct_answer text,
  explanation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_attempt FROM public.attempts WHERE id = p_attempt_id;
  IF NOT FOUND OR v_attempt.user_id != auth.uid() THEN
    RETURN;
  END IF;
  IF v_attempt.submitted_at IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      v_attempt.id, v_attempt.simulation_id, v_attempt.answers,
      v_attempt.score, v_attempt.max_score, v_attempt.started_at,
      v_attempt.submitted_at, v_attempt.expired,
      q.id, q.type, q.position, q.question_text,
      q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
      q.statement_1, q.statement_2, q.statement_3, q.statement_4,
      q.correct_answer, q.explanation
    FROM public.questions q
    WHERE q.simulation_id = v_attempt.simulation_id
    ORDER BY q.position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attempt_results TO authenticated;
