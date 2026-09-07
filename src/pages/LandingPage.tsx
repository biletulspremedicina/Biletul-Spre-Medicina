import {
  ArrowRight,
  Clock, CheckCircle2, Lock, BookOpen,
  Stethoscope,
} from 'lucide-react';
import Logo from '@/components/Logo';
import Reveal from '@/components/Reveal';
import WhyChooseUs from '@/components/WhyChooseUs';
import { CountdownTimer } from '@/components/CountdownTimer';

type Props = {
  onGetStarted: () => void;
  onSignIn: () => void;
};

export default function LandingPage({ onGetStarted, onSignIn }: Props) {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* ────────────────────────── Navbar ────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8 sm:py-4">
          <div className="flex items-center gap-1.5">
            <Logo />
            <div className="flex flex-col text-[12px] font-extrabold uppercase tracking-wide leading-[1.08] select-none">
  <span className="text-stone-900">Biletul</span>
  <span className="text-stone-900">Spre</span>
  <span className="text-brand-600 font-black">Medicină</span>
</div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={onSignIn} className="btn-ghost">
              Loghează-te
            </button>
            <button onClick={onGetStarted} className="btn-primary">
              Creează cont
            </button>
          </div>
        </div>
      </header>

      {/* ────────────────────────── Hero ────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/80 via-stone-50/40 to-stone-50" />
        <div className="absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand-200/30 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20">
          {/* Main heading */}
          <h1 className="text-center font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-stone-900 text-balance sm:text-5xl md:text-6xl">
            Standardul modern în pregătirea pentru{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              Medicină
            </span>
            .
          </h1>

          {/* Intro text — reformatat pe două rânduri */}
          <div className="mx-auto mt-8 max-w-2xl text-center" style={{ animation: 'fadeIn 0.8s ease-out 0.3s both' }}>
            <p className="text-xl font-light italic leading-relaxed text-stone-600 sm:text-2xl">
              Înțelegem presiunea.<br />
              <span className="font-medium text-brand-700">Suntem aici să-ți facem drumul mai ușor.</span>
            </p>
          </div>

          {/* Ticket visual with embedded CTA */}
          <div className="mt-12" style={{ animation: 'fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both' }}>
            <TicketCard onGetStarted={onGetStarted} />
          </div>
        </div>
      </section>

      {/* ────────────────────────── Why choose us ────────────────────────── */}
      <WhyChooseUs />

      {/* ────────────────────────── Stats / Progress preview ────────────────────────── */}
     <section className="relative overflow-hidden bg-stone-950 py-20 sm:py-24 border-y border-stone-800/80">
  <div className="absolute inset-0 grid-bg opacity-[0.05]" />
  <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
  <div className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />

  <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <Reveal className="mb-8 text-center">
      <h2 className="font-display text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">
        Materiale noi pe platformă în:
      </h2>
    </Reveal>

    <Reveal delay={80}>
      <CountdownTimer />
    </Reveal>

    <Reveal delay={150}>
      <p className="mx-auto mt-8 max-w-xl text-center text-stone-400">
        Alătură-te comunității de viitori medici și fii primul care accesează noile simulări și grile explicate.
      </p>
    </Reveal>
  </div>
</section>
      {/* ────────────────────────── Features ────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
  <Reveal className="mb-6 text-center">
    <h2 className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
      
    </h2>
          
        </Reveal>


      </section>

      {/* ────────────────────────── How it works ────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24">
        <Reveal className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Cum funcționează
          </h2>
          <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-brand-500" />
        </Reveal>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connector line */}
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent md:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <Step number={s.number} title={s.title} desc={s.desc} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ────────────────────────── Final CTA ────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-700 to-brand-800 px-8 py-16 text-center sm:px-16 sm:py-20">
            <div className="absolute inset-0 grid-bg opacity-[0.05]" />
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl" />

            <div className="relative">
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                Pregătește-te pentru admitere
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-brand-100">
                Începe astăzi cu prima ta simulare. Fiecare grilă te aduce mai aproape de locul la
                Medicină.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button onClick={onGetStarted} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-brand-700 shadow-lg transition-all duration-200 hover:bg-brand-50 hover:shadow-xl active:scale-[0.98]">
                  Creează cont
                  <ArrowRight size={18} />
                </button>
                <button onClick={onSignIn} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-400/40 px-8 py-4 text-base font-semibold text-brand-50 transition-all duration-200 hover:bg-brand-600/40 active:scale-[0.98]">
                  Am deja cont
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ────────────────────────── Footer ────────────────────────── */}
      <footer className="border-t border-stone-200 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 sm:flex-row">
          <Logo size="sm" />
          <p className="text-sm text-stone-400">
            © {new Date().getFullYear()} Biletul spre Medicină. Toate drepturile rezervate.
          </p>
        </div>
      </footer>
    </div>
  );
}



const STEPS = [
  { number: 1, title: 'Creează cont', desc: 'Înregistrează-te cu email și parolă. Contul tău îți oferă acces la toate simulările.' },
  { number: 2, title: 'Abonează-te', desc: 'Un singur abonament, acces nelimitat la toate simulările de pe platformă.' },
  { number: 3, title: 'Susține simularea', desc: 'Pornește cronometrul, rezolvă grilele, iar la final primește nota și explicațiile.' },
] as const;

/* ════════════════════════════════════════════════════════════════
   COMPONENTS
   ════════════════════════════════════════════════════════════════ */

function TicketCard({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="relative overflow-hidden rounded-2xl border border-stone-300/60 bg-gradient-to-br from-white to-stone-50 shadow-2xl shadow-stone-400/30"
        style={{ background: 'linear-gradient(135deg, #ffffff 0%, #faf9f7 100%)' }}
      >
        {/* Subtle paper texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Top header strip */}
        <div className="relative flex items-center justify-between bg-gradient-to-r from-brand-700 to-brand-600 px-6 py-3 text-white">
          <div className="flex items-center gap-2">
            <Stethoscope size={18} />
            <span className="font-display text-sm font-bold tracking-wide">BILETUL SPRE MEDICINĂ</span>
          </div>
          <span className="text-xs font-medium text-brand-100">ADMITERE 2027</span>
        </div>

        {/* Body — single section, no extra bottom strip */}
        <div className="relative flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-stretch sm:justify-between sm:px-10 sm:py-7">
          {/* Left perforation holes — realistic with inner shadow */}
          <div className="absolute left-0 top-0 bottom-0 hidden flex-col justify-around sm:flex">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={`l-${i}`}
                className="h-5 w-5 -translate-x-1/2 rounded-full bg-stone-50 ring-1 ring-stone-300/80"
                style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.6)' }}
              />
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 hidden flex-col justify-around sm:flex">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={`r-${i}`}
                className="h-5 w-5 translate-x-1/2 rounded-full bg-stone-50 ring-1 ring-stone-300/80"
                style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.6)' }}
              />
            ))}
          </div>

          {/* Left: journey info */}
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">De la</p>
              <p className="font-display text-xl font-bold text-stone-900">Elev candidat</p>
              <div className="my-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-brand-400 to-brand-200" />
                <ArrowRight size={16} className="text-brand-500" />
                <div className="h-px flex-1 bg-gradient-to-r from-brand-200 to-brand-400" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">La</p>
              <p className="font-display text-xl font-bold text-brand-700">Student la Medicină</p>
            </div>

            {/* ECG line — organic, printed look */}
            <svg viewBox="0 0 300 50" className="w-full h-auto overflow-visible">
  <defs>
    <style>{`
      @keyframes ecgSweep {
        0% {
          stroke-dashoffset: 300;
        }
        100% {
          stroke-dashoffset: -300;
        }
      }
      .animate-ecg-pulse {
        stroke-dasharray: 80 220;
        stroke-dashoffset: 300;
        animation: ecgSweep 5s linear infinite;
      }
    `}</style>
  </defs>

  {/* Linia de fundal (subtilă și discretă) */}
  <path 
    d="M 0 25 L 20 25 Q 25 18 30 25 L 40 25 L 43 29 L 48 3 L 53 38 L 57 25 L 62 25 Q 72 12 82 25 L 140 25 Q 145 18 150 25 L 160 25 L 163 29 L 168 3 L 173 38 L 177 25 L 182 25 Q 192 12 202 25 L 260 25 Q 265 18 270 25 L 280 25 L 283 29 L 288 3 L 293 38 L 297 25 L 300 25" 
    fill="none" 
    stroke="currentColor" 
    strokeOpacity={0.15} 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
  />

  {/* Pulsul animat (lumină mai deschisă / pastel neon) */}
  <path 
    className="animate-ecg-pulse" 
    d="M 0 25 L 20 25 Q 25 18 30 25 L 40 25 L 43 29 L 48 3 L 53 38 L 57 25 L 62 25 Q 72 12 82 25 L 140 25 Q 145 18 150 25 L 160 25 L 163 29 L 168 3 L 173 38 L 177 25 L 182 25 Q 192 12 202 25 L 260 25 Q 265 18 270 25 L 280 25 L 283 29 L 288 3 L 293 38 L 297 25 L 300 25" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    style={{ filter: 'drop-shadow(0px 0px 5px rgba(134, 239, 172, 0.85))' }} 
  />
</svg>
          </div>

          {/* Right: class info + CTA button in bottom-right */}
          <div className="relative flex flex-col justify-between border-l-0 border-y-2 border-dashed border-stone-200 px-0 py-4 sm:border-l-2 sm:border-y-0 sm:border-r-0 sm:px-8 sm:py-0">
            <div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 text-center">UMFCD | Medicină Generală &amp; Dentară</p>
                  <p className="font-display text-lg font-bold text-stone-900 text-center">Zeci de simulări cronometrate</p>
                  <p className="text-sm text-stone-500 text-center">CS · CG · Explicații</p>
                </div>
              </div>
            </div>

            {/* CTA — bottom-right corner of ticket body */}
            <div className="mt-5 flex flex-col items-start gap-1.5 sm:items-end">
              <button onClick={onGetStarted} className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-brand-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30 active:translate-y-0 active:scale-[0.98]">
                Ia-ți biletul spre Medicină
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </button>
              <p className="text-[11px] text-stone-400">Fă-ți cont. Începe gratuit cu simulările de probă.</p>
            </div>
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="flex items-center justify-between border-t border-stone-200/70 bg-stone-50/80 px-6 py-2.5 sm:px-10">
          <span className="text-xs text-stone-400">Asistență dedicată · Corectare automată</span>
  <span className="font-sans text-xs font-bold uppercase tracking-wider text-brand-600">
  {Math.max(0, Math.ceil((new Date("2027-07-15").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000))} zile rămase
</span>
        </div>
      </div>
    </div>
  );
}

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="relative text-center">
      <div className="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-brand-600 shadow-md ring-1 ring-brand-100 transition-transform duration-300 hover:scale-110">
        {number}
      </div>
      <h3 className="mb-2 font-display text-lg font-semibold text-stone-900">{title}</h3>
      <p className="text-sm leading-relaxed text-stone-600">{desc}</p>
    </div>
  );
}
