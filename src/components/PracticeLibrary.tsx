import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { PracticeLessonRPC } from '@/lib/supabase';
import { PRACTICE_LIBRARY_HERO_IMAGE, practiceChapterImageFor } from '@/lib/practiceChapterImages';
import PracticeSetsView from '@/pages/PracticeSetsView';

type Props = {
  lessons: PracticeLessonRPC[];
  onOpen: (lesson: PracticeLessonRPC) => void;
  selectedLesson: { id: string; title: string } | null;
  focusSetId?: string;
  onBack: () => void;
  onStartSet: (setId: string, resume?: boolean) => void;
  onViewResults: (setId: string, attemptId?: string) => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
  subscriptionNonce: number;
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro-RO');
}

function ChapterPhoto({ title }: { title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="block h-16 w-24 shrink-0 overflow-hidden rounded-[3px] bg-[#e9eeea] sm:h-[72px] sm:w-[116px]">
      {!failed && <img src={practiceChapterImageFor(title)} alt="" loading="lazy" onError={() => setFailed(true)}
        className="h-full w-full object-cover saturate-[.8]" />}
    </span>
  );
}

export default function PracticeLibrary({
  lessons, onOpen, selectedLesson, focusSetId, onBack, onStartSet, onViewResults,
  onBuySubscription, buyingSub, subscriptionNonce,
}: Props) {
  const [query, setQuery] = useState('');
  const [displayedLesson, setDisplayedLesson] = useState(selectedLesson);
  const [slideOpen, setSlideOpen] = useState(!!selectedLesson);
  const slideFrame = useRef<number | null>(null);
  const listPaneRef = useRef<HTMLDivElement>(null);
  const chapterPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slideOpen) listPaneRef.current?.setAttribute('inert', '');
    else listPaneRef.current?.removeAttribute('inert');
    if (slideOpen) chapterPaneRef.current?.removeAttribute('inert');
    else chapterPaneRef.current?.setAttribute('inert', '');
  }, [slideOpen, displayedLesson]);

  useEffect(() => {
    if (slideFrame.current !== null) window.cancelAnimationFrame(slideFrame.current);
    if (selectedLesson) {
      setDisplayedLesson(selectedLesson);
      slideFrame.current = window.requestAnimationFrame(() => {
        slideFrame.current = window.requestAnimationFrame(() => setSlideOpen(true));
      });
    } else {
      setSlideOpen(false);
      const timeout = window.setTimeout(() => setDisplayedLesson(null), 440);
      return () => window.clearTimeout(timeout);
    }
    return () => {
      if (slideFrame.current !== null) window.cancelAnimationFrame(slideFrame.current);
    };
  }, [selectedLesson?.id, selectedLesson?.title]);
  const term = normalize(query.trim());
  const visible = term
    ? lessons.filter((lesson) => normalize(`${lesson.out_title} ${lesson.out_subject}`).includes(term))
    : lessons;
  const setCount = lessons.reduce((total, lesson) => total + Number(lesson.out_set_count || 0), 0);
  const questionCount = lessons.reduce((total, lesson) => total + Number(lesson.out_question_count || 0), 0);

  return (
    <section className={`practice-library practice-library--sliding overflow-hidden border border-[#e1e8e3] bg-[#fffefa] text-[#152b2b] ${slideOpen ? 'practice-library--chapter-open' : ''}`}>
      <div className="practice-library__slide-viewport">
      <div className="practice-library__slide-track">
      <div ref={listPaneRef} className="practice-library__slide-pane" aria-hidden={slideOpen}>
      <div className="practice-library__hero relative isolate flex min-h-[218px] items-center overflow-hidden border-b border-[#dce5df] bg-[#f9faf7] px-6 py-9 sm:px-9 lg:min-h-[238px]">
        <div className="absolute inset-0 -z-20 bg-cover bg-right bg-no-repeat" style={{ backgroundImage: `url('${PRACTICE_LIBRARY_HERO_IMAGE}')` }} />
        <div className="practice-library__hero-veil absolute inset-0 -z-10 bg-[linear-gradient(90deg,#fffefa_0%,#fffefa_43%,rgba(255,254,250,.94)_53%,rgba(255,254,250,.04)_81%)] max-sm:bg-[linear-gradient(90deg,#fffefa_0%,rgba(255,254,250,.95)_68%,rgba(255,254,250,.72)_100%)]" />
        <div className="relative max-w-[770px]">
          <p className="practice-library__eyebrow mb-3 text-[11px] font-bold uppercase tracking-[.25em] text-[#3c6659]">Bibliotecă de exersare</p>
          <h1 className="text-[clamp(32px,3.7vw,54px)] font-bold leading-[1.08] tracking-[-.035em] text-[#142828]" style={{ fontFamily: 'Georgia, Cambria, serif' }}>
            Antrenament pe capitole
          </h1>
          <p className="practice-library__subtitle mt-3 text-base text-[#4d6265] sm:text-lg">Alege un subiect și lucrează grilele în ritmul tău.</p>
        </div>
      </div>

      <div className="px-5 sm:px-8">
        <div className="practice-library__summary flex flex-wrap gap-x-7 gap-y-2 border-b border-[#dce5df] py-5 text-sm text-[#213b3c] sm:gap-x-9">
          <span><strong className="mr-1.5 text-lg font-semibold">{lessons.length}</strong> {lessons.length === 1 ? 'capitol' : 'capitole'}</span>
          <span className="hidden text-[#afbfbb] sm:inline" aria-hidden="true">│</span>
          <span><strong className="mr-1.5 text-lg font-semibold">{setCount}</strong> {setCount === 1 ? 'set' : 'seturi'}</span>
          <span className="hidden text-[#afbfbb] sm:inline" aria-hidden="true">│</span>
          <span><strong className="mr-1.5 text-lg font-semibold">{questionCount}</strong> {questionCount === 1 ? 'grilă' : 'grile'}</span>
        </div>

        <label className="relative my-4 block">
          <span className="sr-only">Caută un capitol</span>
          <Search size={18} strokeWidth={1.7} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#718581]" aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută un capitol..."
            className="w-full rounded-[5px] border border-[#d8e3dd] bg-white py-3 pl-11 pr-4 text-sm text-[#213b3c] outline-none transition-colors placeholder:text-[#82928e] focus:border-[#39745f] focus:ring-2 focus:ring-[#39745f]/15" />
        </label>

        <div className="border-t border-[#dce5df]">
          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#667b78]">
              {lessons.length ? 'Nu am găsit niciun capitol cu acest nume.' : 'Nu există capitole publicate momentan.'}
            </p>
          ) : visible.map((lesson) => {
            const sets = Number(lesson.out_set_count || 0);
            const questions = Number(lesson.out_question_count || 0);
            const available = sets > 0 && questions > 0;
            return (
              <button key={lesson.out_id} type="button" disabled={!available}
                onClick={() => onOpen(lesson)}
                aria-label={available ? `Deschide ${lesson.out_title}` : `${lesson.out_title}, în pregătire`}
                className="practice-library__row group grid w-full grid-cols-[96px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 border-b border-[#dce5df] px-1 py-2.5 text-left transition-colors enabled:hover:bg-[#eef6f1] enabled:focus-visible:bg-[#eef6f1] enabled:focus-visible:outline-none enabled:focus-visible:ring-2 enabled:focus-visible:ring-inset enabled:focus-visible:ring-[#36715b] disabled:cursor-default sm:grid-cols-[116px_minmax(0,1fr)_minmax(145px,190px)_minmax(125px,185px)] sm:gap-x-5 sm:px-2">
                <ChapterPhoto title={lesson.out_title} />
                <span className="min-w-0 text-[15px] font-semibold leading-snug text-[#173333] sm:text-[17px]" style={{ fontFamily: 'Georgia, Cambria, serif' }}>
                  {lesson.out_title}
                </span>
                <span className={`practice-library__row-meta col-start-2 text-sm sm:col-auto ${available ? 'text-[#486062]' : 'italic text-[#798c88]'}`}>
                  {available ? `${sets} ${sets === 1 ? 'set' : 'seturi'} · ${questions} ${questions === 1 ? 'grilă' : 'grile'}` : 'În pregătire'}
                </span>
                <span className={`practice-library__row-action col-start-2 flex items-center gap-2 text-sm sm:col-auto sm:justify-end ${available ? 'font-medium text-[#185c4c] group-hover:text-[#0e493b]' : 'italic text-[#8a9a95]'}`}>
                  {available ? 'Începe antrenamentul' : 'Revino curând'}
                  {available && <span aria-hidden="true" className="text-lg leading-none transition-transform group-hover:translate-x-1 motion-reduce:transition-none">→</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      </div>
      {displayedLesson && (
        <div ref={chapterPaneRef} className="practice-library__slide-pane" aria-hidden={!slideOpen}>
          <PracticeSetsView
            key={`${displayedLesson.id}-${subscriptionNonce}`}
            embedded
            lessonId={displayedLesson.id}
            lessonTitle={displayedLesson.title}
            focusSetId={focusSetId}
            onStartSet={onStartSet}
            onViewResults={onViewResults}
            onBack={onBack}
            onHome={onBack}
            onBuySubscription={onBuySubscription}
            buyingSub={buyingSub}
          />
        </div>
      )}
      </div>
      </div>
    </section>
  );
}
