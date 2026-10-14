/*
# Corectare funcție get_attempt_results — alias explicite

Problema: `q.position` și `q.id` în RETURN QUERY pot cauza ambiguitate
cu coloanele de retur `q_pos` și `question_id`. Se adaugă aliasuri explicite.
*/

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
  v_sim public.simulations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_attempt FROM public.attempts AS a WHERE a.id = p_attempt_id;
  IF NOT FOUND OR v_attempt.user_id != auth.uid() THEN
    RETURN;
  END IF;
  IF v_attempt.submitted_at IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = v_attempt.simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      v_attempt.id AS attempt_id,
      v_attempt.simulation_id AS sim_id,
      v_attempt.answers AS answers,
      v_attempt.score AS score,
      v_attempt.max_score AS max_score,
      v_attempt.started_at AS started_at,
      v_attempt.submitted_at AS submitted_at,
      v_attempt.expired AS expired,
      q.id AS question_id,
      q.type AS q_type,
      q.position AS q_pos,
      q.question_text AS question_text,
      q.option_a AS option_a,
      q.option_b AS option_b,
      q.option_c AS option_c,
      q.option_d AS option_d,
      q.option_e AS option_e,
      q.statement_1 AS statement_1,
      q.statement_2 AS statement_2,
      q.statement_3 AS statement_3,
      q.statement_4 AS statement_4,
      q.correct_answer AS correct_answer,
      q.explanation AS explanation
    FROM public.questions AS q
    WHERE q.simulation_id = v_attempt.simulation_id
    ORDER BY q.position;
END;
$$;

REVOKE ALL ON FUNCTION public.get_attempt_results(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_attempt_results(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_results(uuid) TO authenticated;
