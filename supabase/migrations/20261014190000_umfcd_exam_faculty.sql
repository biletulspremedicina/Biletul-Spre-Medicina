BEGIN;

-- Existing exams remain unclassified: no guessed faculty and no row rewrites.
ALTER TABLE public.simulations ADD COLUMN IF NOT EXISTS faculty text;
ALTER TABLE public.simulations ADD CONSTRAINT simulations_faculty_valid
  CHECK (faculty IS NULL OR faculty IN ('Medicină Generală', 'Stomatologie'));

-- Require a selection for new UMFCD exams and prevent clearing a classified exam.
-- Legacy NULL rows can still be published, reordered and otherwise maintained.
CREATE OR REPLACE FUNCTION public.validate_umfcd_faculty()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.student_section = 'umfcd' AND NEW.faculty IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Facultatea este obligatorie pentru examenele UMFCD.' USING ERRCODE = '23514';
    ELSIF OLD.student_section IS DISTINCT FROM 'umfcd' OR OLD.faculty IS NOT NULL THEN
      RAISE EXCEPTION 'Facultatea este obligatorie pentru examenele UMFCD.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER simulations_validate_umfcd_faculty
  BEFORE INSERT OR UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.validate_umfcd_faculty();

COMMENT ON COLUMN public.simulations.faculty IS
  'UMFCD faculty. NULL means an existing exam has not yet been classified.';

COMMIT;
