// Hand-drawn scrapbook flowers. Decorative only (aria-hidden). Colors come
// from the existing token set; rotation/scale set per instance via CSS.
export default function FlowerDoodle({ className = "", color = "var(--red)" }: { className?: string; color?: string }) {
  return (
    <svg className={`flower-doodle ${className}`} viewBox="0 0 60 84" fill="none" aria-hidden="true">
      <g stroke={color} strokeWidth="2.4" strokeLinecap="round">
        <path d="M30 34 C 28 52, 30 66, 29 81" />
        <path d="M29 58 C 22 55, 17 57, 13 62 C 20 63, 26 62, 29 58 Z" />
        <path d="M30 66 C 37 63, 43 65, 47 70 C 40 71, 33 70, 30 66 Z" />
        <ellipse cx="30" cy="18" rx="6" ry="10" />
        <ellipse cx="30" cy="18" rx="6" ry="10" transform="rotate(72 30 26)" />
        <ellipse cx="30" cy="18" rx="6" ry="10" transform="rotate(144 30 26)" />
        <ellipse cx="30" cy="18" rx="6" ry="10" transform="rotate(216 30 26)" />
        <ellipse cx="30" cy="18" rx="6" ry="10" transform="rotate(288 30 26)" />
        <circle cx="30" cy="26" r="4.5" />
      </g>
    </svg>
  );
}
