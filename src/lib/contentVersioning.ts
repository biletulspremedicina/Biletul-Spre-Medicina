import type { Question, PracticeQuestion } from '@/lib/supabase';

export type ContentType = 'simulation' | 'practice_set' | 'bank';

export type ExportRow = {
  tipContinut: string;
  idContinut: string;
  idGrila: string;
  ordine: number;
  titlu: string;
  materie: string;
  lectie: string;
  tipGrila: string;
  enunt: string;
  variantaA: string;
  variantaB: string;
  variantaC: string;
  variantaD: string;
  variantaE: string;
  raspunsCorect: string;
  explicatie: string;
  urlImagine: string;
};

export type FieldDiff = {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
};

export type QuestionChange = {
  question_id: string;
  fields: FieldDiff[];
  protectedFieldWarnings: string[];
};

export type ContentLevelChange = {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
};

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  changes: QuestionChange[];
  contentChanges: ContentLevelChange[];
  totalQuestions: number;
  modifiedQuestions: number;
  missingIds: string[];
  duplicateIds: string[];
  wrongContentIds: string[];
  protectedFieldChanges: string[];
};

export type ContentImportRecord = {
  id: string;
  content_type: ContentType;
  content_id: string;
  file_name: string;
  status: string;
  changes_count: number;
  errors: unknown;
  created_by: string | null;
  created_at: string;
};

export type ContentVersionRecord = {
  id: string;
  import_id: string;
  content_type: ContentType;
  content_id: string;
  question_id: string;
  previous_content: Record<string, string>;
  new_content: Record<string, string>;
  created_by: string | null;
  created_at: string;
};

export const EXPORT_COLUMNS = [
  'Tip conținut',
  'ID simulare/set',
  'ID grilă',
  'Ordine',
  'Titlu simulare/set',
  'Materie',
  'Lecție',
  'Tip grilă',
  'Enunț',
  'Varianta A',
  'Varianta B',
  'Varianta C',
  'Varianta D',
  'Varianta E',
  'Răspuns corect',
  'Explicație',
  'URL imagine',
] as const;

export const PROTECTED_COLUMNS = new Set([
  'Tip conținut',
  'ID simulare/set',
  'ID grilă',
  'Ordine',
  'Tip grilă',
  'Răspuns corect',
  'URL imagine',
]);

export const EDITABLE_COLUMNS = new Set([
  'Titlu simulare/set',
  'Materie',
  'Lecție',
  'Enunț',
  'Varianta A',
  'Varianta B',
  'Varianta C',
  'Varianta D',
  'Varianta E',
  'Explicație',
]);

export const FIELD_LABELS: Record<string, string> = {
  question_text: 'Enunț',
  option_a: 'Varianta A',
  option_b: 'Varianta B',
  option_c: 'Varianta C',
  option_d: 'Varianta D',
  option_e: 'Varianta E',
  statement_1: 'Afirmația 1',
  statement_2: 'Afirmația 2',
  statement_3: 'Afirmația 3',
  statement_4: 'Afirmația 4',
  explanation: 'Explicație',
};

export const EDITABLE_FIELDS = Object.keys(FIELD_LABELS);

type AnyQuestion = Question | PracticeQuestion;

export function buildExportRows(
  questions: AnyQuestion[],
  params: {
    contentType: ContentType;
    contentId: string;
    contentTitle: string;
    materie?: string;
    lectie?: string;
  }
): ExportRow[] {
  return questions.map((q, idx) => {
    const isCS = q.type === 'CS';
    return {
      tipContinut: params.contentType === 'simulation' ? 'Simulare' : 'Antrenament',
      idContinut: params.contentId,
      idGrila: q.id,
      ordine: idx + 1,
      titlu: params.contentTitle,
      materie: params.materie || '',
      lectie: params.lectie || '',
      tipGrila: q.type,
      enunt: q.question_text || '',
      variantaA: isCS ? (q.option_a || '') : (q.statement_1 || ''),
      variantaB: isCS ? (q.option_b || '') : (q.statement_2 || ''),
      variantaC: isCS ? (q.option_c || '') : (q.statement_3 || ''),
      variantaD: isCS ? (q.option_d || '') : (q.statement_4 || ''),
      variantaE: isCS ? (q.option_e || '') : '',
      raspunsCorect: q.correct_answer || '',
      explicatie: q.explanation || '',
      urlImagine: '',
    };
  });
}

export function compareQuestions(
  dbQuestion: AnyQuestion,
  excelRow: Record<string, string>
): QuestionChange {
  const fields: FieldDiff[] = [];
  const protectedFieldWarnings: string[] = [];

  const isCS = dbQuestion.type === 'CS';

  const editableMap: Record<string, [string, string]> = {
    question_text: [dbQuestion.question_text || '', excelRow['Enunț'] || ''],
    option_a: [isCS ? (dbQuestion.option_a || '') : (dbQuestion.statement_1 || ''), excelRow['Varianta A'] || ''],
    option_b: [isCS ? (dbQuestion.option_b || '') : (dbQuestion.statement_2 || ''), excelRow['Varianta B'] || ''],
    option_c: [isCS ? (dbQuestion.option_c || '') : (dbQuestion.statement_3 || ''), excelRow['Varianta C'] || ''],
    option_d: [isCS ? (dbQuestion.option_d || '') : (dbQuestion.statement_4 || ''), excelRow['Varianta D'] || ''],
    option_e: [isCS ? (dbQuestion.option_e || '') : '', excelRow['Varianta E'] || ''],
    explanation: [dbQuestion.explanation || '', excelRow['Explicație'] || ''],
  };

  for (const [field, [oldVal, newVal]] of Object.entries(editableMap)) {
    const trimmedNew = (newVal || '').trim();
    const trimmedOld = (oldVal || '').trim();
    if (trimmedNew !== '' && trimmedNew !== trimmedOld) {
      fields.push({
        field,
        label: FIELD_LABELS[field],
        oldValue: trimmedOld,
        newValue: trimmedNew,
      });
    }
  }

  // Check protected fields
  if (excelRow['Tip grilă'] && excelRow['Tip grilă'].trim() !== dbQuestion.type) {
    protectedFieldWarnings.push(`Tip grilă modificat: ${dbQuestion.type} → ${excelRow['Tip grilă'].trim()} (ignorat)`);
  }
  if (excelRow['Răspuns corect'] && excelRow['Răspuns corect'].trim() !== dbQuestion.correct_answer) {
    protectedFieldWarnings.push(`Răspuns corect modificat: ${dbQuestion.correct_answer} → ${excelRow['Răspuns corect'].trim()} (ignorat)`);
  }
  if (excelRow['Ordine'] && parseInt(excelRow['Ordine']) !== dbQuestion.position + 1) {
    protectedFieldWarnings.push(`Ordinea a fost modificată pentru grila ${dbQuestion.id} (ignorat)`);
  }
  if (excelRow['URL imagine'] && excelRow['URL imagine'].trim() !== '') {
    protectedFieldWarnings.push(`URL imagine modificat pentru grila ${dbQuestion.id} (ignorat)`);
  }

  return {
    question_id: dbQuestion.id,
    fields,
    protectedFieldWarnings,
  };
}

export function validateImport(
  excelRows: Record<string, string>[],
  dbQuestions: AnyQuestion[],
  expectedContentId: string,
  currentMetadata?: {
    title: string;
    materie?: string;
    lectie?: string;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingIds: string[] = [];
  const duplicateIds: string[] = [];
  const wrongContentIds: string[] = [];
  const protectedFieldChanges: string[] = [];
  const contentChanges: ContentLevelChange[] = [];

  const seenIds = new Set<string>();
  const dbMap = new Map<string, AnyQuestion>();
  for (const q of dbQuestions) {
    dbMap.set(q.id, q);
  }

  // Check for duplicates
  for (const row of excelRows) {
    const id = (row['ID grilă'] || '').trim();
    if (!id) {
      errors.push('Un rând nu are ID grilă completat.');
      continue;
    }
    if (seenIds.has(id)) {
      duplicateIds.push(id);
      errors.push(`ID duplicat: ${id}`);
    }
    seenIds.add(id);
  }

  // Check for missing questions (in DB but not in Excel)
  for (const q of dbQuestions) {
    if (!seenIds.has(q.id)) {
      missingIds.push(q.id);
      errors.push(`Grilă lipsă din fișier: ${q.id}`);
    }
  }

  // Check that all Excel IDs exist and belong to the right content
  for (const row of excelRows) {
    const id = (row['ID grilă'] || '').trim();
    const rowContentId = (row['ID simulare/set'] || '').trim();

    if (!dbMap.has(id)) {
      errors.push(`ID grilă inexistent în baza de date: ${id}`);
      continue;
    }

    if (rowContentId !== expectedContentId) {
      wrongContentIds.push(id);
      errors.push(`Grila ${id} aparține unui alt conținut (${rowContentId}).`);
    }
  }

  // ── Detect content-level changes (Titlu, Materie, Lecție) ──
  if (currentMetadata) {
    const excelTitle = (excelRows[0]?.['Titlu simulare/set'] || '').trim();
    if (excelTitle && excelTitle !== currentMetadata.title.trim()) {
      contentChanges.push({
        field: 'title',
        label: 'Titlu',
        oldValue: currentMetadata.title,
        newValue: excelTitle,
      });
    }
    if (currentMetadata.materie !== undefined) {
      const excelMaterie = (excelRows[0]?.['Materie'] || '').trim();
      if (excelMaterie && excelMaterie !== currentMetadata.materie.trim()) {
        contentChanges.push({
          field: 'subject',
          label: 'Materie',
          oldValue: currentMetadata.materie,
          newValue: excelMaterie,
        });
      }
    }
    if (currentMetadata.lectie !== undefined) {
      const excelLectie = (excelRows[0]?.['Lecție'] || '').trim();
      if (excelLectie && excelLectie !== currentMetadata.lectie.trim()) {
        contentChanges.push({
          field: 'lesson_title',
          label: 'Lecție',
          oldValue: currentMetadata.lectie,
          newValue: excelLectie,
        });
      }
    }
  }

  // Compare fields
  const changes: QuestionChange[] = [];
  for (const row of excelRows) {
    const id = (row['ID grilă'] || '').trim();
    const dbQ = dbMap.get(id);
    if (!dbQ) continue;

    const change = compareQuestions(dbQ, row);
    if (change.fields.length > 0 || change.protectedFieldWarnings.length > 0) {
      changes.push(change);
      for (const w of change.protectedFieldWarnings) {
        protectedFieldChanges.push(w);
        warnings.push(w);
      }
    }
  }

  const modifiedQuestions = changes.filter((c) => c.fields.length > 0).length;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    changes,
    contentChanges,
    totalQuestions: excelRows.length,
    modifiedQuestions,
    missingIds,
    duplicateIds,
    wrongContentIds,
    protectedFieldChanges,
  };
}

export function buildRpcChanges(
  changes: QuestionChange[]
): Record<string, string>[] {
  return changes
    .filter((c) => c.fields.length > 0)
    .map((c) => {
      const obj: Record<string, string> = { question_id: c.question_id };
      for (const f of c.fields) {
        obj[f.field] = f.newValue;
      }
      return obj;
    });
}

export function buildContentChangesRpc(
  contentChanges: ContentLevelChange[]
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const c of contentChanges) {
    obj[c.field] = c.newValue;
  }
  return obj;
}
