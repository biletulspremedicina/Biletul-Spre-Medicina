/*
# Bilet spre Medicină — RLS Policies

Adds row-level security policies for all tables.
- profiles: users see/update/insert their own profile.
- simulations: students see active sims; admins have full CRUD.
- questions: students see questions only if sim is active, within access window,
  and they have a paid payment; admins have full CRUD.
- payments: students see/insert/update their own payments; admins see all.
- attempts: students see/insert/update their own attempts; admins see all.
*/

-- profiles
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- simulations
DROP POLICY IF EXISTS "select_simulations" ON public.simulations;
CREATE POLICY "select_simulations" ON public.simulations
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_simulations" ON public.simulations;
CREATE POLICY "admin_insert_simulations" ON public.simulations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_simulations" ON public.simulations;
CREATE POLICY "admin_update_simulations" ON public.simulations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_simulations" ON public.simulations;
CREATE POLICY "admin_delete_simulations" ON public.simulations
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- questions
DROP POLICY IF EXISTS "select_questions" ON public.questions;
CREATE POLICY "select_questions" ON public.questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = questions.simulation_id
          AND s.is_active = true
          AND s.start_at <= now()
          AND now() <= s.end_at
      )
      AND EXISTS (
        SELECT 1 FROM public.payments pay
        WHERE pay.simulation_id = questions.simulation_id
          AND pay.user_id = auth.uid()
          AND pay.status = 'paid'
      )
    )
  );

DROP POLICY IF EXISTS "admin_insert_questions" ON public.questions;
CREATE POLICY "admin_insert_questions" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_questions" ON public.questions;
CREATE POLICY "admin_update_questions" ON public.questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_questions" ON public.questions;
CREATE POLICY "admin_delete_questions" ON public.questions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- payments
DROP POLICY IF EXISTS "select_payments" ON public.payments;
CREATE POLICY "select_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_payment" ON public.payments;
CREATE POLICY "insert_own_payment" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_payment" ON public.payments;
CREATE POLICY "update_own_payment" ON public.payments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- attempts
DROP POLICY IF EXISTS "select_attempts" ON public.attempts;
CREATE POLICY "select_attempts" ON public.attempts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_attempt" ON public.attempts;
CREATE POLICY "insert_own_attempt" ON public.attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_attempt" ON public.attempts;
CREATE POLICY "update_own_attempt" ON public.attempts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
