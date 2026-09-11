import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type PracticeLesson, type BankQuestion } from '@/lib/supabase';
import {
  Plus, Edit2, Trash2, Archive, ArchiveRestore, Search, Loader2, X, Save,
  BookOpen, Layers, ChevronLeft, AlertTriangle, CheckSquare, Square,
  FileDown, FileUp, Download, ArrowUp, ArrowDown, Eye,
} from 'lucide-react';
import {
  generateNewQuestionsTemplate,
  parseNewQuestionsXlsx,
  validateNewQuestions,
  type NewQuestionValidation,
} from '@/lib/newQuestionsImport';
import NewQuestionsImportPreviewDialog from '@/components/admin/NewQuestionsImportPreviewDialog';

export default function QuestionBankAdmin() {
  const [lessons, setLessons] = useState<PracticeLesson[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (selectedLesson) {
    return (
      <BankLessonView
        lesson={selectedLesson}
        onBack={() => { setSelectedLesson(null); loadLessons(); }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold text-stone-900">Banca de grile</h2>
        <p className="text-sm text-stone-500 mt-1">
          Selectează o lecție pentru a vizualiza și administra grilele din bancă.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Se încarcă...</p>
      ) : lessons.length === 0 ? (
        <div className="card p-12 text-center text-stone-500">
          <BookOpen size={40} className="mx-auto mb-4 text-stone-300" />
          <p className="text-lg font-medium">Nu există lecții.</p>
          <p className="text-sm mt-1">Creează lecții în secțiunea „Grile pe lecții" mai întâi.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lessons.map((lesson) => (
            <LessonBankCard key={lesson.id} lesson={lesson} onOpen={() => setSelectedLesson(lesson)} />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonBankCard({ lesson, onOpen }: { lesson: PracticeLesson; onOpen: () => void }) {
  const [bankCount, setBankCount] = useState(0);
  const [setCount, setSetCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { count: bc } = await supabase
        .from('practice_bank_questions')
        .select('*', { count: 'exact', head: true })
        .eq('lesson_id', lesson.id)
        .eq('is_archived', false);
      setBankCount(bc || 0);

      const { count: sc } = await supabase
        .from('practice_sets')
        .select('*', { count: 'exact', head: true })
        .eq('lesson_id', lesson.id);
      setSetCount(sc || 0);
    })();
  }, [lesson.id]);

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <span className="badge bg-stone-100 text-stone-500 mb-1">{lesson.subject}</span>
            <h3 className="font-display text-base font-semibold text-stone-900">{lesson.title}</h3>
          </div>
          {lesson.is_active ? (
            <span className="badge bg-green-100 text-green-700"><Eye size={12} /> Publicată</span>
          ) : (
            <span className="badge bg-stone-100 text-stone-500">Ciornă</span>
          )}
        </div>

        {lesson.description && (
          <p className="text-sm text-stone-600 line-clamp-2">{lesson.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
          <span className="flex items-center gap-1"><BookOpen size={13} /> {bankCount} grile în bancă</span>
          <span className="flex items-center gap-1"><Layers size={13} /> {setCount} seturi</span>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
          <button onClick={onOpen} className="btn-secondary">
            <BookOpen size={15} /> Deschide banca
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bank Lesson View (grilele din banca unei lecții) ────────────────────

function BankLessonView({ lesson, onBack }: { lesson: PracticeLesson; onBack: () => void }) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'CS' | 'CG'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAddToSet, setShowAddToSet] = useState(false);
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [importValidation, setImportValidation] = useState<NewQuestionValidation | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('practice_bank_questions')
      .select('*')
      .eq('lesson_id', lesson.id)
      .order('created_at', { ascending: false });

    if (statusFilter === 'active') {
      query = query.eq('is_archived', false);
    } else if (statusFilter === 'archived') {
      query = query.eq('is_archived', true);
    }

    const { data } = await query;
    setQuestions((data || []) as BankQuestion[]);
    setLoading(false);
  }, [lesson.id, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = questions.filter((q) => {
    if (typeFilter !== 'all' && q.type !== typeFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!q.question_text.toLowerCase().includes(s) && !q.explanation.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((q) => q.id)));
    }
  };

  const handleArchive = async (q: BankQuestion) => {
    await supabase
      .from('practice_bank_questions')
      .update({ is_archived: !q.is_archived, updated_at: new Date().toISOString() })
      .eq('id', q.id);
    load();
  };

  const handleDelete = async (q: BankQuestion) => {
    // Check if question is used in sets
    const { count } = await supabase
      .from('practice_set_questions')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', q.id);

    if (count && count > 0) {
      if (!confirm(`Această grilă este folosită în ${count} seturi. Sigur vrei să o ștergi definitiv? Se va elimina din toate seturile.`)) return;
    } else {
      if (!confirm('Sigur vrei să ștergi definitiv această grilă din bancă?')) return;
    }

    await supabase.from('practice_bank_questions').delete().eq('id', q.id);
    load();
  };

  const handleDownloadTemplate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const safeTitle = lesson.title.replace(/[^a-zA-Z0-9ăâîșțĂÂÎȘȚ -]/g, '').replace(/\s+/g, '-');
      const fileName = `model-grile-noi-${safeTitle}.xlsx`;
      await generateNewQuestionsTemplate(lesson.title, fileName);
      setMessage({ type: 'success', text: 'Modelul a fost descărcat.' });
    } catch {
      setMessage({ type: 'error', text: 'Eroare la generarea modelului.' });
    }
    setBusy(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      setMessage({ type: 'error', text: 'Doar fișiere .xlsx.' });
      e.target.value = '';
      return;
    }

    setBusy(true);
    setMessage(null);
    setImportFileName(file.name);

    try {
      const rows = await parseNewQuestionsXlsx(file);
      const result = validateNewQuestions(rows, questions, { contentType: 'bank' });
      setImportValidation(result);
      if (result.errors.length === 0) {
        setMessage({ type: 'success', text: `${result.validQuestions.length} grile gata pentru import.` });
      } else {
        setMessage({ type: 'error', text: `${result.errors.length} erori găsite.` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Eroare la citirea fișierului.' });
    }

    setBusy(false);
    e.target.value = '';
  };

  const handleImportConfirmed = () => {
    setImportValidation(null);
    setMessage({ type: 'success', text: 'Grilele au fost importate în bancă.' });
    load();
  };

  if (creating) {
    return (
      <BankQuestionForm
        lessonId={lesson.id}
        onSaved={() => { setCreating(false); load(); }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(null)} className="btn-ghost mb-4">
          <ChevronLeft size={16} /> Înapoi la bancă
        </button>
        <BankQuestionForm
          lessonId={lesson.id}
          question={editing}
          onSaved={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4">
        <ChevronLeft size={16} /> Înapoi la lecții
      </button>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-stone-900">Banca de grile — {lesson.title}</h2>
          <p className="text-sm text-stone-500 mt-1">
            {questions.filter((q) => !q.is_archived).length} grile active · {questions.filter((q) => q.is_archived).length} arhivate
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus size={16} /> Adaugă grilă
        </button>
      </div>

      {/* Import tools */}
      <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Import din Excel</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadTemplate} disabled={busy} className="btn-secondary text-xs px-3 py-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Descarcă model
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={busy} className="btn-secondary text-xs px-3 py-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
            Importă grile noi
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        {message && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700'
            : message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-stone-100 border border-stone-200 text-stone-600'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            className="input pl-10"
            placeholder="Caută în enunț..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input max-w-[140px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | 'CS' | 'CG')}
        >
          <option value="all">Toate tipurile</option>
          <option value="CS">CS</option>
          <option value="CG">CG</option>
        </select>
        <select
          className="input max-w-[140px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'active' | 'archived' | 'all')}
        >
          <option value="active">Active</option>
          <option value="archived">Arhivate</option>
          <option value="all">Toate</option>
        </select>
      </div>

      {/* Selection actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <span className="text-sm font-medium text-brand-700">{selectedIds.size} grile selectate</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setShowAddToSet(true)} className="btn-secondary text-xs px-3 py-1.5">
              <Plus size={14} /> Adaugă la set
            </button>
            <button onClick={() => setShowCreateSet(true)} className="btn-secondary text-xs px-3 py-1.5">
              <Layers size={14} /> Creează set din selecție
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost text-xs px-3 py-1.5">
              <X size={14} /> Șterge selecția
            </button>
          </div>
        </div>
      )}

      {/* Question list */}
      {loading ? (
        <p className="text-sm text-stone-500">Se încarcă...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-stone-500">
          <BookOpen size={40} className="mx-auto mb-4 text-stone-300" />
          <p className="text-lg font-medium">Nu există grile în bancă.</p>
          <p className="text-sm mt-1">Adaugă grile manual sau importă din Excel.</p>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <button onClick={toggleSelectAll} className="btn-ghost text-xs">
              {selectedIds.size === filtered.length && filtered.length > 0
                ? <><CheckSquare size={14} /> Deselectează toate</>
                : <><Square size={14} /> Selectează toate</>}
            </button>
            <span className="text-xs text-stone-500">{filtered.length} grile</span>
          </div>
          <div className="space-y-2">
            {filtered.map((q) => (
              <BankQuestionRow
                key={q.id}
                question={q}
                isSelected={selectedIds.has(q.id)}
                onToggle={() => toggleSelect(q.id)}
                onEdit={() => setEditing(q)}
                onArchive={() => handleArchive(q)}
                onDelete={() => handleDelete(q)}
                lessonId={lesson.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add to set dialog */}
      {showAddToSet && (
        <AddToSetDialog
          lessonId={lesson.id}
          selectedQuestionIds={Array.from(selectedIds)}
          onDone={(count) => {
            setShowAddToSet(false);
            setSelectedIds(new Set());
            setMessage({ type: 'success', text: `${count} grile adăugate la set.` });
          }}
          onCancel={() => setShowAddToSet(false)}
        />
      )}

      {/* Create set from selection dialog */}
      {showCreateSet && (
        <CreateSetFromSelectionDialog
          lesson={lesson}
          selectedQuestionIds={Array.from(selectedIds)}
          position={0}
          onDone={() => {
            setShowCreateSet(false);
            setSelectedIds(new Set());
            setMessage({ type: 'success', text: 'Set creat cu succes.' });
          }}
          onCancel={() => setShowCreateSet(false)}
        />
      )}

      {/* Import preview dialog */}
      {importValidation && (
        <NewQuestionsImportPreviewDialog
          validation={importValidation}
          contentType="bank"
          contentId={lesson.id}
          contentTitle={lesson.title}
          fileName={importFileName}
          isPublished={lesson.is_active}
          onConfirm={handleImportConfirmed}
          onCancel={() => setImportValidation(null)}
        />
      )}
    </div>
  );
}

// ── Bank Question Row ───────────────────────────────────────────────────

function BankQuestionRow({
  question, isSelected, onToggle, onEdit, onArchive, onDelete, lessonId,
}: {
  question: BankQuestion;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  lessonId: string;
}) {
  const [setCount, setSetCount] = useState(0);
  const [showSets, setShowSets] = useState(false);
  const [setNames, setSetNames] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('practice_set_questions')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', question.id);
      setSetCount(count || 0);
    })();
  }, [question.id]);

  const loadSetNames = async () => {
    const { data } = await supabase
      .from('practice_set_questions')
      .select('set_id')
      .eq('question_id', question.id);
    if (data && data.length > 0) {
      const setIds = data.map((d: { set_id: string }) => d.set_id);
      const { data: sets } = await supabase
        .from('practice_sets')
        .select('id, title')
        .in('id', setIds)
        .eq('lesson_id', lessonId);
      setSetNames((sets || []) as { id: string; title: string }[]);
    }
  };

  return (
    <div className={`rounded-xl border bg-white px-4 py-3 ${question.is_archived ? 'border-stone-200 opacity-60' : 'border-stone-200'} ${isSelected ? 'ring-2 ring-brand-400' : ''}`}>
      <div className="flex items-center gap-3">
        <button onClick={onToggle} className="flex-shrink-0 text-stone-400 hover:text-brand-600">
          {isSelected ? <CheckSquare size={18} className="text-brand-600" /> : <Square size={18} />}
        </button>
        <span className="badge bg-stone-100 text-stone-600 flex-shrink-0">{question.type}</span>
        <span className="text-sm text-stone-700 truncate flex-1">{question.question_text}</span>
        <span className="text-xs font-bold text-brand-600 flex-shrink-0">Corect: {question.correct_answer}</span>
        <button
          onClick={() => { setShowSets(!showSets); if (!showSets) loadSetNames(); }}
          className="text-xs text-stone-500 hover:text-stone-700 flex-shrink-0 flex items-center gap-1"
        >
          <Layers size={13} /> {setCount} seturi
        </button>
        <button onClick={onEdit} className="btn-ghost text-xs px-2 py-1 flex-shrink-0"><Edit2 size={13} /></button>
        <button onClick={onArchive} className="btn-ghost text-xs px-2 py-1 flex-shrink-0">
          {question.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
        </button>
        <button onClick={onDelete} className="btn-ghost text-xs px-2 py-1 text-red-600 hover:bg-red-50 flex-shrink-0">
          <Trash2 size={13} />
        </button>
      </div>

      {showSets && (
        <div className="mt-2 ml-10 flex flex-wrap gap-2">
          {setNames.length === 0 ? (
            <span className="text-xs text-stone-400">Nu este folosită în niciun set.</span>
          ) : (
            setNames.map((s) => (
              <span key={s.id} className="badge bg-brand-50 text-brand-700">{s.title}</span>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Bank Question Form (create/edit) ────────────────────────────────────

function BankQuestionForm({
  lessonId, question, onSaved, onCancel,
}: {
  lessonId: string;
  question?: BankQuestion;
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
    if (!questionText.trim()) { setError('Enunțul este obligatoriu.'); return; }
    if (type === 'CS') {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim() || !optionE.trim()) {
        setError('Toate variantele A–E trebuie completate pentru CS.'); return;
      }
    } else {
      if (!s1.trim() || !s2.trim() || !s3.trim() || !s4.trim()) {
        setError('Toate afirmațiile 1–4 trebuie completate pentru CG.'); return;
      }
    }

    setSaving(true);
    const payload = {
      lesson_id: lessonId,
      type,
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
      updated_at: new Date().toISOString(),
    };

    if (question) {
      const updatePayload = { ...payload };
      delete (updatePayload as Record<string, unknown>).lesson_id;
      const { error: err } = await supabase.from('practice_bank_questions').update(updatePayload).eq('id', question.id);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase.from('practice_bank_questions').insert(payload);
      if (err) setError(err.message);
    }

    setSaving(false);
    if (!error) onSaved();
  };

  return (
    <div className="card p-6">
      <h3 className="font-display text-lg font-bold text-stone-900 mb-4">
        {question ? 'Editează grila din bancă' : 'Adaugă grilă nouă în bancă'}
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
          <textarea className="input min-h-[70px]" value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Introdu enunțul..." />
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
          <label className="label">Explicație</label>
          <textarea className="input min-h-[80px]" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explicația răspunsului..." />
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

// ── Add To Set Dialog ───────────────────────────────────────────────────

function AddToSetDialog({
  lessonId, selectedQuestionIds, onDone, onCancel,
}: {
  lessonId: string;
  selectedQuestionIds: string[];
  onDone: (count: number) => void;
  onCancel: () => void;
}) {
  const [sets, setSets] = useState<{ id: string; title: string }[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('practice_sets')
        .select('id, title')
        .eq('lesson_id', lessonId)
        .order('position', { ascending: true });
      setSets((data || []) as { id: string; title: string }[]);
      setLoading(false);
    })();
  }, [lessonId]);

  const handleAdd = async () => {
    if (!selectedSetId) { setError('Selectează un set.'); return; }
    setApplying(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_add_questions_to_set', {
        p_set_id: selectedSetId,
        p_question_ids: selectedQuestionIds,
      });
      if (rpcError) throw rpcError;
      const count = typeof data === 'number' ? data : 0;
      onDone(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la adăugarea grilelor.');
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
        <h3 className="font-display text-lg font-bold text-stone-900 mb-4">Adaugă {selectedQuestionIds.length} grile la set</h3>

        {loading ? (
          <p className="text-sm text-stone-500">Se încarcă seturile...</p>
        ) : sets.length === 0 ? (
          <p className="text-sm text-stone-500">Nu există seturi în această lecție. Creează un set mai întâi.</p>
        ) : (
          <select className="input" value={selectedSetId} onChange={(e) => setSelectedSetId(e.target.value)}>
            <option value="">Selectează un set...</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        )}

        {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} disabled={applying} className="btn-secondary">Renunță</button>
          <button onClick={handleAdd} disabled={applying || sets.length === 0} className="btn-primary">
            {applying && <Loader2 size={16} className="animate-spin" />}
            Adaugă la set
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Set From Selection Dialog ────────────────────────────────────

function CreateSetFromSelectionDialog({
  lesson, selectedQuestionIds, position, onDone, onCancel,
}: {
  lesson: PracticeLesson;
  selectedQuestionIds: string[];
  position: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetCount, setTargetCount] = useState(selectedQuestionIds.length.toString());
  const [requiresSub, setRequiresSub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!title.trim()) { setError('Titlul este obligatoriu.'); return; }
    const tc = parseInt(targetCount) || 0;
    if (tc <= 0) { setError('Numărul de grile trebuie să fie pozitiv.'); return; }

    setSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_create_set_from_questions', {
        p_lesson_id: lesson.id,
        p_title: title.trim(),
        p_description: description.trim(),
        p_target_count: tc,
        p_requires_subscription: requiresSub,
        p_position: position,
        p_question_ids: selectedQuestionIds,
      });
      if (rpcError) throw rpcError;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la crearea setului.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6">
        <h3 className="font-display text-lg font-bold text-stone-900 mb-4">
          Creează set din {selectedQuestionIds.length} grile selectate
        </h3>

        <div className="grid gap-4">
          <div>
            <label className="label">Titlu</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Set 1 — Celula..." />
          </div>
          <div>
            <label className="label">Descriere</label>
            <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descriere scurtă..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Număr țintă grile</label>
              <input type="number" className="input" value={targetCount} onChange={(e) => setTargetCount(e.target.value)} min={1} />
            </div>
            <div>
              <label className="label">Acces</label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-600 mt-2">
                <input type="checkbox" checked={requiresSub} onChange={(e) => setRequiresSub(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-brand-600" />
                Necesită abonament
              </label>
            </div>
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} disabled={saving} className="btn-secondary">Renunță</button>
          <button onClick={handleCreate} disabled={saving} className="btn-primary">
            {saving && <Loader2 size={16} className="animate-spin" />}
            <Plus size={16} /> Creează setul
          </button>
        </div>
      </div>
    </div>
  );
}
