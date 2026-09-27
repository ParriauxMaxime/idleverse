const BODY_CLIP = "pm-body-clip";

function flower(x: number, y: number, scale: number): string {
  const petals = [0, 72, 144, 216, 288]
    .map((angle) => `<ellipse rx="4.2" ry="7" cy="-7" transform="rotate(${angle})"/>`)
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${scale})">${petals}<circle class="pm-decor-heart" r="3.4"/></g>`;
}

function rivets(points: [number, number][]): string {
  return points.map(([x, y]) => `<circle class="pm-rivet" cx="${x}" cy="${y}" r="2.8"/>`).join("");
}

const CERAMIC = `
  <g class="pm-decor pm-decor-ceramic" clip-path="url(#${BODY_CLIP})">
    ${flower(72, 104, 1)}${flower(122, 74, 0.72)}${flower(44, 72, 0.55)}${flower(150, 128, 0.6)}
    <path class="pm-decor-line" d="M26 124 q40 22 82 18 q44 -4 80 -26"/>
    <path class="pm-decor-line is-thin" d="M30 132 q40 22 80 18 q42 -4 76 -24"/>
  </g>`;

const METAL = `
  <g class="pm-decor pm-decor-metal" clip-path="url(#${BODY_CLIP})">
    <path class="pm-decor-line" d="M112 30 V160 M24 104 Q108 124 196 104"/>
    ${rivets([[104, 48], [104, 68], [104, 88], [104, 128], [104, 146], [44, 112], [66, 117], [150, 117], [172, 112]])}
  </g>`;

const ARMORED = `
  <g class="pm-decor pm-decor-armored" clip-path="url(#${BODY_CLIP})">
    <path class="pm-decor-line" d="M62 30 V160 M148 30 V160 M20 82 H200 M20 128 H200"/>
    ${rivets([[70, 90], [140, 90], [70, 120], [140, 120], [54, 74], [156, 74], [54, 136], [156, 136]])}
    <circle class="pm-dial" cx="105" cy="105" r="15"/>
    <path class="pm-dial-ticks" d="M105 92 v4 M118 105 h-4 M105 118 v-4 M92 105 h4"/>
    <path class="pm-dial-handle" d="M105 105 l7 -7"/>
  </g>`;

const GOLD = `
  <g class="pm-decor pm-decor-gold" clip-path="url(#${BODY_CLIP})">
    <path class="pm-decor-line" d="M36 128 q12 -16 26 -4 q12 10 24 -4 q12 -14 26 -2 q12 10 24 -2 q10 -8 20 0"/>
    <path class="pm-decor-line is-thin" d="M40 60 q16 -12 32 -2 q14 8 26 -2"/>
    <text class="pm-decor-text" x="84" y="104">24K</text>
  </g>`;

const GODFATHER = `
  <g class="pm-decor pm-decor-godfather">
    <path class="pm-pinstripes" clip-path="url(#${BODY_CLIP})"
      d="M36 20 V170 M54 20 V170 M72 20 V170 M90 20 V170 M108 20 V170 M126 20 V170 M144 20 V170 M162 20 V170 M180 20 V170"/>
    <circle class="pm-rose" cx="86" cy="66" r="6"/>
    <path class="pm-rose-leaf" d="M86 72 q-6 6 -2 12"/>
    <path class="pm-brow" d="M148 70 l22 6"/>
    <path class="pm-cigar" d="M188 124 l24 7"/>
    <circle class="pm-cigar-tip" cx="213" cy="131.3" r="2.6"/>
    <g class="pm-hat">
      <path class="pm-hat-crown" d="M124 48 q-2 -32 28 -34 q30 2 28 34 z"/>
      <path class="pm-hat-dent" d="M140 22 q12 8 24 0"/>
      <rect class="pm-hat-band" x="124" y="38" width="56" height="8"/>
      <ellipse class="pm-hat-brim" cx="152" cy="49" rx="46" ry="7"/>
    </g>
  </g>`;

export const PIG_SVG = `
<svg class="pm-pig-art" viewBox="-6 0 232 180" aria-hidden="true">
  <defs>
    <clipPath id="${BODY_CLIP}">
      <ellipse cx="108" cy="96" rx="82" ry="60"/>
      <ellipse cx="188" cy="104" rx="17" ry="21"/>
    </clipPath>
    <radialGradient id="pm-body-shading" cx="0.36" cy="0.28" r="0.85">
      <stop offset="0" class="pm-stop-light"/>
      <stop offset="0.5" class="pm-stop-body"/>
      <stop offset="1" class="pm-stop-shade"/>
    </radialGradient>
  </defs>
  <ellipse class="pm-floor-shadow" cx="112" cy="166" rx="80" ry="8"/>
  <g class="pm-legs is-back">
    <rect x="76" y="124" width="18" height="36" rx="6"/>
    <rect x="150" y="124" width="18" height="36" rx="6"/>
  </g>
  <g class="pm-legs">
    <rect x="56" y="128" width="21" height="36" rx="7"/>
    <rect x="130" y="128" width="21" height="36" rx="7"/>
  </g>
  <path class="pm-tail" d="M28 94 c-12 -2 -16 -14 -8 -20 c7 -5 14 2 9 8 c-4 5 -12 3 -14 -2"/>
  <path class="pm-ear is-back" d="M136 48 L142 20 L162 44 Z"/>
  <ellipse class="pm-body" cx="108" cy="96" rx="82" ry="60"/>
  ${CERAMIC}${METAL}${ARMORED}${GOLD}
  <rect class="pm-slot" x="82" y="39" width="46" height="7" rx="3.5" transform="rotate(-5 105 42)"/>
  <ellipse class="pm-gloss" cx="74" cy="66" rx="30" ry="11" transform="rotate(-20 74 66)"/>
  <ellipse class="pm-snout" cx="188" cy="104" rx="16" ry="20"/>
  <ellipse class="pm-nostril" cx="183" cy="100" rx="2.6" ry="4.4"/>
  <ellipse class="pm-nostril" cx="193" cy="100" rx="2.6" ry="4.4"/>
  <path class="pm-ear" d="M148 52 L160 22 L180 56 Z"/>
  <circle class="pm-eye" cx="160" cy="82" r="5"/>
  <g class="pm-cracks" clip-path="url(#${BODY_CLIP})">
    <path class="pm-crack" data-level="1" d="M98 38 l6 14 l-8 10 l10 12 l-4 8"/>
    <path class="pm-crack" data-level="2" d="M168 124 l-14 -8 l-4 -14 l-14 -4 l-6 -10"/>
    <path class="pm-crack" data-level="3" d="M30 90 l18 4 l8 -12 l14 8 l4 18 l12 4"/>
    <g class="pm-crack" data-level="4">
      <path class="pm-hole" d="M104 104 l16 -8 l14 8 l-2 16 l-16 8 l-14 -10 z"/>
      <circle class="pm-hole-coin" cx="118" cy="114" r="6"/>
      <path d="M120 96 l6 -16 l14 -4 M134 104 l18 2 l8 14 M104 118 l-12 12 l-16 2 M104 104 l-18 -6"/>
    </g>
  </g>
  ${GODFATHER}
</svg>`;

export const MINI_PIG_SVG = `
<svg class="pm-mini-pig" viewBox="0 0 64 48" aria-hidden="true">
  <rect x="17" y="32" width="7" height="12" rx="2.5"/>
  <rect x="36" y="32" width="7" height="12" rx="2.5"/>
  <path d="M38 14 l5 -10 l7 12 z"/>
  <ellipse cx="30" cy="26" rx="22" ry="16"/>
  <ellipse cx="53" cy="28" rx="6" ry="7"/>
  <rect class="pm-mini-slot" x="22" y="11" width="13" height="3" rx="1.5"/>
</svg>`;
