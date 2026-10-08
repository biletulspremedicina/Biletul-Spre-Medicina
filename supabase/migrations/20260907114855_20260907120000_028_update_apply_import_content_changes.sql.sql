-- ─────────────────────────────────────────────────────────────────────────────
-- 028: Update apply_content_import to accept content-level changes (title, subject, lesson)
-- Adds an optional parameter p_content_changes JSONB that can update:
--   - simulations.title (when content_type = 'simulation')
--   - practice_sets.title (when content_type = 'practice_set')
--   - practice_lessons.subject and practice_lessons.title (when content_type = 'practice_set')
-- All changes are applied atomically with question changes in the same transaction.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION apply_content_import(
  p_content_type TEXT,
  p_content_id UUID,
  p_file_name TEXT,
  p_changes JSONB,
  p_content_changes JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_import_id UUID;
  v_change JSONB;
  v_question_id UUID;
  v_prev JSONB;
  v_new JSONB;
  v_count INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_question_table TEXT;
  v_parent_col TEXT;
  v_content_count INTEGER := 0;
  v_lesson_id UUID;
BEGIN
  -- ── Admin check ──
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Doar administratorii pot aplica importuri.';
  END IF;

  -- ── Determine target table ──
  IF p_content_type = 'simulation' THEN
    v_question_table := 'questions';
    v_parent_col := 'simulation_id';
  ELSIF p_content_type = 'practice_set' THEN
    v_question_table := 'practice_questions';
    v_parent_col := 'set_id';
  ELSE
    RAISE EXCEPTION 'Tip conținut invalid: %', p_content_type;
  END IF;

  -- ── Create import record ──
  INSERT INTO content_imports (content_type, content_id, file_name, status, changes_count, errors, created_by)
  VALUES (p_content_type, p_content_id, p_file_name, 'applied', 0, '[]'::jsonb, v_user_id)
  RETURNING id INTO v_import_id;

  -- ── Apply content-level changes (title, subject, lesson) ──
  IF p_content_changes IS NOT NULL AND p_content_changes <> '{}'::jsonb THEN
    IF p_content_type = 'simulation' THEN
      -- Update simulation title only
      IF p_content_changes ? 'title' THEN
        UPDATE simulations SET title = (p_content_changes->>'title') WHERE id = p_content_id;
        v_content_count := v_content_count + 1;
      END IF;
    ELSIF p_content_type = 'practice_set' THEN
      -- Update practice set title
      IF p_content_changes ? 'title' THEN
        UPDATE practice_sets SET title = (p_content_changes->>'title') WHERE id = p_content_id;
        v_content_count := v_content_count + 1;
      END IF;

      -- Update lesson subject and title if provided
      IF p_content_changes ? 'subject' OR p_content_changes ? 'lesson_title' THEN
        SELECT lesson_id INTO v_lesson_id FROM practice_sets WHERE id = p_content_id;
        IF v_lesson_id IS NOT NULL THEN
          UPDATE practice_lessons SET
            subject = COALESCE(p_content_changes->>'subject', subject),
            title = COALESCE(p_content_changes->>'lesson_title', title)
          WHERE id = v_lesson_id;
          v_content_count := v_content_count + 1;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ── Process each question change ──
  FOR v_change IN SELECT * FROM jsonb_array_elements(p_changes)
  LOOP
    v_question_id := (v_change->>'question_id')::UUID;

    -- Snapshot previous state
    EXECUTE format(
      'SELECT row_to_json(t) FROM (SELECT question_text, option_a, option_b, option_c, option_d, option_e, statement_1, statement_2, statement_3, statement_4, explanation FROM %I WHERE id = $1) t',
      v_question_table
    ) INTO v_prev USING v_question_id;

    IF v_prev IS NULL THEN
      v_errors := v_errors || jsonb_build_object('question_id', v_question_id, 'error', 'Întrebarea nu există');
      CONTINUE;
    END IF;

    -- Apply only editable text fields (never correct_answer, type, position, ids)
    EXECUTE format(
      'UPDATE %I SET
        question_text = $2,
        option_a = $3,
        option_b = $4,
        option_c = $5,
        option_d = $6,
        option_e = $7,
        statement_1 = $8,
        statement_2 = $9,
        statement_3 = $10,
        statement_4 = $11,
        explanation = $12
      WHERE id = $1',
      v_question_table
    )
    USING v_question_id,
      COALESCE(v_change->>'question_text', v_prev->>'question_text'),
      COALESCE(v_change->>'option_a', v_prev->>'option_a'),
      COALESCE(v_change->>'option_b', v_prev->>'option_b'),
      COALESCE(v_change->>'option_c', v_prev->>'option_c'),
      COALESCE(v_change->>'option_d', v_prev->>'option_d'),
      COALESCE(v_change->>'option_e', v_prev->>'option_e'),
      COALESCE(v_change->>'statement_1', v_prev->>'statement_1'),
      COALESCE(v_change->>'statement_2', v_prev->>'statement_2'),
      COALESCE(v_change->>'statement_3', v_prev->>'statement_3'),
      COALESCE(v_change->>'statement_4', v_prev->>'statement_4'),
      COALESCE(v_change->>'explanation', v_prev->>'explanation');

    -- Snapshot new state
    EXECUTE format(
      'SELECT row_to_json(t) FROM (SELECT question_text, option_a, option_b, option_c, option_d, option_e, statement_1, statement_2, statement_3, statement_4, explanation FROM %I WHERE id = $1) t',
      v_question_table
    ) INTO v_new USING v_question_id;

    -- Create version record
    INSERT INTO content_versions (import_id, content_type, content_id, question_id, previous_content, new_content, created_by)
    VALUES (v_import_id, p_content_type, p_content_id, v_question_id, v_prev, v_new, v_user_id);

    v_count := v_count + 1;
  END LOOP;

  -- Update import record with final counts (questions + content-level changes)
  UPDATE content_imports
  SET changes_count = v_count + v_content_count, errors = v_errors
  WHERE id = v_import_id;

  RETURN jsonb_build_object(
    'import_id', v_import_id,
    'changes_count', v_count + v_content_count,
    'question_changes', v_count,
    'content_changes', v_content_count,
    'errors', v_errors
  );
END;
$$;

-- Re-grant (function signature changed)
GRANT EXECUTE ON FUNCTION apply_content_import(TEXT, UUID, TEXT, JSONB, JSONB) TO authenticated;
