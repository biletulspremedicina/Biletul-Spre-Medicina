/*
# Allow free simulations (fee_ron = 0) without payment

Updates the questions SELECT policy so that when a simulation is free
(fee_ron = 0), any authenticated user can access its questions during
the access window — no payment required.
*/

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
      AND (
        -- Free simulation: no payment needed
        EXISTS (
          SELECT 1 FROM public.simulations s
          WHERE s.id = questions.simulation_id AND s.fee_ron = 0
        )
        -- Paid simulation: requires paid payment
        OR EXISTS (
          SELECT 1 FROM public.payments pay
          WHERE pay.simulation_id = questions.simulation_id
            AND pay.user_id = auth.uid()
            AND pay.status = 'paid'
        )
      )
    )
  );
