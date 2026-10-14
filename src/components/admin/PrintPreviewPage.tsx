import type { Question, PracticeQuestion } from '@/lib/supabase';

type PrintQuestion = Question | PracticeQuestion;

type Props = {
  title: string;
  questions: PrintQuestion[];
  subtitle?: string;
  onClose: () => void;
};

export default function PrintPreviewPage({ title, questions, subtitle, onClose }: Props) {
  return (
    <div className="min-h-screen bg-white">
      {/* On-screen toolbar (hidden in print) */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-stone-900 px-6 py-3 text-white shadow-lg">
        <span className="text-sm font-semibold">
          Previzualizare PDF — {title}
        </span>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold transition hover:bg-brand-500"
          >
            Salvează ca PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-stone-700 px-4 py-2 text-sm font-semibold transition hover:bg-stone-600"
          >
            Închide
          </button>
        </div>
      </div>

      {/* Print content */}
      <div className="pdf-document mx-auto max-w-3xl px-8 pt-20 pb-16 sm:pt-20">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .pdf-document { padding-top: 0; max-width: 100%; }
            body { background: white !important; }
            @page { margin: 1.5cm; }
          }
          .pdf-document h1 { font-family: 'Inter', sans-serif; }
          .pdf-question { page-break-inside: avoid; margin-bottom: 1.5rem; }
        `}</style>

        {/* Header */}
        <div className="pdf-header mb-8 border-b-2 border-stone-800 pb-4">
          <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
          <p className="mt-2 text-xs text-stone-500">
            Total grile: {questions.length}
          </p>
        </div>

        {/* Questions */}
        <div className="pdf-questions space-y-6">
          {questions.map((q, idx) => {
            const isCS = q.type === 'CS';
            return (
              <div key={q.id} className="pdf-question">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-stone-900">
                    {idx + 1}.
                  </span>
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
                    {q.type === 'CS' ? 'Complement Simplu' : 'Complement Grupat'}
                  </span>
                </div>

                {/* Enunț */}
                <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-900">
                  {q.question_text}
                </p>

                {/* Variante */}
                {isCS ? (
                  <div className="space-y-1.5 pl-6">
                    {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
                      const val = letter === 'A' ? q.option_a
                        : letter === 'B' ? q.option_b
                        : letter === 'C' ? q.option_c
                        : letter === 'D' ? q.option_d
                        : q.option_e;
                      if (!val) return null;
                      const isCorrect = q.correct_answer === letter;
                      return (
                        <div
                          key={letter}
                          className={`flex gap-2 text-sm ${isCorrect ? 'font-semibold text-green-700' : 'text-stone-700'}`}
                        >
                          <span className="font-bold">{letter}.</span>
                          <span className="whitespace-pre-wrap">{val}</span>
                          {isCorrect && (
                            <span className="ml-1 text-xs text-green-600">✓ corect</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1.5 pl-6">
                    {(['1', '2', '3', '4'] as const).map((num) => {
                      const val = num === '1' ? q.statement_1
                        : num === '2' ? q.statement_2
                        : num === '3' ? q.statement_3
                        : q.statement_4;
                      if (!val) return null;
                      return (
                        <div key={num} className="flex gap-2 text-sm text-stone-700">
                          <span className="font-bold">{num}.</span>
                          <span className="whitespace-pre-wrap">{val}</span>
                        </div>
                      );
                    })}
                    <div className="mt-2 text-sm font-semibold text-green-700">
                      Răspuns corect: {q.correct_answer}
                    </div>
                  </div>
                )}

                {/* Explicație */}
                {q.explanation && (
                  <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Explicație
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                      {q.explanation}
                    </p>
                  </div>
                )}

                <div className="mt-4 border-b border-stone-100" />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 text-center text-xs text-stone-400">
          {title} — {questions.length} grile — Generat la {new Date().toLocaleDateString('ro-RO')}
        </div>
      </div>
    </div>
  );
}
