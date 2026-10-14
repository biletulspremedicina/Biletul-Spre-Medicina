import { useEffect, useState } from 'react';
import { BookOpen, Crown, FileText, GraduationCap } from 'lucide-react';

function MaterialSectionVisual({ label }: { label: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [label]);

  const visual = label === 'Antrenament pe capitole'
    ? { src: '/Capitole.png', size: 32, fallback: <GraduationCap size={28} /> }
    : label === 'Simulări biologie'
      ? { src: '/Simularibiologie.png', size: 32, fallback: <FileText size={28} /> }
      : label === 'Examene UMFCD'
        ? { src: '/UMFCD.png', size: 36, fallback: <Crown size={28} /> }
        : { src: '', size: 28, fallback: <BookOpen size={28} className="text-[#70e0b8]" strokeWidth={1.8} /> };

  if (!visual.src || imageFailed) return visual.fallback;
  return <img src={visual.src} alt="" width={visual.size} height={visual.size}
    className="max-w-none shrink-0 object-contain" onError={() => setImageFailed(true)} draggable={false} />;
}

export default function MaterialLocationCard({ section, name }: { section: string; name: string }) {
  return (
    <div className="rounded-[14px] border border-white/15 bg-white/[0.08] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex min-w-0 items-center justify-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <MaterialSectionVisual label={section} />
        </span>
        <p className="min-w-0 text-[15px] font-semibold leading-tight text-white sm:text-[17px]">
          {section}
        </p>
      </div>
      <div className="mx-auto my-2.5 h-px w-4/5 bg-white/15" />
      <p className="break-words text-center text-[clamp(17px,1.4vw,22px)] font-bold leading-tight text-white"
        style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>
        {name}
      </p>
    </div>
  );
}
