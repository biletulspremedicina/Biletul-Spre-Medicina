import { useEffect, useRef, useState } from 'react';

const GROUP_SIZE = 15;
const TRANSITION_MS = 480;

type Props = {
  questionIds: string[];
  answers: Record<string, string>;
  markedIds: ReadonlySet<string>;
  activeIndex: number;
  questionIdPrefix: string;
};

export default function QuestionRail({ questionIds, answers, markedIds, activeIndex, questionIdPrefix }: Props) {
  const targetGroup = Math.floor(Math.max(0, activeIndex) / GROUP_SIZE);
  const [visibleGroup, setVisibleGroup] = useState(targetGroup);
  const [outgoingGroup, setOutgoingGroup] = useState<number | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const transitionRef = useRef<number | null>(null);

  useEffect(() => {
    if (targetGroup === visibleGroup) return;
    if (transitionRef.current !== null) window.clearTimeout(transitionRef.current);
    setDirection(targetGroup > visibleGroup ? 'forward' : 'backward');
    setOutgoingGroup(visibleGroup);
    setVisibleGroup(targetGroup);
    transitionRef.current = window.setTimeout(() => {
      setOutgoingGroup(null);
      transitionRef.current = null;
    }, TRANSITION_MS);
  }, [targetGroup, visibleGroup]);

  useEffect(() => () => {
    if (transitionRef.current !== null) window.clearTimeout(transitionRef.current);
  }, []);

  const renderGroup = (group: number, leaving: boolean) => {
    const start = group * GROUP_SIZE;
    const ids = questionIds.slice(start, start + GROUP_SIZE);
    const localActive = Math.min(Math.max(activeIndex - start, 0), Math.max(ids.length - 1, 0));
    return (
      <ol
        key={`${group}-${leaving ? 'out' : 'in'}`}
        className={`practice-exam__rail-group${outgoingGroup !== null ? ` practice-exam__rail-group--${leaving ? 'leaving' : 'entering'}-${direction}` : ''}`}
        aria-hidden={leaving ? 'true' : undefined}
      >
        {ids.length > 0 && (
          <span
            className="practice-exam__active-line"
            aria-hidden="true"
            style={{ transform: `translateY(${localActive * 100}%)` }}
          />
        )}
        {ids.map((id, localIndex) => {
          const index = start + localIndex;
          return (
            <li key={id}>
              <button
                type="button"
                className={`practice-exam__number${activeIndex === index ? ' practice-exam__number--active' : ''}${answers[id] ? ' practice-exam__number--answered' : ''}`}
                onClick={() => {
                  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                  document.getElementById(`${questionIdPrefix}${id}`)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
                }}
                aria-label={`Mergi la întrebarea ${index + 1}${answers[id] ? ', completată' : ''}${markedIds.has(id) ? ', marcată' : ''}`}
                aria-current={activeIndex === index ? 'location' : undefined}
                tabIndex={leaving ? -1 : 0}
              >
                <span>{index + 1}</span>
                {markedIds.has(id) && <span className="practice-exam__marked-dot" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <aside className="practice-exam__rail" aria-label="Navigare între grile">
      <div className="practice-exam__sticky">
        <div className="practice-exam__rail-viewport">
          {outgoingGroup !== null && renderGroup(outgoingGroup, true)}
          {renderGroup(visibleGroup, false)}
        </div>
      </div>
    </aside>
  );
}
