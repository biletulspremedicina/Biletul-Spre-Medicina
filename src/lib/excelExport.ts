import * as XLSX from 'xlsx';
import type { ExportRow } from '@/lib/contentVersioning';

type CellFill = {
  patternType: 'solid';
  fgColor: { rgb: string };
  bgColor: { rgb: string };
};

const GREY_FILL: CellFill = {
  patternType: 'solid',
  fgColor: { rgb: 'E7E6E6' },
  bgColor: { rgb: 'E7E6E6' },
};

const GREEN_FILL: CellFill = {
  patternType: 'solid',
  fgColor: { rgb: 'E2EFDA' },
  bgColor: { rgb: 'E2EFDA' },
};

type CellFont = {
  name: string;
  sz: number;
  bold: boolean;
  color: { rgb: string };
};

const HEADER_FONT: CellFont = {
  name: 'Calibri',
  sz: 11,
  bold: true,
  color: { rgb: '1F2937' },
};

const PROTECTED_COL_INDICES = new Set([0, 1, 2, 3, 7, 14, 16]);


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

type SheetCell = {
  v: string | number;
  t?: 's' | 'n';
  s?: {
    fill?: CellFill;
    font?: CellFont;
    alignment?: { wrapText: boolean; vertical: 'top' };
  };
};

export function generateCorrectionXlsx(
  rows: ExportRow[],
  fileName: string
): void {
  // ── Main sheet: Grile ──
  const headerCells: SheetCell[] = COLUMNS.map((col, idx) => {
    const isProtected = PROTECTED_COL_INDICES.has(idx);
    return {
      v: col,
      t: 's',
      s: {
        fill: isProtected ? GREY_FILL : GREEN_FILL,
        font: HEADER_FONT,
        alignment: { wrapText: true, vertical: 'top' },
      },
    };
  });

  const dataRows: SheetCell[][] = rows.map((r) => {
    const values = [
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
    return values.map((val, colIdx) => {
      const isProtected = PROTECTED_COL_INDICES.has(colIdx);
      return {
        v: typeof val === 'number' ? val : String(val),
        t: typeof val === 'number' ? 'n' : 's',
        s: {
          fill: isProtected ? GREY_FILL : undefined,
          alignment: { wrapText: !isProtected, vertical: 'top' as const },
        },
      };
    });
  });

  const sheetData: (SheetCell | string | number)[][] = [
    headerCells,
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(
    sheetData.map((row) =>
      row.map((cell) =>
        typeof cell === 'object' && cell !== null && 'v' in cell
          ? (cell as SheetCell).v
          : cell
      )
    )
  );

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // Tip conținut
    { wch: 36 }, // ID simulare/set
    { wch: 36 }, // ID grilă
    { wch: 8 },  // Ordine
    { wch: 28 }, // Titlu
    { wch: 14 }, // Materie
    { wch: 20 }, // Lecție
    { wch: 10 }, // Tip grilă
    { wch: 50 }, // Enunț
    { wch: 40 }, // Varianta A
    { wch: 40 }, // Varianta B
    { wch: 40 }, // Varianta C
    { wch: 40 }, // Varianta D
    { wch: 40 }, // Varianta E
    { wch: 14 }, // Răspuns corect
    { wch: 50 }, // Explicație
    { wch: 20 }, // URL imagine
  ];

  // ── Instructions sheet ──
  const instructions = [
    ['INSTRUCȚIUNI CORECTURĂ'],
    [''],
    ['1. Coloanele cu fundal GRI sunt tehnice și NU trebuie modificate:'],
    ['   - Tip conținut, ID simulare/set, ID grilă, Ordine, Tip grilă, Răspuns corect, URL imagine'],
    [''],
    ['2. Coloanele cu fundal VERDE pot fi corectate:'],
    ['   - Titlu, Materie, Lecție, Enunț, Variantele A–E, Explicație'],
    [''],
    ['3. NU modificați:'],
    ['   - ID-urile grilelor'],
    ['   - Ordinea grilelor'],
    ['   - Răspunsurile corecte'],
    ['   - Tipul grilei (CS/CG)'],
    ['   - URL-urile imaginilor'],
    [''],
    ['4. Păstrați diacriticele românești (ă, â, î, ș, ț).'],
    [''],
    ['5. Pentru grile CG (Complement Grupat), variantele A–D conțin afirmațiile 1–4.'],
    ['   Varianta E este goală pentru CG.'],
    [''],
    ['6. Nu adăugați și nu ștergeți rânduri. Modificați doar textul în coloanele verzi.'],
    [''],
    ['7. După corectură, salvați fișierul ca .xlsx și importați-l folosind butonul'],
    ['   „Importă versiunea corectată" din panoul de administrare.'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 80 }];

  // ── Build workbook ──
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Grile');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'INSTRUCȚIUNI');

  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}

export function parseCorrectionXlsx(
  file: File
): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          raw: false,
        }) as unknown[][];

        if (json.length < 2) {
          reject(new Error('Fișierul nu conține date.'));
          return;
        }

        const headers = (json[0] as unknown[]).map((h) => String(h || ''));
        const rows: Record<string, string>[] = [];

        for (let i = 1; i < json.length; i++) {
          const rawRow = json[i] as unknown[];
          if (!rawRow || rawRow.every((v) => v === null || v === undefined || v === '')) continue;

          const rowObj: Record<string, string> = {};
          for (let j = 0; j < headers.length; j++) {
            const header = String(headers[j] || '').trim();
            const val = rawRow[j];
            rowObj[header] = val !== null && val !== undefined ? String(val) : '';
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
