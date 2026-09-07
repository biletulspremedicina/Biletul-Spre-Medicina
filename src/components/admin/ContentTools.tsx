import { useRef, useState } from 'react';
import { FileText, FileSpreadsheet, FileUp, History, Loader2, CheckCircle2, AlertTriangle, Download, PlusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Question, PracticeQuestion } from '@/lib/supabase';
import {
  buildExportRows,
  validateImport,
  type ContentType,
  type ValidationResult,
} from '@/lib/contentVersioning';
import { generateCorrectionXlsx, parseCorrectionXlsx } from '@/lib/excelExport';
import {
  generateNewQuestionsTemplate,
  parseNewQuestionsXlsx,
  validateNewQuestions,
  type NewQuestionValidation,
} from '@/lib/newQuestionsImport';
import PrintPreviewPage from '@/components/admin/PrintPreviewPage';
import ImportPreviewDialog from '@/components/admin/ImportPreviewDialog';
import VersionHistoryDialog from '@/components/admin/VersionHistoryDialog';
import NewQuestionsImportPreviewDialog from '@/components/admin/NewQuestionsImportPreviewDialog';

type Props = {
  contentType: ContentType;
  contentId: string;
  contentTitle: string;
  materie?: string;
  lectie?: string;
  questionTable: 'questions' | 'practice_questions';
  parentColumn: 'simulation_id' | 'set_id';
  isPublished?: boolean;
  onQuestionsChanged?: () => void;
};

type AnyQuestion = Question | PracticeQuestion;

export default function ContentTools({
  contentType,
  contentId,
  contentTitle,
  materie,
  lectie,
  questionTable,
  parentColumn,
  isPublished = false,
  onQuestionsChanged,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newQuestionsInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfQuestions, setPdfQuestions] = useState<AnyQuestion[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // New questions import state
  const [newQuestionsValidation, setNewQuestionsValidation] = useState<NewQuestionValidation | null>(null);
  const [newQuestionsFileName, setNewQuestionsFileName] = useState('');

  const fetchQuestions = async (): Promise<AnyQuestion[]> => {
    const { data, error } = await supabase
      .from(questionTable)
      .select('*')
      .eq(parentColumn, contentId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data || []) as AnyQuestion[];
  };

  const handleExportPdf = async () => {
    setBusy('pdf');
    setMessage(null);
    try {
      const questions = await fetchQuestions();
      if (questions.length === 0) {
        setMessage({ type: 'error', text: 'Nu există grile pentru export.' });
        setBusy(null);
        return;
      }
      setPdfQuestions(questions);
      setShowPdf(true);
    } catch {
      setMessage({ type: 'error', text: 'Eroare la încărcarea grilelor.' });
    }
    setBusy(null);
  };

  const handleExportCorrection = async () => {
    setBusy('excel');
    setMessage(null);
    try {
      const questions = await fetchQuestions();
      if (questions.length === 0) {
        setMessage({ type: 'error', text: 'Nu există grile pentru export.' });
        setBusy(null);
        return;
      }

      const rows = buildExportRows(questions, {
        contentType,
        contentId,
        contentTitle,
        materie,
        lectie,
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const safeTitle = contentTitle.replace(/[^a-zA-Z0-9ăâîșțĂÂÎȘȚ -]/g, '').replace(/\s+/g, '-');
      const prefix = contentType === 'simulation' ? 'corectura-simulare' : 'corectura-antrenament';
      const fileName = `${prefix}-${safeTitle}-${dateStr}.xlsx`;

      await generateCorrectionXlsx(rows, fileName);
      setMessage({ type: 'success', text: 'Fișierul pentru corectură a fost descărcat.' });
    } catch {
      setMessage({ type: 'error', text: 'Eroare la generarea fișierului Excel.' });
    }
    setBusy(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setMessage({ type: 'error', text: 'Doar fișierele .xlsx sunt acceptate.' });
      e.target.value = '';
      return;
    }

    setBusy('import');
    setMessage(null);
    setImportFileName(file.name);

    try {
      const excelRows = await parseCorrectionXlsx(file);
      const dbQuestions = await fetchQuestions();

      const result = validateImport(excelRows, dbQuestions, contentId, {
        title: contentTitle,
        materie,
        lectie,
      });
      setValidationResult(result);

      if (result.errors.length === 0 && result.modifiedQuestions === 0 && result.contentChanges.length === 0 && result.warnings.length === 0) {
        setMessage({ type: 'info', text: 'Nu au fost găsite modificări.' });
        setBusy(null);
      } else if (result.errors.length === 0) {
        setMessage({ type: 'success', text: 'Fișier verificat cu succes.' });
        setBusy(null);
      } else {
        setMessage({ type: 'error', text: `Au fost găsite ${result.errors.length} erori. Vezi previzualizarea.` });
        setBusy(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Eroare la citirea fișierului.';
      setMessage({ type: 'error', text: msg });
      setBusy(null);
    }

    e.target.value = '';
  };

  // ── New questions template download ──
  const handleDownloadTemplate = async () => {
    setBusy('template');
    setMessage(null);
    try {
      const safeTitle = contentTitle.replace(/[^a-zA-Z0-9ăâîșțĂÂÎȘȚ -]/g, '').replace(/\s+/g, '-');
      const fileName = `model-grile-noi-${safeTitle}.xlsx`;
      await generateNewQuestionsTemplate(contentTitle, fileName);
      setMessage({ type: 'success', text: 'Modelul pentru grile noi a fost descărcat.' });
    } catch {
      setMessage({ type: 'error', text: 'Eroare la generarea modelului Excel.' });
    }
    setBusy(null);
  };

  // ── New questions file select ──
  const handleNewQuestionsFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setMessage({ type: 'error', text: 'Doar fișierele .xlsx sunt acceptate.' });
      e.target.value = '';
      return;
    }

    setBusy('newImport');
    setMessage(null);
    setNewQuestionsFileName(file.name);

    try {
      const rows = await parseNewQuestionsXlsx(file);
      const dbQuestions = await fetchQuestions();

      // For practice sets, fetch target_question_count
      let targetQuestionCount: number | undefined;
      if (contentType === 'practice_set') {
        const { data: setData } = await supabase
          .from('practice_sets')
          .select('target_question_count')
          .eq('id', contentId)
          .maybeSingle();
        if (setData) targetQuestionCount = (setData as { target_question_count: number }).target_question_count;
      }

      const result = validateNewQuestions(rows, dbQuestions, {
        contentType,
        targetQuestionCount,
      });
      setNewQuestionsValidation(result);

      if (result.errors.length === 0) {
        setMessage({ type: 'success', text: `Fișier verificat: ${result.validQuestions.length} grile gata pentru import.` });
      } else {
        setMessage({ type: 'error', text: `${result.errors.length} erori găsite. Vezi previzualizarea.` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Eroare la citirea fișierului.';
      setMessage({ type: 'error', text: msg });
    }

    setBusy(null);
    e.target.value = '';
  };

  const handleImportConfirmed = () => {
    setValidationResult(null);
    setMessage({ type: 'success', text: 'Import realizat cu succes.' });
    onQuestionsChanged?.();
  };

  const handleImportCancelled = () => {
    setValidationResult(null);
    setMessage({ type: 'info', text: 'Importul nu a fost aplicat. Datele existente au rămas neschimbate.' });
  };

  const handleNewQuestionsImportConfirmed = (importedCount: number) => {
    setNewQuestionsValidation(null);
    setMessage({ type: 'success', text: `Au fost importate cu succes ${importedCount} grile noi.` });
    onQuestionsChanged?.();
  };

  const handleNewQuestionsImportCancelled = () => {
    setNewQuestionsValidation(null);
    setMessage({ type: 'info', text: 'Importul de grile noi nu a fost aplicat.' });
  };

  const isBusy = busy !== null;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Group 1: Verificare și corectură */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Verificare și corectură</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportPdf}
              disabled={isBusy}
              className="btn-secondary text-xs px-3 py-2"
            >
              {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Exportă PDF complet
            </button>
            <button
              onClick={handleExportCorrection}
              disabled={isBusy}
              className="btn-secondary text-xs px-3 py-2"
            >
              {busy === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              Exportă pentru corectură
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="btn-secondary text-xs px-3 py-2"
            >
              {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              Importă versiunea corectată
            </button>
            <button
              onClick={() => setShowHistory(true)}
              disabled={isBusy}
              className="btn-secondary text-xs px-3 py-2"
            >
              <History size={14} />
              Istoric versiuni
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Group 2: Adăugare grile noi */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Adăugare grile noi</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadTemplate}
              disabled={isBusy}
              className="btn-secondary text-xs px-3 py-2"
            >
              {busy === 'template' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Descarcă model grile noi
            </button>
            <button
              onClick={() => newQuestionsInputRef.current?.click()}
              disabled={isBusy}
              className="btn-secondary text-xs px-3 py-2"
            >
              {busy === 'newImport' ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              Importă modelul completat
            </button>
            <input
              ref={newQuestionsInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleNewQuestionsFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : message.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-stone-50 border border-stone-200 text-stone-600'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={14} /> : message.type === 'error' ? <AlertTriangle size={14} /> : null}
            {message.text}
          </div>
        )}
      </div>

      {/* PDF Print Preview */}
      {showPdf && pdfQuestions.length > 0 && (
        <PrintPreviewPage
          title={contentTitle}
          questions={pdfQuestions}
          subtitle={lectie ? `${materie || ''} — ${lectie}` : undefined}
          onClose={() => {
            setShowPdf(false);
            setPdfQuestions([]);
          }}
        />
      )}

      {/* Import Preview Dialog (correction) */}
      {validationResult && (
        <ImportPreviewDialog
          result={validationResult}
          contentType={contentType}
          contentId={contentId}
          fileName={importFileName}
          onConfirm={handleImportConfirmed}
          onCancel={handleImportCancelled}
        />
      )}

      {/* New Questions Import Preview Dialog */}
      {newQuestionsValidation && (
        <NewQuestionsImportPreviewDialog
          validation={newQuestionsValidation}
          contentType={contentType}
          contentId={contentId}
          contentTitle={contentTitle}
          fileName={newQuestionsFileName}
          isPublished={isPublished}
          onConfirm={handleNewQuestionsImportConfirmed}
          onCancel={handleNewQuestionsImportCancelled}
        />
      )}

      {/* Version History Dialog */}
      {showHistory && (
        <VersionHistoryDialog
          contentType={contentType}
          contentId={contentId}
          onClose={() => setShowHistory(false)}
          onRestored={() => {
            setMessage({ type: 'success', text: 'Versiune restaurată cu succes.' });
            onQuestionsChanged?.();
          }}
        />
      )}
    </>
  );
}
