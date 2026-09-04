import { useEffect, useState } from 'react';
import { supabase, type Simulation, type Question } from '@/lib/supabase';
import { Clock, Send, ChevronLeft, CheckCircle2, XCircle, RotateCcw, Trophy, AlertTriangle } from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  simulationId: string;
  onExit: () => void;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export default function PracticeView({ simulationId, onExit }: Props) {
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sim } = await supabase
        .from('simulations')
        .select('*')
        .eq('id', simulationId)
        .maybeSingle();
      if (!sim) {
        setLoading(false);
        return;
      }
      setSimulation(sim as Simulation);

      const { data: qs } = await supabase
        .from('questions')
        .select('*')
        .eq('simulation_id', simulationId)
        .order('position', { ascending: true });
      setQuestions((qs || []) as Question[]);
      setLoading(false);
    })();
  }, [simulationId]);

  const handleAnswer = (questionId: string, letter: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: letter }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  if (loading) return <Loading message="Se încarcă simularea..." />;

  if (!simulation || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        <p>Simularea nu a fost găsită sau nu are întrebări.</p>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const score = questions.reduce((acc, q) => acc + (answers[q.id] === q.correct_answer ? 1 : 0), 0);
  const maxScore = questions.length;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <span className="text-sm font-medium text-stone-700 hidden sm:inline">{simulation.title}</span>
            <span className="badge bg-amber-100 text-amber-700">
              <RotateCcw size={12} /> Practică
            </span>
          </div>
          <button onClick={onExit} className="btn-ghost">
            <ChevronLeft size={16} /> Înapoi
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Practice info banner */}
        {!submitted && (
          <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Mod practică</p>
                <p className="text-sm text-amber-800 mt-0.5">
                  Nu există cronometru. Răspunde în ritmul tău, iar la final vei vedea
                  imediat răspunsurile corecte și explicațiile. Acest rezultat nu este salvat.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Score summary after submit */}
        {submitted && (
          <div className="card p-8 mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
              <Trophy size={32} />
            </div>
            <p className="text-sm text-stone-500 mb-1">Scor practică</p>
            <p className="font-display text-4xl font-extrabold text-stone-900 mb-2">
              {score} <span className="text-2xl text-stone-400">/ {maxScore}</span>
            </p>
            <p className="text-lg font-semibold text-brand-600">{percentage}%</p>
            <button onClick={handleReset} className="btn-secondary mt-6">
              <RotateCcw size={16} /> Refă din nou
            </button>
          </div>
        )}

        {/* Progress */}
        {!submitted && (
          <div className="mb-6 flex items-center justify-between text-sm text-stone-500">
            <span>{answeredCount} / {questions.length} întrebări răspunse</span>
            <div className="h-2 flex-1 mx-4 rounded-full bg-stone-200 overflow-hidden max-w-xs">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((q, idx) => (
            <PracticeQuestionCard
              key={q.id}
              question={q}
              index={idx}
              selectedAnswer={answers[q.id]}
              onSelect={(letter) => handleAnswer(q.id, letter)}
              submitted={submitted}
            />
          ))}
        </div>

        {/* Submit button */}
        {!submitted && questions.length > 0 && (
          <div className="mt-8 flex justify-end gap-3">
            <button onClick={onExit} className="btn-secondary">
              <ChevronLeft size={16} /> Renunță
            </button>
            <button onClick={handleSubmit} className="btn-primary">
              <Send size={16} /> Verifică răspunsurile
            </button>
          </div>
        )}

        {submitted && (
          <div className="mt-8 flex justify-center">
            <button onClick={onExit} className="btn-secondary">
              <ChevronLeft size={16} /> Înapoi la arhivă
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeQuestionCard({
  question,
  index,
  selectedAnswer,
  onSelect,
  submitted,
}: {
  question: Question;
  index: number;
  selectedAnswer: string | undefined;
  onSelect: (letter: string) => void;
  submitted: boolean;
}) {
  const isCG = question.type === 'CG';
  const isCorrect = submitted && selectedAnswer === question.correct_answer;
  const isWrong = submitted && selectedAnswer !== undefined && selectedAnswer !== question.correct_answer;

  return (
    <div className={`card p-6 transition-all ${submitted ? (isCorrect ? 'border-green-300' : isWrong ? 'border-red-300' : '') : ''}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-600">
          {index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="badge bg-stone-100 text-stone-600">
              {isCG ? 'Complement Grupat' : 'Complement Simplu'}
            </span>
            {submitted && isCorrect && (
              <span className="badge bg-green-100 text-green-700">
                <CheckCircle2 size={12} /> Corect
              </span>
            )}
            {submitted && isWrong && (
              <span className="badge bg-red-100 text-red-700">
                <XCircle size={12} /> Greșit
              </span>
            )}
          </div>
          <p className="text-stone-900 font-medium leading-relaxed">{question.question_text}</p>
        </div>
      </div>

      {/* CG statements */}
      {isCG && (
        <div className="mb-4 ml-10 space-y-2">
          {[1, 2, 3, 4].map((n) => {
            const text = question[`statement_${n}` as keyof Question] as string;
            if (!text) return null;
            return (
              <div key={n} className="flex gap-2 text-sm text-stone-700">
                <span className="font-semibold text-stone-500">{n}.</span>
                <span>{text}</span>
              </div>
            );
          })}
          <div className="mt-3 rounded-lg bg-stone-50 border border-stone-200 p-3 text-xs text-stone-500">
            <strong>Variante:</strong> A = 1, 2, 3 · B = 1, 3 · C = 2, 4 · D = doar 4 · E = toate sau altă combinație
          </div>
        </div>
      )}

      {/* Options */}
      <div className="ml-10 grid gap-2">
        {LETTERS.map((letter) => {
          const optionText = isCG
            ? getCGLabel(letter)
            : (question[`option_${letter.toLowerCase()}` as keyof Question] as string);

          if (!optionText && !isCG) return null;

          const isSelected = selectedAnswer === letter;
          const isCorrectOption = submitted && question.correct_answer === letter;

          let className = 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50';
          if (submitted && isCorrectOption) {
            className = 'border-green-300 bg-green-50 text-green-900';
          } else if (submitted && isSelected && !isCorrectOption) {
            className = 'border-red-300 bg-red-50 text-red-900';
          } else if (!submitted && isSelected) {
            className = 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/20';
          }

          return (
            <button
              key={letter}
              onClick={() => !submitted && onSelect(letter)}
              disabled={submitted}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${className} ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                submitted && isCorrectOption
                  ? 'bg-green-600 text-white'
                  : submitted && isSelected && !isCorrectOption
                  ? 'bg-red-500 text-white'
                  : isSelected
                  ? 'bg-brand-600 text-white'
                  : 'bg-stone-100 text-stone-600'
              }`}>
                {letter}
              </span>
              <span className="flex-1">{optionText}</span>
              {submitted && isCorrectOption && (
                <CheckCircle2 size={16} className="text-green-600" />
              )}
              {submitted && isSelected && !isCorrectOption && (
                <XCircle size={16} className="text-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* CG answer comparison after submit */}
      {submitted && isCG && (
        <div className="ml-10 mt-3 grid gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-stone-500 w-32 flex-shrink-0">Răspunsul tău:</span>
            <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
              {selectedAnswer || 'Nerăspuns'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-stone-500 w-32 flex-shrink-0">Răspuns corect:</span>
            <span className="font-bold text-green-700">{question.correct_answer}</span>
          </div>
        </div>
      )}

      {/* Explanation after submit */}
      {submitted && question.explanation && (
        <div className="ml-10 mt-4 rounded-xl bg-brand-50 border border-brand-100 p-4">
          <p className="text-xs font-semibold text-brand-700 mb-1">Explicație</p>
          <p className="text-sm text-stone-700 leading-relaxed">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}

function getCGLabel(letter: string): string {
  const labels: Record<string, string> = {
    A: 'Afirmațiile 1, 2, 3 sunt corecte',
    B: 'Afirmațiile 1, 3 sunt corecte',
    C: 'Afirmațiile 2, 4 sunt corecte',
    D: 'Doar afirmația 4 este corectă',
    E: 'Toate cele 4 corecte sau altă combinație',
  };
  return labels[letter] || '';
}
