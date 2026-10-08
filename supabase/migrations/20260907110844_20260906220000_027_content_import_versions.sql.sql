/*
# Content Import & Version History System

1. New Tables
- `content_imports`: Tracks every import operation (who, when, file, status, changes count, errors)
  - id UUID PK
  - content_type TEXT ('simulation' | 'practice_set')
  - content_id UUID (references simulations OR practice_sets, nullable because both)
  - file_name TEXT
  - status TEXT ('applied' | 'failed' | 'restored')
  - changes_count INTEGER default 0
  - errors JSONB (validation errors/warnings)
  - created_by UUID (references auth.users)
  - created_at TIMESTAMPTZ default now()

- `content_versions`: Stores snapshots of each question before modification
  - id UUID PK
  - import_id UUID (references content_imports, CASCADE)
  - content_type TEXT
  - content_id UUID
  - question_id UUID
  - previous_content JSONB (full snapshot of the question before change)
  - new_content JSONB (full snapshot of the question after change)
  - created_by UUID
  - created_at TIMESTAMPTZ default now()

2. Security
- Both tables have RLS enabled.
- Only users with profile role = 'admin' can SELECT, INSERT, UPDATE.
- No DELETE policy (history is immutable).
- All policies check EXISTS in profiles WHERE role = 'admin' AND id = auth.uid().

3. RPC Functions (SECURITY DEFINER, admin-only)
- `apply_content_import(p_import_id UUID, p_changes JSONB)`: Applies validated question text changes atomically.
  - Creates content_versions snapshots for each modified question.
  - Updates questions or practice_questions table.
  - Only updates: question_text, option_a-e, statement_1-4, explanation.
  - Never updates: id, correct_answer, type, position, simulation_id/set_id.
  - All changes applied in single transaction — if any fails, none are saved.
- `restore_content_version(p_version_id UUID)`: Restores a previous version.
  - Creates a NEW content_version snapshot of current state before restoring.
  - Updates the question with the previous_content values (only editable fields).
  - Creates a new content_import record with status='restored'.
  - Returns the new import_id.

4. Important Notes
- No existing tables are modified or dropped.
- No existing data is affected.
- All operations are admin-only via RLS + SECURITY DEFINER.
- The RPC functions validate admin status internally via auth.uid().
*/

-- ───────────────────────────── content_imports ─────────────────────────────

CREATE TABLE IF NOT EXISTS content_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('simulation', 'practice_set')),
  content_id UUID,
  file_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'failed', 'restored')),
  changes_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE content_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_content_imports" ON content_imports;
CREATE POLICY "admin_select_content_imports"
  ON content_imports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admin_insert_content_imports" ON content_imports;
CREATE POLICY "admin_insert_content_imports"
  ON content_imports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admin_update_content_imports" ON content_imports;
CREATE POLICY "admin_update_content_imports"
  ON content_imports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ───────────────────────────── content_versions ────────────────────────────

CREATE TABLE IF NOT EXISTS content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES content_imports(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('simulation', 'practice_set')),
  content_id UUID,
  question_id UUID NOT NULL,
  previous_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_content_versions" ON content_versions;
CREATE POLICY "admin_select_content_versions"
  ON content_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admin_insert_content_versions" ON content_versions;
CREATE POLICY "admin_insert_content_versions"
  ON content_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ───────────────────────────── Indexes ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_content_imports_content ON content_imports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_import ON content_versions(import_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_question ON content_versions(question_id);

-- ───────────────────────────── RPC: apply_content_import ───────────────────
-- SECURITY DEFINER: runs with elevated privileges, admin-only via internal check.
-- Applies validated text-only changes to questions or practice_questions.
-- Creates version snapshots. All-or-nothing via implicit transaction.

CREATE OR REPLACE FUNCTION apply_content_import(
  p_content_type TEXT,
  p_content_id UUID,
  p_file_name TEXT,
  p_changes JSONB
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

  -- ── Process each change ──
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

  -- Update import record with final counts
  UPDATE content_imports
  SET changes_count = v_count, errors = v_errors
  WHERE id = v_import_id;

  RETURN jsonb_build_object(
    'import_id', v_import_id,
    'changes_count', v_count,
    'errors', v_errors
  );
END;
$$;

-- Grant execute to authenticated (admin check is inside)
GRANT EXECUTE ON FUNCTION apply_content_import(TEXT, UUID, TEXT, JSONB) TO authenticated;

-- ───────────────────────────── RPC: restore_content_version ────────────────
-- Restores a previous version. Creates a NEW version snapshot of current state
-- before restoring, and a new content_import record with status='restored'.

CREATE OR REPLACE FUNCTION restore_content_version(
  p_version_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_version content_versions%ROWTYPE;
  v_import_id UUID;
  v_prev JSONB;
  v_new JSONB;
  v_question_table TEXT;
BEGIN
  -- Admin check
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Doar administratorii pot restaura versiuni.';
  END IF;

  -- Get the version to restore
  SELECT * INTO v_version FROM content_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versiunea nu a fost găsită.';
  END IF;

  -- Determine table
  IF v_version.content_type = 'simulation' THEN
    v_question_table := 'questions';
  ELSIF v_version.content_type = 'practice_set' THEN
    v_question_table := 'practice_questions';
  ELSE
    RAISE EXCEPTION 'Tip conținut invalid.';
  END IF;

  -- Snapshot current state before restore
  EXECUTE format(
    'SELECT row_to_json(t) FROM (SELECT question_text, option_a, option_b, option_c, option_d, option_e, statement_1, statement_2, statement_3, statement_4, explanation FROM %I WHERE id = $1) t',
    v_question_table
  ) INTO v_prev USING v_version.question_id;

  -- Create a new import record for the restore action
  INSERT INTO content_imports (content_type, content_id, file_name, status, changes_count, errors, created_by)
  VALUES (v_version.content_type, v_version.content_id, 'RESTAURARE', 'restored', 1, '[]'::jsonb, v_user_id)
  RETURNING id INTO v_import_id;

  -- Restore the previous_content values (only editable fields)
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
  USING v_version.question_id,
    COALESCE(v_version.previous_content->>'question_text', v_prev->>'question_text'),
    COALESCE(v_version.previous_content->>'option_a', v_prev->>'option_a'),
    COALESCE(v_version.previous_content->>'option_b', v_prev->>'option_b'),
    COALESCE(v_version.previous_content->>'option_c', v_prev->>'option_c'),
    COALESCE(v_version.previous_content->>'option_d', v_prev->>'option_d'),
    COALESCE(v_version.previous_content->>'option_e', v_prev->>'option_e'),
    COALESCE(v_version.previous_content->>'statement_1', v_prev->>'statement_1'),
    COALESCE(v_version.previous_content->>'statement_2', v_prev->>'statement_2'),
    COALESCE(v_version.previous_content->>'statement_3', v_prev->>'statement_3'),
    COALESCE(v_version.previous_content->>'statement_4', v_prev->>'statement_4'),
    COALESCE(v_version.previous_content->>'explanation', v_prev->>'explanation');

  -- Snapshot the restored state
  EXECUTE format(
    'SELECT row_to_json(t) FROM (SELECT question_text, option_a, option_b, option_c, option_d, option_e, statement_1, statement_2, statement_3, statement_4, explanation FROM %I WHERE id = $1) t',
    v_question_table
  ) INTO v_new USING v_version.question_id;

  -- Create version record for the restore
  INSERT INTO content_versions (import_id, content_type, content_id, question_id, previous_content, new_content, created_by)
  VALUES (v_import_id, v_version.content_type, v_version.content_id, v_version.question_id, v_prev, v_new, v_user_id);

  RETURN jsonb_build_object(
    'import_id', v_import_id,
    'version_id', p_version_id,
    'question_id', v_version.question_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION restore_content_version(UUID) TO authenticated;
