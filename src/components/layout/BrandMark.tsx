interface BrandMarkProps {
  size?: number;
  /**
   * Optional shadow under the mark (only meaningful on dark backgrounds).
   * Defaults off; the splash + onboarding screens turn it on.
   */
  glow?: boolean;
}

/**
 * Pindrapp brand mark — the orange tile with the white pin and dot.
 * Renders the canonical PNG (public/pindrapp-logo.png) at the requested size
 * so the in-app logo matches PWA icons and the favicon pixel-for-pixel.
 */
export function BrandMark({ size = 24, glow = false }: BrandMarkProps) {
  return (
    <img
      src="/pindrapp-logo.png"
      alt="Pindrapp"
      width={size}
      height={size}
      draggable={false}
      style={{
        display: 'block',
        width: size,
        height: size,
        // The source already has rounded corners + bleed; clip with the
        // matching radius so it stays crisp at all sizes.
        borderRadius: Math.round(size * 0.22),
        objectFit: 'cover',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        filter: glow ? 'drop-shadow(0 8px 22px rgba(255, 92, 26, 0.4))' : undefined,
      }}
    />
  );
}
