export function twoDigitNumber(position: number): string {
  return String(Math.max(1, position)).padStart(2, '0');
}

export function biologySimulationName(position: number): string {
  return `Simulare ${twoDigitNumber(position)}`;
}

type UmfcdDisplayFields = {
  title: string;
  umfcd_kind?: 'Examen' | 'Simulare' | null;
  umfcd_year?: number | null;
};

export function umfcdSimulationKind(simulation: UmfcdDisplayFields): 'Examen' | 'Simulare' {
  return simulation.umfcd_kind || (/simulare/i.test(simulation.title) ? 'Simulare' : 'Examen');
}

export function umfcdSimulationYear(simulation: UmfcdDisplayFields): number | null {
  if (simulation.umfcd_year) return simulation.umfcd_year;
  const match = simulation.title.match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

export function umfcdSimulationName(simulation: UmfcdDisplayFields): string {
  const year = umfcdSimulationYear(simulation);
  return `${umfcdSimulationKind(simulation)} ${year ?? '—'}`;
}

export function shortPracticeChapterTitle(title: string): string {
  const cleaned = title.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= 28) return cleaned;

  const firstPart = cleaned.split(/\s+(?:și|si|ale|al|a)\s+/i)[0];
  if (firstPart.length >= 12 && firstPart.length <= 28) return firstPart;

  const words = cleaned.split(' ');
  let shortened = '';
  for (const word of words) {
    if (`${shortened} ${word}`.trim().length > 26) break;
    shortened = `${shortened} ${word}`.trim();
  }
  return shortened && shortened !== cleaned ? `${shortened}…` : cleaned;
}

export function practiceSetName(chapterTitle: string, position: number): string {
  return `${shortPracticeChapterTitle(chapterTitle)} ${twoDigitNumber(position)}`;
}
