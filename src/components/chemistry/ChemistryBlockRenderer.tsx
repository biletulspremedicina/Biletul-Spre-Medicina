import type { ChemistryLessonBlock } from '@/lib/supabase';
import { AlertCircle, Beaker, Lightbulb } from 'lucide-react';

export function plainLessonText(value: string) {
  return value
    .replace(/==([\s\S]+?)==/g, '$1')
    .replace(/\{\{([\s\S]+?)\}\}/g, '$1');
}

function LessonText({ value }: { value: string }) {
  const parts: Array<{ text: string; kind: 'normal' | 'important' | 'formula' }> = [];
  const pattern = /==([\s\S]+?)==|\{\{([\s\S]+?)\}\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) parts.push({ text: value.slice(cursor, match.index), kind: 'normal' });
    parts.push({ text: match[1] ?? match[2], kind: match[1] !== undefined ? 'important' : 'formula' });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor), kind: 'normal' });

  return <>{parts.map((part, index) => part.kind === 'important'
    ? <mark key={index} className="rounded bg-red-100 px-1 py-0.5 font-semibold text-red-900 [box-decoration-break:clone]">{part.text}</mark>
    : part.kind === 'formula'
      ? <span key={index} className="whitespace-nowrap text-[1.08em] text-[#123f34]"><ChemicalFormula value={part.text} /></span>
      : <span key={index}>{part.text}</span>)}</>;
}

function ChemicalFormula({ value }: { value: string }) {
  const subscriptDigits: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  };
  const superscriptCharacters: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '−',
  };
  const parts: Array<{ kind: 'normal' | 'sub' | 'sup'; text: string }> = [];
  const push = (kind: 'normal' | 'sub' | 'sup', text: string) => {
    if (!text) return;
    const previous = parts[parts.length - 1];
    if (previous?.kind === kind) previous.text += text;
    else parts.push({ kind, text });
  };

  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (character === '^') {
      let charge = '';
      index += 1;
      while (index < value.length && /[0-9+\-−]/.test(value[index])) charge += value[index++];
      if (charge) push('sup', charge.replace('-', '−'));
      else push('normal', '^');
      continue;
    }
    if (subscriptDigits[character]) {
      let digits = '';
      while (index < value.length && subscriptDigits[value[index]]) digits += subscriptDigits[value[index++]];
      push('sub', digits);
      continue;
    }
    if (superscriptCharacters[character]) {
      let charge = '';
      while (index < value.length && superscriptCharacters[value[index]]) charge += superscriptCharacters[value[index++]];
      push('sup', charge);
      continue;
    }
    if (/\d/.test(character)) {
      let digits = '';
      while (index < value.length && /\d/.test(value[index])) digits += value[index++];
      const previous = value[index - digits.length - 1] || '';
      push(/[A-Za-z)\]]/.test(previous) ? 'sub' : 'normal', digits);
      continue;
    }
    if ((character === '+' || character === '-' || character === '−')
      && /[A-Za-z0-9)\]]/.test(value[index - 1] || '')
      && (!value[index + 1] || /\s|,|;|\.|→/.test(value[index + 1]))) {
      push('sup', character === '-' ? '−' : character);
      index += 1;
      continue;
    }
    push('normal', character);
    index += 1;
  }

  return (
    <span className="whitespace-pre-wrap font-serif tracking-wide">
      {parts.map((part, index) => part.kind === 'sup'
        ? <sup key={index} className="ml-0.5">{part.text}</sup>
        : part.kind === 'sub'
          ? <sub key={index}>{part.text}</sub>
          : <span key={index}>{part.text}</span>)}
    </span>
  );
}

export function ChemistryBlockRenderer({ block }: { block: ChemistryLessonBlock }) {
  if (block.block_type === 'heading') {
    return <h2 id={`bloc-${block.id}`} className="scroll-mt-24 break-words [overflow-wrap:anywhere] text-2xl font-bold leading-tight text-[#123f34] sm:text-3xl"><LessonText value={block.content} /></h2>;
  }
  if (block.block_type === 'subheading') {
    return <h3 id={`bloc-${block.id}`} className="scroll-mt-24 break-words [overflow-wrap:anywhere] text-xl font-bold leading-tight text-[#205e4e] sm:text-2xl"><LessonText value={block.content} /></h3>;
  }
  if (block.block_type === 'paragraph') {
    return <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[17px] leading-8 text-stone-800 sm:text-lg sm:leading-9"><LessonText value={block.content} /></p>;
  }
  if (block.block_type === 'list') {
    return (
      <ul className="space-y-3 pl-1 text-[17px] leading-8 text-stone-800 sm:text-lg">
        {block.items.filter(Boolean).map((item, index) => (
          <li key={index} className="flex min-w-0 gap-3"><span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-brand-600" /><span className="min-w-0 break-words [overflow-wrap:anywhere]"><LessonText value={item} /></span></li>
        ))}
      </ul>
    );
  }
  if (block.block_type === 'note') {
    const styles = block.note_style === 'important'
      ? 'border-red-400 bg-red-50 text-red-950'
      : block.note_style === 'example'
        ? 'border-blue-300 bg-blue-50 text-blue-950'
        : 'border-emerald-300 bg-emerald-50 text-emerald-950';
    const Icon = block.note_style === 'important' ? AlertCircle : block.note_style === 'example' ? Beaker : Lightbulb;
    return (
      <aside className={`flex min-w-0 gap-3 rounded-2xl border-l-4 p-5 ${styles}`}>
        <Icon className="mt-0.5 shrink-0" size={22} />
        <p className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[17px] leading-8 sm:text-lg"><LessonText value={block.content} /></p>
      </aside>
    );
  }
  if (block.block_type === 'formula') {
    return (
      <div className="max-w-full overflow-x-auto rounded-2xl border border-[#d6e8e1] bg-[#f7fcf9] px-6 py-5 text-center text-2xl leading-relaxed text-[#123f34] sm:text-[28px]">
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

