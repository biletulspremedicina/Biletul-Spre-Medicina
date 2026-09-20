import { useEffect, useState, useCallback, type DragEvent } from 'react';
import { supabase, type PracticeLesson, type PracticeSet, type BankQuestion } from '@/lib/supabase';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, ChevronLeft, Save, X, Loader2, BookOpen,
  Layers, AlertTriangle, Copy, ArrowUp, ArrowDown, CheckSquare, Square, Search,
  CalendarClock, GripVertical,
} from 'lucide-react';
import { BankQuestionForm } from '@/components/admin/QuestionBankAdmin';
import { loadBankQuestions, loadQuestionSetMemberships, type QuestionSetMemberships } from '@/lib/questionBankAdmin';

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatReleaseDate(value: string) {
  return new Date(value).toLocaleString('ro-RO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const reordered = [...items];
  reordered.splice(to, 0, ...reordered.splice(from, 1));
  return reordered;
}

function PositionInput({ position, total, onMove, label, disabled }: {
  position: number;
  total: number;
  onMove: (index: number) => void;
  label: string;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(String(position));

  useEffect(() => setDraft(String(position)), [position]);

  const commit = (value: string) => {
    const next = Number(value);
    if (Number.isInteger(next) && next >= 1 && next <= total && next !== position) {
      onMove(next - 1);
    } else {
      setDraft(String(position));
    }
  };

  return (
    <input
      type="number"
      min={1}
      max={total}
      value={draft}
      disabled={disabled}
      aria-label={label}
      title="Introdu poziția dorită și apasă Enter"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.currentTarget.value = String(position);
          setDraft(String(position));
          event.currentTarget.blur();
        }
      }}
      className="h-9 w-12 rounded-lg border border-stone-200 bg-stone-50 text-center text-xs font-bold text-stone-700 focus:border-brand-500 focus:outline-none disabled:opacity-50"
    />
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function PracticeAdmin() {
  const [lessons, setLessons] = useState<PracticeLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLesson, setEditingLesson] = useState<PracticeLesson | null>(null);
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<PracticeLesson | null>(null);
  const [savingLessonOrder, setSavingLessonOrder] = useState(false);
  const [lessonOrderError, setLessonOrderError] = useState<string | null>(null);
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('practice_lessons')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    setLessons((data || []) as PracticeLesson[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const reorderLessons = async (from: number, to: number) => {
    if (savingLessonOrder || from === to || from < 0 || to < 0 || from >= lessons.length || to >= lessons.length) return;
    const reordered = moveItem(lessons, from, to);
    setLessons(reordered.map((lesson, index) => ({ ...lesson, position: index })));
    setSavingLessonOrder(true);
    setLessonOrderError(null);

    try {
      const results = await Promise.all(reordered.map((lesson, index) =>
        supabase.from('practice_lessons')
          .update({ position: index, updated_at: new Date().toISOString() })
          .eq('id', lesson.id),
      ));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    } catch (error) {
      setLessonOrderError(`Ordinea lecțiilor nu a putut fi salvată: ${error instanceof Error ? error.message : 'Încearcă din nou.'}`);
      await loadLessons();
    } finally {
      setSavingLessonOrder(false);
    }
  };

  if (creatingLesson) {
    return <LessonForm position={Math.max(-1, ...lessons.map((lesson) => lesson.position)) + 1} onSaved={() => { setCreatingLesson(false); loadLessons(); }} onCancel={() => setCreatingLesson(false)} />;
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

      {lessons.length > 1 && <p className="mb-3 text-xs text-stone-500">Trage lecțiile de mâner, folosește săgețile sau introdu direct poziția dorită.</p>}
      {lessonOrderError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{lessonOrderError}</div>}

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
            <div
              key={lesson.id}
              className={dragOverLessonId === lesson.id ? 'rounded-2xl ring-2 ring-brand-500' : ''}
              onDragOver={(event) => {
                if (!draggingLessonId || draggingLessonId === lesson.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverLessonId(lesson.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = lessons.findIndex((item) => item.id === draggingLessonId);
                setDraggingLessonId(null);
                setDragOverLessonId(null);
                if (from >= 0) reorderLessons(from, idx);
              }}
            >
              <LessonAdminCard
                lesson={lesson}
                order={idx + 1}
                total={lessons.length}
                savingOrder={savingLessonOrder}
                canMoveUp={idx > 0}
                canMoveDown={idx < lessons.length - 1}
                onEdit={() => setEditingLesson(lesson)}
                onReload={loadLessons}
                onOpen={() => setSelectedLesson(lesson)}
                onMove={(dir) => reorderLessons(idx, idx + (dir === 'up' ? -1 : 1))}
                onMoveTo={(target) => reorderLessons(idx, target)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', lesson.id);
                  setDraggingLessonId(lesson.id);
                }}
                onDragEnd={() => { setDraggingLessonId(null); setDragOverLessonId(null); }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Lesson Card ─────────────────────────────────────────────────────────

function LessonAdminCard({
  lesson, order, total, savingOrder, canMoveUp, canMoveDown, onEdit, onReload, onOpen, onMove, onMoveTo, onDragStart, onDragEnd,
}: {
  lesson: PracticeLesson;
  order: number;
  total: number;
  savingOrder: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onReload: () => void;
  onOpen: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onMoveTo: (index: number) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
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
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              draggable={!savingOrder}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              disabled={savingOrder}
              className="cursor-grab text-stone-400 hover:text-brand-600 active:cursor-grabbing disabled:opacity-30"
              title="Trage pentru a schimba ordinea lecției"
              aria-label={`Trage lecția ${lesson.title}`}
            >
              <GripVertical size={17} />
            </button>
            <button
              onClick={() => onMove('up')}
              disabled={savingOrder || !canMoveUp}
              className="text-stone-400 hover:text-stone-700 disabled:opacity-30"
              aria-label={`Mută lecția ${lesson.title} mai sus`}
            >
              <ArrowUp size={14} />
            </button>
            <button
              onClick={() => onMove('down')}
              disabled={savingOrder || !canMoveDown}
              className="text-stone-400 hover:text-stone-700 disabled:opacity-30"
              aria-label={`Mută lecția ${lesson.title} mai jos`}
            >
              <ArrowDown size={14} />
            </button>
          </div>
          <PositionInput position={order} total={total} onMove={onMoveTo} label={`Poziția lecției ${lesson.title}`} disabled={savingOrder} />
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

function LessonForm({ lesson, position = 0, onSaved, onCancel }: { lesson?: PracticeLesson; position?: number; onSaved: () => void; onCancel: () => void }) {
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
    let saveError: string | null = null;
    if (lesson) {
      const { error: err } = await supabase.from('practice_lessons').update(payload).eq('id', lesson.id);
      if (err) saveError = err.message;
    } else {
      const { error: err } = await supabase.from('practice_lessons').insert({ ...payload, position });
      if (err) saveError = err.message;
    }
    setSaving(false);
    if (saveError) setError(saveError);
    else onSaved();
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
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [draggingSetId, setDraggingSetId] = useState<string | null>(null);
  const [dragOverSetId, setDragOverSetId] = useState<string | null>(null);

  const loadSets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('practice_sets')
      .select('*')
      .eq('lesson_id', lesson.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    setSets((data || []) as PracticeSet[]);
    setLoading(false);
  }, [lesson.id]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const reorderSets = async (from: number, to: number) => {
    if (savingOrder || from === to || from < 0 || to < 0 || from >= sets.length || to >= sets.length) return;
    const reordered = moveItem(sets, from, to);
    setSets(reordered.map((item, index) => ({ ...item, position: index })));
    setSavingOrder(true);
    setOrderError(null);

    try {
      const results = await Promise.all(reordered.map((item, index) =>
        supabase.from('practice_sets')
          .update({ position: index, updated_at: new Date().toISOString() })
          .eq('id', item.id),
      ));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    } catch (error) {
      setOrderError(`Ordinea seturilor nu a putut fi salvată: ${error instanceof Error ? error.message : 'Încearcă din nou.'}`);
      await loadSets();
    } finally {
      setSavingOrder(false);
    }
  };

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

      {sets.length > 1 && <p className="mb-3 text-xs text-stone-500">Trage seturile de mâner, folosește săgețile sau introdu direct poziția dorită.</p>}
      {orderError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{orderError}</div>}

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
            <div
              key={set.id}
              className={dragOverSetId === set.id ? 'rounded-2xl ring-2 ring-brand-500' : ''}
              onDragOver={(event) => {
                if (!draggingSetId || draggingSetId === set.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverSetId(set.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = sets.findIndex((item) => item.id === draggingSetId);
                setDraggingSetId(null);
                setDragOverSetId(null);
                if (from >= 0) reorderSets(from, idx);
              }}
            >
              <SetAdminCard
                set={set}
                order={idx + 1}
                total={sets.length}
                savingOrder={savingOrder}
                canMoveUp={idx > 0}
                canMoveDown={idx < sets.length - 1}
                onEdit={() => setEditingSet(set)}
                onReload={loadSets}
                onOpen={() => setSelectedSet(set)}
                onMove={(dir) => reorderSets(idx, idx + (dir === 'up' ? -1 : 1))}
                onMoveTo={(target) => reorderSets(idx, target)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', set.id);
                  setDraggingSetId(set.id);
                }}
                onDragEnd={() => { setDraggingSetId(null); setDragOverSetId(null); }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Set Card ────────────────────────────────────────────────────────────

function SetAdminCard({
  set, order, total, savingOrder, canMoveUp, canMoveDown, onEdit, onReload, onOpen, onMove, onMoveTo, onDragStart, onDragEnd,
}: {
  set: PracticeSet;
  order: number;
  total: number;
  savingOrder: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onReload: () => void;
  onOpen: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onMoveTo: (index: number) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const [questionCount, setQuestionCount] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const isScheduled = !!set.available_at && new Date(set.available_at).getTime() > Date.now();

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
    const nextActive = !set.is_active;
    await supabase
      .from('practice_sets')
      .update({
        is_active: nextActive,
        updated_at: new Date().toISOString(),
        ...(!nextActive && isScheduled ? { available_at: null } : {}),
      })
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
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              draggable={!savingOrder}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              disabled={savingOrder}
              className="cursor-grab text-stone-400 hover:text-brand-600 active:cursor-grabbing disabled:opacity-30"
              title="Trage pentru a schimba ordinea setului"
              aria-label={`Trage setul ${set.title}`}
            >
              <GripVertical size={17} />
            </button>
            <button onClick={() => onMove('up')} disabled={savingOrder || !canMoveUp} className="text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label={`Mută setul ${set.title} mai sus`}>
              <ArrowUp size={14} />
            </button>
            <button onClick={() => onMove('down')} disabled={savingOrder || !canMoveDown} className="text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label={`Mută setul ${set.title} mai jos`}>
              <ArrowDown size={14} />
            </button>
          </div>
          <PositionInput position={order} total={total} onMove={onMoveTo} label={`Poziția setului ${set.title}`} disabled={savingOrder} />
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-semibold text-stone-900">{set.title}</h3>
          </div>
          {set.is_active && isScheduled ? (
            <span className="badge bg-blue-100 text-blue-700"><CalendarClock size={12} /> Programat</span>
          ) : set.is_active ? (
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
          {isScheduled && set.available_at && (
            <span className="flex items-center gap-1 font-semibold text-blue-700">
              <CalendarClock size={13} /> {formatReleaseDate(set.available_at)}
            </span>
          )}
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
            {set.is_active ? (isScheduled ? 'Anulează programarea' : 'Ascunde') : (isScheduled ? 'Programează' : 'Publică')}
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
  const existingFutureRelease = !!set?.available_at && new Date(set.available_at).getTime() > Date.now();
  const [timedPost, setTimedPost] = useState(existingFutureRelease);
  const [availableAt, setAvailableAt] = useState(existingFutureRelease ? toDateTimeLocal(set?.available_at) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError('Titlul este obligatoriu.'); return; }
    const tc = parseInt(targetCount) || 0;
    if (tc <= 0) { setError('Numărul de grile trebuie să fie mai mare decât zero.'); return; }
    if (timedPost && !availableAt) { setError('Alege ziua și ora publicării programate.'); return; }
    const releaseDate = timedPost ? new Date(availableAt) : null;
    if (timedPost && (!releaseDate || Number.isNaN(releaseDate.getTime()) || releaseDate.getTime() <= Date.now())) {
      setError('Data pentru Timed Post trebuie să fie în viitor.');
      return;
    }

    setSaving(true);
    let saveError: string | null = null;
    const payload = {
      lesson_id: lessonId,
      title: title.trim(),
      description: description.trim(),
      target_question_count: tc,
      requires_subscription: requiresSub,
      available_at: timedPost
        ? releaseDate!.toISOString()
        : (set?.available_at && new Date(set.available_at).getTime() <= Date.now() ? set.available_at : null),
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
      if (err) saveError = err.message;

      // If set was published and target changed making it incomplete, unpublish
      if (!saveError && set.is_active && tc !== realCount) {
        await supabase.from('practice_sets').update({ is_active: false }).eq('id', set.id);
      }
    } else {
      const { error: err } = await supabase.from('practice_sets').insert(payload);
      if (err) saveError = err.message;
    }

    setSaving(false);
    if (saveError) {
      setError(saveError);
    } else {
      onSaved();
    }
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
        <div className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-blue-950">
            <input
              type="checkbox"
              checked={timedPost}
              onChange={(event) => setTimedPost(event.target.checked)}
              className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
            />
            <CalendarClock size={18} /> Timed Post
          </label>
          <p className="mt-1 text-xs leading-relaxed text-blue-700">
            Setul publicat va apărea în capitol, dar va putea fi început doar după momentul ales.
          </p>
          {timedPost && (
            <div className="mt-3 max-w-sm">
              <label className="label">Ziua și ora deblocării</label>
              <input
                type="datetime-local"
                className="input"
                value={availableAt}
                min={toDateTimeLocal(new Date().toISOString())}
                onChange={(event) => setAvailableAt(event.target.value)}
              />
              <p className="mt-1 text-[11px] text-blue-700">Ora este interpretată în fusul orar al dispozitivului administratorului.</p>
            </div>
          )}
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
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);

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

  const reorderQuestions = async (from: number, to: number) => {
    if (savingOrder || from === to || from < 0 || to < 0 || from >= questions.length || to >= questions.length) return;
    const reordered = moveItem(questions, from, to).map((question, index) => ({ ...question, position: index }));
    setQuestions(reordered);
    setSavingOrder(true);
    setOrderError(null);
    try {
      const { error } = await supabase.rpc('admin_reorder_set_questions', {
        p_set_id: set.id,
        p_ordered_ids: reordered.map((question) => question.id),
      });
      if (error) throw error;
    } catch (error) {
      setQuestions(questions);
      setOrderError(`Ordinea grilelor nu a putut fi salvată: ${error instanceof Error ? error.message : 'Încearcă din nou.'}`);
    } finally {
      setSavingOrder(false);
    }
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

      {questions.length > 1 && <p className="mb-3 text-xs text-stone-500">Trage grilele de mâner, folosește săgețile sau introdu direct poziția dorită.</p>}
      {orderError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{orderError}</div>}

      {loading ? (
        <p className="text-sm text-stone-500">Se încarcă...</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-stone-500 py-4">Nu există grile în acest set. Adaugă din banca de grile.</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 ${dragOverQuestionId === q.id ? 'border-brand-500 ring-2 ring-brand-300' : 'border-stone-200'}`}
              onDragOver={(event) => {
                if (!draggingQuestionId || draggingQuestionId === q.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverQuestionId(q.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = questions.findIndex((question) => question.id === draggingQuestionId);
                setDraggingQuestionId(null);
                setDragOverQuestionId(null);
                if (from >= 0) reorderQuestions(from, idx);
              }}
            >
              <div className="flex flex-col items-center gap-0.5">
                <button
                  type="button"
                  draggable={!savingOrder}
                  disabled={savingOrder}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', q.id);
                    setDraggingQuestionId(q.id);
                  }}
                  onDragEnd={() => { setDraggingQuestionId(null); setDragOverQuestionId(null); }}
                  className="cursor-grab text-stone-400 hover:text-brand-600 active:cursor-grabbing disabled:opacity-30"
                  title="Trage pentru a schimba ordinea grilei"
                  aria-label={`Trage grila ${idx + 1}`}
                >
                  <GripVertical size={16} />
                </button>
                <button onClick={() => reorderQuestions(idx, idx - 1)} disabled={savingOrder || idx === 0} className="text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label={`Mută grila ${idx + 1} mai sus`}>
                  <ArrowUp size={13} />
                </button>
                <button onClick={() => reorderQuestions(idx, idx + 1)} disabled={savingOrder || idx === questions.length - 1} className="text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label={`Mută grila ${idx + 1} mai jos`}>
                  <ArrowDown size={13} />
                </button>
              </div>
              <PositionInput position={idx + 1} total={questions.length} onMove={(target) => reorderQuestions(idx, target)} label={`Poziția grilei ${idx + 1}`} disabled={savingOrder} />
              <span className="badge bg-stone-100 text-stone-600">{q.type}</span>
              <span className="text-sm text-stone-700 truncate flex-1">{q.question_text}</span>
              <span className="text-xs font-bold text-brand-600">Corect: {q.correct_answer}</span>
              <button
                onClick={() => setEditingQuestion(q)}
                className="btn-ghost text-xs px-2 py-1"
                title="Editează grila în bancă și în toate seturile"
                aria-label={`Editează grila ${idx + 1}`}
              >
                <Edit2 size={13} />
              </button>
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
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Editează grila din set">
          <div className="my-8 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <p className="px-6 pt-5 text-sm text-stone-600">
              Modificările se salvează în banca de grile și apar în toate seturile care folosesc această grilă.
            </p>
            <BankQuestionForm
              lessonId={editingQuestion.lesson_id}
              question={editingQuestion}
              onSaved={() => { setEditingQuestion(null); load(); }}
              onCancel={() => setEditingQuestion(null)}
            />
          </div>
        </div>
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
  const [memberships, setMemberships] = useState<QuestionSetMemberships>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'CS' | 'CG'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingSet = new Set(existingQuestionIds);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const questions = await loadBankQuestions(lesson.id);
        const questionMemberships = await loadQuestionSetMemberships(questions.map((q) => q.id));
        if (!active) return;
        setBankQuestions(questions);
        setMemberships(questionMemberships);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Nu s-au putut încărca grilele din bancă.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
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
          ) : error && bankQuestions.length === 0 ? null : filtered.length === 0 ? (
            <p className="text-sm text-stone-500 py-4">
              Nu există grile disponibile. Grilele deja în set sunt ascunse. Adaugă grile noi în banca de grile a lecției.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((q) => {
                const otherSets = (memberships.get(q.id) || []).filter((set) => set.id !== setId);
                return (
                  <button
                    key={q.id}
                    onClick={() => toggleSelect(q.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                      selectedIds.has(q.id) ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400' : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {selectedIds.has(q.id)
                        ? <CheckSquare size={18} className="text-brand-600 flex-shrink-0" />
                        : <Square size={18} className="text-stone-400 flex-shrink-0" />}
                      <span className="badge bg-stone-100 text-stone-600 flex-shrink-0">{q.type}</span>
                      <span className="text-sm text-stone-700 truncate flex-1">{q.question_text}</span>
                      <span className="text-xs font-bold text-brand-600 flex-shrink-0">{q.correct_answer}</span>
                    </span>
                    {otherSets.length > 0 && (
                      <span className="mt-2 ml-8 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-amber-800">
                        <Layers size={13} /> Deja în {otherSets.length === 1 ? 'setul' : 'seturile'}:
                        {otherSets.map((set) => (
                          <span key={set.id} className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{set.title}</span>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
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
