import type { Suit } from "./config";

/** Crisp classic suits, referenced by every pip through <use>. */
export const SUIT_SPRITE = `
<svg class="bj-sprite" aria-hidden="true" width="0" height="0">
  <defs>
    <symbol id="bj-suit-hearts" viewBox="0 0 100 100">
      <path d="M50 92C22 66 4 50 4 29 4 14 15 4 29 4c10 0 17 6 21 15 4-9 11-15 21-15 14 0 25 10 25 25 0 21-18 37-46 63z"/>
    </symbol>
    <symbol id="bj-suit-diamonds" viewBox="0 0 100 100">
      <path d="M50 2 88 50 50 98 12 50z"/>
    </symbol>
    <symbol id="bj-suit-spades" viewBox="0 0 100 100">
      <path d="M50 3C60 22 95 38 95 61c0 14-10 23-23 23-9 0-15-5-18-11 1 10 4 18 12 24H34c8-6 11-14 12-24-3 6-9 11-18 11C15 84 5 75 5 61 5 38 40 22 50 3z"/>
    </symbol>
    <symbol id="bj-suit-clubs" viewBox="0 0 100 100">
      <circle cx="50" cy="27" r="21"/>
      <circle cx="26" cy="58" r="21"/>
      <circle cx="74" cy="58" r="21"/>
      <path d="M45 50h10c0 20 3 33 12 47H33c9-14 12-27 12-47z"/>
    </symbol>
  </defs>
</svg>`;

export function suitIcon(suit: Suit, className = "bj-suit"): string {
  return `<svg class="${className}" viewBox="0 0 100 100" aria-hidden="true"><use href="#bj-suit-${suit}"/></svg>`;
}

const LEFT = 30;
const CENTER = 50;
const RIGHT = 70;

/** Pip positions in percent of the card face, for ranks 2 to 10. */
export const PIP_LAYOUTS: Record<number, [number, number][]> = {
  2: [[CENTER, 18], [CENTER, 82]],
  3: [[CENTER, 18], [CENTER, 50], [CENTER, 82]],
  4: [[LEFT, 18], [RIGHT, 18], [LEFT, 82], [RIGHT, 82]],
  5: [[LEFT, 18], [RIGHT, 18], [CENTER, 50], [LEFT, 82], [RIGHT, 82]],
  6: [[LEFT, 18], [RIGHT, 18], [LEFT, 50], [RIGHT, 50], [LEFT, 82], [RIGHT, 82]],
  7: [[LEFT, 18], [RIGHT, 18], [CENTER, 34], [LEFT, 50], [RIGHT, 50], [LEFT, 82], [RIGHT, 82]],
  8: [[LEFT, 18], [RIGHT, 18], [CENTER, 34], [LEFT, 50], [RIGHT, 50], [CENTER, 66], [LEFT, 82], [RIGHT, 82]],
  9: [[LEFT, 18], [RIGHT, 18], [LEFT, 39], [RIGHT, 39], [CENTER, 50], [LEFT, 61], [RIGHT, 61], [LEFT, 82], [RIGHT, 82]],
  10: [[LEFT, 18], [RIGHT, 18], [CENTER, 29], [LEFT, 39], [RIGHT, 39], [LEFT, 61], [RIGHT, 61], [CENTER, 71], [LEFT, 82], [RIGHT, 82]],
};

function glove(x: number, flip: boolean): string {
  const mirror = flip ? `translate(${x * 2} 0) scale(-1 1)` : "";
  return `
  <g class="bj-glove" transform="${mirror}">
    <rect class="bj-cuff" x="${x - 17}" y="80" width="30" height="13" rx="3" transform="rotate(-14 ${x} 86)"/>
    <path class="bj-glove-hand" d="M${x - 10} 90c-2 8 0 16 7 19 5 2 14 2 22 0 5-1 10-3 15-2 4 1 5-3 1-5-5-2-11-2-15-2 6-1 16-1 20-3 3-2 1-5-2-5l-21 1c5-2 13-5 16-8 2-2 0-5-3-4l-19 7c3-3 7-7 7-10 0-2-3-3-5-1-6 5-14 9-23 13z"/>
    <path class="bj-glove-stitch" d="M${x + 1} 97l14-3M${x + 2} 101l15-2M${x + 2} 105l14-1"/>
  </g>`;
}

function chipColumn(x: number, tone: string, height: number): string {
  const top = 108 - height;
  const lines = Array.from({ length: Math.floor(height / 3) }, (_, i) => `M${x} ${top + 3 + i * 3}h12`).join("");
  return `<rect class="bj-tray-chips is-${tone}" x="${x}" y="${top}" width="12" height="${height}" rx="1.5"/><path class="bj-tray-lines" d="${lines}"/>`;
}

/** The croupier seen from the player's seat: tuxedo, bow tie, white gloves resting beside the chip tray. */
export const CROUPIER_SVG = `
<svg class="bj-croupier" viewBox="0 0 360 118" role="img" aria-label="Le croupier, nœud papillon et gants blancs">
  <path class="bj-jacket" d="M78 0h204l10 50 6 42H62l6-42z"/>
  <path class="bj-shirt" d="M150 0h60l-30 66z"/>
  <path class="bj-lapel" d="M150 0l30 66-22-2-24-64zM210 0l-30 66 22-2 24-64z"/>
  <path class="bj-studs" d="M180 30v.1M180 42v.1M180 54v.1"/>
  <path class="bj-bowtie" d="M180 13l-19-9c-3-1-5 1-5 4v12c0 3 2 5 5 4l19-9 19 9c3 1 5-1 5-4V8c0-3-2-5-5-4z"/>
  <rect class="bj-bowtie-knot" x="175" y="8" width="10" height="11" rx="3"/>
  <path class="bj-sleeve" d="M68 42c-10 18-14 34-10 48l32 4c-2-16 2-32 8-46zM292 42c10 18 14 34 10 48l-32 4c2-16-2-32-8-46z"/>
  <rect class="bj-tray" x="126" y="92" width="108" height="21" rx="3"/>
  ${chipColumn(131, "ivory", 14)}${chipColumn(145, "red", 12)}${chipColumn(159, "black", 15)}${chipColumn(173, "violet", 10)}${chipColumn(187, "red", 13)}${chipColumn(201, "ivory", 11)}${chipColumn(215, "black", 9)}
  ${glove(92, false)}${glove(268, true)}
</svg>`;

export function feltArc(topLine: string, bottomLine: string): string {
  return `
<svg class="bj-arc" viewBox="0 0 360 74" aria-hidden="true">
  <path id="bj-arc-top" d="M24 10A400 400 0 0 0 336 10" fill="none"/>
  <path id="bj-arc-bottom" d="M58 35A330 330 0 0 0 302 35" fill="none"/>
  <path class="bj-arc-rule" d="M12 50A430 430 0 0 0 348 50"/>
  <path class="bj-arc-rule is-thin" d="M12 55A430 430 0 0 0 348 55"/>
  <text class="bj-arc-text"><textPath href="#bj-arc-top" startOffset="50%" text-anchor="middle">${topLine}</textPath></text>
  <text class="bj-arc-text is-small"><textPath href="#bj-arc-bottom" startOffset="50%" text-anchor="middle">${bottomLine}</textPath></text>
</svg>`;
}
