import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
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
  title: string;
  intro?: string;
  benefits?: Benefit[];
  children?: ReactNode;
  tone?: CardTone;
  iconSide?: 'left' | 'right';
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
    surface: string;
    edge: string;
    icon: string;
    check: string;
  }
> = {
  brand: {
    surface: 'border-brand-200 bg-[#f5faf7]',
    edge: 'bg-brand-600',
    icon: 'ring-brand-200',
    check: 'bg-brand-600',
  },
  accent: {
    surface: 'border-amber-200 bg-[#fff9ed]',
    edge: 'bg-accent-500',
    icon: 'ring-amber-200',
    check: 'bg-accent-600',
  },
  sky: {
    surface: 'border-sky-200 bg-[#f2f8fc]',
    edge: 'bg-sky-500',
    icon: 'ring-sky-200',
    check: 'bg-sky-600',
  },
  warm: {
    surface: 'border-orange-200 bg-[#fffaf4]',
    edge: 'bg-orange-400',
    icon: 'ring-orange-200',
    check: 'bg-orange-500',
  },
};

export default function WhyChooseUs() {
  const [activeCard, setActiveCard] = useState<CardId | null>(null);

  return (
    <section
      aria-labelledby="why-choose-us-title"
      className="overflow-hidden bg-[#fbfcfa] px-4 pb-16 pt-5 sm:px-6 sm:pb-20 sm:pt-12 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto mb-9 max-w-3xl text-center motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none sm:mb-12">
          <h2
            id="why-choose-us-title"
            className="font-display text-3xl font-extrabold leading-[1.13] tracking-tight text-brand-900 sm:text-4xl lg:text-5xl"
          >
            De ce să alegi{' '}
            <span className="text-accent-600">Biletul Spre Medicină</span>?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl font-sans text-base leading-relaxed text-stone-600 sm:text-lg">
            Tot ce ai nevoie pentru o pregătire organizată, realistă și eficientă
            pentru admiterea la medicină.
          </p>
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          {/* Coloana stângă */}
          <div className="contents lg:flex lg:flex-col lg:gap-5">
            <SlideInCard direction="left" className="order-1 lg:order-none">
              <AdvantageCard
                id="simulations"
                icon={<CardImage src="/Calendar.png" />}
                iconSide="right"
                title="Simulări zilnice"
                intro="Oferim acces la o gamă vastă și variată de simulări, concepute pentru a nu lăsa loc de surprindere la examen."
                benefits={BENEFIT_CHECKS}
                tone="brand"
                activeCard={activeCard}
                onActivate={setActiveCard}
              />
            </SlideInCard>

            <SlideInCard direction="left" className="order-3 lg:order-none">
              <AdvantageCard
                id="dashboard"
                icon={<CardImage src="/Chartst.png" />}
                iconSide="left"
                title="Dashboard integrat"
                intro="Urmărește în detaliu evoluția"
                tone="sky"
                activeCard={activeCard}
                onActivate={setActiveCard}
              >
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  {DASHBOARD_ITEMS.map((item) => (
                    <div
                      key={item.label}
                      className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-sky-100 bg-white p-3 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          item.tone === 'accent'
                            ? 'bg-amber-100 text-accent-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                        aria-hidden="true"
                      >
                        {item.icon}
                      </div>
                      <p className="min-w-0 break-words text-sm font-medium leading-snug text-stone-700">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-center text-sm font-semibold text-sky-800">
                  + multe altele statistici
                </p>
              </AdvantageCard>
            </SlideInCard>
          </div>

          {/* Coloana dreaptă */}
          <div className="contents lg:flex lg:flex-col lg:gap-5">
            <SlideInCard direction="right" className="order-2 lg:order-none">
              <AdvantageCard
                id="exam"
                icon={<CardImage src="/Checkboard copy 2.png" />}
                iconSide="left"
                title="Simulează cu adevărat experiența examenului"
                benefits={EXAM_BENEFITS}
                tone="accent"
                activeCard={activeCard}
                onActivate={setActiveCard}
              />
            </SlideInCard>

            <SlideInCard direction="right" className="order-4 lg:order-none">
              <AdvantageCard
                id="support"
                icon={<CardImage src="/Support.png" />}
                iconSide="right"
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
                activeCard={activeCard}
                onActivate={setActiveCard}
              />
            </SlideInCard>

            <SlideInCard direction="right" className="order-5 lg:order-none">
              <AdvantageCard
                id="team"
                icon={<CardImage src="/doctorii.png" />}
                iconSide="left"
                title="Cine suntem?"
                tone="warm"
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
            </SlideInCard>
          </div>
        </div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .why-slide {
            opacity: 0;
            transition:
              opacity 700ms ease,
              transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          .why-slide[data-direction='left'] {
            transform: translateX(-32px);
          }

          .why-slide[data-direction='right'] {
            transform: translateX(32px);
          }

          .why-slide[data-visible='true'] {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
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

function SlideInCard({
  direction,
  className = '',
  children,
}: {
  direction: 'left' | 'right';
  className?: string;
  children: ReactNode;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      className={`why-slide ${className}`}
      data-direction={direction}
      data-visible={visible}
    >
      {children}
    </div>
  );
}

function AdvantageCard({
  id,
  icon,
  title,
  intro,
  benefits,
  children,
  tone = 'brand',
  iconSide = 'left',
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
      className={`group relative cursor-pointer overflow-hidden rounded-[20px] border p-5 shadow-sm outline-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6 ${colors.surface} ${
        isActive ? 'ring-2 ring-brand-300' : ''
      }`}
    >
      <span
        className={`absolute bottom-5 left-0 top-5 w-[3px] rounded-r-full ${colors.edge}`}
        aria-hidden="true"
      />

      <div
        className={`flex items-start gap-4 ${
          iconSide === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ${colors.icon}`}
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold leading-tight text-brand-900 sm:text-[23px]">
            {title}
          </h3>

          {intro && (
            <p className="mt-2 font-sans text-sm leading-relaxed text-stone-600 sm:text-[15px]">
              {intro}
            </p>
          )}
        </div>
      </div>

      {benefits && (
        <ul className="mt-5 divide-y divide-stone-200/80 border-t border-stone-200/80">
          {benefits.map((benefit, index) => (
            <li
              key={index}
              className="flex items-start gap-3 py-3 text-sm leading-relaxed text-stone-700 first:pt-4 last:pb-0 sm:text-[15px]"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${colors.check}`}
                aria-hidden="true"
              >
                <Check size={12} strokeWidth={3} />
              </span>

              <span className="min-w-0">
                {benefit.text}
                {benefit.emphasis && (
                  <span
                    className={`mt-1.5 block text-sm font-semibold text-accent-700 ${benefit.emphasisClassName ?? ''}`}
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