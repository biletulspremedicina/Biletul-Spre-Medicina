import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, GraduationCap, MapPin, Target } from 'lucide-react';
import Logo from '@/components/Logo';

type Props = {
  onComplete: () => void;
};

type AdmissionTiming = 'current_year' | 'next_year' | 'later' | 'undecided';
type StudyTime = 'under_30' | '30_60' | '60_120' | 'over_120';

const totalSteps = 5;

export default function StudentOnboarding({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [attempt, setAttempt] = useState<number | null>(null);
  const [score, setScore] = useState(50);
  const [facultyChoice, setFacultyChoice] = useState<'UMFCD' | 'other' | 'undecided' | null>(null);
  const [otherFaculty, setOtherFaculty] = useState('');
  const [admissionTiming, setAdmissionTiming] = useState<AdmissionTiming | null>(null);
  const [studyTime, setStudyTime] = useState<StudyTime | null>(null);

  const currentValid =
    (step === 1 && attempt !== null) ||
    step === 2 ||
    (step === 3 && facultyChoice !== null && (facultyChoice !== 'other' || otherFaculty.trim().length >= 2)) ||
    (step === 4 && admissionTiming !== null) ||
    (step === 5 && studyTime !== null);

  const next = () => {
    if (!currentValid) return;
    setStep((current) => Math.min(totalSteps, current + 1));
  };

  const finish = () => {
    if (!attempt || !facultyChoice || !admissionTiming || !studyTime || !currentValid) return;
    onComplete();
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e5f6ee_0%,#f8fbf9_38%,#f6f5f1_100%)] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col sm:min-h-[calc(100vh-5rem)]">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <section className="my-auto overflow-hidden rounded-[28px] border border-brand-100 bg-white shadow-[0_24px_70px_rgba(24,70,55,0.12)]">
          <div className="border-b border-stone-100 px-5 py-5 sm:px-9 sm:py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Bun venit în comunitatea NOASTRĂ</p>
                <p className="mt-1 text-sm text-stone-500">Câteva răspunsuri pentru a-ți înțelege mai bine parcursul.</p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
                {step} / {totalSteps}
              </span>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }} />
            </div>
          </div>

          <div className="min-h-[390px] px-5 py-8 sm:px-9 sm:py-10">
            {step === 1 && (
              <Question icon={<GraduationCap size={26} />} title="Pentru a câta oară susții examenul de admitere?"
                text="Alege varianta care descrie parcursul tău actual.">
                <Choice selected={attempt === 1} onClick={() => setAttempt(1)}>Este prima încercare</Choice>
                <Choice selected={attempt === 2} onClick={() => setAttempt(2)}>Este a doua încercare</Choice>
                <Choice selected={attempt === 3} onClick={() => setAttempt(3)}>A treia încercare sau mai mult</Choice>
              </Question>
            )}

            {step === 2 && (
              <Question icon={<Target size={25} />} title="Cum îți evaluezi nivelul actual?"
                text="Nu este un test. Alege punctajul care crezi că te reprezintă acum.">
                <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-5 py-6 sm:px-7">
                  <div className="flex items-end justify-between gap-4">
                    <span className="text-sm font-semibold text-stone-600">Punctaj estimat</span>
                    <strong className="font-display text-4xl text-brand-700">{score}<span className="ml-1 text-base text-brand-500">/100</span></strong>
                  </div>
                  <input type="range" min="0" max="100" step="1" value={score}
                    onChange={(event) => setScore(Number(event.target.value))}
                    className="mt-7 h-2 w-full cursor-pointer accent-brand-600" aria-label="Punctaj actual estimat" />
                  <div className="mt-2 flex justify-between text-xs font-medium text-stone-400"><span>0</span><span>100</span></div>
                </div>
              </Question>
            )}

            {step === 3 && (
              <Question icon={<MapPin size={24} />} title="La ce facultate vrei să dai admiterea?"
                text="Alege facultatea pe care o ai în vedere în acest moment.">
                <Choice selected={facultyChoice === 'UMFCD'} onClick={() => setFacultyChoice('UMFCD')}>UMFCD</Choice>
                <Choice selected={facultyChoice === 'other'} onClick={() => setFacultyChoice('other')}>Altă facultate de medicină</Choice>
                {facultyChoice === 'other' && (
                  <input autoFocus type="text" maxLength={100} value={otherFaculty}
                    onChange={(event) => setOtherFaculty(event.target.value)} placeholder="Scrie denumirea facultății"
                    className="input -mt-1 mb-3" />
                )}
                <Choice selected={facultyChoice === 'undecided'} onClick={() => setFacultyChoice('undecided')}>Încă nu m-am decis</Choice>
              </Question>
            )}

            {step === 4 && (
              <Question icon={<GraduationCap size={25} />} title="Când vei susține examenul?"
                text="Poți alege perioada care se potrivește planului tău actual.">
                <Choice selected={admissionTiming === 'current_year'} onClick={() => setAdmissionTiming('current_year')}>Admiterea din anul acesta</Choice>
                <Choice selected={admissionTiming === 'next_year'} onClick={() => setAdmissionTiming('next_year')}>Admiterea de anul viitor</Choice>
                <Choice selected={admissionTiming === 'later'} onClick={() => setAdmissionTiming('later')}>Mai târziu</Choice>
                <Choice selected={admissionTiming === 'undecided'} onClick={() => setAdmissionTiming('undecided')}>Încă nu știu</Choice>
              </Question>
            )}

            {step === 5 && (
              <Question icon={<Clock3 size={25} />} title="Cât timp poți aloca pregătirii într-o zi?"
                text="Alege o variantă realistă pentru programul tău obișnuit.">
                <Choice selected={studyTime === 'under_30'} onClick={() => setStudyTime('under_30')}>Sub 30 de minute</Choice>
                <Choice selected={studyTime === '30_60'} onClick={() => setStudyTime('30_60')}>30–60 de minute</Choice>
                <Choice selected={studyTime === '60_120'} onClick={() => setStudyTime('60_120')}>1–2 ore</Choice>
                <Choice selected={studyTime === 'over_120'} onClick={() => setStudyTime('over_120')}>Peste 2 ore</Choice>
              </Question>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/80 px-5 py-5 sm:px-9">
            <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))}
              disabled={step === 1} className="btn-secondary px-4 disabled:invisible">
              <ArrowLeft size={17} /> Înapoi
            </button>
            <div className="text-right">
              {step < totalSteps ? (
                <button type="button" onClick={next} disabled={!currentValid} className="btn-primary px-5 disabled:opacity-40">
                  Continuă <ArrowRight size={17} />
                </button>
              ) : (
                <button type="button" onClick={finish} disabled={!currentValid} className="btn-primary px-5 disabled:opacity-40">
                  <Check size={17} />
                  Începe pregătirea
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Question({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">{icon}</div>
      <h1 className="mt-5 font-display text-2xl font-bold leading-tight text-stone-900 sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-500 sm:text-base">{text}</p>
      <div className="mt-7 space-y-3">{children}</div>
    </div>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left text-sm font-semibold transition-all sm:text-base ${
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-[0_5px_18px_rgba(42,107,78,0.08)] ring-1 ring-brand-500/20'
          : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300 hover:bg-brand-50/50'
      }`}>
      <span>{children}</span>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
        selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 text-transparent'
      }`}><Check size={14} strokeWidth={3} /></span>
    </button>
  );
}
