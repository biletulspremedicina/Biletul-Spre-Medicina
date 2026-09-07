import * as XLSX from 'xlsx';
import type { Question, PracticeQuestion } from '@/lib/supabase';
import type { ContentType } from '@/lib/contentVersioning';

// ── Color constants (match site theme) ───────────────────────────────────

const BRAND_600 = 'FF2A6B4E';
const WHITE = 'FFFFFFFF';
const BORDER_GREY = 'FFD0D0D0';
const TEXT_DARK = 'FF1F2937';
const LIGHT_GREEN_BG = 'FFE2EFDA';

const NEW_QUESTION_COLUMNS = [
  'Nr. crt.',
  'Tip grilă',
  'Enunț',
  'Varianta A',
  'Varianta B',
  'Varianta C',
  'Varianta D',
  'Varianta E',
  'Afirmația 1',
  'Afirmația 2',
  'Afirmația 3',
  'Afirmația 4',
  'Răspuns corect',
  'Explicație',
] as const;

const COL_WIDTHS = [
  8,   // A: Nr. crt.
  10,  // B: Tip grilă
  50,  // C: Enunț
  40,  // D: Varianta A
  40,  // E: Varianta B
  40,  // F: Varianta C
  40,  // G: Varianta D
  40,  // H: Varianta E
  40,  // I: Afirmația 1
  40,  // J: Afirmația 2
  40,  // K: Afirmația 3
  40,  // L: Afirmația 4
  14,  // M: Răspuns corect
  50,  // N: Explicație
];

// ── Types ────────────────────────────────────────────────────────────────

export type NewQuestionRow = {
  rowNumber: number;
  nrCrt: number | null;
  type: 'CS' | 'CG';
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  statement1: string;
  statement2: string;
  statement3: string;
  statement4: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  explanation: string;
};

export type NewQuestionValidation = {
  errors: string[];
  warnings: string[];
  validQuestions: NewQuestionRow[];
  csCount: number;
  cgCount: number;
  totalCount: number;
};

// ── Template generation (ExcelJS) ────────────────────────────────────────

export async function generateNewQuestionsTemplate(
  contentTitle: string,
  fileName: string
): Promise<void> {
  const ExcelJS = await import('exceljs');

  const THIN_BORDER = {
    style: 'thin' as const,
    color: { argb: BORDER_GREY },
  };
  const FULL_BORDER = {
    top: THIN_BORDER,
    bottom: THIN_BORDER,
    left: THIN_BORDER,
    right: THIN_BORDER,
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biletul spre Medicină';
  wb.created = new Date();

  // ── Sheet 1: GRILE NOI ──
  const ws = wb.addWorksheet('GRILE NOI', {
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }],
    properties: { defaultRowHeight: 18 },
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: NEW_QUESTION_COLUMNS.length },
  };

  ws.columns = COL_WIDTHS.map((wch, idx) => ({
    width: wch,
    key: `col${idx}`,
  }));

  // Header row
  const headerRow = ws.getRow(1);
  headerRow.height = 32;
  for (let col = 0; col < NEW_QUESTION_COLUMNS.length; col++) {
    const cell = headerRow.getCell(col + 1);
    cell.value = NEW_QUESTION_COLUMNS[col];
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_600 },
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: WHITE },
    };
    cell.alignment = {
      wrapText: true,
      vertical: 'middle',
      horizontal: 'center',
    };
    cell.border = FULL_BORDER;
  }
  headerRow.commit();

  // Data validation dropdowns
  // Tip grilă: CS or CG (column B = index 2)
  ws.addDataValidation({
    type: 'list',
    formulae: ['"CS,CG"'],
    showErrorMessage: true,
    errorTitle: 'Tip invalid',
    error: 'Folosește doar CS sau CG.',
    allowBlank: false,
    sqref: `B2:B1000`,
  });

  // Răspuns corect: A-E (column M = index 13)
  ws.addDataValidation({
    type: 'list',
    formulae: ['"A,B,C,D,E"'],
    showErrorMessage: true,
    errorTitle: 'Răspuns invalid',
    error: 'Folosește doar A, B, C, D sau E.',
    allowBlank: false,
    sqref: `M2:M1000`,
  });

  // ── Sheet 2: INSTRUCȚIUNI AI ──
  const wsInst = wb.addWorksheet('INSTRUCȚIUNI AI');
  wsInst.columns = [{ width: 90 }];

  const instructions: string[] = [
    'INSTRUCȚIUNI PENTRU AI — IMPORT GRILE NOI',
    '',
    'Completează exclusiv foaia «GRILE NOI».',
    '',
    'Pentru CS completează enunțul, variantele A–E, răspunsul corect și explicația.',
    'Lasă necompletate afirmațiile 1–4.',
    '',
    'Pentru CG completează enunțul, afirmațiile 1–4, răspunsul corect și explicația.',
    'Lasă necompletate variantele A–E.',
    '',
    'Folosește exclusiv CS sau CG în coloana «Tip grilă».',
    'Folosește exclusiv A, B, C, D sau E în coloana «Răspuns corect».',
    'Nu redenumi foaia și nu modifica denumirile coloanelor.',
    'Nu adăuga alte coloane.',
    'Păstrează fișierul în format XLSX.',
    'Folosește diacritice românești (ă, â, î, ș, ț).',
    'Nu introduce explicații în afara coloanelor stabilite.',
    '',
    '── Sistemul de răspuns CG ──',
    '',
    'Pentru grilele CG (Complement Grupat), există 4 afirmații numerotate 1–4.',
    'Răspunsul corect se exprimă printr-o literă de la A la E:',
    '',
    '  A = afirmațiile 1, 2, 3 sunt corecte',
    '  B = afirmațiile 1, 3 sunt corecte',
    '  C = afirmațiile 2, 4 sunt corecte',
    '  D = doar afirmația 4 este corectă',
    '  E = toate afirmațiile 1, 2, 3, 4 sunt corecte (sau altă combinație)',
    '',
    'Aceste corespondențe sunt identice cu cele din formularul manual din aplicație.',
    'Nu modifica sistemul — doar completează litera corespunzătoare în coloana «Răspuns corect».',
    '',
    '── Exemple ──',
    '',
    'EXEMPLU CS:',
    '  Tip grilă: CS',
    '  Enunț: Care dintre următoarele structuri aparține sistemului osos?',
    '  Varianta A: Femurul',
    '  Varianta B: Clavicula',
    '  Varianta C: Humérus',
    '  Varianta D: Cuboidianul',
    '  Varianta E: Metatarsienele',
    '  Răspuns corect: A',
    '  Explicație: Femurul este cel mai lung os al corpului uman și aparține sistemului osos.',
    '',
    'EXEMPLU CG:',
    '  Tip grilă: CG',
    '  Enunț: despre topografia organelor, alegeți afirmațiile corecte:',
    '  Afirmația 1: Inima este situată în mediastinul mijlociu.',
    '  Afirmația 2: Plămânul stâng are 3 lobi.',
    '  Afirmația 3: Ficatul ocupă hipocondrul drept.',
    '  Afirmația 4: Stomacul este situat în epigastru.',
    '  Răspuns corect: B  (afirmațiile 1 și 3 sunt corecte)',
    '  Explicație: Inima este în mediastinul mijlociu (1 corectă). Plămânul stâng are 2 lobi, nu 3 (2 incorectă). Ficatul ocupă hipocondrul drept (3 corectă). Stomacul se află în epigastru și hipocondrul stâng, dar afirmația 4 singură nu este complet corectă.',
  ];

  for (let i = 0; i < instructions.length; i++) {
    const cell = wsInst.getCell(`A${i + 1}`);
    cell.value = instructions[i];
    if (i === 0) {
      cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: BRAND_600 } };
    } else if (instructions[i].startsWith('──')) {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: TEXT_DARK } };
    } else {
      cell.font = { name: 'Calibri', size: 11, color: { argb: TEXT_DARK } };
    }
    cell.alignment = { wrapText: true, vertical: 'top' };
  }

  // Write to file
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Parsing (SheetJS) ────────────────────────────────────────────────────

export function parseNewQuestionsXlsx(file: File): Promise<NewQuestionRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        const sheetName = wb.SheetNames.find(
          (name) => name.trim().toLowerCase() === 'grile noi'
        );

        if (!sheetName) {
          reject(new Error('Fișierul nu conține o foaie numită „GRILE NOI".'));
          return;
        }

        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          raw: false,
        }) as unknown[][];

        if (json.length < 2) {
          reject(new Error('Fișierul nu conține date (doar antet).'));
          return;
        }

        // Build header map by name
        const rawHeaders = json[0] as unknown[];
        const headerMap = new Map<string, number>();
        for (let j = 0; j < rawHeaders.length; j++) {
          const h = String(rawHeaders[j] || '').trim();
          if (h && !headerMap.has(h)) {
            headerMap.set(h, j);
          }
        }

        // Check required columns
        const required = ['Tip grilă', 'Enunț', 'Răspuns corect', 'Explicație'];
        const missing = required.filter((c) => !headerMap.has(c));
        if (missing.length > 0) {
          reject(new Error(`Coloane lipsă: ${missing.join(', ')}.`));
          return;
        }

        const getCell = (row: unknown[], header: string): string => {
          const idx = headerMap.get(header);
          if (idx === undefined) return '';
          const val = row[idx];
          return val !== null && val !== undefined ? String(val).trim() : '';
        };

        const rows: NewQuestionRow[] = [];
        const MAX_ROWS = 500;

        for (let i = 1; i < json.length && rows.length < MAX_ROWS; i++) {
          const rawRow = json[i] as unknown[];
          if (!rawRow || rawRow.every((v) => v === null || v === undefined || v === '')) continue;

          const typeRaw = getCell(rawRow, 'Tip grilă').toUpperCase();
          const enuntRaw = getCell(rawRow, 'Enunț');
          const correctRaw = getCell(rawRow, 'Răspuns corect').toUpperCase();

          // Skip rows where everything is empty including type
          if (!typeRaw && !enuntRaw && !correctRaw) continue;

          const nrCrtRaw = getCell(rawRow, 'Nr. crt.');
          const nrCrt = nrCrtRaw ? parseInt(nrCrtRaw, 10) : null;

          rows.push({
            rowNumber: i + 1, // 1-based Excel row
            nrCrt: nrCrt && !isNaN(nrCrt) ? nrCrt : null,
            type: (typeRaw === 'CG' ? 'CG' : 'CS') as 'CS' | 'CG',
            questionText: enuntRaw,
            optionA: getCell(rawRow, 'Varianta A'),
            optionB: getCell(rawRow, 'Varianta B'),
            optionC: getCell(rawRow, 'Varianta C'),
            optionD: getCell(rawRow, 'Varianta D'),
            optionE: getCell(rawRow, 'Varianta E'),
            statement1: getCell(rawRow, 'Afirmația 1'),
            statement2: getCell(rawRow, 'Afirmația 2'),
            statement3: getCell(rawRow, 'Afirmația 3'),
            statement4: getCell(rawRow, 'Afirmația 4'),
            correctAnswer: (['A', 'B', 'C', 'D', 'E'].includes(correctRaw) ? correctRaw : '') as 'A' | 'B' | 'C' | 'D' | 'E',
            explanation: getCell(rawRow, 'Explicație'),
          });
        }

        if (rows.length === 0) {
          reject(new Error('Nu s-au găsit rânduri cu date.'));
          return;
        }

        resolve(rows);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Eroare la parsarea fișierului.'));
      }
    };
    reader.onerror = () => reject(new Error('Nu s-a putut citi fișierul.'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Normalization for duplicate detection ────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?()[\]{}""''\-_/\\]/g, '')
    .trim();
}

// ── Validation ───────────────────────────────────────────────────────────

export function validateNewQuestions(
  rows: NewQuestionRow[],
  existingQuestions: (Question | PracticeQuestion)[],
  options: {
    contentType: ContentType;
    targetQuestionCount?: number;
  }
): NewQuestionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validQuestions: NewQuestionRow[] = [];

  const validAnswers = new Set(['A', 'B', 'C', 'D', 'E']);

  // Build normalized set of existing question texts
  const existingNormalized = new Set<string>();
  for (const q of existingQuestions) {
    existingNormalized.add(normalizeText(q.question_text || ''));
  }

  // Track Nr. crt. uniqueness
  const seenNrCrt = new Set<number>();
  // Track normalized texts within this file
  const seenTexts = new Set<string>();
  const seenNormalized = new Set<string>();

  for (const row of rows) {
    const rowErrors: string[] = [];

    // Type check
    const typeRaw = row.type;
    if (typeRaw !== 'CS' && typeRaw !== 'CG') {
      rowErrors.push(`Rând ${row.rowNumber}: Tip grilă trebuie să fie CS sau CG (am găsit „${typeRaw}").`);
    }

    // Enunț
    if (!row.questionText.trim()) {
      rowErrors.push(`Rând ${row.rowNumber}: Enunțul este obligatoriu.`);
    }

    // Correct answer
    if (!row.correctAnswer || !validAnswers.has(row.correctAnswer)) {
      rowErrors.push(`Rând ${row.rowNumber}: Răspuns corect trebuie să fie A, B, C, D sau E.`);
    }

    // Explanation
    if (!row.explanation.trim()) {
      rowErrors.push(`Rând ${row.rowNumber}: Explicația este obligatorie.`);
    }

    // Type-specific checks
    if (typeRaw === 'CS') {
      if (!row.optionA.trim()) rowErrors.push(`Rând ${row.rowNumber}: Varianta A lipsește (CS).`);
      if (!row.optionB.trim()) rowErrors.push(`Rând ${row.rowNumber}: Varianta B lipsește (CS).`);
      if (!row.optionC.trim()) rowErrors.push(`Rând ${row.rowNumber}: Varianta C lipsește (CS).`);
      if (!row.optionD.trim()) rowErrors.push(`Rând ${row.rowNumber}: Varianta D lipsește (CS).`);
      if (!row.optionE.trim()) rowErrors.push(`Rând ${row.rowNumber}: Varianta E lipsește (CS).`);
    } else if (typeRaw === 'CG') {
      if (!row.statement1.trim()) rowErrors.push(`Rând ${row.rowNumber}: Afirmația 1 lipsește (CG).`);
      if (!row.statement2.trim()) rowErrors.push(`Rând ${row.rowNumber}: Afirmația 2 lipsește (CG).`);
      if (!row.statement3.trim()) rowErrors.push(`Rând ${row.rowNumber}: Afirmația 3 lipsește (CG).`);
      if (!row.statement4.trim()) rowErrors.push(`Rând ${row.rowNumber}: Afirmația 4 lipsește (CG).`);
    }

    // Nr. crt. uniqueness
    if (row.nrCrt !== null) {
      if (row.nrCrt <= 0) {
        rowErrors.push(`Rând ${row.rowNumber}: Nr. crt. trebuie să fie pozitiv.`);
      } else if (seenNrCrt.has(row.nrCrt)) {
        rowErrors.push(`Rând ${row.rowNumber}: Nr. crt. ${row.nrCrt} este duplicat.`);
      } else {
        seenNrCrt.add(row.nrCrt);
      }
    }

    // Duplicate check against existing DB questions
    const normalized = normalizeText(row.questionText);
    if (normalized && existingNormalized.has(normalized)) {
      rowErrors.push(`Rând ${row.rowNumber}: Enunț duplicat — există deja în ${options.contentType === 'simulation' ? 'simularea' : 'setul'} curent.`);
    }

    // Duplicate check within file (exact text)
    if (row.questionText.trim() && seenTexts.has(row.questionText.trim())) {
      rowErrors.push(`Rând ${row.rowNumber}: Enunț duplicat în fișier.`);
    }
    if (row.questionText.trim()) seenTexts.add(row.questionText.trim());

    // Similarity warning (normalized but not exact dup)
    if (normalized && !seenNormalized.has(normalized)) {
      seenNormalized.add(normalized);
    } else if (normalized && rowErrors.length === 0) {
      // Already in seenNormalized from a previous row that wasn't caught as exact dup
      // but normalized matches — only warn if it wasn't caught above
      const alreadyErrored = rowErrors.some((e) => e.includes('duplicat'));
      if (!alreadyErrored) {
        warnings.push(`Rând ${row.rowNumber}: Enunț asemănător cu alt rând din fișier.`);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validQuestions.push(row);
    }
  }

  // Target question count check for practice sets
  if (options.targetQuestionCount !== undefined && options.contentType === 'practice_set') {
    const totalAfterImport = existingQuestions.length + validQuestions.length;
    if (totalAfterImport > options.targetQuestionCount) {
      errors.push(
        `Importul ar aduce ${totalAfterImport} grile, dar setul are o țintă de ${options.targetQuestionCount}. ` +
        `Reduceti numărul de grile din fișier sau modificați ținta setului.`
      );
    }
  }

  const csCount = validQuestions.filter((q) => q.type === 'CS').length;
  const cgCount = validQuestions.filter((q) => q.type === 'CG').length;

  return {
    errors,
    warnings,
    validQuestions,
    csCount,
    cgCount,
    totalCount: validQuestions.length,
  };
}

// ── Build RPC payload ────────────────────────────────────────────────────

export function buildNewQuestionsRpcPayload(
  questions: NewQuestionRow[]
): Record<string, string>[] {
  return questions
    .slice()
    .sort((a, b) => {
      if (a.nrCrt !== null && b.nrCrt !== null) return a.nrCrt - b.nrCrt;
      if (a.nrCrt !== null) return -1;
      if (b.nrCrt !== null) return 1;
      return a.rowNumber - b.rowNumber;
    })
    .map((q) => ({
      type: q.type,
      question_text: q.questionText.trim(),
      option_a: q.type === 'CS' ? q.optionA.trim() : '',
      option_b: q.type === 'CS' ? q.optionB.trim() : '',
      option_c: q.type === 'CS' ? q.optionC.trim() : '',
      option_d: q.type === 'CS' ? q.optionD.trim() : '',
      option_e: q.type === 'CS' ? q.optionE.trim() : '',
      statement_1: q.type === 'CG' ? q.statement1.trim() : '',
      statement_2: q.type === 'CG' ? q.statement2.trim() : '',
      statement_3: q.type === 'CG' ? q.statement3.trim() : '',
      statement_4: q.type === 'CG' ? q.statement4.trim() : '',
      correct_answer: q.correctAnswer,
      explanation: q.explanation.trim(),
    }));
}
