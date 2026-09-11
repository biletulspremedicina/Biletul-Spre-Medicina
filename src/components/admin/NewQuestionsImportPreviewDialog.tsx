import { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, FileUp, X, BookOpen } from 'lucide-react';
import type { NewQuestionValidation, NewQuestionRow } from '@/lib/newQuestionsImport';
import type { ContentType } from '@/lib/contentVersioning';
import { supabase } from '@/lib/supabase';
import { buildNewQuestionsRpcPayload } from '@/lib/newQuestionsImport';

type Props = {
  validation: NewQuestionValidation;
  contentType: ContentType;
  contentId: string;
  contentTitle: string;
  fileName: string;
  isPublished: boolean;
  onConfirm: (importedCount: number) => void;
  onCancel: () => void;
};

export default function NewQuestionsImportPreviewDialog({
  validation,
  contentType,
  contentId,
  contentTitle,
  fileName,
  isPublished,
  onConfirm,
  onCancel,
}: Props) {
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState(false);

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;
  const canImport = !hasErrors && (!hasWarnings || acknowledgedWarnings) && validation.validQuestions.length > 0;

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const payload = buildNewQuestionsRpcPayload(validation.validQuestions);

      let rpcName: string;
      let rpcParams: Record<string, unknown>;

      if (contentType === 'bank') {
        rpcName = 'admin_import_to_bank';
        rpcParams = {
          p_lesson_id: contentId,
          p_questions: payload as unknown as never,
        };
      } else {
        rpcName = 'admin_import_new_questions';
        rpcParams = {
          p_content_type: contentType,
          p_content_id: contentId,
          p_questions: payload as unknown as never,
        };
      }

      const { data, error: rpcError } = await supabase.rpc(rpcName, rpcParams);

      if (rpcError) throw rpcError;
      const count = typeof data === 'number' ? data : 0;
      setImportedCount(count);
      setDone(true);
      setTimeout(() => onConfirm(count), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Importul nu a fost aplicat. Datele existente au rămas neschimbate.');
      setApplying(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-stone-900">Import realizat cu succes</h3>
          <p className="mt-2 text-sm text-stone-600">
            Au fost importate cu succes {importedCount} grile noi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <FileUp size={22} className="text-brand-600" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                Previzualizare import grile noi
              </h2>
              <p className="text-xs text-stone-500">
                {contentType === 'simulation' ? 'Simulare' : contentType === 'bank' ? 'Banca de grile — lecția' : 'Set de antrenament'}: {contentTitle}
              </p>
            </div>
          </div>
          <button onClick={onCancel} disabled={applying} className="btn-ghost p-2">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* File name */}
          <p className="mb-4 text-xs text-stone-500">Fișier: {fileName}</p>

          {/* Published warning */}
          {isPublished && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <AlertTriangle size={16} /> Conținut publicat
              </h3>
              <p className="mt-1 text-xs text-amber-700">
                Acest conținut este public. Grilele importate vor deveni vizibile elevilor după confirmare.
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total grile" value={validation.totalCount} color="stone" />
            <SummaryCard label="Grile CS" value={validation.csCount} color="green" />
            <SummaryCard label="Grile CG" value={validation.cgCount} color="blue" />
            <SummaryCard label="Erori" value={validation.errors.length} color={validation.errors.length > 0 ? 'red' : 'stone'} />
          </div>

          {/* Errors */}
          {validation.errors.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
                <AlertTriangle size={16} /> Erori ({validation.errors.length})
              </h3>
              <ul className="space-y-1 text-xs text-red-700 max-h-40 overflow-y-auto">
                {validation.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800">
                <AlertTriangle size={16} /> Avertismente ({validation.warnings.length})
              </h3>
              <ul className="space-y-1 text-xs text-amber-700 max-h-40 overflow-y-auto">
                {validation.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
              {!hasErrors && (
                <label className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-800">
                  <input
                    type="checkbox"
                    checked={acknowledgedWarnings}
                    onChange={(e) => setAcknowledgedWarnings(e.target.checked)}
                    className="rounded border-amber-400"
                  />
                  Am citit avertismentele și confirm importul.
                </label>
              )}
            </div>
          )}

          {/* Question previews */}
          {validation.validQuestions.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-stone-800">
                <BookOpen size={16} /> Grile de importat ({validation.validQuestions.length})
              </h3>
              <div className="space-y-3">
                {validation.validQuestions.map((q, idx) => (
                  <QuestionPreviewCard key={idx} question={q} index={idx + 1} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          <p className="text-xs text-stone-500">
            {applying ? 'Se importă grilele...' : 'Confirmați pentru a adăuga grilele în baza de date.'}
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={applying} className="btn-secondary">
              Renunță
            </button>
            <button
              onClick={handleApply}
              disabled={applying || !canImport}
              className="btn-primary"
            >
              {applying && <Loader2 size={16} className="animate-spin" />}
              Importă toate grilele
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionPreviewCard({ question, index }: { question: NewQuestionRow; index: number }) {
  const isCS = question.type === 'CS';
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-600">
          {index}
        </span>
        <span className={`badge ${isCS ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
          {question.type}
        </span>
        <span className="ml-auto rounded-lg bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">
          Corect: {question.correctAnswer}
        </span>
      </div>

      <p className="mb-3 text-sm text-stone-800 whitespace-pre-wrap">{question.questionText}</p>

      {isCS ? (
        <div className="space-y-1.5">
          {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
            const val = {
              A: question.optionA,
              B: question.optionB,
              C: question.optionC,
              D: question.optionD,
              E: question.optionE,
            }[letter];
            const isCorrect = question.correctAnswer === letter;
            return (
              <div
                key={letter}
                className={`flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs ${
                  isCorrect ? 'bg-green-50 border border-green-200' : 'bg-stone-50'
                }`}
              >
                <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-stone-500'}`}>{letter}.</span>
                <span className="text-stone-700 whitespace-pre-wrap">{val || '(gol)'}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {(['1', '2', '3', '4'] as const).map((num) => {
            const val = {
              '1': question.statement1,
              '2': question.statement2,
              '3': question.statement3,
              '4': question.statement4,
            }[num];
            return (
              <div key={num} className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-xs">
                <span className="font-bold text-stone-500">{num}.</span>
                <span className="text-stone-700 whitespace-pre-wrap">{val}</span>
              </div>
            );
          })}
          <div className="mt-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs text-stone-500">
            <strong>Variante CG:</strong> A = 1,2,3 · B = 1,3 · C = 2,4 · D = doar 4 · E = toate
          </div>
        </div>
      )}

      <div className="mt-3 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-stone-600">
        <strong className="text-brand-700">Explicație:</strong> {question.explanation}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <div className={`rounded-xl p-4 ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}
