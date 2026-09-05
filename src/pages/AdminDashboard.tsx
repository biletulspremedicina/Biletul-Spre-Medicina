import { useEffect, useState, useCallback } from 'react';
import { supabase, type Simulation, type Question, type Attempt, type Profile, type Subscription } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, Plus, Edit2, Trash2, Eye, EyeOff,
  ChevronLeft, Save, X, Loader2, Trophy, CreditCard, BookOpen, Clock, Settings, CheckCircle2, AlertTriangle
} from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  onExit: () => void;
};

type Tab = 'simulations' | 'monitoring' | 'settings';

export default function AdminDashboard({ onExit }: Props) {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('simulations');
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSim, setEditingSim] = useState<Simulation | null>(null);
  const [creatingSim, setCreatingSim] = useState(false);

  const loadSimulations = useCallback(async () => {
    const { data } = await supabase
      .from('simulations')
      .select('*')
      .order('created_at', { ascending: false });
    setSimulations((data || []) as Simulation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSimulations();
  }, [loadSimulations]);

  if (loading) return <Loading message="Se încarcă panoul de administrare..." />;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="badge bg-brand-100 text-brand-700 ml-2">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-600 hidden sm:inline">{profile?.email}</span>
            <button onClick={() => { signOut(); onExit(); }} className="btn-ghost">Deconectare</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex gap-1 rounded-xl bg-stone-100 p-1">
          <TabButton active={tab === 'simulations'} onClick={() => setTab('simulations')} icon={<LayoutDashboard size={16} />}>
            Simulări & Întrebări
          </TabButton>
          <TabButton active={tab === 'monitoring'} onClick={() => setTab('monitoring')} icon={<Users size={16} />}>
            Monitorizare
          </TabButton>
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={<Settings size={16} />}>
            Setări
          </TabButton>
        </div>

        {tab === 'simulations' && (
          <SimulationsTab
            simulations={simulations}
            onReload={loadSimulations}
            editingSim={editingSim}
            setEditingSim={setEditingSim}
            creatingSim={creatingSim}
            setCreatingSim={setCreatingSim}
          />
        )}

        {tab === 'monitoring' && <MonitoringTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SimulationsTab({
  simulations,
  onReload,
  editingSim,
  setEditingSim,
  creatingSim,
  setCreatingSim,
}: {
  simulations: Simulation[];
  onReload: () => void;
  editingSim: Simulation | null;
  setEditingSim: (s: Simulation | null) => void;
  creatingSim: boolean;
  setCreatingSim: (v: boolean) => void;
}) {
  if (creatingSim) {
    return <SimForm onSaved={() => { setCreatingSim(false); onReload(); }} onCancel={() => setCreatingSim(false)} />;
  }

  if (editingSim) {
    return (
      <div>
        <button onClick={() => setEditingSim(null)} className="btn-ghost mb-4">
          <ChevronLeft size={16} /> Înapoi la simulări
        </button>
        <SimForm sim={editingSim} onSaved={() => { setEditingSim(null); onReload(); }} onCancel={() => setEditingSim(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-stone-900">Simulări</h2>
        <button onClick={() => setCreatingSim(true)} className="btn-primary">
          <Plus size={16} /> Creează simulare
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {simulations.length === 0 && (
          <div className="card p-12 text-center text-stone-500">
            <LayoutDashboard size={40} className="mx-auto mb-4 text-stone-300" />
            <p className="text-lg font-medium">Nu există simulări.</p>
            <p className="text-sm mt-1">Creează prima simulare pentru a începe.</p>
          </div>
        )}
        {simulations.map((sim) => (
          <SimAdminCard key={sim.id} sim={sim} onReload={onReload} onEdit={() => setEditingSim(sim)} />
        ))}
      </div>
    </div>
  );
}

function SimAdminCard({ sim, onReload, onEdit }: { sim: Simulation; onReload: () => void; onEdit: () => void }) {
  const [showQuestions, setShowQuestions] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('simulation_id', sim.id);
      setQuestionCount(count || 0);
    })();
  }, [sim.id]);

  const toggleActive = async () => {
    setPublishError(null);

    if (!sim.is_active) {
      // Validate before publishing
      if (!sim.title.trim()) {
        setPublishError('Titlul lipsește.');
        return;
      }
      if (!sim.duration_minutes || sim.duration_minutes <= 0) {
        setPublishError('Durata trebuie să fie validă.');
        return;
      }
      if (questionCount === 0) {
        setPublishError('Simularea trebuie să aibă cel puțin o grilă.');
        return;
      }

      // Check that every question has a correct_answer
      const { data: qs } = await supabase
        .from('questions')
        .select('correct_answer')
        .eq('simulation_id', sim.id);
      const missingAnswer = (qs || []).some((q) => !q.correct_answer);
      if (missingAnswer) {
        setPublishError('Toate grilele trebuie să aibă un răspuns corect configurat.');
        return;
      }
    }

    await supabase
      .from('simulations')
      .update({ is_active: !sim.is_active })
      .eq('id', sim.id);
    onReload();
  };

  const handleDelete = async () => {
    if (!confirm(`Sigur vrei să ștergi simularea „${sim.title}"? Această acțiune va șterge și toate întrebările asociate.`)) return;
    await supabase.from('simulations').delete().eq('id', sim.id);
    onReload();
  };

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-display text-base font-semibold text-stone-900">{sim.title}</h3>
            {sim.is_active ? (
              <span className="badge bg-green-100 text-green-700">
                <Eye size={12} /> Publicată
              </span>
            ) : (
              <span className="badge bg-stone-100 text-stone-500">
                <EyeOff size={12} /> Ciornă
              </span>
            )}
          </div>
          {sim.description && (
            <p className="text-sm text-stone-600 mb-2 line-clamp-2">{sim.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
            <span className="flex items-center gap-1"><Clock size={13} /> {sim.duration_minutes} min</span>
            <span className="flex items-center gap-1"><CreditCard size={13} /> {sim.requires_subscription ? 'Cu abonament' : 'Fără abonament'}</span>
            <span className="flex items-center gap-1"><BookOpen size={13} /> {questionCount} întrebări</span>
            <span className="flex items-center gap-1">
              {new Date(sim.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {publishError && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
              <AlertTriangle size={12} />
              {publishError}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onEdit} className="btn-ghost"><Edit2 size={15} /> Editează</button>
          <button onClick={toggleActive} className="btn-ghost">
            {sim.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
            {sim.is_active ? 'Ascunde' : 'Publică'}
          </button>
          <button onClick={handleDelete} className="btn-ghost text-red-600 hover:bg-red-50">
            <Trash2 size={15} /> Șterge
          </button>
          <button onClick={() => setShowQuestions(!showQuestions)} className="btn-secondary">
            <BookOpen size={15} /> Întrebări
          </button>
        </div>
      </div>

      {showQuestions && (
        <div className="mt-4 border-t border-stone-200 pt-4">
          <QuestionsManager simulationId={sim.id} />
        </div>
      )}
    </div>
  );
}

function SimForm({ sim, onSaved, onCancel }: { sim?: Simulation; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(sim?.title || '');
  const [description, setDescription] = useState(sim?.description || '');
  const [duration, setDuration] = useState(sim?.duration_minutes?.toString() || '120');
  const [requiresSub, setRequiresSub] = useState(sim ? sim.requires_subscription : false);
  const [isActive, setIsActive] = useState(sim ? sim.is_active : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError('Titlul este obligatoriu.'); return; }
    const dur = parseInt(duration) || 0;
    if (dur <= 0) { setError('Durata trebuie să fie un număr valid de minute.'); return; }

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      duration_minutes: dur,
      requires_subscription: requiresSub,
      is_active: isActive,
    };

    if (sim) {
      const { error: updateError } = await supabase
        .from('simulations')
        .update(payload)
        .eq('id', sim.id);
      if (updateError) setError(updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from('simulations')
        .insert(payload);
      if (insertError) setError(insertError.message);
    }

    setSaving(false);
    if (!error) onSaved();
  };

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl font-bold text-stone-900 mb-6">
        {sim ? 'Editează simularea' : 'Creează simulare nouă'}
      </h2>

      {!sim && (
        <div className="mb-4 rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 text-sm text-stone-600 flex gap-3">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-stone-400" />
          <div>
            Simularea se creează implicit ca <strong>ciornă (invizibilă)</strong>. Adaugă grilele,
            verifică conținutul, apoi public-o când e gata.
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Titlu</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Simulare Biologie —..." />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descriere</label>
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descriere scurtă a simulării..." />
        </div>
        <div>
          <label className="label">Durata testului (minute)</label>
          <input type="number" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} min={1} />
        </div>
        <div>
          <label className="label">Acces</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-600">
              <input
                type="checkbox"
                checked={requiresSub}
                onChange={(e) => setRequiresSub(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              />
              Necesită abonament
            </label>
          </div>
          {requiresSub ? (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              Doar elevii cu abonament activ pot accesa această simulare.
            </div>
          ) : (
            <div className="mt-2 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-brand-700">
              Această simulare este accesibilă fără abonament — orice elev o poate susține.
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Vizibilitate</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-600">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              />
              {isActive ? (
                <span className="flex items-center gap-1"><Eye size={14} /> Publicată (vizibilă elevilor)</span>
              ) : (
                <span className="flex items-center gap-1"><EyeOff size={14} /> Ciornă (invizibilă elevilor)</span>
              )}
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary"><X size={16} /> Anulează</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving && <Loader2 size={16} className="animate-spin" />}
          <Save size={16} /> {sim ? 'Salvează modificările' : 'Creează simulare'}
        </button>
      </div>
    </div>
  );
}

function QuestionsManager({ simulationId }: { simulationId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Question | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('simulation_id', simulationId)
      .order('position', { ascending: true });
    setQuestions((data || []) as Question[]);
    setLoading(false);
  }, [simulationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (creating) {
    return (
      <QuestionForm
        simulationId={simulationId}
        position={questions.length}
        onSaved={() => { setCreating(false); load(); }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(null)} className="btn-ghost mb-3"><ChevronLeft size={16} /> Înapoi la întrebări</button>
        <QuestionForm
          simulationId={simulationId}
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
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-stone-700">Gestionare întrebări ({questions.length})</h4>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs px-4 py-2">
          <Plus size={14} /> Adaugă grilă
        </button>
      </div>

      {loading && <p className="text-sm text-stone-500">Se încarcă...</p>}

      {questions.length === 0 && !loading && (
        <p className="text-sm text-stone-500 py-4">Nu există întrebări. Adaugă prima grilă.</p>
      )}

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
                await supabase.from('questions').delete().eq('id', q.id);
                load();
              }}
              className="btn-ghost text-xs px-2 py-1 text-red-600 hover:bg-red-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionForm({
  simulationId,
  question,
  position,
  onSaved,
  onCancel,
}: {
  simulationId: string;
  question?: Question;
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
      simulation_id: simulationId,
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
      const { error: err } = await supabase.from('questions').update(payload).eq('id', question.id);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase.from('questions').insert(payload);
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

function MonitoringTab() {
  const [data, setData] = useState<{ profile: Profile; subscriptions: Subscription[]; attempts: Attempt[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      const { data: subs } = await supabase.from('subscriptions').select('*');
      const { data: attempts } = await supabase.from('attempts').select('*');

      const enriched = (profiles || []).map((p) => ({
        profile: p as Profile,
        subscriptions: (subs || []).filter((s) => s.user_id === (p as Profile).id) as Subscription[],
        attempts: (attempts || []).filter((a) => a.user_id === (p as Profile).id) as Attempt[],
      }));

      setData(enriched);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loading message="Se încarcă datele de monitorizare..." />;

  const now = new Date();
  const activeSubs = data.filter((d) =>
    d.subscriptions.some((s) => s.status === 'active' && new Date(s.end_at) > now)
  ).length;

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Users size={20} /></div>
          <p className="text-2xl font-bold text-stone-900">{data.length}</p>
          <p className="text-sm text-stone-500">Elevi înscriși</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-600"><CreditCard size={20} /></div>
          <p className="text-2xl font-bold text-stone-900">{activeSubs}</p>
          <p className="text-sm text-stone-500">Abonamente active</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Trophy size={20} /></div>
          <p className="text-2xl font-bold text-stone-900">{data.reduce((s, d) => s + d.attempts.filter((a) => a.submitted_at).length, 0)}</p>
          <p className="text-sm text-stone-500">Simulări susținute</p>
        </div>
      </div>

      <h2 className="font-display text-xl font-bold text-stone-900 mb-4">Elevi</h2>

      {data.length === 0 ? (
        <div className="card p-12 text-center text-stone-500">
          <Users size={40} className="mx-auto mb-4 text-stone-300" />
          <p>Nu există elevi înscriși.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Elev</th>
                <th className="px-4 py-3">Abonament</th>
                <th className="px-4 py-3">Simulări susținute</th>
                <th className="px-4 py-3">Scoruri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map(({ profile, subscriptions, attempts }) => {
                const activeSub = subscriptions.find((s) => s.status === 'active' && new Date(s.end_at) > now);
                const completedAttempts = attempts.filter((a) => a.submitted_at);
                return (
                  <tr key={profile.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{profile.full_name || '—'}</p>
                      <p className="text-xs text-stone-500">{profile.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {activeSub ? (
                        <span className="badge bg-amber-100 text-amber-700">
                          <CheckCircle2 size={12} /> Activ până la {new Date(activeSub.end_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : (
                        <span className="badge bg-stone-100 text-stone-500">Inactiv</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-brand-100 text-brand-700">{completedAttempts.length}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {completedAttempts.length === 0 && <span className="text-stone-400 text-xs">—</span>}
                        {completedAttempts.map((a) => (
                          <span key={a.id} className="badge bg-stone-100 text-stone-600">
                            {a.score}/{a.max_score}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (data) {
        setPrice(Number(data.subscription_price_ron).toString());
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setError(null);
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed < 0) {
      setError('Introdu un preț valid (mai mare sau egal cu 0).');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from('app_settings')
      .update({ subscription_price_ron: parsed, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <Loading message="Se încarcă setările..." />;

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl font-bold text-stone-900 mb-6">Setări aplicație</h2>

      <div className="card p-6">
        <label className="label">Preț abonament lunar (RON)</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            className="input"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min={0}
            step="1"
            placeholder="30"
          />
          <span className="text-sm text-stone-500 whitespace-nowrap">RON / lună</span>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Acest preț va fi afișat elevilor în dashboard.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {saved && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Prețul a fost salvat cu succes.
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving && <Loader2 size={16} className="animate-spin" />}
            <Save size={16} /> Salvează prețul
          </button>
        </div>
      </div>
    </div>
  );
}
