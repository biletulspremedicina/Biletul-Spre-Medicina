import { useEffect, useState, useCallback } from 'react';
import { supabase, type PracticeLesson, type PracticeSet, type PracticeQuestion } from '@/lib/supabase';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, ChevronLeft, Save, X, Loader2, BookOpen,
  Layers, AlertTriangle, Copy, ArrowUp, ArrowDown,
} from 'lucide-react';
import ContentTools from '@/components/admin/ContentTools';

// ── Main component ──────────────────────────────────────────────────────

export default function PracticeAdmin() {
  const [lessons, setLessons] = useState<PracticeLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLesson, setEditingLesson] = useState<PracticeLesson | null>(null);
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<PracticeLesson | null>(null);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('practice_lessons')
      .select('*')
      .order('position', { ascending: true });
    setLessons((data || []) as PracticeLesson[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  if (creatingLesson) {
    return <LessonForm onSaved={() => { setCreatingLesson(false); loadLessons(); }} onCancel={() => setCreatingLesson(false)} />;
  }

  if (editingLesson) {
    return (
      <div>
        <button onClick={() => setEditingLesson(null)} className="btn-ghost mb-4">
          <ChevronLeft size={16} /> Înapoi la lecții
        </button>
        <LessonForm lesson={editingLesson} onSaved={() => { setEditingLesson(null); loadLessons(); }} onCancel={() => setEditingLesson(null)} />
      </div>
    );
  }

  if (selectedLesson) {
    return (
      <SetsManager
        lesson={selectedLesson}
        onBack={() => { setSelectedLesson(null); loadLessons(); }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-stone-900">Lecții</h2>
          <p className="text-sm text-stone-500 mt-1">Creează și administrează lecțiile de grile.</p>
        </div>
        <button onClick={() => setCreatingLesson(true)} className="btn-primary">
          <Plus size={16} /> Creează lecție
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Se încarcă...</p>
      ) : lessons.length === 0 ? (
        <div className="card p-12 text-center text-stone-500">
          <BookOpen size={40} className="mx-auto mb-4 text-stone-300" />
          <p className="text-lg font-medium">Nu există lecții.</p>
          <p className="text-sm mt-1">Creează prima lecție pentru a începe.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lessons.map((lesson, idx) => (
            <LessonAdminCard
              key={lesson.id}
              lesson={lesson}
              canMoveUp={idx > 0}
              canMoveDown={idx < lessons.length - 1}
              onEdit={() => setEditingLesson(lesson)}
              onReload={loadLessons}
              onOpen={() => setSelectedLesson(lesson)}
              onMove={(dir) => moveLesson(lesson, dir, lessons, loadLessons)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

async function moveLesson(lesson: PracticeLesson, dir: 'up' | 'down', all: PracticeLesson[], reload: () => void) {
  const idx = all.findIndex((l) => l.id === lesson.id);
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;
  const other = all[swapIdx];
  await Promise.all([
    supabase.from('practice_lessons').update({ position: other.position, updated_at: new Date().toISOString() }).eq('id', lesson.id),
    supabase.from('practice_lessons').update({ position: lesson.position, updated_at: new Date().toISOString() }).eq('id', other.id),
  ]);
  reload();
}

// ── Lesson Card ─────────────────────────────────────────────────────────

function LessonAdminCard({
  lesson, canMoveUp, canMoveDown, onEdit, onReload, onOpen, onMove,
}: {
  lesson: PracticeLesson;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onReload: () => void;
  onOpen: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const [setCount, setSetCount] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('practice_sets')
        .select('*', { count: 'exact', head: true })
        .eq('lesson_id', lesson.id);
      setSetCount(count || 0);
    })();
  }, [lesson.id]);

  const toggleActive = async () => {
    setPublishError(null);
    if (!lesson.is_active && !lesson.title.trim()) {
      setPublishError('Titlul nu poate fi gol.');
      return;
    }
    await supabase
      .from('practice_lessons')
      .update({ is_active: !lesson.is_active, updated_at: new Date().toISOString() })
      .eq('id', lesson.id);
    onReload();
  };

  const handleDelete = async () => {
    if (!confirm(`Sigur vrei să ștergi lecția „${lesson.title}"? Se vor șterge toate seturile și întrebările asociate.`)) return;
    await supabase.from('practice_lessons').delete().eq('id', lesson.id);
    onReload();
  };

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onMove('up')}
              disabled={!canMoveUp}
              className="text-stone-400 hover:text-stone-700 disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
            <button
              onClick={() => onMove('down')}
              disabled={!canMoveDown}
              className="text-stone-400 hover:text-stone-700 disabled:opacity-30"
            >
              <ArrowDown size={14} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <span className="badge bg-stone-100 text-stone-500 mb-1">{lesson.subject}</span>
            <h3 className="font-display text-base font-semibold text-stone-900">{lesson.title}</h3>
          </div>
          {lesson.is_active ? (
            <span className="badge bg-green-100 text-green-700"><Eye size={12} /> Publicată</span>
          ) : (
            <span className="badge bg-stone-100 text-stone-500"><EyeOff size={12} /> Ciornă</span>
          )}
        </div>

        {lesson.description && (
          <p className="text-sm text-stone-600 line-clamp-2">{lesson.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
          <span className="flex items-center gap-1"><Layers size={13} /> {setCount} seturi</span>
        </div>

        {publishError && (
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertTriangle size={12} /> {publishError}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
          <button onClick={onOpen} className="btn-secondary"><Layers size={15} /> Seturi</button>
          <button onClick={onEdit} className="btn-ghost"><Edit2 size={15} /> Editează</button>
          <button onClick={toggleActive} className="btn-ghost">
            {lesson.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
            {lesson.is_active ? 'Ascunde' : 'Publică'}
          </button>
          <button onClick={handleDelete} className="btn-ghost text-red-600 hover:bg-red-50">
            <Trash2 size={15} /> Șterge
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lesson Form ─────────────────────────────────────────────────────────

function LessonForm({ lesson, onSaved, onCancel }: { lesson?: PracticeLesson; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(lesson?.title || '');
  const [description, setDescription] = useState(lesson?.description || '');
  const [subject, setSubject] = useState(lesson?.subject || 'Biologie');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError('Titlul este obligatoriu.'); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      subject: subject.trim() || 'Biologie',
      updated_at: new Date().toISOString(),
    };
    if (lesson) {
      const { error: err } = await supabase.from('practice_lessons').update(payload).eq('id', lesson.id);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase.from('practice_lessons').insert({ ...payload, position: 0 });
      if (err) setError(err.message);
    }
    setSaving(false);
    if (!error) onSaved();
  };

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl font-bold text-stone-900 mb-6">
        {lesson ? 'Editează lecția' : 'Creează lecție nouă'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Titlu</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Citologie..." />
        </div>
        <div>
          <label className="label">Materie</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Biologie" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descriere</label>
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descriere scurtă a lecției..." />
        </div>
      </div>
      {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary"><X size={16} /> Anulează</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving && <Loader2 size={16} className="animate-spin" />}
          <Save size={16} /> {lesson ? 'Salvează' : 'Creează lecția'}
        </button>
      </div>
    </div>
  );
}

// ── Sets Manager ────────────────────────────────────────────────────────

function SetsManager({ lesson, onBack }: { lesson: PracticeLesson; onBack: () => void }) {
  const [sets, setSets] = useState<PracticeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSet, setCreatingSet] = useState(false);
  const [editingSet, setEditingSet] = useState<PracticeSet | null>(null);
  const [selectedSet, setSelectedSet] = useState<PracticeSet | null>(null);

  const loadSets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('practice_sets')
      .select('*')
      .eq('lesson_id', lesson.id)
      .order('position', { ascending: true });
    setSets((data || []) as PracticeSet[]);
    setLoading(false);
  }, [lesson.id]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  if (creatingSet) {
    return (
      <SetForm
        lessonId={lesson.id}
        position={sets.length}
        onSaved={() => { setCreatingSet(false); loadSets(); }}
        onCancel={() => setCreatingSet(false)}
      />
    );
  }

  if (editingSet) {
    return (
      <div>
        <button onClick={() => setEditingSet(null)} className="btn-ghost mb-4">
          <ChevronLeft size={16} /> Înapoi la seturi
        </button>
        <SetForm
          lessonId={lesson.id}
          set={editingSet}
          position={editingSet.position}
          onSaved={() => { setEditingSet(null); loadSets(); }}
          onCancel={() => setEditingSet(null)}
        />
      </div>
    );
  }

  if (selectedSet) {
    return (
      <QuestionsManagerAdmin
        set={selectedSet}
        lesson={lesson}
        onBack={() => { setSelectedSet(null); loadSets(); }}
      />
    );
  }

  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4">
        <ChevronLeft size={16} /> Înapoi la lecții
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-stone-900">{lesson.title}</h2>
          <p className="text-sm text-stone-500 mt-1">Seturi de grile din această lecție</p>
        </div>
        <button onClick={() => setCreatingSet(true)} className="btn-primary">
          <Plus size={16} /> Creează set
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Se încarcă...</p>
      ) : sets.length === 0 ? (
        <div className="card p-12 text-center text-stone-500">
          <Layers size={40} className="mx-auto mb-4 text-stone-300" />
          <p className="text-lg font-medium">Nu există seturi în această lecție.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sets.map((set, idx) => (
            <SetAdminCard
              key={set.id}
              set={set}
              canMoveUp={idx > 0}
              canMoveDown={idx < sets.length - 1}
              onEdit={() => setEditingSet(set)}
              onReload={loadSets}
              onOpen={() => setSelectedSet(set)}
              onMove={(dir) => moveSet(set, dir, sets, loadSets)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

async function moveSet(set: PracticeSet, dir: 'up' | 'down', all: PracticeSet[], reload: () => void) {
  const idx = all.findIndex((s) => s.id === set.id);
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;
  const other = all[swapIdx];
  await Promise.all([
    supabase.from('practice_sets').update({ position: other.position, updated_at: new Date().toISOString() }).eq('id', set.id),
    supabase.from('practice_sets').update({ position: set.position, updated_at: new Date().toISOString() }).eq('id', other.id),
  ]);
  reload();
}

// ── Set Card ────────────────────────────────────────────────────────────

function SetAdminCard({
  set, canMoveUp, canMoveDown, onEdit, onReload, onOpen, onMove,
}: {
  set: PracticeSet;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onReload: () => void;
  onOpen: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const [questionCount, setQuestionCount] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('practice_questions')
        .select('*', { count: 'exact', head: true })
        .eq('set_id', set.id);
      setQuestionCount(count || 0);
    })();
  }, [set.id]);

  const toggleActive = async () => {
    setPublishError(null);
    if (!set.is_active) {
      if (!set.title.trim()) { setPublishError('Titlul nu poate fi gol.'); return; }
      if (questionCount !== set.target_question_count) {
        setPublishError(`Setul trebuie să aibă exact ${set.target_question_count} grile. Acum are ${questionCount}.`);
        return;
      }
      const { data: qs } = await supabase
        .from('practice_questions')
        .select('correct_answer, explanation')
        .eq('set_id', set.id);
      const missing = (qs || []).some((q) => !q.correct_answer || !(q as PracticeQuestion).explanation?.trim());
      if (missing) {
        setPublishError('Toate grilele trebuie să aibă un răspuns corect și o explicație.');
        return;
      }
    }
    await supabase
      .from('practice_sets')
      .update({ is_active: !set.is_active, updated_at: new Date().toISOString() })
      .eq('id', set.id);
    onReload();
  };

  const handleDuplicate = async () => {
    const newTitle = `${set.title} (copie)`;
    const { data: newSet, error: insertError } = await supabase
      .from('practice_sets')
      .insert({
        lesson_id: set.lesson_id,
        title: newTitle,
        description: set.description,
        target_question_count: set.target_question_count,
        requires_subscription: set.requires_subscription,
        position: set.position + 1,
        is_active: false,
      })
      .select()
      .single();
    if (insertError || !newSet) return;

    const { data: questions } = await supabase
      .from('practice_questions')
      .select('*')
      .eq('set_id', set.id)
      .order('position', { ascending: true });

    if (questions && questions.length > 0) {
      const newQuestions = (questions as PracticeQuestion[]).map((q) => ({
        set_id: newSet.id,
        type: q.type,
        position: q.position,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        option_e: q.option_e,
        statement_1: q.statement_1,
        statement_2: q.statement_2,
        statement_3: q.statement_3,
        statement_4: q.statement_4,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
      }));
      await supabase.from('practice_questions').insert(newQuestions);
    }
    onReload();
  };

  const handleDelete = async () => {
    if (!confirm(`Sigur vrei să ștergi setul „${set.title}"? Se vor șterge toate întrebările asociate.`)) return;
    await supabase.from('practice_sets').delete().eq('id', set.id);
    onReload();
  };

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <button onClick={() => onMove('up')} disabled={!canMoveUp} className="text-stone-400 hover:text-stone-700 disabled:opacity-30">
              <ArrowUp size={14} />
            </button>
            <button onClick={() => onMove('down')} disabled={!canMoveDown} className="text-stone-400 hover:text-stone-700 disabled:opacity-30">
              <ArrowDown size={14} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-semibold text-stone-900">{set.title}</h3>
          </div>
          {set.is_active ? (
            <span className="badge bg-green-100 text-green-700"><Eye size={12} /> Publicat</span>
          ) : (
            <span className="badge bg-stone-100 text-stone-500"><EyeOff size={12} /> Ciornă</span>
          )}
        </div>

        {set.description && <p className="text-sm text-stone-600 line-clamp-2">{set.description}</p>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <BookOpen size={13} />
            Grile introduse: <strong className="text-stone-700">{questionCount} din {set.target_question_count}</strong>
          </span>
          <span className={`badge ${set.requires_subscription ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'}`}>
            {set.requires_subscription ? 'Cu abonament' : 'Gratuit'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
          <div
            className={`h-full transition-all ${questionCount === set.target_question_count ? 'bg-green-500' : 'bg-accent-500'}`}
            style={{ width: `${set.target_question_count > 0 ? Math.min(100, (questionCount / set.target_question_count) * 100) : 0}%` }}
          />
        </div>

        {publishError && (
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertTriangle size={12} /> {publishError}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
          <button onClick={onOpen} className="btn-secondary"><BookOpen size={15} /> Întrebări</button>
          <button onClick={onEdit} className="btn-ghost"><Edit2 size={15} /> Editează</button>
          <button onClick={toggleActive} className="btn-ghost">
            {set.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
            {set.is_active ? 'Ascunde' : 'Publică'}
          </button>
          <button onClick={handleDuplicate} className="btn-ghost"><Copy size={15} /> Dublează</button>
          <button onClick={handleDelete} className="btn-ghost text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
        </div>
      </div>
    </div>
  );
}

// ── Set Form ────────────────────────────────────────────────────────────

function SetForm({ lessonId, set, position, onSaved, onCancel }: {
  lessonId: string;
  set?: PracticeSet;
  position: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(set?.title || '');
  const [description, setDescription] = useState(set?.description || '');
  const [targetCount, setTargetCount] = useState(set?.target_question_count?.toString() || '10');
  const [requiresSub, setRequiresSub] = useState(set ? set.requires_subscription : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError('Titlul este obligatoriu.'); return; }
    const tc = parseInt(targetCount) || 0;
    if (tc <= 0) { setError('Numărul de grile trebuie să fie mai mare decât zero.'); return; }

    setSaving(true);
    const payload = {
      lesson_id: lessonId,
      title: title.trim(),
      description: description.trim(),
      target_question_count: tc,
      requires_subscription: requiresSub,
      position,
      updated_at: new Date().toISOString(),
    };

    if (set) {
      // Check if reducing target below existing questions
      const { count } = await supabase
        .from('practice_questions')
        .select('*', { count: 'exact', head: true })
        .eq('set_id', set.id);
      const realCount = count || 0;
      if (tc < realCount) {
        setError(`Nu poți reduce numărul la ${tc} — există deja ${realCount} grile introduse. Șterge întâi grilele în plus.`);
        setSaving(false);
        return;
      }

      const updatePayload = { ...payload };
      delete (updatePayload as Record<string, unknown>).lesson_id;
      delete (updatePayload as Record<string, unknown>).position;
      const { error: err } = await supabase.from('practice_sets').update(updatePayload).eq('id', set.id);
      if (err) setError(err.message);

      // If set was published and target changed making it incomplete, unpublish
      if (set.is_active && tc !== realCount) {
        await supabase.from('practice_sets').update({ is_active: false }).eq('id', set.id);
      }
    } else {
      const { error: err } = await supabase.from('practice_sets').insert(payload);
      if (err) setError(err.message);
    }

    setSaving(false);
    if (!error) onSaved();
  };

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl font-bold text-stone-900 mb-6">
        {set ? 'Editează setul' : 'Creează set nou'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Titlu</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Set 1 — Celula..." />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descriere</label>
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descriere scurtă..." />
        </div>
        <div>
          <label className="label">Număr de grile</label>
          <input type="number" className="input" value={targetCount} onChange={(e) => setTargetCount(e.target.value)} min={1} />
          <p className="mt-1 text-xs text-stone-500">Numărul exact de grile pe care trebuie să le aibă setul.</p>
        </div>
        <div>
          <label className="label">Acces</label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-600 mt-2">
            <input
              type="checkbox"
              checked={requiresSub}
              onChange={(e) => setRequiresSub(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            Necesită abonament
          </label>
        </div>
      </div>
      {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary"><X size={16} /> Anulează</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving && <Loader2 size={16} className="animate-spin" />}
          <Save size={16} /> {set ? 'Salvează' : 'Creează setul'}
        </button>
      </div>
    </div>
  );
}

// ── Questions Manager (Admin) ───────────────────────────────────────────

function QuestionsManagerAdmin({ set, lesson, onBack }: { set: PracticeSet; lesson: PracticeLesson; onBack: () => void }) {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PracticeQuestion | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('practice_questions')
      .select('*')
      .eq('set_id', set.id)
      .order('position', { ascending: true });
    setQuestions((data || []) as PracticeQuestion[]);
    setLoading(false);
  }, [set.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (creating) {
    return (
      <PracticeQuestionForm
        setId={set.id}
        position={questions.length}
        onSaved={() => { setCreating(false); load(); }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(null)} className="btn-ghost mb-3">
          <ChevronLeft size={16} /> Înapoi la întrebări
        </button>
        <PracticeQuestionForm
          setId={set.id}
          question={editing}
          position={editing.position}
          onSaved={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4">
        <ChevronLeft size={16} /> Înapoi la seturi
      </button>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-stone-900">{set.title}</h2>
          <p className="text-sm text-stone-500 mt-1">
            Grile introduse: <strong className="text-stone-700">{questions.length} din {set.target_question_count}</strong>
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus size={16} /> Adaugă grilă
        </button>
      </div>

      <div className="mb-4">
        <ContentTools
          contentType="practice_set"
          contentId={set.id}
          contentTitle={set.title}
          materie={lesson.subject}
          lectie={lesson.title}
          questionTable="practice_questions"
          parentColumn="set_id"
          isPublished={set.is_active}
          onQuestionsChanged={load}
        />
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Se încarcă...</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-stone-500 py-4">Nu există întrebări. Adaugă prima grilă.</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => (
            <div key={q.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-600">{idx + 1}</span>
              <span className="badge bg-stone-100 text-stone-600">{q.type}</span>
              <span className="text-sm text-stone-700 truncate flex-1">{q.question_text}</span>
              <span className="text-xs font-bold text-brand-600">Corect: {q.correct_answer}</span>
              <button onClick={() => setEditing(q)} className="btn-ghost text-xs px-2 py-1"><Edit2 size={13} /></button>
              <button
                onClick={async () => {
                  if (!confirm('Sigur vrei să ștergi această întrebare?')) return;
                  await supabase.from('practice_questions').delete().eq('id', q.id);
                  load();
                }}
                className="btn-ghost text-xs px-2 py-1 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Practice Question Form ──────────────────────────────────────────────

function PracticeQuestionForm({
  setId, question, position, onSaved, onCancel,
}: {
  setId: string;
  question?: PracticeQuestion;
  position: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<'CS' | 'CG'>(question?.type || 'CS');
  const [questionText, setQuestionText] = useState(question?.question_text || '');
  const [optionA, setOptionA] = useState(question?.option_a || '');
  const [optionB, setOptionB] = useState(question?.option_b || '');
  const [optionC, setOptionC] = useState(question?.option_c || '');
  const [optionD, setOptionD] = useState(question?.option_d || '');
  const [optionE, setOptionE] = useState(question?.option_e || '');
  const [s1, setS1] = useState(question?.statement_1 || '');
  const [s2, setS2] = useState(question?.statement_2 || '');
  const [s3, setS3] = useState(question?.statement_3 || '');
  const [s4, setS4] = useState(question?.statement_4 || '');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D' | 'E'>(question?.correct_answer || 'A');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!questionText.trim()) { setError('Textul întrebării este obligatoriu.'); return; }
    if (type === 'CS') {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim() || !optionE.trim()) {
        setError('Toate opțiunile A-E trebuie completate pentru Complement Simplu.'); return;
      }
    } else {
      if (!s1.trim() || !s2.trim() || !s3.trim() || !s4.trim()) {
        setError('Toate afirmațiile 1-4 trebuie completate pentru Complement Grupat.'); return;
      }
    }

    setSaving(true);
    const payload = {
      set_id: setId,
      type,
      position,
      question_text: questionText.trim(),
      option_a: type === 'CS' ? optionA.trim() : '',
      option_b: type === 'CS' ? optionB.trim() : '',
      option_c: type === 'CS' ? optionC.trim() : '',
      option_d: type === 'CS' ? optionD.trim() : '',
      option_e: type === 'CS' ? optionE.trim() : '',
      statement_1: type === 'CG' ? s1.trim() : '',
      statement_2: type === 'CG' ? s2.trim() : '',
      statement_3: type === 'CG' ? s3.trim() : '',
      statement_4: type === 'CG' ? s4.trim() : '',
      correct_answer: correct,
      explanation: explanation.trim(),
    };

    if (question) {
      const { error: err } = await supabase.from('practice_questions').update(payload).eq('id', question.id);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase.from('practice_questions').insert(payload);
      if (err) setError(err.message);
    }

    setSaving(false);
    if (!error) onSaved();
  };

  return (
    <div className="card p-6">
      <h3 className="font-display text-lg font-bold text-stone-900 mb-4">
        {question ? 'Editează grila' : 'Adaugă grilă nouă'}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="label">Tip grilă</label>
          <div className="flex gap-2">
            <button
              onClick={() => setType('CS')}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                type === 'CS' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              Complement Simplu (CS)
            </button>
            <button
              onClick={() => setType('CG')}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                type === 'CG' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              Complement Grupat (CG)
            </button>
          </div>
        </div>

        <div>
          <label className="label">Text întrebare</label>
          <textarea className="input min-h-[70px]" value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Introdu enunțul întrebării..." />
        </div>

        {type === 'CS' ? (
          <div className="grid gap-3">
            {([
              ['A', optionA, setOptionA],
              ['B', optionB, setOptionB],
              ['C', optionC, setOptionC],
              ['D', optionD, setOptionD],
              ['E', optionE, setOptionE],
            ] as const).map(([letter, val, setter]) => (
              <div key={letter} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCorrect(letter)}
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    correct === letter ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {letter}
                </button>
                <input className="input" value={val} onChange={(e) => setter(e.target.value)} placeholder={`Opțiunea ${letter}...`} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {([
              ['1', s1, setS1],
              ['2', s2, setS2],
              ['3', s3, setS3],
              ['4', s4, setS4],
            ] as const).map(([num, val, setter]) => (
              <div key={num} className="flex items-start gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-sm font-bold text-stone-600 mt-0.5">{num}</span>
                <textarea className="input min-h-[50px]" value={val} onChange={(e) => setter(e.target.value)} placeholder={`Afirmația ${num}...`} />
              </div>
            ))}
            <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 text-xs text-stone-500">
              <strong>Variante standard CG:</strong> A = 1,2,3 · B = 1,3 · C = 2,4 · D = doar 4 · E = toate sau altă combinație
            </div>
            <div>
              <label className="label">Răspuns corect</label>
              <div className="flex gap-2">
                {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setCorrect(letter)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      correct === letter ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="label">Explicație bibliografică</label>
          <textarea className="input min-h-[80px]" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explicația răspunsului corect..." />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary"><X size={16} /> Anulează</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving && <Loader2 size={16} className="animate-spin" />}
          <Save size={16} /> {question ? 'Salvează' : 'Adaugă grila'}
        </button>
      </div>
    </div>
  );
}
