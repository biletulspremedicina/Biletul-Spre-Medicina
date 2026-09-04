/*
# Archive retake support for premium simulations

## Ce se schimbă
1. Adaugă coloana `is_archive_retake` (boolean, default false) pe tabela `attempts`
   pentru a distinge încercările din fereastra activă de cele din arhivă.
2. Actualizează politica INSERT pe `attempts` pentru a permite:
   - Simulări gratuite: încercări nelimitate (fără schimbare)
   - Simulări premium, încercare normală (is_archive_retake = false):
     doar în fereastra activă, dacă nu există deja o încercare normală
   - Simulări premium, retake din arhivă (is_archive_retake = true):
     doar după închiderea ferestrei, cu abonament activ,
     dacă nu există deja un retake din arhivă

## Note
- Fiecare utilizator premium poate susține o simulare o dată în fereastra activă
  și o dată suplimentar din arhivă (retake). După consumarea retake-ului,
  rămâne doar accesul la detalii și explicații.
- Simulările gratuite rămân nelimitate (mod practică).
*/

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS is_archive_retake boolean NOT NULL DEFAULT false;

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

      -- Simulări premium — încercare normală (fereastra activă)
      OR (
        attempts.is_archive_retake = false
        AND EXISTS (
          SELECT 1 FROM public.simulations s
          WHERE s.id = attempts.simulation_id
            AND s.requires_subscription = true
            AND s.is_active = true
            AND s.start_at <= now()
            AND now() <= s.end_at
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.attempts a
          WHERE a.simulation_id = attempts.simulation_id
            AND a.user_id = auth.uid()
            AND a.is_archive_retake = false
        )
      )

      -- Simulări premium — retake din arhivă (după închiderea ferestrei)
      OR (
        attempts.is_archive_retake = true
        AND EXISTS (
          SELECT 1 FROM public.simulations s
          WHERE s.id = attempts.simulation_id
            AND s.requires_subscription = true
            AND s.is_active = true
            AND s.end_at < now()
        )
        AND EXISTS (
          SELECT 1 FROM public.subscriptions sub
          WHERE sub.user_id = auth.uid()
            AND sub.status = 'active'
            AND sub.end_at > now()
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.attempts a
          WHERE a.simulation_id = attempts.simulation_id
            AND a.user_id = auth.uid()
            AND a.is_archive_retake = true
        )
      )
    )
  );
