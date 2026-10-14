/*
# Corectare funcție get_exam_questions — alias explicit pentru q.position

Problema: `RETURN QUERY SELECT ... q.position ...` poate cauza ambiguitate
în PostgreSQL deoarece `position` este cuvânt rezervat în anumite contexte.
Se adaugă alias explicit `q.position AS q_position` pentru a evita confuzia.
*/

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
DECLARE
  v_sim public.simulations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.attempts AS a
    WHERE a.simulation_id = p_simulation_id
      AND a.user_id = auth.uid()
      AND a.submitted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      q.id AS id,
      q.simulation_id AS simulation_id,
      q.type AS type,
      q.position AS q_position,
      q.question_text AS question_text,
      q.option_a AS option_a,
      q.option_b AS option_b,
      q.option_c AS option_c,
      q.option_d AS option_d,
      q.option_e AS option_e,
      q.statement_1 AS statement_1,
      q.statement_2 AS statement_2,
      q.statement_3 AS statement_3,
      q.statement_4 AS statement_4
    FROM public.questions AS q
    WHERE q.simulation_id = p_simulation_id
    ORDER BY q.position;
END;
$$;

REVOKE ALL ON FUNCTION public.get_exam_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(uuid) TO authenticated;
