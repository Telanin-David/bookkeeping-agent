import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The home page's art, drawn as vector shapes so it's sharp and light on data. The language
 * comes from the logo's bee: honeycomb, a bee's flight path, and honey-gold light on deep green.
 */

/** A field of honeycomb outlines. */
export function Honeycomb({ className, stroke = 'currentColor', id = 'hex' }: { className?: string; stroke?: string; id?: string }) {
  return (
    <svg aria-hidden className={cn('pointer-events-none', className)} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={id} width="56" height="97" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
          <path d="M28 0 L56 16.2 L56 48.5 L28 64.7 L0 48.5 L0 16.2 Z M28 64.7 L28 97" fill="none" stroke={stroke} strokeWidth="1" />
          <path d="M0 48.5 L-28 64.7 M56 48.5 L84 64.7" fill="none" stroke={stroke} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Fine film grain over a dark section: gives flat colour some texture. */
export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay', className)}
      style={{
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

/** A small bee, readable on light and dark: yellow body, dark stripes, pale wings. */
export function Bee({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 64 48" className={cn(className, flip && '-scale-x-100')} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="27" cy="13" rx="11" ry="8" transform="rotate(-25 27 13)" fill="#F7F8F4" fillOpacity="0.92" stroke="#111713" strokeOpacity="0.35" strokeWidth="1.2" />
      <ellipse cx="38" cy="12" rx="10" ry="7" transform="rotate(20 38 12)" fill="#F7F8F4" fillOpacity="0.85" stroke="#111713" strokeOpacity="0.35" strokeWidth="1.2" />
      <ellipse cx="32" cy="29" rx="17" ry="11" fill="#F5C928" />
      <rect x="24" y="18.6" width="5" height="20.8" rx="2.5" fill="#111713" />
      <rect x="34" y="18.4" width="5" height="21.2" rx="2.5" fill="#111713" />
      <ellipse cx="32" cy="29" rx="17" ry="11" fill="none" stroke="#111713" strokeWidth="1.6" />
      <path d="M15.5 29 L10 30.5 L15.5 32" fill="#111713" />
      <circle cx="50" cy="27" r="6.5" fill="#111713" />
      <circle cx="52" cy="25.5" r="1.6" fill="#F7F8F4" />
      <path d="M50 21 C51 15 54 13 57 12 M53 22 C56 18 59 18 61 18" fill="none" stroke="#111713" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A bee's dotted flight path, with the bee at the end of it. */
export function FlightPath({ d, viewBox, className, beeAt, beeSize = 44, stroke = '#F5C928', flipBee }: {
  d: string; viewBox: string; className?: string; beeAt: [number, number]; beeSize?: number; stroke?: string; flipBee?: boolean;
}) {
  const [x, y] = beeAt;
  return (
    <svg aria-hidden viewBox={viewBox} className={cn('pointer-events-none overflow-visible', className)} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={d} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 9" className="landing-flight" />
      <foreignObject x={x - beeSize / 2} y={y - beeSize / 2} width={beeSize} height={beeSize * 0.75} className="overflow-visible">
        <Bee className="h-full w-full landing-buzz" flip={flipBee} />
      </foreignObject>
    </svg>
  );
}

/** A hand-drawn style swash under a word. */
export function Swash({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 300 24" preserveAspectRatio="none" className={cn('pointer-events-none', className)} fill="none">
      <path d="M4 15 C 60 6, 130 4, 200 8 S 280 14, 296 9" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

/** A hexagon with an icon inside. */
export function HexBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('relative inline-flex h-14 w-[52px] shrink-0 items-center justify-center', className)}>
      <svg aria-hidden viewBox="0 0 52 56" className="absolute inset-0 h-full w-full">
        <path d="M26 2 L49 15 L49 41 L26 54 L3 41 L3 15 Z" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** Amaka's shop: a market kiosk with its awning, shelves, and a phone on the counter. */
export function MarketStall({ className }: { className?: string }) {
  const stripes = Array.from({ length: 12 }, (_, i) => i);
  return (
    <svg viewBox="0 0 520 400" className={cn('overflow-visible', className)} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration: a provisions kiosk with a phone on the counter and a bee flying past">
      <defs>
        <linearGradient id="ms-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F5C928" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F5C928" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ms-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E4A30" />
          <stop offset="1" stopColor="#0A3524" />
        </linearGradient>
        <clipPath id="ms-awning"><rect x="40" y="96" width="440" height="58" rx="6" /></clipPath>
      </defs>

      {/* Ground and light */}
      <ellipse cx="260" cy="372" rx="230" ry="16" fill="#000" opacity="0.28" />
      <circle cx="260" cy="210" r="190" fill="url(#ms-glow)" opacity="0.35" />

      {/* Sign board */}
      <rect x="120" y="44" width="280" height="44" rx="10" fill="#111713" />
      <rect x="120" y="44" width="280" height="44" rx="10" fill="none" stroke="#F5C928" strokeOpacity="0.5" strokeWidth="2" />
      <text x="260" y="73" textAnchor="middle" fontFamily="'Bricolage Grotesque Variable', system-ui, sans-serif" fontWeight="700" fontSize="21" fill="#F7F8F4" letterSpacing="-0.3">Amaka Provisions</text>
      <rect x="150" y="88" width="6" height="12" fill="#111713" />
      <rect x="364" y="88" width="6" height="12" fill="#111713" />

      {/* Kiosk */}
      <rect x="62" y="140" width="396" height="212" rx="8" fill="url(#ms-wall)" />
      <rect x="92" y="160" width="336" height="118" rx="6" fill="#072A1C" />

      {/* Top shelf: sacks of rice and semovita */}
      <rect x="92" y="214" width="336" height="5" fill="#13573A" />
      {[104, 150, 196].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 214 C ${x - 3} 190, ${x + 3} 176, ${x + 8} 172 L ${x + 32} 172 C ${x + 37} 176, ${x + 43} 190, ${x + 40} 214 Z`} fill={i === 1 ? '#EFE6CF' : '#E6DABB'} />
          <path d={`M${x + 8} 172 C ${x + 14} 167, ${x + 26} 167, ${x + 32} 172`} fill="none" stroke="#B9A87F" strokeWidth="2" />
          <rect x={x + 9} y="188" width="22" height="12" rx="2" fill={i === 1 ? '#147A45' : '#C9472F'} opacity="0.85" />
        </g>
      ))}
      {/* Kegs of oil */}
      {[262, 300].map((x) => (
        <g key={x}>
          <rect x={x} y="178" width="30" height="36" rx="5" fill="#F5C928" />
          <rect x={x + 18} y="172" width="8" height="8" rx="2" fill="#E0A814" />
          <rect x={x + 5} y="192" width="20" height="10" rx="2" fill="#F7F8F4" opacity="0.8" />
        </g>
      ))}
      {/* Milk tins */}
      {[346, 366, 386, 406].map((x, i) => (
        <g key={x}>
          <rect x={x} y={i % 2 ? 190 : 194} width="16" height={i % 2 ? 24 : 20} rx="3" fill="#F7F8F4" />
          <rect x={x} y={i % 2 ? 196 : 199} width="16" height="7" fill="#2F6FB5" />
        </g>
      ))}

      {/* Bottom shelf: cartons */}
      <rect x="92" y="270" width="336" height="5" fill="#13573A" />
      {[
        [102, '#E8A317'], [150, '#C9472F'], [198, '#E8A317'], [246, '#4DA569'], [294, '#C9472F'], [342, '#E8A317'], [384, '#4DA569'],
      ].map(([x, c], i) => (
        <g key={i}>
          <rect x={x as number} y={i % 3 === 1 ? 236 : 240} width="40" height={i % 3 === 1 ? 34 : 30} rx="3" fill={c as string} />
          <rect x={(x as number) + 6} y={i % 3 === 1 ? 246 : 249} width="28" height="7" rx="1.5" fill="#F7F8F4" opacity="0.75" />
        </g>
      ))}

      {/* Awning */}
      <g clipPath="url(#ms-awning)">
        {stripes.map((i) => (
          <rect key={i} x={40 + i * 37} y="96" width="37" height="58" fill={i % 2 ? '#F7F8F4' : '#F5C928'} />
        ))}
      </g>
      <path d={`M40 150 ${stripes.map(() => 'q 18.5 22 37 0').join(' ')}`} fill="#F5C928" />
      <path d={`M40 150 ${stripes.map(() => 'q 18.5 22 37 0').join(' ')}`} fill="none" stroke="#111713" strokeOpacity="0.12" strokeWidth="2" />
      {stripes.filter((i) => i % 2).map((i) => (
        <path key={i} d={`M${40 + i * 37} 150 q 18.5 22 37 0 Z`} fill="#F7F8F4" />
      ))}

      {/* Counter */}
      <rect x="50" y="290" width="420" height="16" rx="4" fill="#F7F8F4" />
      <rect x="62" y="306" width="396" height="46" fill="#147A45" />
      <rect x="62" y="306" width="396" height="46" fill="#000" opacity="0.08" />
      <path d="M62 322 H458" stroke="#0E5A34" strokeWidth="2" />

      {/* Phone on the counter, with a reply above it */}
      <g>
        <rect x="300" y="244" width="40" height="48" rx="7" fill="#111713" />
        <rect x="304" y="249" width="32" height="38" rx="4" fill="#0B3826" />
        <rect x="308" y="256" width="20" height="4" rx="2" fill="#4DA569" />
        <rect x="308" y="264" width="24" height="4" rx="2" fill="#F7F8F4" opacity="0.7" />
        <rect x="308" y="272" width="16" height="4" rx="2" fill="#F5C928" />
      </g>
      <g className="landing-float">
        <rect x="324" y="186" width="150" height="46" rx="14" fill="#F7F8F4" />
        <path d="M344 231 l-6 12 l16 -12 Z" fill="#F7F8F4" />
        <circle cx="344" cy="209" r="10" fill="#147A45" />
        <path d="M339 209 l3.5 3.5 l6.5 -7" stroke="#F7F8F4" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="362" y="205" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="600" fill="#111713">Recorded</text>
        <text x="362" y="220" fontFamily="system-ui, sans-serif" fontSize="11" fill="#111713" fillOpacity="0.6">₦164,000 · rice</text>
      </g>

      {/* The bee and its path */}
      <path d="M40 120 C 10 60, 90 10, 150 30 S 230 10, 250 -4" fill="none" stroke="#F5C928" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" opacity="0.8" />
      <foreignObject x="236" y="-26" width="48" height="36" className="overflow-visible">
        <Bee className="h-full w-full landing-buzz" />
      </foreignObject>
    </svg>
  );
}
