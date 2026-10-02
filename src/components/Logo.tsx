type Props = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  linked?: boolean;
  tone?: 'light' | 'inverse';
};

export default function Logo({ size = 'md', className = '', showText = false, linked = true, tone = 'light' }: Props) {
  const sizeClass =
    size === 'sm'
      ? 'h-10'
      : size === 'lg'
        ? 'h-16'
        : 'h-12';

  const content = showText ? (
    <>
      <img
        src="/Logo_final.png"
        alt=""
        className="block h-11 w-16 shrink-0 object-contain"
      />
      <span className="flex select-none flex-col font-sans text-[13px] font-extrabold uppercase leading-[1.08] tracking-[0.025em]">
        <span>Biletul</span>
        <span>Spre</span>
        <span className={`font-black ${tone === 'inverse' ? 'text-[#8bd6ad]' : 'brand-lockup__medicine text-brand-600'}`}>Medicină</span>
      </span>
    </>
  ) : (
    <img src="/Logo_final.png" alt="Biletul spre Medicină" className="h-full w-auto object-contain object-center" />
  );

  const layoutClass = showText
    ? `brand-lockup inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap ${tone === 'inverse' ? 'brand-lockup--inverse text-white' : 'text-[#152b27]'}`
    : `inline-flex flex-shrink-0 items-center ${sizeClass}`;

  if (!linked) return <span className={`${layoutClass} ${className}`}>{content}</span>;

  return <a href="/" aria-label="Biletul spre Medicină" className={`${layoutClass} transition-transform duration-200 hover:scale-[1.02] ${className}`}>{content}</a>;
}
