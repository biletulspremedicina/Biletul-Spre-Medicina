import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type { ExportRow } from '@/lib/contentVersioning';

// ── Color constants (match site theme) ───────────────────────────────────

const BRAND_600 = 'FF2A6B4E'; // site primary color with alpha prefix
const WHITE = 'FFFFFFFF';
const GREY_BG = 'FFE7E6E6';
const GREEN_BG = 'FFE2EFDA';
const BORDER_GREY = 'FFD0D0D0';
const TEXT_DARK = 'FF1F2937';

const COLUMNS = [
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

// Column indices (0-based) that are technical/protected:
// A(0), B(1), C(2), D(3), H(7), O(14), Q(16)
const PROTECTED_COL_INDICES = new Set([0, 1, 2, 3, 7, 14, 16]);

const COL_WIDTHS = [
  14,  // A: Tip conținut
  36,  // B: ID simulare/set
  36,  // C: ID grilă
  8,   // D: Ordine
  28,  // E: Titlu
  14,  // F: Materie
  20,  // G: Lecție
  10,  // H: Tip grilă
  50,  // I: Enunț
  40,  // J: Varianta A
  40,  // K: Varianta B
  40,  // L: Varianta C
  40,  // M: Varianta D
  40,  // N: Varianta E
  14,  // O: Răspuns corect
  50,  // P: Explicație
  20,  // Q: URL imagine
];

const THIN_BORDER: Partial<ExcelJS.Border> = {
  style: 'thin' as const,
  color: { argb: BORDER_GREY },
};

const FULL_BORDER = {
  top: THIN_BORDER as ExcelJS.Border,
  bottom: THIN_BORDER as ExcelJS.Border,
  left: THIN_BORDER as ExcelJS.Border,
  right: THIN_BORDER as ExcelJS.Border,
} as unknown as ExcelJS.Borders;

// ── Main export function using ExcelJS for full styling ───────────────────

export async function generateCorrectionXlsx(
  rows: ExportRow[],
  fileName: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biletul spre Medicină';
  wb.created = new Date();

  // ── Sheet 1: Grile ──
  const ws = wb.addWorksheet('Grile', {
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }],
    properties: { defaultRowHeight: 18 },
  });

  // Auto filter on header row A1:Q1
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  // Set column widths
  ws.columns = COL_WIDTHS.map((wch, idx) => ({
    width: wch,
    key: `col${idx}`,
  }));

  // ── Header row (row 1) ──
  const headerRow = ws.getRow(1);
  headerRow.height = 32;
  for (let col = 0; col < COLUMNS.length; col++) {
    const cell = headerRow.getCell(col + 1);
    cell.value = COLUMNS[col];
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

  // ── Data rows ──
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const r = rows[rowIdx];
    const values: (string | number)[] = [
      r.tipContinut,
      r.idContinut,
      r.idGrila,
      r.ordine,
      r.titlu,
      r.materie,
      r.lectie,
      r.tipGrila,
      r.enunt,
      r.variantaA,
      r.variantaB,
      r.variantaC,
      r.variantaD,
      r.variantaE,
      r.raspunsCorect,
      r.explicatie,
      r.urlImagine,
    ];

    const excelRow = ws.getRow(rowIdx + 2);

    // Estimate row height based on longest text
    let maxLines = 1;
    for (let col = 0; col < values.length; col++) {
      const text = String(values[col] || '');
      if (!text) continue;
      const colWidth = COL_WIDTHS[col] || 40;
      const charsPerLine = Math.max(10, Math.floor(colWidth * 1.1));
      const explicitLines = text.split('\n').length;
      const wrappedLines = Math.ceil(text.length / charsPerLine);
      const lines = Math.max(explicitLines, wrappedLines);
      if (lines > maxLines) maxLines = lines;
    }
    excelRow.height = Math.max(20, maxLines * 15);

    for (let col = 0; col < values.length; col++) {
      const cell = excelRow.getCell(col + 1);
      cell.value = values[col];
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: false,
        color: { argb: TEXT_DARK },
      };
      cell.alignment = {
        wrapText: true,
        vertical: 'top',
      };
      cell.border = FULL_BORDER;

      const isProtected = PROTECTED_COL_INDICES.has(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isProtected ? GREY_BG : GREEN_BG },
      };
    }
    excelRow.commit();
  }

  // ── Sheet 2: INSTRUCȚIUNI ──
  const wsInst = wb.addWorksheet('INSTRUCȚIUNI');
  wsInst.columns = [{ width: 80 }];

  const instructions: string[] = [
    'INSTRUCȚIUNI CORECTURĂ',
    '',
    '1. Coloanele cu fundal GRI sunt tehnice și NU trebuie modificate:',
    '   - Tip conținut, ID simulare/set, ID grilă, Ordine, Tip grilă, Răspuns corect, URL imagine',
    '',
    '2. Coloanele cu fundal VERDE pot fi corectate:',
    '   - Titlu, Materie, Lecție, Enunț, Variantele A–E, Explicație',
    '',
    '3. NU modificați:',
    '   - ID-urile grilelor',
    '   - Ordinea grilelor',
    '   - Răspunsurile corecte',
    '   - Tipul grilei (CS/CG)',
    '   - URL-urile imaginilor',
    '',
    '4. Păstrați diacriticele românești (ă, â, î, ș, ț).',
    '',
    '5. Pentru grile CG (Complement Grupat), variantele A–D conțin afirmațiile 1–4.',
    '   Varianta E este goală pentru CG.',
    '',
    '6. Nu adăugați și nu ștergeți rânduri. Modificați doar textul în coloanele verzi.',
    '',
    '7. După corectură, salvați fișierul ca .xlsx și importați-l folosind butonul',
    '   „Importă versiunea corectată" din panoul de administrare.',
  ];

  for (let i = 0; i < instructions.length; i++) {
    const cell = wsInst.getCell(`A${i + 1}`);
    cell.value = instructions[i];
    if (i === 0) {
      cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: BRAND_600 } };
    } else {
      cell.font = { name: 'Calibri', size: 11, color: { argb: TEXT_DARK } };
    }
    cell.alignment = { wrapText: true, vertical: 'top' };
  }

  // ── Write to file (browser-compatible) ──
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

// ── Import parsing (uses SheetJS) ─────────────────────────────────────────
// Identifies columns by header name (not position) and finds the "Grile" sheet by name.
// Accepts: columns in any order, extra sheets, modified formatting, multiline cells,
// empty cells, Romanian diacritics.
// Refuses: no "Grile" sheet, no "ID grilă" column, no header row.

export function parseCorrectionXlsx(
  file: File
): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        // Find the "Grile" sheet by name (case-insensitive, trimmed)
        const grileSheetName = wb.SheetNames.find(
          (name) => name.trim().toLowerCase() === 'grile'
        );

        if (!grileSheetName) {
          reject(new Error('Fișierul nu conține o foaie numită „Grile".'));
          return;
        }

        const ws = wb.Sheets[grileSheetName];
        const json = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          raw: false,
        }) as unknown[][];

        if (json.length < 2) {
          reject(new Error('Fișierul nu conține date.'));
          return;
        }

        // Build header map: header name → column index (by name, not position)
        const rawHeaders = json[0] as unknown[];
        const headerMap = new Map<string, number>();
        for (let j = 0; j < rawHeaders.length; j++) {
          const h = String(rawHeaders[j] || '').trim();
          if (h && !headerMap.has(h)) {
            headerMap.set(h, j);
          }
        }

        // Require "ID grilă" column
        if (!headerMap.has('ID grilă')) {
          reject(new Error('Fișierul nu conține coloana „ID grilă".'));
          return;
        }

        // Build rows as key-value objects keyed by header name
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < json.length; i++) {
          const rawRow = json[i] as unknown[];
          if (!rawRow || rawRow.every((v) => v === null || v === undefined || v === '')) continue;

          const rowObj: Record<string, string> = {};
          for (const [header, colIdx] of headerMap) {
            const val = rawRow[colIdx];
            rowObj[header] = val !== null && val !== undefined ? String(val).trim() : '';
          }
          rows.push(rowObj);
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
