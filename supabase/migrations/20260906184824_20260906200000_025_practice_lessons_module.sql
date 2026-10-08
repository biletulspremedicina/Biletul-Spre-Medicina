/*
# Grile pe lecții — Practice Module (fixed v2)

Creates a completely new "Grile pe lecții" module, separate from simulations.
Students practice question sets organized by lessons, unlimited attempts, no timer.

## New Tables
1. practice_lessons — lessons (id, title, description, subject, position, is_active)
2. practice_sets — sets within lessons (id, lesson_id, title, target_question_count, requires_subscription, position, is_active)
3. practice_questions — questions within sets (same CS/CG structure as questions table)
4. practice_attempts — student attempts (unlimited, no timer)

## Security
- RLS on all tables
- Admin: full CRUD via is_admin() helper
- Students: active lessons, active sets in active lessons, own attempts only
- practice_questions: NO student direct SELECT — RPC only
- 9 SECURITY DEFINER RPC functions with p_ params, out_ columns, qualified aliases
*/

-- ============================================================================
-- 1. TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.practice_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  subject text DEFAULT 'Biologie',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.practice_lessons ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.practice_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.practice_lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  target_question_count integer NOT NULL DEFAULT 1,
  requires_subscription boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_question_count > 0)
);
ALTER TABLE public.practice_sets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.practice_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('CS','CG')),
  position integer NOT NULL DEFAULT 0,
  question_text text NOT NULL,
  option_a text DEFAULT '',
  option_b text DEFAULT '',
  option_c text DEFAULT '',
  option_d text DEFAULT '',
  option_e text DEFAULT '',
  statement_1 text DEFAULT '',
  statement_2 text DEFAULT '',
  statement_3 text DEFAULT '',
  statement_4 text DEFAULT '',
  correct_answer text NOT NULL CHECK (correct_answer IN ('A','B','C','D','E')),
  explanation text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.practice_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_practice_lessons_position ON public.practice_lessons(position);
CREATE INDEX IF NOT EXISTS idx_practice_sets_lesson_position ON public.practice_sets(lesson_id, position);
CREATE INDEX IF NOT EXISTS idx_practice_questions_set_position ON public.practice_questions(set_id, position);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_set ON public.practice_attempts(user_id, set_id);

-- ============================================================================
-- 3. HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- practice_lessons
DROP POLICY IF EXISTS "admin_all_practice_lessons" ON public.practice_lessons;
CREATE POLICY "admin_all_practice_lessons" ON public.practice_lessons
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "student_select_active_lessons" ON public.practice_lessons;
CREATE POLICY "student_select_active_lessons" ON public.practice_lessons
  FOR SELECT TO authenticated USING (is_active = true);

-- practice_sets
DROP POLICY IF EXISTS "admin_all_practice_sets" ON public.practice_sets;
CREATE POLICY "admin_all_practice_sets" ON public.practice_sets
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "student_select_active_sets" ON public.practice_sets;
CREATE POLICY "student_select_active_sets" ON public.practice_sets
  FOR SELECT TO authenticated USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.practice_lessons pl
      WHERE pl.id = practice_sets.lesson_id AND pl.is_active = true
    )
  );

-- practice_questions: admin only — students use RPC
DROP POLICY IF EXISTS "admin_all_practice_questions" ON public.practice_questions;
CREATE POLICY "admin_all_practice_questions" ON public.practice_questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- practice_attempts
DROP POLICY IF EXISTS "admin_all_practice_attempts" ON public.practice_attempts;
CREATE POLICY "admin_all_practice_attempts" ON public.practice_attempts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "student_select_own_attempts" ON public.practice_attempts;
CREATE POLICY "student_select_own_attempts" ON public.practice_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "student_insert_own_attempts" ON public.practice_attempts;
CREATE POLICY "student_insert_own_attempts" ON public.practice_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "student_update_own_attempts" ON public.practice_attempts;
CREATE POLICY "student_update_own_attempts" ON public.practice_attempts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 5. RPC FUNCTIONS
-- ============================================================================

-- 5.1 get_practice_lessons
CREATE OR REPLACE FUNCTION public.get_practice_lessons()
RETURNS TABLE (
  out_id uuid,
  out_title text,
  out_description text,
  out_subject text,
  out_position integer,
  out_set_count bigint,
  out_question_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie sa fii autentificat'; END IF;

  RETURN QUERY
  SELECT
    pl.id,
    pl.title,
    pl.description,
    pl.subject,
    pl.position,
    (SELECT COUNT(*) FROM public.practice_sets ps WHERE ps.lesson_id = pl.id AND ps.is_active = true),
    (SELECT COUNT(*) FROM public.practice_questions pq
     JOIN public.practice_sets ps ON ps.id = pq.set_id
     WHERE ps.lesson_id = pl.id AND ps.is_active = true)
  FROM public.practice_lessons pl
  WHERE pl.is_active = true
  ORDER BY pl.position ASC, pl.created_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_lessons() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_lessons() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_lessons() TO authenticated;

-- 5.2 get_practice_sets
CREATE OR REPLACE FUNCTION public.get_practice_sets(p_lesson_id uuid)
RETURNS TABLE (
  out_id uuid,
  out_title text,
  out_description text,
  out_target_question_count integer,
  out_requires_subscription boolean,
  out_position integer,
  out_question_count bigint,
  out_attempt_count bigint,
  out_best_score integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie sa fii autentificat'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.practice_lessons pl
    WHERE pl.id = p_lesson_id AND pl.is_active = true
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.title,
    ps.description,
    ps.target_question_count,
    ps.requires_subscription,
    ps.position,
    (SELECT COUNT(*) FROM public.practice_questions pq WHERE pq.set_id = ps.id),
    (SELECT COUNT(*) FROM public.practice_attempts pa
     WHERE pa.set_id = ps.id AND pa.user_id = auth.uid() AND pa.submitted_at IS NOT NULL),
    COALESCE(
      (SELECT MAX(pa.score) FROM public.practice_attempts pa
       WHERE pa.set_id = ps.id AND pa.user_id = auth.uid() AND pa.submitted_at IS NOT NULL),
      0
    )
  FROM public.practice_sets ps
  WHERE ps.lesson_id = p_lesson_id AND ps.is_active = true
  ORDER BY ps.position ASC, ps.created_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_sets(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_sets(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_sets(uuid) TO authenticated;

-- 5.3 get_practice_question_count
CREATE OR REPLACE FUNCTION public.get_practice_question_count(p_set_id uuid)
RETURNS TABLE (out_count bigint, out_target integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie sa fii autentificat'; END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.practice_questions pq WHERE pq.set_id = p_set_id),
    (SELECT ps.target_question_count FROM public.practice_sets ps WHERE ps.id = p_set_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_question_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_question_count(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_question_count(uuid) TO authenticated;

-- 5.4 start_practice_attempt
CREATE OR REPLACE FUNCTION public.start_practice_attempt(p_set_id uuid)
RETURNS TABLE (
  out_id uuid,
  out_set_id uuid,
  out_answers jsonb,
  out_score integer,
  out_max_score integer,
  out_started_at timestamptz,
  out_submitted_at timestamptz,
  out_is_new boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_set_id uuid;
  v_answers jsonb;
  v_score integer;
  v_max_score integer;
  v_started_at timestamptz;
  v_submitted_at timestamptz;
  v_is_new boolean := false;
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

  SELECT pa.id, pa.set_id, pa.answers, pa.score, pa.max_score, pa.started_at, pa.submitted_at
    INTO v_id, v_set_id, v_answers, v_score, v_max_score, v_started_at, v_submitted_at
  FROM public.practice_attempts pa
  WHERE pa.set_id = p_set_id AND pa.user_id = auth.uid() AND pa.submitted_at IS NULL
  ORDER BY pa.started_at DESC LIMIT 1;

  IF NOT FOUND THEN
    v_is_new := true;
    WITH ins AS (
      INSERT INTO public.practice_attempts (user_id, set_id, answers, score, max_score, started_at)
      VALUES (auth.uid(), p_set_id, '{}'::jsonb, 0, 0, now())
      RETURNING id, set_id, answers, score, max_score, started_at, submitted_at
    )
    SELECT i.id, i.set_id, i.answers, i.score, i.max_score, i.started_at, i.submitted_at
      INTO v_id, v_set_id, v_answers, v_score, v_max_score, v_started_at, v_submitted_at
    FROM ins i;
  END IF;

  RETURN QUERY SELECT v_id, v_set_id, v_answers, v_score, v_max_score, v_started_at, v_submitted_at, v_is_new;
END;
$$;
REVOKE ALL ON FUNCTION public.start_practice_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_practice_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_practice_attempt(uuid) TO authenticated;

-- 5.5 get_practice_questions (no correct_answer/explanation)
CREATE OR REPLACE FUNCTION public.get_practice_questions(p_set_id uuid)
RETURNS TABLE (
  out_id uuid,
  out_type text,
  out_position integer,
  out_question_text text,
  out_option_a text,
  out_option_b text,
  out_option_c text,
  out_option_d text,
  out_option_e text,
  out_statement_1 text,
  out_statement_2 text,
  out_statement_3 text,
  out_statement_4 text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
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

  RETURN QUERY
  SELECT
    pq.id, pq.type, pq.position, pq.question_text,
    pq.option_a, pq.option_b, pq.option_c, pq.option_d, pq.option_e,
    pq.statement_1, pq.statement_2, pq.statement_3, pq.statement_4
  FROM public.practice_questions pq
  WHERE pq.set_id = p_set_id
  ORDER BY pq.position ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid) TO authenticated;

-- 5.6 save_practice_progress
CREATE OR REPLACE FUNCTION public.save_practice_progress(
  p_attempt_id uuid,
  p_answers jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie sa fii autentificat'; END IF;

  UPDATE public.practice_attempts
  SET answers = p_answers
  WHERE id = p_attempt_id AND user_id = auth.uid() AND submitted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incercarea nu a fost gasita sau a fost deja finalizata';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_practice_progress(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_practice_progress(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_practice_progress(uuid, jsonb) TO authenticated;

-- 5.7 submit_practice_attempt
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
    v_user_ans := p_answers ->> v_q_id;
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

-- 5.8 get_practice_results
CREATE OR REPLACE FUNCTION public.get_practice_results(p_attempt_id uuid)
RETURNS TABLE (
  out_attempt_id uuid,
  out_set_id uuid,
  out_answers jsonb,
  out_score integer,
  out_max_score integer,
  out_started_at timestamptz,
  out_submitted_at timestamptz,
  out_question_id uuid,
  out_q_type text,
  out_q_position integer,
  out_question_text text,
  out_option_a text,
  out_option_b text,
  out_option_c text,
  out_option_d text,
  out_option_e text,
  out_statement_1 text,
  out_statement_2 text,
  out_statement_3 text,
  out_statement_4 text,
  out_correct_answer text,
  out_explanation text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_att_id uuid;
  v_set_id uuid;
  v_answers jsonb;
  v_score integer;
  v_max_score integer;
  v_started_at timestamptz;
  v_submitted_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie sa fii autentificat'; END IF;

  SELECT pa.id, pa.set_id, pa.answers, pa.score, pa.max_score, pa.started_at, pa.submitted_at
    INTO v_att_id, v_set_id, v_answers, v_score, v_max_score, v_started_at, v_submitted_at
  FROM public.practice_attempts pa
  WHERE pa.id = p_attempt_id AND pa.user_id = auth.uid() AND pa.submitted_at IS NOT NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Incercarea nu a fost gasita sau nu a fost finalizata'; END IF;

  RETURN QUERY
  SELECT
    v_att_id, v_set_id, v_answers, v_score, v_max_score, v_started_at, v_submitted_at,
    pq.id, pq.type, pq.position, pq.question_text,
    pq.option_a, pq.option_b, pq.option_c, pq.option_d, pq.option_e,
    pq.statement_1, pq.statement_2, pq.statement_3, pq.statement_4,
    pq.correct_answer, pq.explanation
  FROM public.practice_questions pq
  WHERE pq.set_id = v_set_id
  ORDER BY pq.position ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_results(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_results(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_results(uuid) TO authenticated;

-- 5.9 get_practice_history
CREATE OR REPLACE FUNCTION public.get_practice_history(p_set_id uuid)
RETURNS TABLE (
  out_id uuid,
  out_answers jsonb,
  out_score integer,
  out_max_score integer,
  out_started_at timestamptz,
  out_submitted_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie sa fii autentificat'; END IF;

  RETURN QUERY
  SELECT pa.id, pa.answers, pa.score, pa.max_score, pa.started_at, pa.submitted_at
  FROM public.practice_attempts pa
  WHERE pa.set_id = p_set_id AND pa.user_id = auth.uid() AND pa.submitted_at IS NOT NULL
  ORDER BY pa.submitted_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_history(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_history(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_history(uuid) TO authenticated;
