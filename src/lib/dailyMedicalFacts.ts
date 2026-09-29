// Ordinea este intenționată: după ultima informație, seria reîncepe cu prima.
export const DAILY_MEDICAL_FACTS = [
  'Știai că Școala Medicală din Salerno funcționa încă din secolul al IX-lea și este considerată prima facultate de medicină din Europa.',
  'Tu știai că Werner Forssmann și-a introdus singur un cateter prin vena brațului până în inimă, în 1929?',
  'Știai că Barry Marshall a băut o cultură de Helicobacter pylori pentru a demonstra că bacteria poate provoca gastrită?',
  'Astăzi afli că H. pylori a fost cultivată cu succes după ce probele au rămas în incubator mai mult decât prevedea protocolul.',
  'Știai că Fleming a observat efectul penicilinei într-o cultură contaminată accidental cu mucegai?',
  'Tu știai că au trecut mai bine de zece ani de la observația lui Fleming până când penicilina a devenit un tratament utilizabil?',
  'Știai că Fleming avertiza asupra rezistenței bacteriene la antibiotice încă din discursul său de la Nobel?',
  'Astăzi afli că Semmelweis a redus dramatic mortalitatea maternă cerând medicilor să-și dezinfecteze mâinile după autopsii.',
  'Știai că primul experiment de vaccinare al lui Edward Jenner, în 1796, a pornit de la observația că vărsatul vacilor proteja împotriva variolei?',
  'Tu știai că termenul „vaccin” provine din latinescul vacca, adică „vacă”?',
  'Știai că variola a fost declarată eradicată în 1980, după milenii în care a provocat epidemii?',
  'Astăzi afli că primul pacient tratat cu insulină a fost Leonard Thompson, un băiat de 14 ani aflat în stare gravă.',
  'Știai că Charles Best a contribuit la descoperirea insulinei, dar nu s-a numărat printre cei doi laureați ai Nobelului din 1923?',
  'Tu știai că descoperirea grupelor sanguine de către Karl Landsteiner a explicat de ce unele transfuzii anterioare aveau consecințe fatale?',
  'Știai că primul transplant renal uman cu succes durabil, realizat în 1954, a avut loc între doi gemeni identici?',
  'Astăzi afli că Gerty Cori a fost prima femeie care a primit Premiul Nobel pentru Fiziologie sau Medicină.',
  'Știai că Tu Youyou a găsit pista care a dus la descoperirea artemisininei studiind texte medicale chineze vechi?',
  'Tu știai că ipoteza legăturii dintre HPV și cancerul de col uterin a fost respinsă inițial de mulți cercetători?',
  'Știai că prionii au schimbat ideea clasică despre infecții, fiind agenți transmisibili fără genom propriu?',
  'Astăzi afli că ideea reacției PCR i-a venit lui Kary Mullis în timpul unei călătorii cu mașina.',
  'Știai că telomeraza poate reface capetele cromozomilor și că multe celule canceroase profită de această capacitate?',
  'Tu știai că modificarea unor componente ale ARN-ului a fost decisivă pentru dezvoltarea vaccinurilor moderne pe bază de ARN mesager?',
  'Știai că Rosalyn Yalow a contribuit la o metodă care a făcut posibilă măsurarea unor cantități infime de hormoni în sânge?',
  'Astăzi afli că Barbara McClintock a descoperit elemente genetice capabile să-și schimbe poziția în genom — „genele săritoare”.',
  'Știai că primul transplant renal între gemeni identici a fost precedat de grefe de piele folosite pentru verificarea compatibilității?',
  'Știai că ADN-ul dintr-o singură celulă umană ar măsura aproximativ doi metri dacă ar fi întins?',
  'Tu știai că genomul uman conține aproximativ trei miliarde de perechi de baze într-un singur set de cromozomi?',
  'Astăzi afli că organismul unui adult conține, conform estimărilor actuale, aproximativ 30 de trilioane de celule umane.',
  'Știai că în fiecare zi mor și sunt înlocuite aproximativ 330 de miliarde de celule din corp?',
  'Tu știai că raportul estimat dintre bacteriile din corp și celulele umane este aproape de 1:1, nu de 10:1 cum se repeta cândva?',
  'Știai că unele prelungiri ale neuronilor pot atinge lungimi de aproximativ un metru?',
  'Astăzi afli că ficatul poate reveni spre dimensiunea sa inițială chiar și după îndepărtarea unei părți foarte mari din el.',
  'Știai că creierul reprezintă aproximativ 2% din masa corpului, dar consumă în jur de 20% din energia utilizată în repaus?',
  'Tu știai că unele celule fetale pot rămâne în corpul mamei timp de decenii după naștere?',
  'Știai că în sângele unei gravide circulă fragmente de ADN provenite în principal din placentă, fapt care permite anumite teste prenatale fără intervenții invazive?',
  'Astăzi afli că și celulele mamei pot trece la făt și pot persista în organismul copilului după naștere.',
  'Știai că organismul uman emite lumină extrem de slabă, imposibil de observat cu ochiul liber?',
  'Tu știai că aproape întregul schelet adult trece prin remodelare într-un interval de aproximativ zece ani?',
  'Știai că o parte dintre neuronii și celulele ochilor pot supraviețui întreaga viață, în timp ce alte celule sunt înlocuite rapid?',
  'Astăzi afli că celulele bacteriene din corp sunt cam la fel de numeroase ca celulele umane, dar reprezintă o fracțiune mică din masa corporală.',
  'Știai că un eritrocit poate circula aproximativ 120 de zile înainte să fie eliminat din circulație?',
  'Tu știai că celulele se pot „dezasambla” și recicla pe ele însele prin autofagie?',
  'Știai că mitocondriile au propriul ADN, distinct de ADN-ul din nucleu?',
  'Astăzi afli că ADN-ul mitocondrial este transmis, în mod obișnuit, pe linie maternă.',
  'Știai că aproximativ jumătate din ADN-ul unui copil provine de la fiecare părinte, dar ADN-ul mitocondrial urmează o regulă diferită?',
  'Tu știai că unele celule canceroase își mențin telomerii pentru a continua să se dividă?',
  'Știai că aproximativ 86% dintre celulele înlocuite zilnic sunt celule sanguine?',
  'Astăzi afli că prionii pot transmite o boală prin modificarea formei altor proteine, fără să aibă nevoie de ADN sau ARN propriu.',
  'Știai că în organism există aproximativ 200 de tipuri de celule, deși aproape toate pornesc de la aceeași informație genetică?',
  'Tu știai că două persoane pot avea genomuri extrem de asemănătoare, iar diferențele relativ mici dintre ele pot avea efecte medicale importante?',
] as const;

const DAY_MS = 86_400_000;
const FIRST_FACT_DAY = Date.UTC(2026, 8, 30) / DAY_MS;

export function medicalFactForDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayNumber = Date.UTC(year, month - 1, day) / DAY_MS;
  const index = ((dayNumber - FIRST_FACT_DAY) % DAILY_MEDICAL_FACTS.length + DAILY_MEDICAL_FACTS.length)
    % DAILY_MEDICAL_FACTS.length;
  return DAILY_MEDICAL_FACTS[index];
}
