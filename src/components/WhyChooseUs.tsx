import { useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  BarChart3,
  Bookmark,
  Check,
  ClipboardCheck,
  Clock3,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import Reveal from '@/components/Reveal';

type CardId = 'simulations' | 'exam' | 'dashboard' | 'support' | 'team';
type CardTone = 'brand' | 'accent' | 'sky' | 'warm';

type Benefit = {
  text: ReactNode;
  emphasis?: string;
  emphasisClassName?: string;
};

type AdvantageCardProps = {
  id: CardId;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  intro?: string;
  benefits?: Benefit[];
  children?: ReactNode;
  tone?: CardTone;
  className?: string;
  activeCard: CardId | null;
  onActivate: (id: CardId) => void;
};

const BENEFIT_CHECKS: Benefit[] = [
  {
    text: (
      <>
        <strong>Simulări din întreaga materie de Biologie</strong>, pentru evaluarea
        completă a nivelului de pregătire.
      </>
    ),
  },
  {
    text: (
      <>
        <strong>Simulări structurate pe capitole</strong>, ideale pentru aprofundarea
        și verificarea fiecărui subiect.
      </>
    ),
  },
  {
    text: (
      <>
        <strong>
          Simulările și examenele de admitere oferite în anii anteriori de UMFCD
        </strong>
        , pentru o pregătire cât mai apropiată de experiența examenului real.
      </>
    ),
  },
];

const EXAM_BENEFITS: Benefit[] = [
  {
    text: 'Ne lăudăm cu grile complexe și atent concepute, fără AI, totul din materie.',
    emphasis: '60 grile la noi = 200 pe alte platforme',
    emphasisClassName: 'text-center',
  },
  {
    text: 'Cronometru integrat, pentru gestionarea eficientă a timpului.',
  },
  {
    text: 'Răspunsuri și explicații cuprinzătoare, disponibile imediat după finalizarea simulării.',
    emphasis: 'Înțelege fiecare greșeală, îmbunătățește pregătirea.',
  },
];

const DASHBOARD_ITEMS = [
  {
    icon: <BarChart3 size={17} />,
    label: 'Performanță pentru fiecare capitol',
    tone: 'brand',
  },
  {
    icon: <Clock3 size={17} />,
    label: 'Timp mediu de rezolvare',
    tone: 'accent',
  },
  {
    icon: <TrendingUp size={17} />,
    label: 'Evoluția scorului în timp',
    tone: 'brand',
  },
  {
    icon: <ClipboardCheck size={17} />,
    label: 'Număr simulări rezolvate',
    tone: 'brand',
  },
  {
    icon: <Bookmark size={17} />,
    label: 'Opțiunea „Grile de revăzut”',
    tone: 'accent',
  },
  {
    icon: <PieChart size={17} />,
    label: 'Rata medie de răspunsuri corecte',
    tone: 'brand',
  },
] as const;

const CARD_STYLES: Record<
  CardTone,
  {
    card: string;
    line: string;
    glow: string;
    icon: string;
    eyebrow: string;
    check: string;
    benefitBorder: string;
  }
> = {
  brand: {
    card: 'border-brand-200/80 from-white via-white to-brand-50/70',
    line: 'from-brand-500 via-emerald-400 to-transparent',
    glow: 'bg-brand-100/70',
    icon: 'bg-brand-100 text-brand-700 ring-brand-200/70',
    eyebrow: 'bg-brand-100/80 text-brand-800',
    check: 'bg-brand-100 text-brand-700',
    benefitBorder: 'border-brand-100/80',
  },
  accent: {
    card: 'border-amber-200/80 from-white via-white to-amber-50/75',
    line: 'from-accent-500 via-amber-400 to-transparent',
    glow: 'bg-amber-100/70',
    icon: 'bg-amber-100 text-accent-700 ring-amber-200/70',
    eyebrow: 'bg-amber-100/80 text-amber-800',
    check: 'bg-amber-100 text-accent-700',
    benefitBorder: 'border-amber-100',
  },
  sky: {
    card: 'border-sky-200/80 from-white via-white to-sky-50/75',
    line: 'from-sky-500 via-cyan-300 to-transparent',
    glow: 'bg-sky-100/70',
    icon: 'bg-sky-100 text-sky-700 ring-sky-200/70',
    eyebrow: 'bg-sky-100/80 text-sky-800',
    check: 'bg-sky-100 text-sky-700',
    benefitBorder: 'border-sky-100',
  },
  warm: {
    card: 'border-orange-200/70 from-white via-white to-orange-50/60',
    line: 'from-orange-400 via-amber-300 to-transparent',
    glow: 'bg-orange-100/65',
    icon: 'bg-orange-100 text-orange-700 ring-orange-200/70',
    eyebrow: 'bg-orange-100/80 text-orange-800',
    check: 'bg-orange-100 text-orange-700',
    benefitBorder: 'border-orange-100',
  },
};

export default function WhyChooseUs() {
  const [activeCard, setActiveCard] = useState<CardId | null>(null);

  return (
    <section
      aria-labelledby="why-choose-us-title"
      className="relative overflow-hidden px-4 pb-16 pt-5 sm:px-6 sm:pb-20 sm:pt-12 lg:px-8"
      style={{
        background:
          'linear-gradient(180deg, #fafcf9 0%, #f7faf7 58%, #fffdfa 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-brand-100/45 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 top-64 h-80 w-80 rounded-full bg-amber-100/55 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl">
        <Reveal className="mx-auto mb-10 max-w-3xl text-center motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none sm:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/85 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.17em] text-brand-700 shadow-sm">
            <span
              className="h-2 w-2 rounded-full bg-brand-500"
              aria-hidden="true"
            />
            Află despre noi
          </span>

          <h2
            id="why-choose-us-title"
            className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-brand-900 sm:text-4xl lg:text-5xl"
          >
            De ce să alegi{' '}
            <span className="text-accent-500">Biletul Spre Medicină</span>?
          </h2>

          <div
            className="mx-auto mt-5 h-1 w-20 rounded-full bg-gradient-to-r from-brand-500 to-accent-400"
            aria-hidden="true"
          />

          <p className="mx-auto mt-5 max-w-2xl font-sans text-base leading-relaxed text-stone-600 sm:text-lg">
            Tot ce ai nevoie pentru o pregătire organizată, realistă și eficientă
            pentru admiterea la medicină.
          </p>
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-12 lg:auto-rows-[minmax(170px,auto)]">
          <Reveal
            className="lg:col-span-7 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
            delay={60}
          >
            <AdvantageCard
              id="simulations"
              icon={<CardImage src="/Calendar.png" />}
              eyebrow="Pregătire constantă"
              title="Simulări zilnice"
              intro="Oferim acces la o gamă vastă și variată de simulări, concepute pentru a nu lăsa loc de surprindere la examen."
              benefits={BENEFIT_CHECKS}
              tone="brand"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            />
          </Reveal>

          <Reveal
            className="lg:col-span-5 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
            delay={120}
          >
            <AdvantageCard
              id="exam"
              icon={<CardImage src="/Checkboard copy 2.png" />}
              eyebrow="Ca la examen"
              title="Simulează cu adevărat experiența examenului"
              benefits={EXAM_BENEFITS}
              tone="accent"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            />
          </Reveal>

          <Reveal
            className="lg:col-span-5 lg:row-span-2 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
            delay={180}
          >
            <AdvantageCard
              id="dashboard"
              icon={<CardImage src="/Chartst.png" />}
              eyebrow="Progresul tău"
              title="Dashboard integrat"
              intro="Urmărește în detaliu evoluția"
              tone="sky"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            >
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {DASHBOARD_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="group/metric flex min-w-0 flex-col items-start gap-2 rounded-xl border border-sky-100 bg-white/85 p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md sm:flex-row sm:items-center sm:gap-3 sm:p-3"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${
                        item.tone === 'accent'
                          ? 'bg-amber-100 text-accent-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </div>
                    <p className="min-w-0 break-words text-sm font-medium leading-snug text-stone-700 sm:text-base">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm font-bold text-sky-800">
                <span aria-hidden="true">+</span>
                multe altele statistici
              </div>
            </AdvantageCard>
          </Reveal>

          <Reveal
            className="lg:col-span-7 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
            delay={240}
          >
            <AdvantageCard
              id="support"
              icon={<CardImage src="/Support.png" />}
              eyebrow="Sprijin pe parcurs"
              title="Ai o întrebare? Suntem aici să te ajutăm"
              intro="Beneficiezi de suport dedicat pe parcursul pregătirii, pentru orice nelămurire legată de platformă, simulări sau chiar materie:"
              benefits={[
                {
                  text: 'Asistență de luni până vineri, în intervalul 08:00–17:00.',
                },
                {
                  text: 'Răspunsuri rapide la întrebările și problemele întâmpinate.',
                },
              ]}
              tone="brand"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            />
          </Reveal>

          <Reveal
            className="lg:col-span-7 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
            delay={300}
          >
            <AdvantageCard
              id="team"
              icon={<CardImage src="/doctorii.png" />}
              eyebrow="Oameni care înțeleg"
              title="Cine suntem?"
              tone="warm"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            >
              <div className="mt-5 space-y-3 font-sans text-sm leading-relaxed text-stone-600 sm:text-base">
                <p className="font-semibold text-stone-800">
                  Suntem o echipă formată din profesori și studenți, uniți de
                  aceeași experiență și de dorința de a face pregătirea mai
                  eficientă.
                </p>
                <p>
                  Am înțeles și perfecționat metodele de pregătire pentru unul
                  dintre cele mai solicitante examene, transformând experiența
                  noastră într-un sistem de simulări adaptat nevoilor reale ale
                  elevilor.
                </p>
              </div>
            </AdvantageCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CardImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-105"
      draggable={false}
    />
  );
}

function AdvantageCard({
  id,
  icon,
  eyebrow,
  title,
  intro,
  benefits,
  children,
  tone = 'brand',
  className = '',
  activeCard,
  onActivate,
}: AdvantageCardProps) {
  const isActive = activeCard === id;
  const colors = CARD_STYLES[tone];

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate(id);
    }
  };

  return (
    <article
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      aria-label={`${title}. Activează evidențierea cardului.`}
      onClick={() => onActivate(id)}
      onKeyDown={handleKeyDown}
      className={`group relative isolate flex min-h-full cursor-pointer flex-col overflow-hidden rounded-[28px] border bg-gradient-to-br p-5 shadow-[0_8px_32px_rgba(27,61,49,0.05)] outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(27,61,49,0.11)] focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-7 ${
        colors.card
      } ${
        isActive ? 'ring-2 ring-brand-200 shadow-lg' : ''
      } ${className}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${colors.line}`}
        aria-hidden="true"
      />
      <div
        className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-2xl ${colors.glow}`}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ring-1 shadow-sm ${colors.icon}`}
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="min-w-0">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${colors.eyebrow}`}
          >
            {eyebrow}
          </span>

          <h3 className="mt-2 font-display text-xl font-extrabold leading-tight text-brand-900 sm:text-2xl">
            {title}
          </h3>

          {intro && (
            <p className="mt-2 font-sans text-sm leading-relaxed text-stone-600 sm:text-base">
              {intro}
            </p>
          )}
        </div>
      </div>

      {benefits && (
        <ul className="relative mt-6 space-y-2.5">
          {benefits.map((benefit, index) => (
            <li
              key={index}
              className={`flex items-start gap-3 rounded-2xl border bg-white/75 px-3 py-3 font-sans text-sm leading-relaxed text-stone-700 sm:px-4 sm:text-base ${colors.benefitBorder}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${colors.check}`}
                aria-hidden="true"
              >
                <Check size={14} strokeWidth={3} />
              </span>

              <span className="min-w-0">
                {benefit.text}
                {benefit.emphasis && (
                  <span
                    className={`mt-2 block rounded-lg bg-amber-50 px-2 py-1.5 text-sm font-bold text-accent-700 ${benefit.emphasisClassName ?? ''}`}
                  >
                    {benefit.emphasis}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {children}
    </article>
  );
}