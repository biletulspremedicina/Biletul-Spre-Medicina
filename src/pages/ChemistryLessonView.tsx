import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Beaker, ChevronDown, List, Loader2 } from 'lucide-react';
import { supabase, type ChemistryLesson, type ChemistryLessonBlock } from '@/lib/supabase';
import { ChemistryBlockRenderer } from '@/components/chemistry/ChemistryBlockRenderer';
import Logo from '@/components/Logo';

export default function ChemistryLessonView({ lessonId, onBack }: { lessonId: string; onBack: () => void }) {
  const [lesson, setLesson] = useState<ChemistryLesson | null>(null);
  const [blocks, setBlocks] = useState<ChemistryLessonBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileContentsOpen, setMobileContentsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      const [lessonResult, blocksResult] = await Promise.all([
        supabase.from('chemistry_lessons').select('*').eq('id', lessonId).maybeSingle(),
        supabase.from('chemistry_lesson_blocks').select('*').eq('lesson_id', lessonId).order('position').order('created_at'),
      ]);
      if (!active) return;
      if (lessonResult.error || blocksResult.error || !lessonResult.data) setError('Lecția nu a putut fi încărcată.');
      else {
        setLesson(lessonResult.data as ChemistryLesson);
        setBlocks(((blocksResult.data || []) as ChemistryLessonBlock[]).map((block) => ({ ...block, items: block.items || [] })));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [lessonId]);

  const contents = useMemo(() => blocks.filter((block) => block.block_type === 'heading' || block.block_type === 'subheading'), [blocks]);
  const goToBlock = (id: string) => {
    document.getElementById(`bloc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileContentsOpen(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-stone-50"><div className="text-center text-stone-500"><Loader2 className="mx-auto mb-3 animate-spin" />Se încarcă lecția...</div></div>;

  return (
    <div className="min-h-screen bg-[#f6faf8] text-stone-800">
      <header className="sticky top-0 z-30 border-b border-[#dce9e4] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button className="btn-ghost !px-2 sm:!px-4" onClick={onBack}><ArrowLeft size={18} /><span className="hidden sm:inline">Înapoi la lecții</span></button>
          <div className="ml-auto flex items-center gap-2"><Logo className="h-8 w-auto" /><span className="hidden text-sm font-bold text-[#164d3e] sm:inline">Lecții de chimie</span></div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        {error || !lesson ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800"><p>{error || 'Lecția nu există.'}</p><button className="btn-secondary mt-5" onClick={onBack}>Înapoi</button></div>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_270px]">
            <article className="min-w-0 rounded-3xl border border-[#dce9e4] bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10 lg:px-12">
              <div className="mb-9 border-b border-[#e3ece8] pb-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e6f5ef] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#16634e]"><Beaker size={15} /> Chimie</div>
                <h1 className="font-display text-3xl font-extrabold leading-tight text-[#123f34] sm:text-4xl">{lesson.title}</h1>
                {lesson.description && <p className="mt-4 text-lg leading-8 text-stone-600">{lesson.description}</p>}
              </div>

              {contents.length > 0 && (
                <div className="mb-8 rounded-2xl border border-[#dce9e4] bg-[#f7fcf9] lg:hidden">
                  <button className="flex w-full items-center gap-2 px-4 py-3 text-left font-bold text-[#164d3e]" onClick={() => setMobileContentsOpen((open) => !open)}><List size={18} /> Cuprins <ChevronDown className={`ml-auto transition-transform ${mobileContentsOpen ? 'rotate-180' : ''}`} size={18} /></button>
                  {mobileContentsOpen && <Contents items={contents} onSelect={goToBlock} />}
                </div>
              )}

              <div className="space-y-7">{blocks.map((block) => <ChemistryBlockRenderer key={block.id} block={block} />)}</div>
              {blocks.length === 0 && <p className="py-14 text-center text-stone-500">Conținutul acestei lecții este în curs de pregătire.</p>}
            </article>
            <aside className="sticky top-24 hidden rounded-2xl border border-[#dce9e4] bg-white p-4 shadow-sm lg:block">
              <p className="mb-2 flex items-center gap-2 px-2 text-sm font-bold uppercase tracking-wide text-[#164d3e]"><List size={17} /> Cuprins</p>
              {contents.length ? <Contents items={contents} onSelect={goToBlock} /> : <p className="px-2 py-3 text-sm text-stone-500">Titlurile secțiunilor vor apărea aici.</p>}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Contents({ items, onSelect }: { items: ChemistryLessonBlock[]; onSelect: (id: string) => void }) {
  return (
    <nav className="space-y-1 border-t border-[#e5eeea] p-2 lg:border-0 lg:p-0">
      {items.map((item) => (
        <button key={item.id} onClick={() => onSelect(item.id)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm leading-snug hover:bg-[#edf7f2] hover:text-[#116149] ${item.block_type === 'subheading' ? 'pl-6 text-stone-500' : 'font-semibold text-stone-700'}`}>{item.content}</button>
      ))}
    </nav>
  );
}

