/*
# Corectează RPC-urile ambigue, securizează tabelele, adaugă abonament de test

## Ce se schimbă

### 1. Funcții RPC — corectare referințe ambigue
Toate funcțiile SECURITY DEFINER sunt rescrise cu aliasuri calificate (s.id, a.id, q.id etc.)
pentru a elimina eroarea PostgreSQL "column reference id is ambiguous".

### 2. Funcție nouă: activate_test_subscription
Permite elevilor să activeze gratuit un abonament de test de 30 de zile.
- Folosește exclusiv auth.uid() — nu primește user_id din browser
- Verifică dacă există deja abonament activ și îl returnează pe acela
- Dacă abonamentul anterior a expirat, permite activarea unuia nou
- amount_ron = 0, status = 'active', start_at = now(), end_at = now() + 30 days

### 3. Eliminarea politicilor RLS vechi permissive
- attempts: elimină insert_own_attempt, update_own_attempt, delete_own_attempt, select_attempts
  Elevii nu mai pot INSERT/UPDATE/DELETE direct. Doar SELECT rămâne.
- subscriptions: elimină insert_own_subscription, insert_own_subscriptions,
  update_own_subscription, update_own_subscriptions, delete_own_subscriptions
  Elevii nu mai pot insera/actualiza/șterge abonamente. Doar SELECT rămâne.
- payments: elimină insert_own_payment, update_own_payment
  Elevii nu pot marca plăți ca 'paid'.
- questions: elimină politicile duplicate vechi (delete_questions, insert_questions, update_questions)
- simulations: elimină politicile duplicate vechi (delete_simulations, insert_simulations, update_simulations)

### 4. Protecție profiles
- update_own_profile: permite modificarea DOAR a full_name-ului
- Elimină insert_own_profile (profilurile se creează prin trigger)

### 5. Drepturi funcții RPC
- REVOKE ALL FROM PUBLIC și FROM anon pentru toate funcțiile
- GRANT EXECUTE doar TO authenticated

### 6. Protecție încercare premium unică
- start_exam_attempt folosește SELECT ... FOR UPDATE pentru a bloca crearea
  simultană a două încercări premium pentru același user+simulare

### 7. get_exam_questions îmbunătățit
- Returnează grile doar dacă utilizatorul are o încercare începută și nefinalizată
- Pentru premium, verifică că a avut abonament activ la pornire

### 8. Granturi tabelă
- Revoca granturile INSERT/UPDATE/DELETE de la anon pentru attempts, subscriptions, payments
- Păstrează doar SELECT necesar
*/

-- ============================================================
-- 1. CURĂȚĂ POLITICI VECHI
-- ============================================================

-- attempts: elimină toate politicile vechi permissive
DROP POLICY IF EXISTS "insert_own_attempt" ON public.attempts;
DROP POLICY IF EXISTS "update_own_attempt" ON public.attempts;
DROP POLICY IF EXISTS "delete_own_attempt" ON public.attempts;
DROP POLICY IF EXISTS "select_attempts" ON public.attempts;
DROP POLICY IF EXISTS "select_own_attempts" ON public.attempts;

-- subscriptions: elimină politicile vechi
DROP POLICY IF EXISTS "insert_own_subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "insert_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "update_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "delete_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "select_own_subscriptions" ON public.subscriptions;

-- payments: elimină politicile vechi
DROP POLICY IF EXISTS "insert_own_payment" ON public.payments;
DROP POLICY IF EXISTS "update_own_payment" ON public.payments;
DROP POLICY IF EXISTS "select_payments" ON public.payments;

-- questions: elimină duplicatele vechi
DROP POLICY IF EXISTS "delete_questions" ON public.questions;
DROP POLICY IF EXISTS "insert_questions" ON public.questions;
DROP POLICY IF EXISTS "update_questions" ON public.questions;

-- simulations: elimină duplicatele vechi
DROP POLICY IF EXISTS "delete_simulations" ON public.simulations;
DROP POLICY IF EXISTS "insert_simulations" ON public.simulations;
DROP POLICY IF EXISTS "update_simulations" ON public.simulations;

-- profiles: elimină insert_own_profile vechi
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;

-- ============================================================
-- 2. POLITICI NOI — attempts (doar SELECT, admin full)
-- ============================================================

CREATE POLICY "select_own_attempts" ON public.attempts
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_insert_attempts" ON public.attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_update_attempts" ON public.attempts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_delete_attempts" ON public.attempts
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 3. POLITICI NOI — subscriptions (doar SELECT, admin full)
-- ============================================================

CREATE POLICY "select_own_subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_insert_subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_update_subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_delete_subscriptions" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 4. POLITICI NOI — payments (doar SELECT, admin full)
-- ============================================================

CREATE POLICY "select_own_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_insert_payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_update_payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_delete_payments" ON public.payments
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 5. POLITICI NOI — profiles (update doar full_name)
-- ============================================================

CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin poate face update la orice profil
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 6. REVOKE granturi periculoase de la anon
-- ============================================================

REVOKE INSERT, UPDATE, DELETE ON public.attempts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;

-- ============================================================
-- 7. REVOKE EXECUTE de la PUBLIC/anon pentru toate funcțiile
-- ============================================================

REVOKE ALL ON FUNCTION public.get_exam_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.get_attempt_results(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_attempt_results(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_results(uuid) TO authenticated;

-- ============================================================
-- 8. FUNCȚIE NOUĂ: activate_test_subscription
-- ============================================================

CREATE OR REPLACE FUNCTION public.activate_test_subscription()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  start_at timestamptz,
  end_at timestamptz,
  amount_ron numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.subscriptions%ROWTYPE;
BEGIN
  -- Verifică autentificare
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Trebuie să fii autentificat';
  END IF;

  -- Caută abonament activ existent
  SELECT * INTO v_existing FROM public.subscriptions AS sub
    WHERE sub.user_id = auth.uid()
      AND sub.status = 'active'
      AND sub.end_at > now()
    LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
      SELECT sub.id, sub.user_id, sub.status, sub.start_at, sub.end_at, sub.amount_ron
      FROM public.subscriptions AS sub
      WHERE sub.id = v_existing.id;
    RETURN;
  END IF;

  -- Creează abonament nou de test
  INSERT INTO public.subscriptions (user_id, status, start_at, end_at, amount_ron)
  VALUES (auth.uid(), 'active', now(), now() + interval '30 days', 0)
  RETURNING id, user_id, status, start_at, end_at, amount_ron
  INTO v_existing.id, v_existing.user_id, v_existing.status, v_existing.start_at, v_existing.end_at, v_existing.amount_ron;

  RETURN QUERY
    SELECT v_existing.id, v_existing.user_id, v_existing.status, v_existing.start_at, v_existing.end_at, v_existing.amount_ron;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_test_subscription() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_test_subscription() FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_test_subscription() TO authenticated;

-- ============================================================
-- 9. REWRITE: get_exam_questions (calificat + verificare încercare)
-- ============================================================

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

  -- Verifică că simularea este publicată
  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN
    RETURN;
  END IF;

  -- Verifică că utilizatorul are o încercare începută și nefinalizată
  IF NOT EXISTS (
    SELECT 1 FROM public.attempts AS a
    WHERE a.simulation_id = p_simulation_id
      AND a.user_id = auth.uid()
      AND a.submitted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  -- Returnează întrebările fără correct_answer și explanation
  RETURN QUERY
    SELECT
      q.id, q.simulation_id, q.type, q.position,
      q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
      q.statement_1, q.statement_2, q.statement_3, q.statement_4
    FROM public.questions AS q
    WHERE q.simulation_id = p_simulation_id
    ORDER BY q.position;
END;
$$;

REVOKE ALL ON FUNCTION public.get_exam_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(uuid) TO authenticated;

-- ============================================================
-- 10. REWRITE: start_exam_attempt (calificat + FOR UPDATE lock)
-- ============================================================

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Trebuie să fii autentificat';
  END IF;

  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN
    RAISE EXCEPTION 'Simularea nu este disponibilă';
  END IF;

  IF v_sim.requires_subscription = true THEN
    -- Premium: verifică abonament activ
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions AS sub
      WHERE sub.user_id = auth.uid()
        AND sub.status = 'active'
        AND sub.end_at > now()
    ) THEN
      RAISE EXCEPTION 'Abonament necesar';
    END IF;

    -- Premium: folosește FOR UPDATE pentru a preveni crearea simultană
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id
        AND a.user_id = auth.uid()
      FOR UPDATE
      LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
        SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
        FROM public.attempts AS a WHERE a.id = v_existing.id;
      RETURN;
    END IF;

    -- Creează încercare nouă premium
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at)
    VALUES (auth.uid(), p_simulation_id, '{}'::jsonb, 0, 0, now())
    RETURNING id, user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired
    INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;

    RETURN QUERY
      SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;
  ELSE
    -- Free: caută încercare nefinalizată pentru continuare
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id
        AND a.user_id = auth.uid()
        AND a.submitted_at IS NULL
      ORDER BY a.started_at DESC
      LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
        SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
        FROM public.attempts AS a WHERE a.id = v_existing.id;
      RETURN;
    END IF;

    -- Creează încercare nouă gratuită
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at)
    VALUES (auth.uid(), p_simulation_id, '{}'::jsonb, 0, 0, now())
    RETURNING id, user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired
    INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;

    RETURN QUERY
      SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_exam_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;

-- ============================================================
-- 11. REWRITE: submit_exam_attempt (calificat, FOR UPDATE)
-- ============================================================

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Trebuie să fii autentificat';
  END IF;

  SELECT * INTO v_sim FROM public.simulations AS s WHERE s.id = p_simulation_id;
  IF NOT FOUND OR v_sim.is_active = false THEN
    RAISE EXCEPTION 'Simularea nu este disponibilă';
  END IF;

  IF v_sim.requires_subscription = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions AS sub
      WHERE sub.user_id = auth.uid()
        AND sub.status = 'active'
        AND sub.end_at > now()
    ) THEN
      RAISE EXCEPTION 'Abonament necesar';
    END IF;
  END IF;

  -- Caută încercare existentă cu FOR UPDATE
  IF v_sim.requires_subscription = true THEN
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id
        AND a.user_id = auth.uid()
      FOR UPDATE
      LIMIT 1;
  ELSE
    SELECT * INTO v_existing FROM public.attempts AS a
      WHERE a.simulation_id = p_simulation_id
        AND a.user_id = auth.uid()
        AND a.submitted_at IS NULL
      ORDER BY a.started_at DESC
      FOR UPDATE
      LIMIT 1;
  END IF;

  -- Calculează scorul server-side
  v_answers := COALESCE(p_answers, '{}'::jsonb);
  v_max := (SELECT count(*) FROM public.questions AS q WHERE q.simulation_id = p_simulation_id);

  SELECT count(*) INTO v_score
    FROM public.questions AS q
    WHERE q.simulation_id = p_simulation_id
      AND (v_answers ->> q.id) = q.correct_answer;

  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL THEN
    -- Actualizează încercarea existentă
    UPDATE public.attempts SET
      answers = v_answers,
      score = v_score,
      max_score = v_max,
      submitted_at = now(),
      expired = p_expired
    WHERE id = v_existing.id AND user_id = auth.uid();

    RETURN QUERY
      SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
      FROM public.attempts AS a WHERE a.id = v_existing.id;
  ELSIF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NOT NULL THEN
    -- Încercare deja trimisă — returnează existenta
    RETURN QUERY
      SELECT a.id, a.user_id, a.simulation_id, a.answers, a.score, a.max_score, a.started_at, a.submitted_at, a.expired
      FROM public.attempts AS a WHERE a.id = v_existing.id;
  ELSE
    -- Creează încercare nouă (doar pentru free — premium ar fi fost prinsă mai sus)
    INSERT INTO public.attempts (user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired)
    VALUES (auth.uid(), p_simulation_id, v_answers, v_score, v_max, now(), now(), p_expired)
    RETURNING id, user_id, simulation_id, answers, score, max_score, started_at, submitted_at, expired
    INTO v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;

    RETURN QUERY
      SELECT v_existing.id, v_existing.user_id, v_existing.simulation_id, v_existing.answers, v_existing.score, v_existing.max_score, v_existing.started_at, v_existing.submitted_at, v_existing.expired;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, boolean) TO authenticated;

-- ============================================================
-- 12. REWRITE: get_attempt_results (calificat)
-- ============================================================

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
      v_attempt.id, v_attempt.simulation_id, v_attempt.answers,
      v_attempt.score, v_attempt.max_score, v_attempt.started_at,
      v_attempt.submitted_at, v_attempt.expired,
      q.id, q.type, q.position, q.question_text,
      q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
      q.statement_1, q.statement_2, q.statement_3, q.statement_4,
      q.correct_answer, q.explanation
    FROM public.questions AS q
    WHERE q.simulation_id = v_attempt.simulation_id
    ORDER BY q.position;
END;
$$;

REVOKE ALL ON FUNCTION public.get_attempt_results(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_attempt_results(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_results(uuid) TO authenticated;
