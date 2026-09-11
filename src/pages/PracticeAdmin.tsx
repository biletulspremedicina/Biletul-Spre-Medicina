import { useEffect, useState, useCallback } from 'react';
import { supabase, type PracticeLesson, type PracticeSet, type PracticeQuestion, type BankQuestion } from '@/lib/supabase';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, ChevronLeft, Save, X, Loader2, BookOpen,
  Layers, AlertTriangle, Copy, ArrowUp, ArrowDown, CheckSquare, Square, Search,
} from 'lucide-react';

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
        .from('practice_set_questions')
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
        .from('practice_set_questions')
        .select('question_id')
        .eq('set_id', set.id);
      const qIds = (qs || []).map((q: { question_id: string }) => q.question_id);
      let missing = false;
      if (qIds.length > 0) {
        const { data: bankQs } = await supabase
          .from('practice_bank_questions')
          .select('correct_answer, explanation')
          .in('id', qIds);
        missing = (bankQs || []).some((q: { correct_answer: string; explanation: string }) => !q.correct_answer || !q.explanation?.trim());
      }
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

    // Duplicate junction entries (references to bank questions)
    const { data: junctions } = await supabase
      .from('practice_set_questions')
      .select('question_id, position')
      .eq('set_id', set.id)
      .order('position', { ascending: true });

    if (junctions && junctions.length > 0) {
      const newJunctions = (junctions as { question_id: string; position: number }[]).map((j) => ({
        set_id: newSet.id,
        question_id: j.question_id,
        position: j.position,
      }));
      await supabase.from('practice_set_questions').insert(newJunctions);
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
        .from('practice_set_questions')
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
  const [questions, setQuestions] = useState<(BankQuestion & { position: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBankPicker, setShowBankPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: junctions } = await supabase
      .from('practice_set_questions')
      .select('question_id, position')
      .eq('set_id', set.id)
      .order('position', { ascending: true });

    if (!junctions || junctions.length === 0) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    const ids = junctions.map((j: { question_id: string; position: number }) => j.question_id);
    const { data: bankQuestions } = await supabase
      .from('practice_bank_questions')
      .select('*')
      .in('id', ids);

    const bankMap = new Map<string, BankQuestion>();
    for (const bq of (bankQuestions || []) as BankQuestion[]) {
      bankMap.set(bq.id, bq);
    }

    const combined = junctions
      .map((j: { question_id: string; position: number }) => {
        const bq = bankMap.get(j.question_id);
        if (!bq) return null;
        return { ...bq, position: j.position };
      })
      .filter((q): q is BankQuestion & { position: number } => q !== null);

    setQuestions(combined);
    setLoading(false);
  }, [set.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (questionId: string) => {
    if (!confirm('Sigur vrei să elimini această grilă din set? Grila rămâne în banca de grile.')) return;
    await supabase.rpc('admin_remove_question_from_set', {
      p_set_id: set.id,
      p_question_id: questionId,
    });
    load();
  };

  const handleMove = async (idx: number, dir: 'up' | 'down') => {
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === questions.length - 1) return;
    const reordered = [...questions];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const orderedIds = reordered.map((q) => q.id);
    await supabase.rpc('admin_reorder_set_questions', {
      p_set_id: set.id,
      p_ordered_ids: orderedIds,
    });
    load();
  };

  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4">
        <ChevronLeft size={16} /> Înapoi la seturi
      </button>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-stone-900">{set.title}</h2>
          <p className="text-sm text-stone-500 mt-1">
            Grile în set: <strong className="text-stone-700">{questions.length} din {set.target_question_count}</strong>
          </p>
          {questions.length !== set.target_question_count && (
            <div className="mt-1 flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle size={12} />
              Setul nu are numărul stabilit de grile. Nu poate fi publicat.
            </div>
          )}
        </div>
        <button onClick={() => setShowBankPicker(true)} className="btn-primary">
          <Plus size={16} /> Adaugă din bancă
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Se încarcă...</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-stone-500 py-4">Nu există grile în acest set. Adaugă din banca de grile.</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => (
            <div key={q.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMove(idx, 'up')} disabled={idx === 0} className="text-stone-400 hover:text-stone-700 disabled:opacity-30">
                  <ArrowUp size={13} />
                </button>
                <button onClick={() => handleMove(idx, 'down')} disabled={idx === questions.length - 1} className="text-stone-400 hover:text-stone-700 disabled:opacity-30">
                  <ArrowDown size={13} />
                </button>
              </div>
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-600">{idx + 1}</span>
              <span className="badge bg-stone-100 text-stone-600">{q.type}</span>
              <span className="text-sm text-stone-700 truncate flex-1">{q.question_text}</span>
              <span className="text-xs font-bold text-brand-600">Corect: {q.correct_answer}</span>
              <button
                onClick={() => handleRemove(q.id)}
                className="btn-ghost text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                title="Elimină din set"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showBankPicker && (
        <BankPickerDialog
          lesson={lesson}
          setId={set.id}
          existingQuestionIds={questions.map((q) => q.id)}
          onDone={() => { setShowBankPicker(false); load(); }}
          onCancel={() => setShowBankPicker(false)}
        />
      )}
    </div>
  );
}

// ── Bank Picker Dialog (add bank questions to set) ──────────────────────

function BankPickerDialog({
  lesson, setId, existingQuestionIds, onDone, onCancel,
}: {
  lesson: PracticeLesson;
  setId: string;
  existingQuestionIds: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'CS' | 'CG'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingSet = new Set(existingQuestionIds);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('practice_bank_questions')
        .select('*')
        .eq('lesson_id', lesson.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      setBankQuestions((data || []) as BankQuestion[]);
      setLoading(false);
    })();
  }, [lesson.id]);

  const filtered = bankQuestions.filter((q) => {
    if (existingSet.has(q.id)) return false;
    if (typeFilter !== 'all' && q.type !== typeFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!q.question_text.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setApplying(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('admin_add_questions_to_set', {
        p_set_id: setId,
        p_question_ids: Array.from(selectedIds),
      });
      if (rpcError) throw rpcError;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la adăugarea grilelor.');
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h3 className="font-display text-lg font-bold text-stone-900">
            Adaugă grile din banca lecției
          </h3>
          <button onClick={onCancel} disabled={applying} className="btn-ghost p-2"><X size={18} /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className="input pl-10" placeholder="Caută..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input max-w-[120px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | 'CS' | 'CG')}>
              <option value="all">Toate</option>
              <option value="CS">CS</option>
              <option value="CG">CG</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-stone-500">Se încarcă...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-stone-500 py-4">
              Nu există grile disponibile. Grilele deja în set sunt ascunse. Adaugă grile noi în banca de grile a lecției.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((q) => (
                <button
                  key={q.id}
                  onClick={() => toggleSelect(q.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    selectedIds.has(q.id) ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400' : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {selectedIds.has(q.id)
                    ? <CheckSquare size={18} className="text-brand-600 flex-shrink-0" />
                    : <Square size={18} className="text-stone-400 flex-shrink-0" />}
                  <span className="badge bg-stone-100 text-stone-600 flex-shrink-0">{q.type}</span>
                  <span className="text-sm text-stone-700 truncate flex-1">{q.question_text}</span>
                  <span className="text-xs font-bold text-brand-600 flex-shrink-0">{q.correct_answer}</span>
                </button>
              ))}
            </div>
          )}

          {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          <span className="text-xs text-stone-500">{selectedIds.size} grile selectate</span>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={applying} className="btn-secondary">Renunță</button>
            <button onClick={handleAdd} disabled={applying || selectedIds.size === 0} className="btn-primary">
              {applying && <Loader2 size={16} className="animate-spin" />}
              <Plus size={16} /> Adaugă {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
