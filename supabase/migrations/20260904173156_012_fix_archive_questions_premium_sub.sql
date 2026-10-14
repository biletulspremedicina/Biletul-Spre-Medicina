/*
# Fix questions RLS for archive retake: premium sims need subscription

## Ce se schimbă
Actualizează politica `select_questions` pentru simulări închise:
- Simulări gratuite închise: orice elev autentificat poate vedea întrebările (mod practică)
- Simulări premium închise: necesită abonament activ (pentru retake din arhivă)

## De ce
Politica anterioară permitea ORICĂRUI elev să vadă întrebările de la
simulările premium închise, chiar și fără abonament. Asta însemna că
utilizatorii fără abonament puteau accesa conținutul premium din arhivă.
Acum, simulările premium închise necesită abonament activ pentru a vedea
întrebările — corespunzător cu butonul "Cumpără abonament" din arhivă.
*/

DROP POLICY IF EXISTS "select_questions" ON public.questions;

CREATE POLICY "select_questions" ON public.questions
  FOR SELECT TO authenticated
  USING (
    -- Adminii văd tot
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      -- În timpul ferestrei active
      EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = questions.simulation_id
          AND s.is_active = true
          AND s.start_at <= now()
          AND now() <= s.end_at
      )
      AND (
        -- Simulare fără abonament
        EXISTS (
          SELECT 1 FROM public.simulations s
          WHERE s.id = questions.simulation_id AND s.requires_subscription = false
        )
        -- Simulare cu abonament: necesită abonament activ
        OR (
          EXISTS (
            SELECT 1 FROM public.simulations s
            WHERE s.id = questions.simulation_id AND s.requires_subscription = true
          )
          AND EXISTS (
            SELECT 1 FROM public.subscriptions sub
            WHERE sub.user_id = auth.uid()
              AND sub.status = 'active'
              AND sub.end_at > now()
          )
        )
        -- Backward compat: plăți vechi
        OR EXISTS (
          SELECT 1 FROM public.payments pay
          WHERE pay.simulation_id = questions.simulation_id
            AND pay.user_id = auth.uid()
            AND pay.status = 'paid'
        )
      )
    )
    -- DUPĂ închiderea ferestrei: simulări gratuite → orice elev (mod practică)
    OR (
      EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = questions.simulation_id
          AND s.is_active = true
          AND s.end_at < now()
          AND s.requires_subscription = false
      )
    )
    -- DUPĂ închiderea ferestrei: simulări premium → necesită abonament activ
    OR (
      EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = questions.simulation_id
          AND s.is_active = true
          AND s.end_at < now()
          AND s.requires_subscription = true
      )
      AND EXISTS (
        SELECT 1 FROM public.subscriptions sub
        WHERE sub.user_id = auth.uid()
          AND sub.status = 'active'
          AND sub.end_at > now()
      )
    )
  );
