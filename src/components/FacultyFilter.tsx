import { EXAM_FACULTIES, type FacultyFilter as Filter } from '@/lib/examFaculty';

export default function FacultyFilter({ value, onChange }: { value: Filter; onChange: (value: Filter) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>Facultate</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value as Filter)}>
        <option value="all">Toate facultățile</option>
        {EXAM_FACULTIES.map((faculty) => <option key={faculty} value={faculty}>{faculty}</option>)}
        <option value="unspecified">Nespecificată</option>
      </select>
    </label>
  );
}
