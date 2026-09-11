import { useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  Headphones,
  MessageCircle,
  PieChart,
  Timer,
  TrendingUp,
  Users,
  Bookmark,
} from 'lucide-react';
import Reveal from '@/components/Reveal';

type CardId = 'simulations' | 'exam' | 'dashboard' | 'support' | 'team';

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
  tone?: 'brand' | 'accent';
  className?: string;
  activeCard: CardId | null;
  onActivate: (id: CardId) => void;
};

const BENEFIT_CHECKS: Benefit[] = [
  {
  text: (
    <>
      <strong>Simulări din întreaga materie de Biologie</strong>, pentru evaluarea completă a nivelului de pregătire.
    </>
  ),
},
 {
  text: (
    <>
      <strong>Simulări structurate pe capitole</strong>, ideale pentru aprofundarea și verificarea fiecărui subiect.
    </>
  ),
},
  {
  text: (
    <>
      <strong>Simulările și examenele de admitere oferite în anii anteriori de UMFCD</strong>, pentru o pregătire cât mai apropiată de experiența examenului real.
    </>
  ),
},
];

const EXAM_BENEFITS: Benefit[] = [
{
  text: 'Ne lăudăm cu grile complexe și atent concepute, fără AI, totul din materie.',
  emphasis: '60 grile la noi = 200 pe alte platforme',
  emphasisClassName: 'block w-full text-center',
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
  { icon: <BarChart3 size={17} />, label: 'Performanță pentru fiecare capitol', tone: 'brand' },
  { icon: <Clock3 size={17} />, label: 'Timp mediu de rezolvare', tone: 'accent' },
  { icon: <TrendingUp size={17} />, label: 'Evoluția scorului în timp', tone: 'brand' },
  { icon: <ClipboardCheck size={17} />, label: 'Număr simulări rezolvate', tone: 'brand' },
  { icon: <Bookmark size={17} />, label: 'Opțiunea „Grile de revăzut”', tone: 'accent' },
  { icon: <PieChart size={17} />, label: 'Rata medie de răspunsuri corecte', tone: 'brand' },
] as const;

export default function WhyChooseUs() {
  const [activeCard, setActiveCard] = useState<CardId | null>(null);

  return (
    <section
      aria-labelledby="why-choose-us-title"
      className="relative overflow-hidden bg-stone-50 px-4 pt-4 pb-12 sm:px-6 sm:pt-6 sm:pb-16 lg:px-8"
    >
      <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-100/35 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <Reveal className="mx-auto mb-8 max-w-3xl text-center motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none">
          <p className="mb-4 font-sans text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            Află despre noi
          </p>
          <h2
            id="why-choose-us-title"
            className="font-display text-3xl font-extrabold tracking-tight text-brand-900 sm:text-4xl lg:text-5xl"
            >
              De ce să alegi <span className="text-accent-500">Biletul Spre Medicină</span>?
            </h2>
          <p className="mx-auto mt-5 max-w-2xl font-sans text-base leading-relaxed text-stone-600 sm:text-lg">
            Tot ce ai nevoie pentru o pregătire organizată, realistă și eficientă pentru admiterea la medicină.
          </p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:auto-rows-[minmax(170px,auto)]">
          <Reveal className="md:col-span-2 lg:col-span-7 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none" delay={60}>
            <AdvantageCard
              id="simulations"
              icon={
  <img 
    src="/Calendar.png" 
    alt="Iconita" 
    className="h-8 w-8 object-contain transition-transform duration-300 hover:scale-115 hover:-rotate-12 active:scale-95 cursor-pointer" 
  />
}
              title="Simulări zilnice"
              intro="Oferim acces la o gamă vastă și variată de simulări, concepute pentru a nu lăsa loc de surprindere la examen."
              benefits={BENEFIT_CHECKS}
              tone="brand"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            />
          </Reveal>

          <Reveal className="md:col-span-2 lg:col-span-5 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none" delay={120}>
            <AdvantageCard
              id="exam"
              icon={
  <img 
    src="/Checkboard.png" 
    alt="Iconita" 
    className="h-8 w-8 object-contain transition-transform duration-300 hover:scale-115 hover:-rotate-12 active:scale-95 cursor-pointer" 
  />
}
              title="Simulează cu adevărat experiența examenului"
              benefits={EXAM_BENEFITS}
              tone="accent"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            />
          </Reveal>

          <Reveal className="md:col-span-2 lg:col-span-5 lg:row-span-2 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none" delay={180}>
            <AdvantageCard
              id="dashboard"
              icon={
  <img 
    src="/Chartst.png" 
    alt="Iconita" 
    className="h-8 w-8 object-contain transition-transform duration-300 hover:scale-115 hover:-rotate-12 active:scale-95 cursor-pointer" 
  />
}
              title="Dashboard integrat"
              intro="Urmărește în detaliu evoluția"
              tone="brand"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            >
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {DASHBOARD_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="group/metric flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 transition-all duration-250 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm focus-within:ring-2 focus-within:ring-brand-500/30"
                  >
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${item.tone === 'accent' ? 'bg-accent-50 text-accent-600' : 'bg-brand-50 text-brand-600'} transition-transform duration-250 group-hover/metric:scale-105`} aria-hidden="true">
                      {item.icon}
                    </div>
                    <p className="text-base font-medium leading-snug text-stone-700">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-brand-100 px-4 py-3 text-sm font-bold text-brand-800">
                <span aria-hidden="true">+</span> multe altele statistici
              </div>
            </AdvantageCard>
          </Reveal>

          <Reveal className="md:col-span-2 lg:col-span-7 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none" delay={240}>
            <AdvantageCard
              id="support"
              icon={
  <img 
    src="/Support.png" 
    alt="Iconita" 
    className="h-8 w-8 object-contain transition-transform duration-300 hover:scale-115 hover:-rotate-12 active:scale-95 cursor-pointer" 
  />
}
              title="Ai o întrebare? Suntem aici să te ajutăm"
              intro="Beneficiezi de suport dedicat pe parcursul pregătirii, pentru orice nelămurire legată de platformă, simulări sau chiar materie:"
              benefits={[
                { text: 'Asistență de luni până vineri, în intervalul 08:00–17:00.' },
                { text: 'Răspunsuri rapide la întrebările și problemele întâmpinate.' },
              ]}
              tone="brand"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            />
          </Reveal>

          <Reveal className="md:col-span-2 lg:col-span-7 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none" delay={300}>
            <AdvantageCard
              id="team"
              icon={
  <img 
    src="/doctorii.png" 
    alt="Iconita" 
    className="h-8 w-8 object-contain transition-transform duration-300 hover:scale-115 hover:-rotate-12 active:scale-95 cursor-pointer" 
  />
}
              title="Cine suntem?"
              tone="brand"
              className="h-full"
              activeCard={activeCard}
              onActivate={setActiveCard}
            >
              <div className="mt-5 space-y-3 font-sans text-sm leading-relaxed text-stone-600 sm:text-base">
               <p className="font-bold indent-4">
  Suntem o echipă formată din profesori și studenți, uniți de aceeași experiență și de dorința de a face pregătirea mai eficientă.
</p>
                <p>Am înțeles și perfecționat metodele de pregătire pentru unul dintre cele mai solicitante examene, transformând experiența noastră într-un sistem de simulări adaptat nevoilor reale ale elevilor.</p>
              </div>
            </AdvantageCard>
          </Reveal>
        </div>
      </div>
    </section>
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
  className = '',
  activeCard,
  onActivate,
}: AdvantageCardProps) {
  const isActive = activeCard === id;
  const accentClasses = tone === 'accent'
    ? 'bg-accent-50 text-accent-600 group-hover:bg-accent-100'
    : 'bg-brand-100 text-brand-700 group-hover:bg-brand-150';

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
      className={`group relative isolate flex min-h-full cursor-pointer flex-col overflow-hidden rounded-[24px] border bg-white p-6 shadow-sm outline-none transition-all duration-250 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${isActive ? 'border-brand-400 shadow-md ring-1 ring-brand-200' : 'border-stone-200'} ${className}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-250 group-hover:scale-x-100 ${tone === 'accent' ? 'bg-accent-500' : 'bg-brand-500'} ${isActive ? 'scale-x-100' : ''}`} aria-hidden="true" />
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-brand-50/60 opacity-50 transition-opacity duration-250 group-hover:opacity-90" aria-hidden="true" />

      <div className="relative flex items-start gap-4">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-transform duration-250 group-hover:scale-105 ${accentClasses}`} aria-hidden="true">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-extrabold leading-tight text-brand-900 sm:text-2xl">{title}</h3>
          {intro && <p className="mt-2 font-sans text-sm leading-relaxed text-stone-600 sm:text-base">{intro}</p>}
        </div>
      </div>

      {benefits && (
        <ul className="relative mt-5 space-y-3">
          {benefits.map((benefit, idx) => (
            <li key={idx} className="flex items-start gap-3 font-sans text-sm leading-relaxed text-stone-700 sm:text-base">
              <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${tone === 'accent' ? 'bg-accent-100 text-accent-600' : 'bg-brand-100 text-brand-700'}`} aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="min-w-0">
                {benefit.text}
                {benefit.emphasis && (
                  <span className="mt-1 block font-sans text-sm font-semibold text-accent-600">{benefit.emphasis}</span>
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
