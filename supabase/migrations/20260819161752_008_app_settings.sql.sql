/*
# Tabel de setări aplicație

## Ce se schimbă
1. Se creează tabelul `app_settings` cu o singură rând pentru setări globale.
   Coloana `subscription_price_ron` reține prețul abonamentului lunar.
2. RLS: adminii pot citi și modifica setările; elevii pot doar citi.

## Tabele noi
- `app_settings`
  - `id` (int, PK, default 1)
  - `subscription_price_ron` (numeric, default 30.00)
  - `updated_at` (timestamptz)
*/

CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  subscription_price_ron numeric(10,2) NOT NULL DEFAULT 30.00,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Inserează rândul default dacă nu există
INSERT INTO public.app_settings (id, subscription_price_ron)
VALUES (1, 30.00)
ON CONFLICT (id) DO NOTHING;

-- Politici RLS
DROP POLICY IF EXISTS "select_app_settings" ON public.app_settings;
CREATE POLICY "select_app_settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_update_app_settings" ON public.app_settings;
CREATE POLICY "admin_update_app_settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
