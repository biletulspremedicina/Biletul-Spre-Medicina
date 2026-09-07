type Props = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
};

export default function Logo({ size = 'md', className = '' }: Props) {
  const sizeClass =
    size === 'sm'
      ? 'h-10'
      : size === 'lg'
        ? 'h-16'
        : 'h-12';

  return (
    <a
      href="/"
      aria-label="Biletul spre Medicină"
      className={`inline-flex flex-shrink-0 items-center transition-transform duration-200 hover:scale-[1.02] ${sizeClass} ${className}`}
    >
      <img
        src="/Logo_final.png"
        alt="Biletul spre Medicină"
        className="h-full w-auto object-contain object-center"
      />
    </a>
  );
}
