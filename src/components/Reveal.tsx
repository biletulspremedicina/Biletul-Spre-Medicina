import { useState } from 'react';

type Props = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

export default function Reveal({ children, delay = 0, className = '' }: Props) {
  const [shown, setShown] = useState(false);

  return (
    <div
      ref={(el) => {
        if (!el || shown) return;
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setShown(true);
              observer.disconnect();
            }
          },
          { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );
        observer.observe(el);
      }}
      className={`${className} transition-all duration-700 ease-out ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
