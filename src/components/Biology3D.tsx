import { lazy, Suspense } from 'react';

const HumanAtlas = lazy(() => import('./human-atlas/HumanAtlas'));

export default function Biology3D() {
  return <Suspense fallback={<p role="status" className="p-8 text-center text-[#174b3d]">Se pregătește Biologie 3D…</p>}>
    <HumanAtlas />
  </Suspense>;
}
