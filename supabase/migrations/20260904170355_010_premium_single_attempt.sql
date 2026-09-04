/*
# Single attempt enforcement for premium simulations

## Ce se schimbă
Actualizează politica `insert_own_attempt` pentru a bloca crearea unei noi
încercări la simulările premium (requires_subscription = true) dacă utilizatorul
are deja o încercare existentă pentru acea simulare. Simulările gratuite rămân
nelimitate (refacere pentru practică oricât de multe ori).

## Reguli
1. Simulări premium (requires_subscription = true):
   - O singură încercare per cont, indiferent de momentul susținerii
   - Dacă există deja un attempt, INSERT-ul este respins
2. Simulări gratuite (requires_subscription = false):
   - Încercări nelimitate (mod practică)
3. Adminii pot insera oricând (monitorizare)
*/

DROP POLICY IF EXISTS "insert_own_attempt" ON public.attempts;

CREATE POLICY "insert_own_attempt" ON public.attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Adminii pot insera oricând
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      -- Simulări gratuite: nelimitat
      OR EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = attempts.simulation_id AND s.requires_subscription = false
      )
      -- Simulări premium: doar dacă nu există deja un attempt
      OR (
        EXISTS (
          SELECT 1 FROM public.simulations s
          WHERE s.id = attempts.simulation_id AND s.requires_subscription = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.attempts a
          WHERE a.simulation_id = attempts.simulation_id
            AND a.user_id = auth.uid()
        )
      )
    )
  );
