import { useEffect, useState, useCallback } from 'react';
import { supabase, type PracticeSetRPC, type Subscription } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronLeft, ChevronRight, FileText, Crown, Lock, PlayCircle, RotateCcw,
  BookOpen, Trophy, Loader2, Sparkles, History,
} from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  lessonId: string;
  lessonTitle: string;
  onStartSet: (setId: string) => void;
  onViewResults: (setId: string, attemptId?: string) => void;
  onBack: () => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
};

export default function PracticeSetsView({
  lessonId, lessonTitle, onStartSet, onViewResults, onBack, onBuySubscription, buyingSub,
}: Props) {
  const { profile, signOut } = useAuth();
  const [sets, setSets] = useState<PracticeSetRPC[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data: setsData, error: setsError } = await supabase.rpc('get_practice_sets', {
      p_lesson_id: lessonId,
    });
    if (setsError) console.error('get_practice_sets error:', setsError);
    setSets((setsData || []) as unknown as PracticeSetRPC[]);

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .order('end_at', { ascending: false });
    const now = new Date();
    const activeSub = (subs || []).find(
      (s) => s.status === 'active' && new Date(s.end_at) > now
    ) as Subscription | undefined;
    setSubscription(activeSub || null);

    setLoading(false);
  }, [lessonId, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const hasActiveSub = !!subscription;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            {hasActiveSub ? (
              <span className="badge bg-amber-100 text-amber-700">
                <Crown size={12} /> Abonament activ
              </span>
            ) : (
              <span className="badge bg-stone-100 text-stone-500">Fără abonament</span>
            )}
            <button onClick={signOut} className="btn-ghost">Deconectare</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={onBack} className="btn-ghost mb-4">
          <ChevronLeft size={16} /> Înapoi la lecții
        </button>

        <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-50 to-stone-50 border border-brand-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-stone-900">{lessonTitle}</h3>
              <p className="text-sm text-stone-600">Rezolvă seturile de grile din această lecție.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <Loading message="Se încarcă seturile..." />
        ) : sets.length === 0 ? (
          <div className="card p-12 text-center text-stone-500">
            <FileText size={40} className="mx-auto mb-4 text-stone-300" />
            <p className="text-lg font-medium">Nu există seturi publicate în această lecție.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sets.map((set) => (
              <PracticeSetCard
                key={set.out_id}
                set={set}
                hasActiveSub={hasActiveSub}
                onStart={() => onStartSet(set.out_id)}
                onViewResults={(attemptId) => onViewResults(set.out_id, attemptId)}
                onBuySubscription={onBuySubscription}
                buyingSub={buyingSub}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeSetCard({
  set, hasActiveSub, onStart, onViewResults, onBuySubscription, buyingSub,
}: {
  set: PracticeSetRPC;
  hasActiveSub: boolean;
  onStart: () => void;
  onViewResults: (attemptId?: string) => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
}) {
  const isPremium = set.out_requires_subscription;
  const isLocked = isPremium && !hasActiveSub;
  const hasAttempts = set.out_attempt_count > 0;

  return (
    <div className="card p-5 flex flex-col">
      {/* Content */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-base font-semibold text-stone-900">{set.out_title}</h3>
          {isPremium ? (
            <span className="badge bg-amber-100 text-amber-700">
              <Crown size={12} /> Abonament
            </span>
          ) : (
            <span className="badge bg-brand-100 text-brand-700">
              <Sparkles size={12} /> Gratuit
            </span>
          )}
        </div>

        {set.out_description && (
          <p className="text-sm text-stone-600 line-clamp-2">{set.out_description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <FileText size={13} />
            {set.out_question_count} grile
          </span>
          {hasAttempts && (
            <>
              <span className="flex items-center gap-1">
                <History size={13} />
                {set.out_attempt_count} rezolvări
              </span>
              <span className="flex items-center gap-1 text-brand-600 font-medium">
                <Trophy size={13} />
                Cel mai bun: {set.out_best_score}/{set.out_question_count}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto pt-3 border-t border-stone-100 flex flex-col gap-2">
        {isLocked ? (
          <>
            <button
              onClick={onBuySubscription}
              disabled={buyingSub}
              className="btn-accent w-full"
            >
              {buyingSub ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
              Cumpără abonament pentru a accesa
            </button>
            <span className="text-xs text-stone-400 text-center">
              Mod test – abonamentul se activează gratuit, fără plată.
            </span>
          </>
        ) : (
          <>
            <button onClick={onStart} className="btn-primary w-full">
              {hasAttempts ? (
                <><RotateCcw size={16} /> Rezolvă din nou</>
              ) : (
                <><PlayCircle size={16} /> Începe setul</>
              )}
            </button>
            {hasAttempts && (
              <button onClick={() => onViewResults()} className="btn-secondary w-full">
                <BookOpen size={16} /> Vezi rezultatele
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
