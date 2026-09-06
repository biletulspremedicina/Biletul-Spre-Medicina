import { useEffect, useState, useCallback } from 'react';
import { supabase, type PracticeLessonRPC } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, ChevronRight, Layers, FileText, Loader2, Clock, RotateCcw, Trophy } from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  onOpenLesson: (lessonId: string, lessonTitle: string) => void;
  onBack: () => void;
};

export default function PracticeLessonsView({ onOpenLesson, onBack }: Props) {
  const { profile, signOut } = useAuth();
  const [lessons, setLessons] = useState<PracticeLessonRPC[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_practice_lessons');
    if (error) {
      console.error('get_practice_lessons error:', error);
    }
    setLessons((data || []) as unknown as PracticeLessonRPC[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-600 hidden sm:inline">{profile?.full_name || profile?.email}</span>
            <button onClick={signOut} className="btn-ghost">Deconectare</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={onBack} className="btn-ghost mb-4">
          <ChevronRight size={16} className="rotate-180" /> Înapoi la dashboard
        </button>

        <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-50 to-stone-50 border border-brand-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-stone-900">Grile pe lecții</h3>
              <p className="text-sm text-stone-600">
                Alege o lecție și rezolvă seturi de grile pe tema respectivă. Antrenament nelimitat, fără cronometru.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <Loading message="Se încarcă lecțiile..." />
        ) : lessons.length === 0 ? (
          <div className="card p-12 text-center text-stone-500">
            <BookOpen size={40} className="mx-auto mb-4 text-stone-300" />
            <p className="text-lg font-medium">Nu există lecții publicate momentan.</p>
            <p className="text-sm mt-1">Revino mai târziu pentru lecții noi.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.out_id}
                lesson={lesson}
                onOpen={() => onOpenLesson(lesson.out_id, lesson.out_title)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LessonCard({ lesson, onOpen }: { lesson: PracticeLessonRPC; onOpen: () => void }) {
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <BookOpen size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="badge bg-stone-100 text-stone-500 mb-1">{lesson.out_subject}</span>
          <h3 className="font-display text-base font-semibold text-stone-900 line-clamp-2">{lesson.out_title}</h3>
        </div>
      </div>

      {lesson.out_description && (
        <p className="text-sm text-stone-600 line-clamp-2 mb-3">{lesson.out_description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 mb-4">
        <span className="flex items-center gap-1">
          <Layers size={13} />
          {lesson.out_set_count} seturi
        </span>
        <span className="flex items-center gap-1">
          <FileText size={13} />
          {lesson.out_question_count} grile
        </span>
      </div>

      <div className="mt-auto pt-3 border-t border-stone-100">
        <button onClick={onOpen} className="btn-primary w-full">
          Vezi seturile
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
