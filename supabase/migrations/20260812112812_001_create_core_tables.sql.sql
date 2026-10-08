/*
# Bilet spre Medicină — Core Schema (Tables only)

Creates all tables for the platform: profiles, simulations, questions,
payments, attempts. RLS enabled but policies added in a follow-up migration
because the questions SELECT policy references the payments table.
*/

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- simulations
CREATE TABLE IF NOT EXISTS public.simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 120,
  fee_ron numeric(10,2) NOT NULL DEFAULT 50.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

-- questions
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('CS','CG')),
  position integer NOT NULL DEFAULT 0,
  question_text text NOT NULL,
  option_a text DEFAULT '',
  option_b text DEFAULT '',
  option_c text DEFAULT '',
  option_d text DEFAULT '',
  option_e text DEFAULT '',
  statement_1 text DEFAULT '',
  statement_2 text DEFAULT '',
  statement_3 text DEFAULT '',
  statement_4 text DEFAULT '',
  correct_answer text NOT NULL CHECK (correct_answer IN ('A','B','C','D','E')),
  explanation text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  amount_ron numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- attempts
CREATE TABLE IF NOT EXISTS public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expired boolean NOT NULL DEFAULT false
);
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_questions_simulation_id ON public.questions(simulation_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_sim ON public.payments(user_id, simulation_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_sim ON public.attempts(user_id, simulation_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
