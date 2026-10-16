// Personajes originales de Farmacia Umbrella (no son personajes de ninguna franquicia).
const Cruz = () => (
  <g>
    <rect x="86" y="196" width="26" height="26" rx="6" fill="#0f150b" />
    <path d="M99 201v16M91 209h16" stroke="#91c837" strokeWidth="4" strokeLinecap="round" />
  </g>
);

export function FarmaceuticoA({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 300" aria-hidden="true">
      <path d="M20 300c0-62 30-100 80-100s80 38 80 100z" fill="#f4f6ee" />
      <path d="M100 200l-26 40-18-30 44-26z M100 200l26 40 18-30-44-26z" fill="#dfe6d0" />
      <path d="M100 200v100" stroke="#c9d3b5" strokeWidth="2" />
      <rect x="86" y="170" width="28" height="36" rx="8" fill="#e2b48f" />
      <ellipse cx="100" cy="120" rx="44" ry="52" fill="#edc3a0" />
      <path d="M54 112c-4-52 28-70 52-66 30 4 42 30 38 66-10-22-26-30-48-30-22 0-36 10-42 30z" fill="#4a3322" />
      <rect x="64" y="112" width="30" height="22" rx="8" fill="none" stroke="#0f150b" strokeWidth="3" />
      <rect x="106" y="112" width="30" height="22" rx="8" fill="none" stroke="#0f150b" strokeWidth="3" />
      <path d="M94 122h12" stroke="#0f150b" strokeWidth="3" />
      <path d="M86 156q14 10 28 0" stroke="#8a4b3a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Cruz />
    </svg>
  );
}

export function FarmaceuticoB({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 300" aria-hidden="true">
      <path d="M10 300c0-66 36-104 90-104s90 38 90 104z" fill="#f4f6ee" />
      <path d="M100 196l-30 44-20-34 50-24z M100 196l30 44 20-34-50-24z" fill="#dfe6d0" />
      <rect x="84" y="166" width="32" height="38" rx="9" fill="#c98f6b" />
      <ellipse cx="100" cy="118" rx="46" ry="52" fill="#d9a07c" />
      <path d="M52 118c-8-58 30-80 56-74 34 6 44 40 40 74-6-30-20-42-48-42-26 0-40 14-48 42z" fill="#1c1410" />
      <path d="M62 112h76v8H62z" fill="#91c837" opacity=".9" />
      <rect x="66" y="126" width="68" height="6" rx="3" fill="#0f150b" opacity=".0" />
      <circle cx="82" cy="130" r="4" fill="#1c1410" />
      <circle cx="118" cy="130" r="4" fill="#1c1410" />
      <path d="M84 154q16 12 32 0" stroke="#7a3b2e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M130 168h30v34h-30z" fill="#e8ecd9" stroke="#c9d3b5" />
      <Cruz />
    </svg>
  );
}
