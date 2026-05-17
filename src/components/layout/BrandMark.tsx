interface BrandMarkProps {
  size?: number;
}

export function BrandMark({ size = 24 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#FF5C1A" />
      <path
        d="M11 9h2.6v6.6L19 9h2.9l-5 6.4L22 23h-3.1l-3.9-5.8-1.4 1.7V23H11V9z"
        fill="#fff"
      />
    </svg>
  );
}
