/*
# Trecere la model de abonament lunar

## Ce se schimbă
1. Simulările nu mai au o taxă per simulare (fee_ron). În schimb, fiecare simulare
   este marcată ca necesitând abonament (requires_subscription = true) sau fiind
   accesibilă fără abonament (requires_subscription = false).
2. Se creează tabelul `subscriptions` care reține abonamentele lunare ale elevilor.
   Un abonament este activ dacă data de final (end_at) este în viitor.
3. Politica RLS pentru `questions` este actualizată: accesul se acordă dacă
   simularea nu necesită abonament SAU elevul are un abonament activ.
4. Tabelul `payments` rămâne pentru istoric, dar nu mai este verificat pentru acces.

## Tabele noi
- `subscriptions`
  - `id` (uuid, PK)
  - `user_id` (uuid, FK auth.users, default auth.uid())
  - `status` (text: 'active' | 'expired')
  - `start_at` (timestamptz)
  - `end_at` (timestamptz) — data când expiră abonamentul
  - `amount_ron` (numeric) — suma plătită
  - `created_at` (timestamptz)

## Coloane noi
- `simulations.requires_subscription` (boolean, default false) — dacă necesită abonament

## Securitate
- RLS activat pe `subscriptions`
- Elevii își văd propriile abonamente
- Adminii văd toate abonamentele
- Elevii pot insera/actualiza propriile abonamente
- Politica `select_questions` actualizată pentru noul model
*/

-- 1. Adaugă coloana requires_subscription la simulations
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS requires_subscription boolean NOT NULL DEFAULT false;

-- 2. Creează tabelul subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL,
  amount_ron numeric(10,2) NOT NULL DEFAULT 30.00,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON public.subscriptions(user_id, end_at);

-- 3. Politici RLS pentru subscriptions
DROP POLICY IF EXISTS "select_own_subscriptions" ON public.subscriptions;
CREATE POLICY "select_own_subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_subscription" ON public.subscriptions;
CREATE POLICY "insert_own_subscription" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_subscription" ON public.subscriptions;
CREATE POLICY "update_own_subscription" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Actualizează politica select_questions pentru noul model
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
        -- Simulare fără abonament: oricine are acces
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
        -- Backward compat: simulări plătite anterior (fee_ron > 0 cu plată)
        OR EXISTS (
          SELECT 1 FROM public.payments pay
          WHERE pay.simulation_id = questions.simulation_id
            AND pay.user_id = auth.uid()
            AND pay.status = 'paid'
        )
      )
    )
    -- După închiderea ferestrei: elevii care au trimis un attempt
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

-- 5. Migrare date: simulările existente cu fee_ron > 0 necesită abonament
UPDATE public.simulations SET requires_subscription = true WHERE fee_ron > 0;
