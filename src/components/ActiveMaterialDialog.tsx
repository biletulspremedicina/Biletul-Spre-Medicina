import { useEffect, useRef } from 'react';
import { ArrowUpRight, BookOpenCheck } from 'lucide-react';
import type { ActiveMaterial } from '@/lib/activeMaterial';
import './ActiveMaterialDialog.css';

type Props = {
  material: ActiveMaterial | null;
  verificationError: boolean;
  onClose: () => void;
};

export default function ActiveMaterialDialog({ material, verificationError, onClose }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    buttonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        event.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="active-material-dialog__backdrop">
      <section className="active-material-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby="active-material-dialog-title" aria-describedby="active-material-dialog-description">
        <div className="active-material-dialog__icon"><BookOpenCheck size={26} strokeWidth={1.7} aria-hidden="true" /></div>
        <p className="active-material-dialog__eyebrow">{material?.section || 'Rezolvare'}</p>
        <h2 id="active-material-dialog-title">{verificationError ? 'Nu am putut verifica progresul' : 'Ai deja o rezolvare în desfășurare'}</h2>
        <p id="active-material-dialog-description" className="active-material-dialog__description">
          {verificationError ? (
            'Încearcă din nou în câteva momente. Nu am pornit un material nou, pentru a-ți păstra progresul.'
          ) : (
            <>„<strong>{material?.name}</strong>” este deja în desfășurare. Trimite răspunsurile de acolo înainte de a începe alt material.</>
          )}
        </p>
        <button ref={buttonRef} type="button" className="active-material-dialog__button" onClick={onClose}>
          Am înțeles <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
