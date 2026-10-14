export const EXAM_FACULTIES = ['Medicină Generală', 'Stomatologie'] as const;
export type ExamFaculty = typeof EXAM_FACULTIES[number];
export type FacultyFilter = 'all' | 'unspecified' | ExamFaculty;

export function isExamFaculty(value: unknown): value is ExamFaculty {
  return EXAM_FACULTIES.some((faculty) => faculty === value);
}

export function facultyLabel(value: ExamFaculty | null | undefined): string {
  return value || 'Nespecificată';
}

export function matchesFaculty(value: ExamFaculty | null | undefined, filter: FacultyFilter): boolean {
  return filter === 'all' || (filter === 'unspecified' ? value == null : value === filter);
}
