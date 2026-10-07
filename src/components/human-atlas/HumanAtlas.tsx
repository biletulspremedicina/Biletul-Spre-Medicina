import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Layers3, Search, X, RotateCcw, RotateCw, Maximize2, Minimize2, Focus, ChevronLeft, ChevronRight } from 'lucide-react';
import AnatomyScene from './scene';
import { DEFAULT_VISIBLE, FEMALE_DEFAULT_VISIBLE, SYSTEMS, type Atlas, type Concept, type SceneState, type SystemId, type View } from './anatomy';
import './HumanAtlas.css';

type AtlasSex = 'male' | 'female';
const initialState = (sex: AtlasSex): SceneState => ({ explode: 0, visible: sex === 'female' ? FEMALE_DEFAULT_VISIBLE : DEFAULT_VISIBLE, selected: [], isolate: false, view: 'three-quarter', rotate: false, reset: 0 });
const labels: Record<SystemId, string> = {
  skeletal: 'Schelet', muscular: 'Mușchi', cardiac: 'Inimă', sensory: 'Organe de simț', arterial: 'Artere', venous: 'Vene', nervous: 'Sistem nervos', respiratory: 'Sistem respirator', digestive: 'Sistem digestiv', urinary: 'Sistem urinar', lymphatic: 'Sistem limfatic', endocrine: 'Sistem endocrin', reproductive: 'Sistem reproducător', pregnancy: 'Referință sarcină', integumentary: 'Suprafața corpului', connective: 'Țesut conjunctiv',
};
const ORGAN_SYSTEMS: SystemId[] = ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'];

export default function HumanAtlas() {
  const root = useRef<HTMLDivElement>(null);
  const [sex, setSex] = useState<AtlasSex>('male');
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [state, setState] = useState(() => initialState('male'));
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'layers' | 'search' | null>(null);
  const [chosen, setChosen] = useState<Concept | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const [controlCollapsed, setControlCollapsed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const modelRoot = sex === 'female' ? '/human-atlas/female-models' : '/human-atlas/models';
    const assetRevision = sex === 'female' ? '?v=2.1-aligned' : '';
    setAtlas(null); setError(''); setProgress(0); setChosen(null); setQuery(''); setState(initialState(sex));
    fetch(`${modelRoot}/atlas.json${assetRevision}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Nu s-a putut încărca atlasul.'); return response.json(); })
      .then((data: Atlas) => {
        if (controller.signal.aborted) return;
        if (!data.parts?.length || !data.chunks?.length || !data.concepts?.length) throw new Error('Datele atlasului sunt incomplete.');
        // Keep every geometry request on our own origin, in the imported asset folder.
        const localAsset = (path: string) => `${modelRoot}/${path.split('/').pop()}${assetRevision}`;
        setAtlas({ ...data, chunks: data.chunks.map(chunk => ({ ...chunk, url: localAsset(chunk.url), gzip: chunk.gzip ? localAsset(chunk.gzip) : undefined })) });
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Atlasul nu s-a putut încărca.'); });
    return () => controller.abort();
  }, [reload, sex]);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const parts = useMemo(() => new Map(atlas?.parts.map(part => [part.id, part])), [atlas]);
  const counts = useMemo(() => Object.fromEntries(SYSTEMS.map(system => [system.id, atlas?.parts.filter(part => part.system === system.id).length ?? 0])), [atlas]);
  const availableSystems = useMemo(() => SYSTEMS.filter(system => (counts[system.id] ?? 0) > 0), [counts]);
  const results = useMemo(() => {
    if (!atlas) return [];
    const term = query.trim().toLowerCase();
    return atlas.concepts.filter(concept => term ? concept.name.toLowerCase().includes(term) || concept.id.toLowerCase().includes(term) : ['heart', 'brain', 'liver', 'stomach', 'spleen', 'pancreas'].includes(concept.name.toLowerCase()))
      .sort((a, b) => a.name.length - b.name.length).slice(0, 80);
  }, [atlas, query]);
  const choose = (concept: Concept) => { setChosen(concept); setPanel(null); setState(current => ({ ...current, selected: concept.elements, isolate: false, rotate: false })); };
  const choosePart = (id: string) => { const part = parts.get(id); if (part) choose({ id: part.conceptId, name: part.name, elements: [id] }); };
  const showSystems = (visible: SystemId[]) => { setChosen(null); setState(current => ({ ...current, visible, selected: [], isolate: false })); };
  const reset = () => { setChosen(null); setPanel(null); setState(current => ({ ...initialState(sex), reset: current.reset + 1 })); };
  const toggleFullscreen = async () => {
    setNotice('');
    try { if (document.fullscreenElement === root.current) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else throw new Error(); }
    catch { setNotice('Ecranul complet nu este disponibil în acest browser.'); }
  };
  const selectedParts = state.selected.map(id => parts.get(id)).filter(part => !!part);
  const visibleCount = atlas?.parts.filter(part => state.isolate ? state.selected.includes(part.id) : state.visible.includes(part.system) || state.selected.includes(part.id)).length ?? 0;
  const hasExactSystems = (systems: SystemId[]) => state.visible.length === systems.length && systems.every(system => state.visible.includes(system));

  const toggleControl = () => {
    setControlCollapsed(current => !current);
    setState(current => ({ ...current, reset: current.reset + 1 }));
  };
  const selectSex = (nextSex: AtlasSex) => {
    if (nextSex === sex) return;
    setControlCollapsed(false);
    setPanel(null);
    setSex(nextSex);
  };

  return <section className={`human-atlas ${controlCollapsed ? 'is-control-collapsed' : ''}`} ref={root} aria-label="Biologie 3D — atlas anatomic">
    <div className="human-atlas__stage">
      {atlas && !error && <AnatomyScene atlas={atlas} state={{ ...state, inspectorOpen: !!chosen, controlCollapsed }} onSelect={choosePart} onProgress={setProgress} onError={setError} />}
      <header className="identity">
        <span>ATLAS ANATOMIC INTERACTIV</span>
        <h1 className="human-atlas__title" aria-label="Biologie 3D">
          <span>BIOLOGIE</span>
          <strong aria-hidden="true"><b>3</b><i>D</i></strong>
        </h1>
        <p>{atlas?.parts.length.toLocaleString('ro-RO') ?? (sex === 'female' ? '3.002' : '2.234')} structuri · {sex === 'female' ? 'HuBMAP + BodyParts3D' : 'BodyParts3D'}</p>
        <div className="human-atlas__sex-switch" role="group" aria-label="Model anatomic">
          <button type="button" aria-pressed={sex === 'male'} onClick={() => selectSex('male')}>Male</button>
          <button type="button" aria-pressed={sex === 'female'} onClick={() => selectSex('female')}>Female</button>
        </div>
      </header>
      <button type="button" className="human-atlas__control-launch" aria-label="Deschide controlul anatomic" onClick={() => setPanel('layers')}><Layers3 size={20} /></button>
      <aside className={`human-atlas__control ${panel === 'layers' || panel === 'search' ? 'is-open' : ''}`} aria-label="Control anatomic">
        <button type="button" className="human-atlas__control-toggle" aria-label={controlCollapsed ? 'Deschide controlul anatomic' : 'Ascunde controlul anatomic'} aria-expanded={!controlCollapsed} onClick={toggleControl}>
          {controlCollapsed ? <ChevronLeft size={18} strokeWidth={1.8} /> : <ChevronRight size={18} strokeWidth={1.8} />}
        </button>
        <div className="human-atlas__control-head">
          <span>CONTROL ANATOMIC</span>
          <div>
            <button type="button" aria-label="Caută o structură" aria-pressed={panel === 'search'} onClick={() => { setChosen(null); setPanel(panel === 'search' ? 'layers' : 'search'); }}><Search size={20} /></button>
            <button type="button" aria-label={fullscreen ? 'Ieși din ecran complet' : 'Ecran complet'} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button>
            <button type="button" className="human-atlas__control-close" aria-label="Închide controlul anatomic" onClick={() => setPanel(null)}><X size={19} /></button>
          </div>
        </div>

        {panel === 'search' ? <section className="human-atlas__search" aria-label="Căutare anatomică">
          <div className="human-atlas__heading"><h2>Caută o structură</h2><button type="button" aria-label="Închide căutarea" onClick={() => setPanel('layers')}><X size={18} /></button></div>
          <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Heart, femur, brain…" aria-label="Denumire anatomică sau cod FMA" />
          <p>Denumirile anatomice sunt cele originale, în engleză.</p>
          <div className="human-atlas__results">{results.map(concept => <button type="button" key={concept.id} onClick={() => choose(concept)}><span>{concept.name}</span><small>{concept.elements.length} piese</small></button>)}{atlas && results.length === 0 && <p>Nicio structură găsită.</p>}</div>
        </section> : <>
          <section className="human-atlas__systems-section">
            <div className="human-atlas__heading"><h2>Sisteme anatomice</h2></div>
            <div className="human-atlas__presets">
              <button type="button" aria-pressed={hasExactSystems(availableSystems.map(system => system.id))} onClick={() => showSystems(availableSystems.map(system => system.id))}>Toate</button>
              <button type="button" aria-pressed={hasExactSystems(['skeletal'])} onClick={() => showSystems(['skeletal'])}>Schelet</button>
              <button type="button" aria-pressed={hasExactSystems(ORGAN_SYSTEMS.filter(system => availableSystems.some(item => item.id === system)))} onClick={() => showSystems(ORGAN_SYSTEMS.filter(system => availableSystems.some(item => item.id === system)))}>Organe</button>
            </div>
            <div className="human-atlas__systems">{availableSystems.map(system => <div className="human-atlas__system" key={system.id}>
              <button type="button" title={`Arată doar: ${labels[system.id]}`} onClick={() => showSystems([system.id])}><i style={{ background: system.color }} />{labels[system.id]}<small>{counts[system.id]}</small></button>
              <label className="human-atlas__switch">
                <input type="checkbox" aria-label={`Afișează ${labels[system.id]}`} checked={state.visible.includes(system.id)} onChange={() => showSystems(state.visible.includes(system.id) ? state.visible.filter(id => id !== system.id) : [...state.visible, system.id])} />
                <span aria-hidden="true" />
              </label>
            </div>)}</div>
            <div className="human-atlas__layer-foot"><span>{visibleCount} vizibile</span><button type="button" onClick={() => showSystems([])}>Ascunde tot</button></div>
          </section>

          <section className="human-atlas__view-section">
            <div className="human-atlas__heading"><h2>Perspectivă</h2></div>
            <nav className="human-atlas__views" aria-label="Orientarea corpului">
              {(['three-quarter', 'front', 'side', 'back'] as View[]).map((view, index) => <button type="button" key={view} disabled={state.explode > .8 && view !== 'front'} aria-pressed={state.view === view} onClick={() => setState(current => ({ ...current, view, reset: current.reset + 1, rotate: false }))}>{['¾', 'Față', 'Profil', 'Spate'][index]}</button>)}
              <button type="button" aria-label="Rotire automată" aria-pressed={state.rotate} disabled={state.explode >= .4} onClick={() => setState(current => ({ ...current, rotate: !current.rotate }))}><RotateCw size={18} /></button>
              <button type="button" aria-label="Resetează corpul și straturile" onClick={reset}><RotateCcw size={18} /></button>
            </nav>
          </section>

          <section className="human-atlas__explode">
            <label htmlFor="anatomy-explode">Separă structurile <span>{Math.round(state.explode * 100)}%</span></label>
            <input id="anatomy-explode" type="range" min={0} max={100} value={Math.round(state.explode * 100)} style={{ '--atlas-range': `${Math.round(state.explode * 100)}%` } as CSSProperties} onChange={event => { const value = Number(event.target.value); setState(current => ({ ...current, explode: value / 100, view: value > 80 ? 'front' : current.view, rotate: false })); }} />
            <div><span>Corp asamblat</span><span>Piese separate</span></div>
          </section>
        </>}
      </aside>
      {chosen && <aside className="detail-sheet human-atlas__glass" aria-label="Structura selectată">
        <div className="human-atlas__heading"><span>{selectedParts[0] ? labels[selectedParts[0].system] : 'Structură'}</span><button type="button" aria-label="Închide detaliile" onClick={() => setChosen(null)}><X size={18} /></button></div>
        <h2>{chosen.name}</h2><p>{chosen.id} · {chosen.elements.length} piese selectate</p>
        {selectedParts.length > 1 && <div className="human-atlas__members">{selectedParts.slice(0, 50).map(part => <button type="button" key={part.id} onClick={() => choosePart(part.id)}>{part.name}</button>)}{selectedParts.length > 50 && <p>Și încă {selectedParts.length - 50} piese.</p>}</div>}
        <button className="human-atlas__primary" type="button" aria-pressed={state.isolate} onClick={() => setState(current => ({ ...current, isolate: !current.isolate, explode: 0, rotate: false }))}><Focus size={17} />{state.isolate ? 'Arată corpul' : 'Izolează structura'}</button>
        <button type="button" onClick={() => { setChosen(null); setState(current => ({ ...current, selected: [], isolate: false })); }}>Șterge selecția</button>
      </aside>}
      {progress < 100 && !error && <div className="human-atlas__loading human-atlas__glass" role="status"><strong>Se încarcă anatomia · {progress}%</strong><p>Prima încărcare descarcă aproximativ {sex === 'female' ? '52 MB' : '33 MB'}.</p><progress value={progress} max={100} /></div>}
      {error && <div className="human-atlas__loading human-atlas__glass" role="alert"><strong>Nu s-a putut încărca vizualizatorul 3D.</strong><p>{error}</p><button type="button" onClick={() => setReload(current => current + 1)}>Reîncearcă</button></div>}
      {notice && <p className="human-atlas__notice" role="status">{notice}</p>}
    </div>
  </section>;
}
