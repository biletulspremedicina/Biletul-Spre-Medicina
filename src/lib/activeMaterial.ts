import { supabase, type Simulation } from '@/lib/supabase';
import { biologySimulationName, practiceSetName, umfcdSimulationName } from '@/lib/materialDisplayNames';

export type MaterialTarget = { kind: 'simulation' | 'practice'; id: string };
export type ActiveMaterial = {
  name: string;
  target: MaterialTarget;
  lessonId?: string;
  lessonTitle?: string;
};

// Check both attempt tables each time, so another tab or device is also respected.
export async function findOtherActiveMaterial(userId: string, target: MaterialTarget): Promise<ActiveMaterial | null> {
  const [examResult, practiceResult] = await Promise.all([
    supabase.from('attempts').select('simulation_id, started_at')
      .eq('user_id', userId).is('submitted_at', null),
    supabase.from('practice_attempts').select('set_id, started_at')
      .eq('user_id', userId).is('submitted_at', null),
  ]);
  if (examResult.error || practiceResult.error) {
    throw examResult.error || practiceResult.error;
  }

  const open = [
    ...(examResult.data || []).map((row) => ({ kind: 'simulation' as const, id: row.simulation_id, startedAt: row.started_at })),
    ...(practiceResult.data || []).map((row) => ({ kind: 'practice' as const, id: row.set_id, startedAt: row.started_at })),
  ];
  // Existing attempts always remain resumable, including data created before
  // this one-at-a-time rule was introduced.
  if (open.some((row) => row.kind === target.kind && row.id === target.id)) return null;
  const blocking = open.sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
  if (!blocking) return null;
  const blockingTarget: MaterialTarget = { kind: blocking.kind, id: blocking.id };

  if (blocking.kind === 'simulation') {
    const { data, error } = await supabase.from('simulations')
      .select('title, student_section, display_order, umfcd_kind, umfcd_year')
      .eq('id', blocking.id).maybeSingle();
    if (error) throw error;
    if (!data) return { name: 'O simulare', target: blockingTarget };
    const simulation = data as Pick<Simulation, 'title' | 'student_section' | 'display_order' | 'umfcd_kind' | 'umfcd_year'>;
    return simulation.student_section === 'umfcd'
      ? { name: umfcdSimulationName(simulation), target: blockingTarget }
      : { name: simulation.display_order ? biologySimulationName(simulation.display_order) : simulation.title, target: blockingTarget };
  }

  const { data: set, error: setError } = await supabase.from('practice_sets')
    .select('title, position, lesson_id').eq('id', blocking.id).maybeSingle();
  if (setError) throw setError;
  if (!set) return { name: 'Un set', target: blockingTarget };
  const { data: lesson, error: lessonError } = await supabase.from('practice_lessons')
    .select('title').eq('id', set.lesson_id).maybeSingle();
  if (lessonError) throw lessonError;
  return {
    name: lesson ? practiceSetName(lesson.title, set.position + 1) : set.title,
    target: blockingTarget,
    lessonId: set.lesson_id,
    lessonTitle: lesson?.title,
  };
}
