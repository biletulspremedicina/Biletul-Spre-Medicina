import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Beaker, Edit2, Eye, EyeOff,
  ImagePlus, Loader2, Plus, Save, Trash2, X,
} from 'lucide-react';
import { supabase, type ChemistryBlockType, type ChemistryLesson, type ChemistryLessonBlock } from '@/lib/supabase';
import { ChemistryBlockRenderer } from '@/components/chemistry/ChemistryBlockRenderer';

const blockLabels: Record<ChemistryBlockType, string> = {
  heading: 'Titlu de secțiune',
  subheading: 'Subtitlu',
  paragraph: 'Text',
  list: 'Listă',
  note: 'Casetă evidențiată',
  formula: 'Formulă chimică',
  image: 'Imagine / schemă',
};

const emptyBlock = (lessonId: string, position: number): ChemistryLessonBlock => ({
  id: '', lesson_id: lessonId, block_type: 'paragraph', content: '', items: [],
  image_url: '', image_alt: '', caption: '', note_style: 'info', position,
  created_at: '', updated_at: '',
});

export default function ChemistryAdmin() {
  const [lessons, setLessons] = useState<ChemistryLesson[]>([]);
  const [selected, setSelected] = useState<ChemistryLesson | null>(null);
  const [blocks, setBlocks] = useState<ChemistryLessonBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState<{ id?: string; title: string; description: string } | null>(null);
  const [blockForm, setBlockForm] = useState<ChemistryLessonBlock | null>(null);
  const [preview, setPreview] = useState(false);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('chemistry_lessons').select('*')
      .order('position').order('created_at');
    if (error) setMessage(`Nu am putut încărca lecțiile: ${error.message}`);
    setLessons((data || []) as ChemistryLesson[]);
    setLoading(false);
  }, []);

  const loadBlocks = useCallback(async (lessonId: string) => {
    const { data, error } = await supabase.from('chemistry_lesson_blocks').select('*')
      .eq('lesson_id', lessonId).order('position').order('created_at');
    if (error) setMessage(`Nu am putut încărca conținutul: ${error.message}`);
    setBlocks(((data || []) as ChemistryLessonBlock[]).map((block) => ({ ...block, items: block.items || [] })));
  }, []);

  useEffect(() => { void loadLessons(); }, [loadLessons]);
  useEffect(() => { if (selected) void loadBlocks(selected.id); }, [selected, loadBlocks]);

  const saveLesson = async () => {
    if (!lessonForm?.title.trim()) return;
    setSaving(true); setMessage(null);
    const payload = { title: lessonForm.title.trim(), description: lessonForm.description.trim(), updated_at: new Date().toISOString() };
    const result = lessonForm.id
      ? await supabase.from('chemistry_lessons').update(payload).eq('id', lessonForm.id)
      : await supabase.from('chemistry_lessons').insert({ ...payload, position: lessons.length });
    if (result.error) setMessage(`Lecția nu a fost salvată: ${result.error.message}`);
    else { setLessonForm(null); setMessage('Lecția a fost salvată.'); await loadLessons(); }
    setSaving(false);
  };

  const deleteLesson = async (lesson: ChemistryLesson) => {
    if (!window.confirm(`Ștergi lecția „${lesson.title}” și tot conținutul ei?`)) return;
    const { error } = await supabase.from('chemistry_lessons').delete().eq('id', lesson.id);
    if (error) setMessage(`Lecția nu a putut fi ștearsă: ${error.message}`);
    else await loadLessons();
  };

  const togglePublished = async (lesson: ChemistryLesson) => {
    const { error } = await supabase.from('chemistry_lessons')
      .update({ is_published: !lesson.is_published, updated_at: new Date().toISOString() }).eq('id', lesson.id);
    if (error) setMessage(`Starea lecției nu a putut fi schimbată: ${error.message}`);
    else await loadLessons();
  };

  const moveLesson = async (index: number, direction: -1 | 1) => {
    const other = index + direction;
    if (other < 0 || other >= lessons.length) return;
    await Promise.all([
      supabase.from('chemistry_lessons').update({ position: other }).eq('id', lessons[index].id),
      supabase.from('chemistry_lessons').update({ position: index }).eq('id', lessons[other].id),
    ]);
    await loadLessons();
  };

  const uploadImage = async (file: File) => {
    if (!blockForm) return;
    setSaving(true); setMessage(null);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${blockForm.lesson_id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('chemistry-lessons').upload(path, file, { upsert: false });
    if (error) setMessage(`Imaginea nu a putut fi încărcată: ${error.message}`);
    else {
      const { data } = supabase.storage.from('chemistry-lessons').getPublicUrl(path);
      setBlockForm((current) => current ? { ...current, image_url: data.publicUrl, image_alt: current.image_alt || file.name.replace(/\.[^.]+$/, '') } : current);
    }
    setSaving(false);
  };

  const saveBlock = async () => {
    if (!blockForm) return;
    setSaving(true); setMessage(null);
    const payload = {
      lesson_id: blockForm.lesson_id, block_type: blockForm.block_type,
      content: blockForm.content.trim(), items: blockForm.items.filter((item) => item.trim()),
      image_url: blockForm.image_url.trim(), image_alt: blockForm.image_alt.trim(),
      caption: blockForm.caption.trim(), note_style: blockForm.note_style,
      position: blockForm.position, updated_at: new Date().toISOString(),
    };
    const result = blockForm.id
      ? await supabase.from('chemistry_lesson_blocks').update(payload).eq('id', blockForm.id)
      : await supabase.from('chemistry_lesson_blocks').insert(payload);
    if (result.error) setMessage(`Blocul nu a fost salvat: ${result.error.message}`);
    else { setBlockForm(null); if (selected) await loadBlocks(selected.id); }
    setSaving(false);
  };

  const deleteBlock = async (block: ChemistryLessonBlock) => {
    if (!window.confirm('Ștergi acest bloc din lecție?')) return;
    const { error } = await supabase.from('chemistry_lesson_blocks').delete().eq('id', block.id);
    if (error) setMessage(`Blocul nu a putut fi șters: ${error.message}`);
    else if (selected) await loadBlocks(selected.id);
  };

  const moveBlock = async (index: number, direction: -1 | 1) => {
    const other = index + direction;
    if (other < 0 || other >= blocks.length) return;
    await Promise.all([
      supabase.from('chemistry_lesson_blocks').update({ position: other }).eq('id', blocks[index].id),
      supabase.from('chemistry_lesson_blocks').update({ position: index }).eq('id', blocks[other].id),
    ]);
    if (selected) await loadBlocks(selected.id);
  };

  if (loading) return <div className="py-16 text-center text-stone-500"><Loader2 className="mx-auto mb-3 animate-spin" />Se încarcă lecțiile de chimie...</div>;

  if (selected) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button className="btn-ghost" onClick={() => { setSelected(null); setBlockForm(null); setPreview(false); }}><ArrowLeft size={17} /> Toate lecțiile</button>
          <button className="btn-secondary" onClick={() => setPreview((value) => !value)}>{preview ? <Edit2 size={16} /> : <Eye size={16} />}{preview ? 'Editează' : 'Previzualizare'}</button>
        </div>
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Lecție de chimie</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-stone-900">{selected.title}</h2>
          {selected.description && <p className="mt-2 text-stone-600">{selected.description}</p>}
        </div>
        {message && <div className="mb-5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">{message}</div>}
        {preview ? (
          <div className="mx-auto max-w-4xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="space-y-7">{blocks.map((block) => <ChemistryBlockRenderer key={block.id} block={block} />)}</div>
            {blocks.length === 0 && <p className="py-12 text-center text-stone-500">Lecția nu are încă niciun bloc.</p>}
          </div>
        ) : (
          <>
            {blockForm && <BlockEditor block={blockForm} setBlock={setBlockForm} saving={saving} onSave={saveBlock} onUpload={uploadImage} onCancel={() => setBlockForm(null)} />}
            {!blockForm && (
              <div className="mb-5 flex flex-wrap gap-2">
                {(Object.keys(blockLabels) as ChemistryBlockType[]).map((type) => (
                  <button key={type} className="btn-secondary !px-4 !py-2" onClick={() => setBlockForm({ ...emptyBlock(selected.id, blocks.length), block_type: type })}>
                    <Plus size={15} /> {blockLabels[type]}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {blocks.map((block, index) => (
                <div key={block.id} className="card flex gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <button className="rounded-lg p-1.5 hover:bg-stone-100 disabled:opacity-30" disabled={index === 0} onClick={() => void moveBlock(index, -1)} aria-label="Mută mai sus"><ArrowUp size={16} /></button>
                    <button className="rounded-lg p-1.5 hover:bg-stone-100 disabled:opacity-30" disabled={index === blocks.length - 1} onClick={() => void moveBlock(index, 1)} aria-label="Mută mai jos"><ArrowDown size={16} /></button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="badge bg-stone-100 text-stone-600">{blockLabels[block.block_type]}</span>
                    <div className="mt-3 max-h-52 overflow-hidden"><ChemistryBlockRenderer block={block} /></div>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <button className="rounded-lg p-2 text-brand-700 hover:bg-brand-50" onClick={() => setBlockForm(block)} aria-label="Editează"><Edit2 size={16} /></button>
                    <button className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => void deleteBlock(block)} aria-label="Șterge"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {blocks.length === 0 && <div className="card p-12 text-center text-stone-500"><Beaker className="mx-auto mb-3 text-stone-300" size={40} />Adaugă primul bloc al lecției.</div>}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-bold text-stone-900">Lecții teoretice de chimie</h2><p className="mt-1 text-sm text-stone-500">Creează și ordonează lecțiile. Elevii văd doar lecțiile publicate.</p></div>
        <button className="btn-primary" onClick={() => setLessonForm({ title: '', description: '' })}><Plus size={16} /> Lecție nouă</button>
      </div>
      {message && <div className="mb-5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">{message}</div>}
      {lessonForm && (
        <div className="card mb-6 p-5">
          <h3 className="font-bold text-stone-900">{lessonForm.id ? 'Editează lecția' : 'Lecție nouă'}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label><span className="label">Titlu</span><input className="input" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} placeholder="Exemplu: Alcani" /></label>
            <label><span className="label">Descriere scurtă</span><input className="input" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} placeholder="Ce va învăța elevul" /></label>
          </div>
          <div className="mt-4 flex gap-2"><button className="btn-primary" disabled={saving || !lessonForm.title.trim()} onClick={() => void saveLesson()}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvează</button><button className="btn-ghost" onClick={() => setLessonForm(null)}><X size={16} /> Renunță</button></div>
        </div>
      )}
      <div className="space-y-3">
        {lessons.map((lesson, index) => (
          <div key={lesson.id} className="card flex flex-wrap items-center gap-3 p-4">
            <div className="flex gap-1"><button className="rounded-lg p-1.5 hover:bg-stone-100 disabled:opacity-30" disabled={index === 0} onClick={() => void moveLesson(index, -1)}><ArrowUp size={16} /></button><button className="rounded-lg p-1.5 hover:bg-stone-100 disabled:opacity-30" disabled={index === lessons.length - 1} onClick={() => void moveLesson(index, 1)}><ArrowDown size={16} /></button></div>
            <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(lesson)}><p className="font-bold text-stone-900">{lesson.title}</p><p className="mt-1 truncate text-sm text-stone-500">{lesson.description || 'Fără descriere'}</p></button>
            <span className={`badge ${lesson.is_published ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-600'}`}>{lesson.is_published ? 'Publicată' : 'Ciornă'}</span>
            <button className="btn-ghost !px-3" onClick={() => void togglePublished(lesson)}>{lesson.is_published ? <EyeOff size={16} /> : <Eye size={16} />}{lesson.is_published ? 'Ascunde' : 'Publică'}</button>
            <button className="rounded-lg p-2 text-brand-700 hover:bg-brand-50" onClick={() => setLessonForm({ id: lesson.id, title: lesson.title, description: lesson.description })}><Edit2 size={16} /></button>
            <button className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => void deleteLesson(lesson)}><Trash2 size={16} /></button>
          </div>
        ))}
        {lessons.length === 0 && <div className="card p-12 text-center text-stone-500"><Beaker className="mx-auto mb-3 text-stone-300" size={42} /><p className="font-medium">Nu există lecții de chimie.</p><p className="mt-1 text-sm">Creează prima lecție din butonul de mai sus.</p></div>}
      </div>
    </div>
  );
}

function BlockEditor({ block, setBlock, saving, onSave, onUpload, onCancel }: {
  block: ChemistryLessonBlock; setBlock: (block: ChemistryLessonBlock) => void; saving: boolean;
  onSave: () => void; onUpload: (file: File) => void; onCancel: () => void;
}) {
  return (
    <div className="card mb-6 border-brand-200 p-5">
      <div className="flex items-center justify-between"><h3 className="font-bold text-stone-900">{block.id ? 'Editează blocul' : `Adaugă: ${blockLabels[block.block_type]}`}</h3><button className="rounded-lg p-2 hover:bg-stone-100" onClick={onCancel}><X size={18} /></button></div>
      <label className="mt-4 block"><span className="label">Tipul blocului</span><select className="input" value={block.block_type} onChange={(e) => setBlock({ ...block, block_type: e.target.value as ChemistryBlockType })}>{(Object.keys(blockLabels) as ChemistryBlockType[]).map((type) => <option key={type} value={type}>{blockLabels[type]}</option>)}</select></label>
      {block.block_type === 'list' ? (
        <label className="mt-4 block"><span className="label">Elementele listei, câte unul pe rând</span><textarea className="input min-h-40" value={block.items.join('\n')} onChange={(e) => setBlock({ ...block, items: e.target.value.split('\n') })} /></label>
      ) : block.block_type === 'image' ? (
        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 px-5 py-8 text-sm font-semibold text-stone-600 hover:border-brand-400 hover:bg-brand-50"><ImagePlus size={22} /> Alege imaginea din calculator<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUpload(file); }} /></label>
          {block.image_url && <img src={block.image_url} alt="Previzualizare" className="mx-auto max-h-64 rounded-xl border object-contain" />}
          <label><span className="label">Adresă imagine</span><input className="input" value={block.image_url} onChange={(e) => setBlock({ ...block, image_url: e.target.value })} placeholder="Se completează automat după încărcare" /></label>
          <div className="grid gap-4 md:grid-cols-2"><label><span className="label">Descriere pentru accesibilitate</span><input className="input" value={block.image_alt} onChange={(e) => setBlock({ ...block, image_alt: e.target.value })} /></label><label><span className="label">Text sub imagine</span><input className="input" value={block.caption} onChange={(e) => setBlock({ ...block, caption: e.target.value })} /></label></div>
        </div>
      ) : (
        <label className="mt-4 block"><span className="label">{block.block_type === 'formula' ? 'Formula (exemplu: CH3-CH2-OH + O2 → CO2 + H2O; pentru sarcină: Fe^3+)' : 'Conținut'}</span><textarea className="input min-h-32" value={block.content} onChange={(e) => setBlock({ ...block, content: e.target.value })} /></label>
      )}
      {block.block_type === 'note' && <label className="mt-4 block"><span className="label">Stilul casetei</span><select className="input" value={block.note_style} onChange={(e) => setBlock({ ...block, note_style: e.target.value as ChemistryLessonBlock['note_style'] })}><option value="info">De reținut</option><option value="important">Important</option><option value="example">Exemplu</option></select></label>}
      {block.block_type === 'formula' && <div className="mt-4"><span className="label">Previzualizare</span><ChemistryBlockRenderer block={block} /></div>}
      <div className="mt-5 flex gap-2"><button className="btn-primary" disabled={saving} onClick={onSave}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvează blocul</button><button className="btn-ghost" onClick={onCancel}>Renunță</button></div>
    </div>
  );
}

