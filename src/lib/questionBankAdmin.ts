import { supabase, type BankQuestion } from '@/lib/supabase';

export type QuestionSet = { id: string; title: string };
export type QuestionSetMemberships = Map<string, QuestionSet[]>;

const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 100;

export async function loadBankQuestions(lessonId: string, status: 'active' | 'archived' | 'all' = 'active') {
  const questions: BankQuestion[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from('practice_bank_questions')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (status !== 'all') query = query.eq('is_archived', status === 'archived');

    const { data, error } = await query;
    if (error) throw error;
    questions.push(...((data || []) as BankQuestion[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return questions;
}

export async function loadQuestionSetMemberships(questionIds: string[]): Promise<QuestionSetMemberships> {
  const memberships: QuestionSetMemberships = new Map(questionIds.map((id) => [id, []]));
  if (questionIds.length === 0) return memberships;

  const junctions: { question_id: string; set_id: string }[] = [];
  for (let start = 0; start < questionIds.length; start += ID_BATCH_SIZE) {
    const ids = questionIds.slice(start, start + ID_BATCH_SIZE);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('practice_set_questions')
        .select('question_id, set_id')
        .in('question_id', ids)
        .order('question_id')
        .order('set_id')
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      junctions.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  const setIds = [...new Set(junctions.map((item) => item.set_id))];
  const sets = new Map<string, QuestionSet>();
  for (let start = 0; start < setIds.length; start += ID_BATCH_SIZE) {
    const { data, error } = await supabase
      .from('practice_sets')
      .select('id, title')
      .in('id', setIds.slice(start, start + ID_BATCH_SIZE));
    if (error) throw error;
    for (const set of data || []) sets.set(set.id, set);
  }

  for (const item of junctions) {
    const set = sets.get(item.set_id);
    if (set) memberships.get(item.question_id)?.push(set);
  }
  for (const list of memberships.values()) list.sort((a, b) => a.title.localeCompare(b.title, 'ro'));

  return memberships;
}
