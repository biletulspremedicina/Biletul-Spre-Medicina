/*
# Permite accesul la întrebări pentru simulări închise (mod arhivă/practică)

## Ce se schimbă
Actualizează politica `select_questions` pentru a permite oricărui elev
autentificat să vadă întrebările de la simulările care s-au închis
(end_at < now), nu doar cei care au trimis un attempt. Astfel, elevii
pot reface simulările anterioare pentru practică din secțiunea de Arhivă.

## Securitate
- Politica SELECT pentru questions permite acum:
  1. Adminii văd tot
  2. În timpul ferestrei active: acces conform regulilor de abonament
  3. DUPĂ închiderea ferestrei: orice elev autentificat poate vedea întrebările
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
    -- DUPĂ închiderea ferestrei: orice elev autentificat poate vedea întrebările (mod arhivă)
    OR (
      EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = questions.simulation_id
          AND s.is_active = true
          AND s.end_at < now()
      )
    )
  );
