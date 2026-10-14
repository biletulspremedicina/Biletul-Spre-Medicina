/*
# Add student_section column to simulations

1. Purpose
   Separă simulările create de echipă de examenele oficiale UMFCD,
   fără a modifica funcționalitățile existente.
   Coloana `student_section` determină în ce filă a elevului apare simularea:
   - 'all'    → „Toate simulările”
   - 'umfcd'  → „Examene și simulări UMFCD”

2. Changes
   - ADD COLUMN `simulations.student_section` (text, NOT NULL, DEFAULT 'all')
   - CHECK constraint: student_section IN ('all', 'umfcd')
   - INDEX on student_section for filtering

3. Data Safety
   - No DROP, no TRUNCATE, no column removal, no data deletion.
   - All existing rows get student_section = 'all' via DEFAULT.
   - Existing simulations remain unchanged in behavior.

4. Security
   - No RLS policy changes. Existing policies remain in effect.
   - student_section is set by admin only; no new policy needed.
*/

ALTER TABLE simulations
  ADD COLUMN IF NOT EXISTS student_section text NOT NULL DEFAULT 'all';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'simulations_student_section_check'
  ) THEN
    ALTER TABLE simulations
      ADD CONSTRAINT simulations_student_section_check
      CHECK (student_section IN ('all', 'umfcd'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_simulations_student_section
  ON simulations (student_section);
