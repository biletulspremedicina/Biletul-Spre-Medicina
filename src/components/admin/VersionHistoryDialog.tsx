import { useEffect, useState } from 'react';
import { Loader2, History, X, RotateCcw, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ContentImportRecord, ContentVersionRecord, ContentType } from '@/lib/contentVersioning';

type Props = {
  contentType: ContentType;
  contentId: string;
  onClose: () => void;
  onRestored: () => void;
};

export default function VersionHistoryDialog({ contentType, contentId, onClose, onRestored }: Props) {
  const [imports, setImports] = useState<ContentImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);
  const [versions, setVersions] = useState<ContentVersionRecord[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('content_imports')
        .select('*')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .order('created_at', { ascending: false });
      setImports((data || []) as ContentImportRecord[]);
      setLoading(false);
    })();
  }, [contentType, contentId]);

  const loadVersions = async (importId: string) => {
    if (expandedImport === importId) {
      setExpandedImport(null);
      return;
    }
    setLoadingVersions(true);
    const { data } = await supabase
      .from('content_versions')
      .select('*')
      .eq('import_id', importId)
      .order('created_at', { ascending: false });
    setVersions((data || []) as ContentVersionRecord[]);
    setExpandedImport(importId);
    setLoadingVersions(false);
  };

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    setRestoreError(null);
    try {
      const { error } = await supabase.rpc('restore_content_version', {
        p_version_id: versionId,
      });
      if (error) throw error;
      setRestoreConfirm(null);
      onRestored();
      // Reload imports
      const { data } = await supabase
        .from('content_imports')
        .select('*')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .order('created_at', { ascending: false });
      setImports((data || []) as ContentImportRecord[]);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Eroare la restaurare.');
    }
    setRestoring(null);
  };

  const getFieldName = (key: string): string => {
    const map: Record<string, string> = {
      question_text: 'Enunț',
      option_a: 'Var. A',
      option_b: 'Var. B',
      option_c: 'Var. C',
      option_d: 'Var. D',
      option_e: 'Var. E',
      statement_1: 'Afirm. 1',
      statement_2: 'Afirm. 2',
      statement_3: 'Afirm. 3',
      statement_4: 'Afirm. 4',
      explanation: 'Explicație',
    };
    return map[key] || key;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <History size={22} className="text-brand-600" />
            <h2 className="font-display text-lg font-bold text-stone-900">Istoric versiuni</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-stone-400" />
            </div>
          ) : imports.length === 0 ? (
            <div className="py-12 text-center text-stone-500">
              <History size={40} className="mx-auto mb-3 text-stone-300" />
              <p className="text-sm font-medium">Nu există importuri înregistrate.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {imports.map((imp) => (
                <div key={imp.id} className="rounded-xl border border-stone-200 overflow-hidden">
                  {/* Import row */}
                  <div className="flex items-center justify-between bg-stone-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        imp.status === 'restored' ? 'bg-amber-100 text-amber-600'
                        : imp.status === 'failed' ? 'bg-red-100 text-red-600'
                        : 'bg-green-100 text-green-600'
                      }`}>
                        {imp.status === 'restored' ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">
                          {new Date(imp.created_at).toLocaleString('ro-RO', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                        <p className="text-xs text-stone-500">
                          {imp.file_name} — {imp.changes_count} modificări — {imp.status}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => loadVersions(imp.id)}
                      className="btn-ghost text-xs px-3 py-1.5"
                    >
                      <Eye size={14} /> Vezi modificările
                    </button>
                  </div>

                  {/* Expanded versions */}
                  {expandedImport === imp.id && (
                    <div className="border-t border-stone-200 px-4 py-3">
                      {loadingVersions ? (
                        <div className="flex justify-center py-4">
                          <Loader2 size={20} className="animate-spin text-stone-400" />
                        </div>
                      ) : versions.length === 0 ? (
                        <p className="py-4 text-center text-xs text-stone-500">Nu există versiuni.</p>
                      ) : (
                        <div className="space-y-3">
                          {versions.map((v) => {
                            const changedFields = Object.keys(v.new_content).filter(
                              (k) => v.previous_content[k] !== v.new_content[k]
                            );
                            return (
                              <div key={v.id} className="rounded-lg border border-stone-100 bg-white p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-mono text-stone-400">
                                    {v.question_id.substring(0, 8)}...
                                  </span>
                                  <button
                                    onClick={() => setRestoreConfirm(v.id)}
                                    disabled={restoring === v.id}
                                    className="btn-ghost text-xs px-2 py-1 text-amber-600 hover:bg-amber-50"
                                  >
                                    {restoring === v.id ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <RotateCcw size={12} />
                                    )}
                                    Restaurează
                                  </button>
                                </div>

                                {restoreConfirm === v.id && (
                                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600" />
                                      <div className="flex-1">
                                        <p className="text-xs font-semibold text-amber-800">
                                          Confirmați restaurarea acestei versiuni?
                                        </p>
                                        <p className="mt-1 text-xs text-amber-700">
                                          Se va crea o nouă versiune cu starea actuală înainte de restaurare.
                                        </p>
                                        <div className="mt-2 flex gap-2">
                                          <button
                                            onClick={() => handleRestore(v.id)}
                                            disabled={!!restoring}
                                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                                          >
                                            Confirmă restaurarea
                                          </button>
                                          <button
                                            onClick={() => setRestoreConfirm(null)}
                                            className="rounded-lg bg-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-300"
                                          >
                                            Anulează
                                          </button>
                                        </div>
                                        {restoreError && (
                                          <p className="mt-2 text-xs text-red-600">{restoreError}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Diff */}
                                <div className="space-y-1.5">
                                  {changedFields.length === 0 ? (
                                    <p className="text-xs text-stone-400">Nicio modificare detectabilă.</p>
                                  ) : (
                                    changedFields.map((field) => (
                                      <div key={field} className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                        <div>
                                          <span className="text-xs font-semibold text-stone-400">
                                            {getFieldName(field)} — anterior:
                                          </span>
                                          <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 line-through">
                                            {v.previous_content[field] || '(gol)'}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-xs font-semibold text-stone-400">
                                            {getFieldName(field)} — nou:
                                          </span>
                                          <p className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                                            {v.new_content[field] || '(gol)'}
                                          </p>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
