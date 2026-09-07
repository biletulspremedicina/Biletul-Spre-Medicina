-- RPC: admin_import_new_questions
-- Atomically inserts new questions into questions or practice_questions
-- SECURITY DEFINER, admin-only, explicit table branching

CREATE OR REPLACE FUNCTION admin_import_new_questions(
  p_content_type text,
  p_content_id uuid,
  p_questions jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_count integer := 0;
  v_max_pos integer := 0;
  v_q jsonb;
  v_insert jsonb;
  v_exists boolean;
BEGIN
  -- Verify caller is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Doar administratorii pot importa grile noi.';
  END IF;

  IF p_content_type = 'simulation' THEN
    -- Verify simulation exists
    SELECT EXISTS (
      SELECT 1 FROM simulations s WHERE s.id = p_content_id
    ) INTO v_exists;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'Simularea nu există.';
    END IF;

    -- Get max position
    SELECT COALESCE(MAX(q.position), -1) INTO v_max_pos
    FROM questions q
    WHERE q.simulation_id = p_content_id;

    FOR v_q IN SELECT * FROM jsonb_array_elements(p_questions)
    LOOP
      v_max_pos := v_max_pos + 1;
      INSERT INTO questions (
        simulation_id, type, position,
        question_text,
        option_a, option_b, option_c, option_d, option_e,
        statement_1, statement_2, statement_3, statement_4,
        correct_answer, explanation
      )
      VALUES (
        p_content_id,
        v_q->>'type',
        v_max_pos,
        v_q->>'question_text',
        v_q->>'option_a',
        v_q->>'option_b',
        v_q->>'option_c',
        v_q->>'option_d',
        v_q->>'option_e',
        v_q->>'statement_1',
        v_q->>'statement_2',
        v_q->>'statement_3',
        v_q->>'statement_4',
        v_q->>'correct_answer',
        v_q->>'explanation'
      );
      v_count := v_count + 1;
    END LOOP;

  ELSIF p_content_type = 'practice_set' THEN
    -- Verify practice set exists
    SELECT EXISTS (
      SELECT 1 FROM practice_sets ps WHERE ps.id = p_content_id
    ) INTO v_exists;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'Setul de antrenament nu există.';
    END IF;

    -- Get max position
    SELECT COALESCE(MAX(pq.position), -1) INTO v_max_pos
    FROM practice_questions pq
    WHERE pq.set_id = p_content_id;

    FOR v_q IN SELECT * FROM jsonb_array_elements(p_questions)
    LOOP
      v_max_pos := v_max_pos + 1;
      INSERT INTO practice_questions (
        set_id, type, position,
        question_text,
        option_a, option_b, option_c, option_d, option_e,
        statement_1, statement_2, statement_3, statement_4,
        correct_answer, explanation
      )
      VALUES (
        p_content_id,
        v_q->>'type',
        v_max_pos,
        v_q->>'question_text',
        v_q->>'option_a',
        v_q->>'option_b',
        v_q->>'option_c',
        v_q->>'option_d',
        v_q->>'option_e',
        v_q->>'statement_1',
        v_q->>'statement_2',
        v_q->>'statement_3',
        v_q->>'statement_4',
        v_q->>'correct_answer',
        v_q->>'explanation'
      );
      v_count := v_count + 1;
    END LOOP;

  ELSE
    RAISE EXCEPTION 'Tip de conținut invalid: %. Acceptă doar "simulation" sau "practice_set".', p_content_type;
  END IF;

  RETURN v_count;
END;
$$;

-- Grant execute to authenticated (admin check is inside the function)
GRANT EXECUTE ON FUNCTION admin_import_new_questions(text, uuid, jsonb) TO authenticated;
