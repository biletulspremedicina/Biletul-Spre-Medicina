import { useRef, useState } from 'react';
import { ExternalLink, Maximize2 } from 'lucide-react';

const VIEWER_URL = 'https://www.zygotebody.com';

export default function Biology3D() {
  const viewerRef = useRef<HTMLIFrameElement>(null);
  const [fullscreenError, setFullscreenError] = useState(false);

  const openFullscreen = async () => {
    setFullscreenError(false);
    try {
      if (!viewerRef.current?.requestFullscreen) throw new Error('Fullscreen unavailable');
      await viewerRef.current.requestFullscreen();
    } catch {
      setFullscreenError(true);
    }
  };

  return (
    <section aria-labelledby="biology-3d-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 id="biology-3d-title" className="text-3xl font-bold text-[#123e31] sm:text-4xl"
            style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>Biologie 3D</h1>
          <p className="mt-2 text-sm text-[#62766b]">Explorează corpul uman, straturile anatomice și denumirile structurilor.</p>
        </div>
        <button type="button" onClick={() => void openFullscreen()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#cfdfd5] bg-white px-4 py-3 text-sm font-semibold text-[#174b3d] transition-colors hover:bg-[#edf5f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3d]">
          <Maximize2 size={17} aria-hidden="true" /> Ecran complet
        </button>
      </div>
      {fullscreenError && (
        <p role="status" className="mb-3 text-sm text-[#62766b]">Ecranul complet nu este disponibil în acest browser. Poți folosi linkul de mai jos pentru a deschide vizualizatorul separat.</p>
      )}
      <div className="overflow-hidden rounded-2xl border border-[#dce8e1] bg-white shadow-sm">
        <iframe
          ref={viewerRef}
          src={VIEWER_URL}
          title="Zygote Body — corpul uman 3D, straturi anatomice și denumiri"
          width="1110"
          height="740"
          allow="fullscreen"
          allowFullScreen
          className="block w-full border-0 bg-white"
          style={{ height: 'clamp(480px, 74svh, 960px)' }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#62766b]">
        <p>Vizualizator extern: Zygote Body. Conținutul și funcțiile disponibile sunt gestionate de furnizor.</p>
        <a href={VIEWER_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-[#174b3d] underline underline-offset-4">
          Deschide separat <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
