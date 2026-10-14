import { Loader2 } from 'lucide-react';

export default function Loading({ message = 'Se încarcă...' }: { message?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-stone-400">
      <Loader2 className="animate-spin" size={32} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
