import { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, FileUp, X } from 'lucide-react';
import type { ValidationResult } from '@/lib/contentVersioning';
import { supabase } from '@/lib/supabase';
import { buildRpcChanges, buildContentChangesRpc, type ContentType } from '@/lib/contentVersioning';

type Props = {
  result: ValidationResult;
  contentType: ContentType;
  contentId: string;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ImportPreviewDialog({
  result,
  contentType,
  contentId,
  fileName,
  onConfirm,
  onCancel,
}: Props) {
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const rpcChanges = buildRpcChanges(result.changes);
      const contentRpc = buildContentChangesRpc(result.contentChanges);

      if (rpcChanges.length === 0 && Object.keys(contentRpc).length === 0) {
        setError('Nu există modificări valide de aplicat.');
        setApplying(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('apply_content_import', {
        p_content_type: contentType,
        p_content_id: contentId,
        p_file_name: fileName,
        p_changes: rpcChanges,
        p_content_changes: contentRpc,
      });

      if (rpcError) throw rpcError;
      if (!data) throw new Error('Răspuns invalid de la server.');

      setDone(true);
      setTimeout(() => {
        onConfirm();
      }, 1500);
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
            {result.modifiedQuestions} grile au fost actualizate.
          </p>
        </div>
      </div>
    );
  }

  const hasChanges = result.changes.some((c) => c.fields.length > 0) || result.contentChanges.length > 0;
  const hasProtectedWarnings = result.protectedFieldChanges.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <FileUp size={22} className="text-brand-600" />
            <h2 className="font-display text-lg font-bold text-stone-900">
              Previzualizare import
            </h2>
          </div>
          <button onClick={onCancel} disabled={applying} className="btn-ghost p-2">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Summary */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Grile identificate" value={result.totalQuestions} color="stone" />
            <SummaryCard label="Grile modificate" value={result.modifiedQuestions} color="green" />
            <SummaryCard label="Erori" value={result.errors.length} color={result.errors.length > 0 ? 'red' : 'stone'} />
            <SummaryCard label="Avertismente" value={result.warnings.length} color={result.warnings.length > 0 ? 'amber' : 'stone'} />
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
                <AlertTriangle size={16} /> Erori ({result.errors.length})
              </h3>
              <ul className="space-y-1 text-xs text-red-700">
                {result.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Protected field warnings */}
          {hasProtectedWarnings && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800">
                <AlertTriangle size={16} /> Câmpuri protejate modificate ({result.protectedFieldChanges.length})
              </h3>
              <ul className="space-y-1 text-xs text-amber-700">
                {result.protectedFieldChanges.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-600">
                Aceste modificări vor fi ignorate. Restul modificărilor textuale vor fi aplicate.
              </p>
            </div>
          )}

          {/* Content-level changes (Titlu, Materie, Lecție) */}
          {result.contentChanges.length > 0 && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-blue-800">
                Modificări la nivel de conținut ({result.contentChanges.length})
              </h3>
              <div className="space-y-2">
                {result.contentChanges.map((c) => (
                  <div key={c.field} className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    <div>
                      <span className="text-xs font-semibold text-stone-500">{c.label} — vechi:</span>
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 line-through">
                        {c.oldValue || '(gol)'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-stone-500">{c.label} — nou:</span>
                      <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
                        {c.newValue}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No changes */}
          {!hasChanges && result.errors.length === 0 && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-8 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-3 text-stone-400" />
              <p className="text-sm font-semibold text-stone-700">Nu au fost găsite modificări</p>
              <p className="mt-1 text-xs text-stone-500">Toate grilele sunt identice cu cele din baza de date.</p>
            </div>
          )}

          {/* Diff list */}
          {hasChanges && (
            <div>
              <h3 className="mb-3 text-sm font-bold text-stone-800">
                Modificări detectate ({result.modifiedQuestions} grile)
              </h3>
              <div className="space-y-3">
                {result.changes
                  .filter((c) => c.fields.length > 0)
                  .map((c) => (
                    <div key={c.question_id} className="rounded-xl border border-stone-200 bg-white p-4">
                      <p className="mb-3 text-xs font-mono text-stone-400">{c.question_id}</p>
                      <div className="space-y-2">
                        {c.fields.map((f) => (
                          <div key={f.field} className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            <div>
                              <span className="text-xs font-semibold text-stone-500">{f.label} — vechi:</span>
                              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 line-through">
                                {f.oldValue || '(gol)'}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-stone-500">{f.label} — nou:</span>
                              <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
                                {f.newValue}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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
            {applying ? 'Se aplică modificările...' : 'Confirmați pentru a aplica modificările în baza de date.'}
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={applying} className="btn-secondary">
              Renunță
            </button>
            <button
              onClick={handleApply}
              disabled={applying || !hasChanges || result.errors.length > 0}
              className="btn-primary"
            >
              {applying && <Loader2 size={16} className="animate-spin" />}
              Importă modificările
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <div className={`rounded-xl p-4 ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}
