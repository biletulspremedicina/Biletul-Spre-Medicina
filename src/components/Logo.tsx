type Props = {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
};

export default function Logo({ size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'h-14 w-56' : size === 'lg' ? 'h-20 w-80' : 'h-16 w-64';

  return (
    <a
      href="/"
      aria-label="Biletul spre Medicină"
      className={`inline-flex ${sizeClass} items-center transition-transform duration-200 hover:scale-[1.02]`}
    >
      <img
        src="/image copy 3.png"
        alt="Biletul spre Medicină"
        className="h-full w-full object-contain object-left"
      />
    </a>
  );
}
