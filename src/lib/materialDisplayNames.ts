export function twoDigitNumber(position: number): string {
  return String(Math.max(1, position)).padStart(2, '0');
}

export function biologySimulationName(position: number): string {
  return `Simulare ${twoDigitNumber(position)}`;
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
