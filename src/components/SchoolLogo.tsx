import { useState } from 'react';

declare global { interface Window { ALEXANDRIA_LOGO?: string } }

/**
 * The school's logo. Put the file at public/school-logo.png (a transparent PNG works best).
 * Until then a plain emblem is shown.
 */
export function SchoolLogo({ className = '' }: { className?: string }) {
  // a one-file build sets window.ALEXANDRIA_LOGO to the embedded logo, or to '' when there is none
  const src = typeof window !== 'undefined' && window.ALEXANDRIA_LOGO !== undefined ? window.ALEXANDRIA_LOGO : './school-logo.png';
  const [missing, setMissing] = useState(src === '');
  if (!missing) return <img src={src} alt="School logo" onError={() => setMissing(true)} className={className} draggable={false} />;
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Alexandria emblem" className={className}>
      <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.9" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <text x="100" y="128" textAnchor="middle" fontFamily="'DM Serif Display', Georgia, serif" fontSize="92" fill="currentColor">A</text>
    </svg>
  );
}
