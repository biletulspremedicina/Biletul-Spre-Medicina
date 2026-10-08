/*
# Banca de grile centrală

Creates a central question bank (practice_bank_questions) linked to practice_lessons,
and a junction table (practice_set_questions) linking sets to bank questions.

Migrates existing practice_questions into the bank, preserves all IDs,
keeps practice_attempts working (answers keyed by original question IDs).

Architecture:
- practice_bank_questions: one row per unique question, linked to practice_lessons
- practice_set_questions: junction (set_id, question_id, position), unique pair
- practice_questions: kept as-is for backward compat with attempts (answers store old IDs)
  BUT new student RPCs read from junction → bank questions
- practice_attempts.answers: keyed by question ID — now these are bank question IDs
  (same UUIDs since we migrate existing practice_questions.id → bank.id)

New admin RPCs:
- admin_import_to_bank(lesson_id, questions jsonb) → integer
- admin_add_questions_to_set(set_id, question_ids uuid[]) → integer
- admin_remove_question_from_set(set_id, question_id uuid) → void
- admin_reorder_set_questions(set_id, ordered_ids uuid[]) → void

Updated student RPCs (read through junction):
- get_practice_questions: reads bank via junction
- get_practice_results: reads bank via junction
- submit_practice_attempt: scores via junction → bank
- get_practice_question_count: counts junction rows
- get_practice_sets: counts junction rows
- get_practice_lessons: counts junction rows
*/

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.practice_bank_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.practice_lessons(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('CS','CG')),
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
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.practice_bank_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bank_questions_lesson ON public.practice_bank_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_bank_questions_archived ON public.practice_bank_questions(is_archived);

CREATE TABLE IF NOT EXISTS public.practice_set_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.practice_bank_questions(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (set_id, question_id)
);
ALTER TABLE public.practice_set_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_set_questions_set_pos ON public.practice_set_questions(set_id, position);
CREATE INDEX IF NOT EXISTS idx_set_questions_question ON public.practice_set_questions(question_id);

-- ============================================================================
-- 2. RLS POLICIES
-- ============================================================================

-- practice_bank_questions: admin only (students get data through RPCs)
DROP POLICY IF EXISTS "admin_all_bank_questions" ON public.practice_bank_questions;
CREATE POLICY "admin_all_bank_questions" ON public.practice_bank_questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- practice_set_questions: admin only
DROP POLICY IF EXISTS "admin_all_set_questions" ON public.practice_set_questions;
CREATE POLICY "admin_all_set_questions" ON public.practice_set_questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 3. MIGRATE EXISTING DATA
-- ============================================================================
-- Transfer all practice_questions into practice_bank_questions,
-- preserving the original UUID, then create junction entries.
-- This is idempotent (safe to run multiple times).

INSERT INTO public.practice_bank_questions (
  id, lesson_id, type, question_text,
  option_a, option_b, option_c, option_d, option_e,
  statement_1, statement_2, statement_3, statement_4,
  correct_answer, explanation, is_archived, created_at, updated_at
)
SELECT
  pq.id,
  ps.lesson_id,
  pq.type,
  pq.question_text,
  pq.option_a, pq.option_b, pq.option_c, pq.option_d, pq.option_e,
  pq.statement_1, pq.statement_2, pq.statement_3, pq.statement_4,
  pq.correct_answer, pq.explanation,
  false,
  pq.created_at,
  now()
FROM public.practice_questions pq
JOIN public.practice_sets ps ON ps.id = pq.set_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.practice_bank_questions pbq WHERE pbq.id = pq.id
);

-- Create junction entries for existing set→question relationships
INSERT INTO public.practice_set_questions (set_id, question_id, position)
SELECT pq.set_id, pq.id, pq.position
FROM public.practice_questions pq
WHERE NOT EXISTS (
  SELECT 1 FROM public.practice_set_questions psq
  WHERE psq.set_id = pq.set_id AND psq.question_id = pq.id
);

-- ============================================================================
-- 4. ADMIN RPC: admin_import_to_bank
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_import_to_bank(
  p_lesson_id uuid,
  p_questions jsonb
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_count integer := 0;
  v_q jsonb;
  v_exists boolean;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Doar administratorii pot importa grile.'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.practice_lessons pl WHERE pl.id = p_lesson_id) INTO v_exists;
  IF NOT v_exists THEN RAISE EXCEPTION 'Lecția nu există.'; END IF;

  FOR v_q IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    INSERT INTO public.practice_bank_questions (
      lesson_id, type, question_text,
      option_a, option_b, option_c, option_d, option_e,
      statement_1, statement_2, statement_3, statement_4,
      correct_answer, explanation
    )
    VALUES (
      p_lesson_id,
      v_q->>'type',
      v_q->>'question_text',
      v_q->>'option_a', v_q->>'option_b', v_q->>'option_c', v_q->>'option_d', v_q->>'option_e',
      v_q->>'statement_1', v_q->>'statement_2', v_q->>'statement_3', v_q->>'statement_4',
      v_q->>'correct_answer',
      v_q->>'explanation'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_import_to_bank(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_import_to_bank(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_import_to_bank(uuid, jsonb) TO authenticated;

-- ============================================================================
-- 5. ADMIN RPC: admin_add_questions_to_set
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_add_questions_to_set(
  p_set_id uuid,
  p_question_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_count integer := 0;
  v_q_id uuid;
  v_max_pos integer := -1;
  v_exists boolean;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Doar administratorii pot organiza grile.'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.practice_sets ps WHERE ps.id = p_set_id) INTO v_exists;
  IF NOT v_exists THEN RAISE EXCEPTION 'Setul nu există.'; END IF;

  SELECT COALESCE(MAX(psq.position), -1) INTO v_max_pos
  FROM public.practice_set_questions psq WHERE psq.set_id = p_set_id;

  FOREACH v_q_id IN ARRAY p_question_ids
  LOOP
    -- Skip if already in set
    IF NOT EXISTS (
      SELECT 1 FROM public.practice_set_questions psq
      WHERE psq.set_id = p_set_id AND psq.question_id = v_q_id
    ) THEN
      v_max_pos := v_max_pos + 1;
      INSERT INTO public.practice_set_questions (set_id, question_id, position)
      VALUES (p_set_id, v_q_id, v_max_pos);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_add_questions_to_set(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_add_questions_to_set(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_add_questions_to_set(uuid, uuid[]) TO authenticated;

-- ============================================================================
-- 6. ADMIN RPC: admin_remove_question_from_set
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_remove_question_from_set(
  p_set_id uuid,
  p_question_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Doar administratorii pot modifica seturile.'; END IF;

  DELETE FROM public.practice_set_questions
  WHERE set_id = p_set_id AND question_id = p_question_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_question_from_set(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_remove_question_from_set(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_question_from_set(uuid, uuid) TO authenticated;

-- ============================================================================
-- 7. ADMIN RPC: admin_reorder_set_questions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_reorder_set_questions(
  p_set_id uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_pos integer := 0;
  v_q_id uuid;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Doar administratorii pot modifica seturile.'; END IF;

  FOREACH v_q_id IN ARRAY p_ordered_ids
  LOOP
    UPDATE public.practice_set_questions
    SET position = v_pos
    WHERE set_id = p_set_id AND question_id = v_q_id;
    v_pos := v_pos + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reorder_set_questions(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reorder_set_questions(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reorder_set_questions(uuid, uuid[]) TO authenticated;

-- ============================================================================
-- 8. ADMIN RPC: admin_create_set_from_questions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_create_set_from_questions(
  p_lesson_id uuid,
  p_title text,
  p_description text,
  p_target_count integer,
  p_requires_subscription boolean,
  p_position integer,
  p_question_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_set_id uuid;
  v_q_id uuid;
  v_pos integer := 0;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Doar administratorii pot crea seturi.'; END IF;

  INSERT INTO public.practice_sets (
    lesson_id, title, description, target_question_count,
    requires_subscription, position, is_active
  )
  VALUES (p_lesson_id, p_title, p_description, p_target_count, p_requires_subscription, p_position, false)
  RETURNING id INTO v_set_id;

  FOREACH v_q_id IN ARRAY p_question_ids
  LOOP
    INSERT INTO public.practice_set_questions (set_id, question_id, position)
    VALUES (v_set_id, v_q_id, v_pos);
    v_pos := v_pos + 1;
  END LOOP;

  RETURN v_set_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_set_from_questions(uuid, text, text, integer, boolean, integer, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_set_from_questions(uuid, text, text, integer, boolean, integer, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_set_from_questions(uuid, text, text, integer, boolean, integer, uuid[]) TO authenticated;

-- ============================================================================
-- 9. UPDATE STUDENT RPCs to read through junction → bank
-- ============================================================================

-- 9.1 get_practice_questions (updated: reads through junction)
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
    pbq.id, pbq.type, psq.position, pbq.question_text,
    pbq.option_a, pbq.option_b, pbq.option_c, pbq.option_d, pbq.option_e,
    pbq.statement_1, pbq.statement_2, pbq.statement_3, pbq.statement_4
  FROM public.practice_set_questions psq
  JOIN public.practice_bank_questions pbq ON pbq.id = psq.question_id
  WHERE psq.set_id = p_set_id AND pbq.is_archived = false
  ORDER BY psq.position ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid) TO authenticated;

-- 9.2 submit_practice_attempt (updated: scores through junction → bank)
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
    SELECT pbq.id, pbq.correct_answer
    FROM public.practice_set_questions psq
    JOIN public.practice_bank_questions pbq ON pbq.id = psq.question_id
    WHERE psq.set_id = p_set_id AND pbq.is_archived = false
    ORDER BY psq.position ASC
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

-- 9.3 get_practice_results (updated: reads through junction → bank)
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
    pbq.id, pbq.type, psq.position, pbq.question_text,
    pbq.option_a, pbq.option_b, pbq.option_c, pbq.option_d, pbq.option_e,
    pbq.statement_1, pbq.statement_2, pbq.statement_3, pbq.statement_4,
    pbq.correct_answer, pbq.explanation
  FROM public.practice_set_questions psq
  JOIN public.practice_bank_questions pbq ON pbq.id = psq.question_id
  WHERE psq.set_id = v_set_id
  ORDER BY psq.position ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_results(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_results(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_results(uuid) TO authenticated;

-- 9.4 get_practice_question_count (updated: counts junction rows)
CREATE OR REPLACE FUNCTION public.get_practice_question_count(p_set_id uuid)
RETURNS TABLE (out_count bigint, out_target integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie sa fii autentificat'; END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.practice_set_questions psq
     JOIN public.practice_bank_questions pbq ON pbq.id = psq.question_id
     WHERE psq.set_id = p_set_id AND pbq.is_archived = false),
    (SELECT ps.target_question_count FROM public.practice_sets ps WHERE ps.id = p_set_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_question_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_question_count(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_question_count(uuid) TO authenticated;

-- 9.5 get_practice_sets (updated: counts junction rows for question_count)
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
    (SELECT COUNT(*) FROM public.practice_set_questions psq
     JOIN public.practice_bank_questions pbq ON pbq.id = psq.question_id
     WHERE psq.set_id = ps.id AND pbq.is_archived = false),
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

-- 9.6 get_practice_lessons (updated: counts through junction)
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
    (SELECT COUNT(DISTINCT psq.question_id) FROM public.practice_set_questions psq
     JOIN public.practice_sets ps ON ps.id = psq.set_id
     WHERE ps.lesson_id = pl.id AND ps.is_active = true)
  FROM public.practice_lessons pl
  WHERE pl.is_active = true
  ORDER BY pl.position ASC, pl.created_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_lessons() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_practice_lessons() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_lessons() TO authenticated;
