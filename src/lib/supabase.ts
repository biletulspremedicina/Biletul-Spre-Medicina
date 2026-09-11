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
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number;
  fee_ron: number;
  requires_subscription: boolean;
  is_active: boolean;
  created_at: string;
  student_section: 'all' | 'umfcd';
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

export type ExamQuestion = {
  id: string;
  simulation_id: string;
  type: 'CS' | 'CG';
  q_position: number;
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
  expires_at: string | null;
};

export type AttemptResult = {
  attempt_id: string;
  sim_id: string;
  answers: Record<string, string>;
  score: number;
  max_score: number;
  started_at: string;
  submitted_at: string;
  expired: boolean;
  question_id: string;
  q_type: 'CS' | 'CG';
  q_pos: number;
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
};

// ── Grile pe lecții (Practice Module) ──────────────────────────────

export type PracticeLesson = {
  id: string;
  title: string;
  description: string;
  subject: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PracticeSet = {
  id: string;
  lesson_id: string;
  title: string;
  description: string;
  target_question_count: number;
  requires_subscription: boolean;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PracticeQuestion = {
  id: string;
  set_id: string;
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

// ── Banca de grile (Question Bank) ───────────────────────────────────

export type BankQuestion = {
  id: string;
  lesson_id: string;
  type: 'CS' | 'CG';
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
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type SetQuestion = {
  id: string;
  set_id: string;
  question_id: string;
  position: number;
  created_at: string;
};

export type PracticeAttempt = {
  id: string;
  user_id: string;
  set_id: string;
  answers: Record<string, string>;
  score: number;
  max_score: number;
  started_at: string;
  submitted_at: string | null;
  created_at: string;
};

export type PracticeLessonRPC = {
  out_id: string;
  out_title: string;
  out_description: string;
  out_subject: string;
  out_position: number;
  out_set_count: number;
  out_question_count: number;
};

export type PracticeSetRPC = {
  out_id: string;
  out_title: string;
  out_description: string;
  out_target_question_count: number;
  out_requires_subscription: boolean;
  out_position: number;
  out_question_count: number;
  out_attempt_count: number;
  out_best_score: number;
};

export type PracticeQuestionRPC = {
  out_id: string;
  out_type: 'CS' | 'CG';
  out_position: number;
  out_question_text: string;
  out_option_a: string;
  out_option_b: string;
  out_option_c: string;
  out_option_d: string;
  out_option_e: string;
  out_statement_1: string;
  out_statement_2: string;
  out_statement_3: string;
  out_statement_4: string;
};

export type PracticeAttemptStartRPC = {
  out_id: string;
  out_set_id: string;
  out_answers: Record<string, string>;
  out_score: number;
  out_max_score: number;
  out_started_at: string;
  out_submitted_at: string | null;
  out_is_new: boolean;
};

export type PracticeResultRPC = {
  out_attempt_id: string;
  out_set_id: string;
  out_answers: Record<string, string>;
  out_score: number;
  out_max_score: number;
  out_started_at: string;
  out_submitted_at: string;
  out_question_id: string;
  out_q_type: 'CS' | 'CG';
  out_q_position: number;
  out_question_text: string;
  out_option_a: string;
  out_option_b: string;
  out_option_c: string;
  out_option_d: string;
  out_option_e: string;
  out_statement_1: string;
  out_statement_2: string;
  out_statement_3: string;
  out_statement_4: string;
  out_correct_answer: 'A' | 'B' | 'C' | 'D' | 'E';
  out_explanation: string;
};

export type PracticeHistoryRPC = {
  out_id: string;
  out_answers: Record<string, string>;
  out_score: number;
  out_max_score: number;
  out_started_at: string;
  out_submitted_at: string;
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

// ── Chat support ───────────────────────────────────────────────────────

export type ChatReason = 'platform_account' | 'subject_question' | 'suggestion_feedback' | 'other';

export type ChatConversation = {
  id: string;
  user_id: string | null;
  reason: ChatReason;
  description: string;
  status: 'new' | 'ongoing' | 'closed';
  admin_id: string | null;
  anonymous_token: string | null;
  rating: number | null;
  rating_created_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin';
  content: string;
  is_read: boolean;
  created_at: string;
};

export type MyChatConversationRPC = {
  out_id: string;
  out_reason: ChatReason;
  out_description: string;
  out_status: 'new' | 'ongoing' | 'closed';
  out_created_at: string;
  out_updated_at: string;
  out_last_message: string;
  out_last_message_at: string;
  out_unread_count: number;
  out_rating: number | null;
};

export type AnonChatConversationRPC = {
  out_id: string;
  out_reason: ChatReason;
  out_description: string;
  out_status: 'new' | 'ongoing' | 'closed';
  out_created_at: string;
  out_updated_at: string;
  out_last_message: string;
  out_last_message_at: string;
  out_unread_count: number;
  out_rating: number | null;
};

export type AdminChatConversationRPC = {
  out_id: string;
  out_user_id: string | null;
  out_user_name: string | null;
  out_user_email: string | null;
  out_is_anonymous: boolean;
  out_reason: ChatReason;
  out_description: string;
  out_status: 'new' | 'ongoing' | 'closed';
  out_admin_id: string | null;
  out_created_at: string;
  out_updated_at: string;
  out_last_message: string;
  out_last_message_at: string;
  out_unread_count: number;
  out_rating: number | null;
};

export const CHAT_REASON_LABELS: Record<ChatReason, string> = {
  platform_account: 'Platformă sau cont',
  subject_question: 'Întrebare legată de materie',
  suggestion_feedback: 'Sugestie sau feedback',
  other: 'Alt motiv',
};

export const CHAT_STATUS_LABELS: Record<string, string> = {
  new: 'Nouă',
  ongoing: 'În desfășurare',
  closed: 'Închisă',
};
