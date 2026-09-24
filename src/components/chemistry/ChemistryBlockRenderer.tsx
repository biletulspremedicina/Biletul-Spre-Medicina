import type { ChemistryLessonBlock } from '@/lib/supabase';
import { AlertCircle, Beaker, Lightbulb } from 'lucide-react';

function ChemicalFormula({ value }: { value: string }) {
  const parts = value.split(/(\^[0-9]*[+-]|(?<=[A-Za-z)])\d+)/g).filter(Boolean);
  return (
    <span className="font-serif tracking-wide">
      {parts.map((part, index) => part.startsWith('^')
        ? <sup key={index}>{part.slice(1)}</sup>
        : /^\d+$/.test(part)
          ? <sub key={index}>{part}</sub>
          : <span key={index}>{part}</span>)}
    </span>
  );
}

export function ChemistryBlockRenderer({ block }: { block: ChemistryLessonBlock }) {
  if (block.block_type === 'heading') {
    return <h2 id={`bloc-${block.id}`} className="scroll-mt-24 break-words [overflow-wrap:anywhere] text-2xl font-bold text-[#123f34] sm:text-3xl">{block.content}</h2>;
  }
  if (block.block_type === 'subheading') {
    return <h3 id={`bloc-${block.id}`} className="scroll-mt-24 break-words [overflow-wrap:anywhere] text-xl font-bold text-[#205e4e] sm:text-2xl">{block.content}</h3>;
  }
  if (block.block_type === 'paragraph') {
    return <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[16px] leading-8 text-stone-700">{block.content}</p>;
  }
  if (block.block_type === 'list') {
    return (
      <ul className="space-y-2 pl-1 text-[16px] leading-7 text-stone-700">
        {block.items.filter(Boolean).map((item, index) => (
          <li key={index} className="flex min-w-0 gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{item}</span></li>
        ))}
      </ul>
    );
  }
  if (block.block_type === 'note') {
    const styles = block.note_style === 'important'
      ? 'border-amber-300 bg-amber-50 text-amber-950'
      : block.note_style === 'example'
        ? 'border-blue-300 bg-blue-50 text-blue-950'
        : 'border-emerald-300 bg-emerald-50 text-emerald-950';
    const Icon = block.note_style === 'important' ? AlertCircle : block.note_style === 'example' ? Beaker : Lightbulb;
    return (
      <aside className={`flex min-w-0 gap-3 rounded-2xl border-l-4 p-5 ${styles}`}>
        <Icon className="mt-0.5 shrink-0" size={22} />
        <p className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-7">{block.content}</p>
      </aside>
    );
  }
  if (block.block_type === 'formula') {
    return (
      <div className="max-w-full overflow-x-auto rounded-2xl border border-[#d6e8e1] bg-[#f7fcf9] px-6 py-5 text-center text-xl text-[#123f34] sm:text-2xl">
        <ChemicalFormula value={block.content} />
      </div>
    );
  }
  if (block.block_type === 'image' && block.image_url) {
    return (
      <figure className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
        <img src={block.image_url} alt={block.image_alt} className="mx-auto max-h-[620px] w-auto rounded-xl object-contain" loading="lazy" />
        {block.caption && <figcaption className="break-words [overflow-wrap:anywhere] px-3 pb-1 pt-3 text-center text-sm text-stone-500">{block.caption}</figcaption>}
      </figure>
    );
  }
  return null;
}

