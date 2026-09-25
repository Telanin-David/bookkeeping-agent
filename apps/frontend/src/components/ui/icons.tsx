interface IconProps {
  size?: number;
  className?: string;
}

export function MenuIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"
      className={className} aria-hidden="true"
    >
      <path d="M4 9h16M4 15h10" />
    </svg>
  );
}
