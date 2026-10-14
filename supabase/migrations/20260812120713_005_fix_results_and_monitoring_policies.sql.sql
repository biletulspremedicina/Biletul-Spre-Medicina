/*
# Fix: allow students to see questions & explanations after the window closes
# Fix: allow admins to see all profiles for monitoring
*/

-- Questions: allow access during the window OR after the window closes
-- (for students who have a submitted attempt, or who had free/paid access)
DROP POLICY IF EXISTS "select_questions" ON public.questions;
CREATE POLICY "select_questions" ON public.questions
  FOR SELECT TO authenticated
  USING (
    -- Admins see everything
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = questions.simulation_id
          AND s.is_active = true
          AND s.start_at <= now()
          AND now() <= s.end_at
      )
      AND (
        -- Free simulation
        EXISTS (
          SELECT 1 FROM public.simulations s
          WHERE s.id = questions.simulation_id AND s.fee_ron = 0
        )
        -- Paid simulation
        OR EXISTS (
          SELECT 1 FROM public.payments pay
          WHERE pay.simulation_id = questions.simulation_id
            AND pay.user_id = auth.uid()
            AND pay.status = 'paid'
        )
      )
    )
    -- After the access window closes: allow if the student submitted an attempt
    OR (
      EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = questions.simulation_id
          AND s.is_active = true
          AND s.end_at < now()
      )
      AND EXISTS (
        SELECT 1 FROM public.attempts a
        WHERE a.simulation_id = questions.simulation_id
          AND a.user_id = auth.uid()
          AND a.submitted_at IS NOT NULL
      )
    )
  );

-- Profiles: allow admins to see all profiles (for monitoring)
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
