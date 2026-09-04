import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'admin';
  created_at: string;
};

export type Simulation = {
  id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  fee_ron: number;
  requires_subscription: boolean;
  is_active: boolean;
  created_at: string;
};

export type AppSettings = {
  id: number;
  subscription_price_ron: number;
  updated_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  status: 'active' | 'expired';
  start_at: string;
  end_at: string;
  amount_ron: number;
  created_at: string;
};

export type Question = {
  id: string;
  simulation_id: string;
  type: 'CS' | 'CG';
  position: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  statement_1: string;
  statement_2: string;
  statement_3: string;
  statement_4: string;
  correct_answer: 'A' | 'B' | 'C' | 'D' | 'E';
  explanation: string;
  created_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  simulation_id: string;
  amount_ron: number;
  status: 'pending' | 'paid' | 'failed';
  created_at: string;
  paid_at: string | null;
};

export type Attempt = {
  id: string;
  user_id: string;
  simulation_id: string;
  answers: Record<string, string>;
  score: number;
  max_score: number;
  started_at: string;
  submitted_at: string | null;
  expired: boolean;
  is_archive_retake: boolean;
};
