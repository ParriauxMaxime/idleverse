import type { WeightLook } from "./config";

export type Arms = "grip" | "hips" | "cheer";
export type Face = "rest" | "strain" | "triumph";

export interface Pose {
  barY: number;
  dip: number;
  arms: Arms;
  face: Face;
  sweat: boolean;
}

interface Point {
  x: number;
  y: number;
}

const INK = "#1d1712";
const SKIN = "#e9b089";
const SKIN_SHADE = "#c98a64";
const CREAM = "#f3e7c9";
const RED = "#b8392b";
const NAVY = "#1f2a44";
const MUSTARD = "#d8a23a";
const IRON = "#2b2b31";
const WOOD = "#9a6436";

const FLOOR_BAR_Y = 256;
const OVERHEAD_BAR_Y = 18;
const MAX_DIP = 28;
const SQUAT_UNTIL_LIFT = 0.35;
const SWEAT_FROM_LIFT = 0.35;

const SHOULDERS: Point[] = [
  { x: 100, y: 126 },
  { x: 200, y: 126 },
];
const HIPS: Point[] = [
  { x: 130, y: 212 },
  { x: 170, y: 212 },
];
const FEET: Point[] = [
  { x: 112, y: 280 },
  { x: 188, y: 280 },
];
const GRIP_X = [72, 228];
const HANDS_ON_HIPS: Point[] = [
  { x: 124, y: 194 },
  { x: 176, y: 194 },
];
const HANDS_CHEERING: Point[] = [
  { x: 50, y: 36 },
  { x: 250, y: 36 },
];
const UPPER_ARM = 58;
const FOREARM = 56;
const THIGH = 38;
const SHIN = 38;
const LOAD_X = [30, 270];

export const TRIUMPH_MS = 260;
export const FALL_MS = 220;
const SETTLE_MS = 320;
export const CELEBRATION_MS = TRIUMPH_MS + FALL_MS + SETTLE_MS;

export function liftPose(lift: number): Pose {
  if (lift <= 0.001) return { barY: FLOOR_BAR_Y, dip: 0, arms: "hips", face: "rest", sweat: false };

  return {
    barY: FLOOR_BAR_Y - (FLOOR_BAR_Y - OVERHEAD_BAR_Y) * Math.min(1, lift),
    dip: MAX_DIP * Math.max(0, 1 - lift / SQUAT_UNTIL_LIFT),
    arms: "grip",
    face: "strain",
    sweat: lift >= SWEAT_FROM_LIFT,
  };
}

export function celebrationPose(elapsedMs: number): Pose {
  const cheering = { dip: 0, arms: "cheer", face: "triumph", sweat: false } as const;
  if (elapsedMs < TRIUMPH_MS) return { ...cheering, barY: OVERHEAD_BAR_Y, arms: "grip" };

  const fall = Math.min(1, (elapsedMs - TRIUMPH_MS) / FALL_MS);
  if (fall < 1) return { ...cheering, barY: OVERHEAD_BAR_Y + (FLOOR_BAR_Y - OVERHEAD_BAR_Y) * fall * fall };

  const settle = Math.min(1, (elapsedMs - TRIUMPH_MS - FALL_MS) / SETTLE_MS);
  return { ...cheering, barY: FLOOR_BAR_Y - Math.sin(settle * Math.PI) * 12 * (1 - settle) };
}

/** Two-bone joint (elbow or knee) bent away from the middle of the body. */
function joint(from: Point, to: Point, upper: number, lower: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const reach = Math.min(length, upper + lower - 0.01);
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const offset = Math.sqrt(Math.max(0, upper * upper - along * along));
  const base = { x: from.x + (dx / length) * along, y: from.y + (dy / length) * along };
  const candidates = [1, -1].map((side) => ({
    x: base.x - (dy / length) * offset * side,
    y: base.y + (dx / length) * offset * side,
  }));
  const outward = from.x < 150 ? -1 : 1;
  return candidates.sort((a, b) => (b.x - a.x) * outward)[0];
}

function segment(from: Point, to: Point): string {
  return `M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

function handsFor(pose: Pose): Point[] {
  if (pose.arms === "hips") return HANDS_ON_HIPS.map((hand) => ({ ...hand, y: hand.y + pose.dip }));
  if (pose.arms === "cheer") return HANDS_CHEERING;
  return GRIP_X.map((x) => ({ x, y: pose.barY }));
}

const endLoads: Record<WeightLook, string> = {
  bar: "",
  plates: `<circle r="29" fill="${IRON}"/><circle r="19" fill="none" stroke="#5b5b63"/><circle r="5" fill="${CREAM}"/>`,
  cannonballs: `<path d="M-2 -29q3 -9 11 -8" fill="none"/><circle r="30" fill="${IRON}"/><path d="M-19 -9a20 20 0 0 1 11 -13" fill="none" stroke="#5b5b63" stroke-width="4"/>`,
  barrels: `<path d="M-21 -31Q-31 0 -21 31H21Q31 0 21 -31Z" fill="#b0702f"/><path d="M-24 -17H24M-24 17H24" stroke="#3a3a40" stroke-width="5"/><path d="M-8 -30V30M8 -30V30" stroke="#7b4a1f" stroke-width="2"/>`,
  anvils: `<path d="M-34 -20H20V-9C11 -7 9 -1 9 4L15 12L17 22H-17L-15 12L-9 4C-9 -1 -13 -7 -18 -9V-12C-26 -12 -33 -15 -34 -20Z" fill="#3d4049"/>`,
  piano: "",
  horse: "",
  elephant: "",
  locomotive: "",
  tent: "",
};

const loadsOnTop: Record<WeightLook, string> = {
  bar: "",
  plates: "",
  cannonballs: "",
  barrels: "",
  anvils: "",
  piano: `
    <path d="M150 -62L226 -100L231 -93L162 -60Z" fill="#34323c"/>
    <path d="M192 -60L206 -86" fill="none"/>
    <path d="M84 -34V-4M154 -34V-4M214 -34V-4" stroke-width="7"/>
    <path d="M74 -34V-62H150C182 -62 196 -80 222 -74C240 -69 238 -34 224 -34Z" fill="#1c1b22"/>
    <rect x="60" y="-54" width="18" height="11" fill="${CREAM}"/>
    <path d="M65 -54V-47M70 -54V-47M75 -54V-47" stroke-width="2"/>`,
  horse: `
    <path d="M104 -54C90 -50 88 -34 94 -22" fill="none" stroke="#4a2a14" stroke-width="8"/>
    <path d="M116 -34V-8M130 -34V-8M168 -34V-8M182 -34V-8" stroke="#8a4f24" stroke-width="11"/>
    <path d="M110 -12H122M124 -12H136M162 -12H174M176 -12H188" stroke="${CREAM}" stroke-width="9"/>
    <ellipse cx="148" cy="-48" rx="46" ry="22" fill="#9c5a2b"/>
    <path d="M182 -60L202 -86C207 -93 222 -94 227 -86L234 -70C236 -63 227 -61 222 -65L211 -72L196 -42Z" fill="#9c5a2b"/>
    <path d="M186 -66L203 -89L208 -84L192 -62Z" fill="#4a2a14"/>
    <circle cx="214" cy="-80" r="2.5" fill="${INK}" stroke="none"/>`,
  elephant: `
    <path d="M106 -30V-6M124 -30V-6M156 -30V-6M174 -30V-6" stroke="#80838d" stroke-width="16"/>
    <ellipse cx="140" cy="-50" rx="50" ry="31" fill="#8f929c"/>
    <path d="M112 -76Q140 -88 170 -76L166 -52Q140 -45 116 -52Z" fill="${RED}"/>
    <path d="M118 -50Q140 -43 164 -50" fill="none" stroke="${MUSTARD}" stroke-dasharray="3 4"/>
    <path d="M208 -64C226 -68 230 -86 222 -100L231 -103C241 -86 237 -58 212 -48Z" fill="#8f929c"/>
    <circle cx="196" cy="-60" r="23" fill="#8f929c"/>
    <ellipse cx="182" cy="-58" rx="13" ry="19" fill="#a8abb4"/>
    <circle cx="204" cy="-66" r="2.5" fill="${INK}" stroke="none"/>`,
  locomotive: `
    <path d="M200 -32L224 -8H200Z" fill="${RED}"/>
    <rect x="70" y="-34" width="134" height="7" fill="${NAVY}"/>
    <rect x="108" y="-66" width="94" height="34" rx="6" fill="#23232b"/>
    <path d="M176 -66V-88H172V-96H196V-88H192V-66Z" fill="#23232b"/>
    <circle cx="146" cy="-67" r="8" fill="${MUSTARD}"/>
    <rect x="68" y="-86" width="44" height="54" fill="${RED}"/>
    <rect x="62" y="-92" width="56" height="8" fill="${NAVY}"/>
    <rect x="78" y="-76" width="24" height="16" fill="${CREAM}"/>
    <g fill="${RED}"><circle cx="92" cy="-17" r="12"/><circle cx="138" cy="-17" r="12"/><circle cx="176" cy="-17" r="12"/></g>
    <g fill="${CREAM}"><circle cx="92" cy="-17" r="3"/><circle cx="138" cy="-17" r="3"/><circle cx="176" cy="-17" r="3"/></g>`,
  tent: `
    <path d="M150 -98V-114L166 -108L150 -102" fill="${RED}"/>
    <rect x="92" y="-46" width="116" height="42" fill="url(#sm-stripes)"/>
    <path d="M150 -30L138 -4H162Z" fill="${NAVY}"/>
    <path d="M80 -46L150 -98L220 -46Z" fill="${RED}"/>
    <path d="M150 -98L106 -46H124ZM150 -98L143 -46H157ZM150 -98L176 -46H194Z" fill="${CREAM}" stroke="none"/>
    <path d="M80 -46L150 -98L220 -46Z" fill="none"/>
    <path d="M80 -46a7 7 0 0 0 14 0a7 7 0 0 0 14 0a7 7 0 0 0 14 0a7 7 0 0 0 14 0a7 7 0 0 0 14 0a7 7 0 0 0 14 0a7 7 0 0 0 14 0a7 7 0 0 0 14 0a7 7 0 0 0 14 0a7 7 0 0 0 14 0Z" fill="${NAVY}"/>`,
};

const MIRRORED_LOOKS: WeightLook[] = ["anvils", "cannonballs"];

export function loadMarkup(look: WeightLook): { onTop: string; ends: string } {
  const [left, right] = LOAD_X;
  const mirror = MIRRORED_LOOKS.includes(look) ? " scale(-1 1)" : "";
  const ends = endLoads[look]
    ? `<g transform="translate(${left} 0)">${endLoads[look]}</g><g transform="translate(${right} 0)${mirror}">${endLoads[look]}</g>`
    : "";
  return { onTop: loadsOnTop[look], ends };
}

const FACES = `
  <g class="sm-face sm-face-rest">
    <path d="M133 61L145 60M155 57L167 61" stroke-width="4"/>
    <ellipse cx="140" cy="69" rx="2.6" ry="3.4" fill="${INK}" stroke="none"/>
    <ellipse cx="160" cy="69" rx="2.6" ry="3.4" fill="${INK}" stroke="none"/>
    <path d="M143 97Q150 101 157 97" fill="none"/>
  </g>
  <g class="sm-face sm-face-strain">
    <path d="M133 58L146 64M154 64L167 58" stroke-width="4"/>
    <path d="M135 66L144 70L135 74M165 66L156 70L165 74" fill="none"/>
    <circle cx="131" cy="84" r="5.5" fill="#d9786a" stroke="none"/>
    <circle cx="169" cy="84" r="5.5" fill="#d9786a" stroke="none"/>
    <rect x="139" y="93" width="22" height="9" rx="3" fill="${CREAM}"/>
    <path d="M139 97.5H161M146 93V102M154 93V102" stroke-width="1.5"/>
    <path class="sm-sweat" d="M178 52C182 59 184 62 184 65A6 6 0 0 1 172 65C172 62 174 59 178 52Z" fill="#cfe1e8" stroke="${NAVY}" stroke-width="2"/>
  </g>
  <g class="sm-face sm-face-triumph">
    <path d="M133 58Q139 53 146 57M154 57Q161 53 167 58" fill="none" stroke-width="4"/>
    <path d="M135 71Q140 64 145 71M155 71Q160 64 165 71" fill="none"/>
    <path d="M137 93Q150 113 163 93Z" fill="#6e2016"/>
    <path d="M140 94H160L158 99H142Z" fill="${CREAM}" stroke-width="1.5"/>
  </g>`;

const MOUSTACHE_HALF =
  "M150 86C142 81 131 83 125 88C119 93 110 91 109 83C109 77 116 75 118 80C116 81 116 85 120 85C127 85 136 89 150 93Z";

export const FIGURE_MARKUP = `
<svg class="sm-figure" viewBox="-10 -118 320 428" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="sm-leopard" width="24" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
      <rect width="24" height="22" fill="${MUSTARD}"/>
      <ellipse cx="6" cy="6" rx="4" ry="3" fill="#8a4f22" stroke="${INK}" stroke-width="1.6" stroke-dasharray="6 3"/>
      <ellipse cx="18" cy="15" rx="3.5" ry="3" fill="#8a4f22" stroke="${INK}" stroke-width="1.6" stroke-dasharray="5 3"/>
      <circle cx="17" cy="4" r="1.4" fill="${INK}"/>
      <circle cx="5" cy="17" r="1.4" fill="${INK}"/>
    </pattern>
    <pattern id="sm-stripes" width="16" height="10" patternUnits="userSpaceOnUse">
      <rect width="8" height="10" fill="${RED}"/>
      <rect x="8" width="8" height="10" fill="${CREAM}"/>
    </pattern>
  </defs>
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <rect class="sm-floor" x="-600" y="290" width="1500" height="120" fill="${WOOD}"/>
    <path d="M-600 290H900" stroke-width="4"/>
    <path d="M-560 290V410M-480 290V410M-400 290V410M-320 290V410M-240 290V410M-160 290V410M-80 290V410M0 290V410M80 290V410M160 290V410M240 290V410M320 290V410M400 290V410M480 290V410M560 290V410M640 290V410M720 290V410M800 290V410" stroke="#6e4524" stroke-width="2"/>
    <g fill="${WOOD}">
      <path d="M22 290L36 262L50 290M250 290L264 262L278 290" fill="none" stroke-width="5"/>
      <rect x="22" y="258" width="28" height="7"/>
      <rect x="250" y="258" width="28" height="7"/>
    </g>
    <g class="sm-bar-follower sm-load-top"></g>
    <path class="sm-legs-ink" fill="none" stroke-width="31"/>
    <path class="sm-legs-skin" fill="none" stroke="${SKIN}" stroke-width="25"/>
    <g fill="#2a1f1a">
      <path d="M96 276H120V286C120 290 116 291 112 291H90C84 291 84 283 90 281Z"/>
      <path d="M204 276H180V286C180 290 184 291 188 291H210C216 291 216 283 210 281Z"/>
    </g>
    <g class="sm-body">
      <path d="M134 88H166L173 112C188 113 200 117 206 124H94C100 117 112 113 127 112Z" fill="${SKIN}"/>
      <path d="M88 132C88 113 120 106 150 106C180 106 212 113 212 132C212 162 190 181 183 204H117C110 181 88 162 88 132Z" fill="${SKIN}"/>
      <path d="M152 142C166 152 186 152 201 139M180 170C174 176 170 180 168 188" fill="none" stroke="${SKIN_SHADE}"/>
      <path d="M118 110L134 108L162 152C182 154 198 147 206 146C200 170 188 186 183 204H117C110 184 90 164 89 140C90 126 104 114 118 110Z" fill="url(#sm-leopard)"/>
      <path d="M113 206H187L193 232C174 229 162 234 150 241C138 234 126 229 107 232Z" fill="url(#sm-leopard)"/>
      <rect x="114" y="194" width="72" height="16" rx="3" fill="#6f4020"/>
      <rect x="140" y="191" width="20" height="22" rx="3" fill="${MUSTARD}"/>
      <rect x="146" y="197" width="8" height="10" fill="#6f4020" stroke-width="2"/>
      <circle cx="124" cy="76" r="7" fill="${SKIN}"/>
      <circle cx="176" cy="76" r="7" fill="${SKIN}"/>
      <ellipse cx="150" cy="72" rx="25" ry="29" fill="${SKIN}"/>
      <path d="M149 43C141 36 149 28 156 33C160 36 157 42 152 40" fill="none" stroke-width="3"/>
      <path d="M134 50Q141 45 148 47" fill="none" stroke="${CREAM}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="150" cy="81" rx="6" ry="5" fill="${SKIN_SHADE}"/>
      ${FACES}
      <path d="${MOUSTACHE_HALF}" fill="#3a2314"/>
      <path d="${MOUSTACHE_HALF}" fill="#3a2314" transform="translate(300 0) scale(-1 1)"/>
    </g>
    <path class="sm-upper-ink" fill="none" stroke-width="34"/>
    <path class="sm-fore-ink" fill="none" stroke-width="29"/>
    <path class="sm-upper-skin" fill="none" stroke="${SKIN}" stroke-width="28"/>
    <path class="sm-fore-skin" fill="none" stroke="${SKIN}" stroke-width="23"/>
    <g class="sm-shoulders">
      <circle cx="100" cy="128" r="22" fill="${SKIN}"/>
      <circle cx="200" cy="128" r="22" fill="${SKIN}"/>
      <path d="M112 108C104 106 94 110 88 118L96 124C101 118 108 115 116 115Z" fill="url(#sm-leopard)"/>
    </g>
    <g class="sm-bar-follower">
      <path d="M6 0H294" stroke-width="10"/>
      <path d="M6 0H294" stroke="#9c9a94" stroke-width="4"/>
      <rect x="50" y="-9" width="8" height="18" rx="2" fill="${NAVY}"/>
      <rect x="242" y="-9" width="8" height="18" rx="2" fill="${NAVY}"/>
      <g class="sm-load-ends"></g>
    </g>
    <circle class="sm-hand" r="13" fill="${SKIN}"/>
    <circle class="sm-hand" r="13" fill="${SKIN}"/>
  </g>
</svg>`;

export interface FigureParts {
  svg: SVGSVGElement;
  loadTop: SVGGElement;
  loadEnds: SVGGElement;
  barFollowers: SVGGElement[];
  body: SVGGElement;
  shoulders: SVGGElement;
  legs: SVGPathElement[];
  upperArms: SVGPathElement[];
  forearms: SVGPathElement[];
  hands: SVGCircleElement[];
}

export function createFigure(container: HTMLElement): FigureParts {
  container.insertAdjacentHTML("beforeend", FIGURE_MARKUP);
  const svg = container.querySelector<SVGSVGElement>(".sm-figure")!;
  const one = <T extends Element>(selector: string) => svg.querySelector<T>(selector)!;
  const all = <T extends Element>(selector: string) => [...svg.querySelectorAll<T>(selector)];
  return {
    svg,
    loadTop: one(".sm-load-top"),
    loadEnds: one(".sm-load-ends"),
    barFollowers: all(".sm-bar-follower"),
    body: one(".sm-body"),
    shoulders: one(".sm-shoulders"),
    legs: all(".sm-legs-ink, .sm-legs-skin"),
    upperArms: all(".sm-upper-ink, .sm-upper-skin"),
    forearms: all(".sm-fore-ink, .sm-fore-skin"),
    hands: all(".sm-hand"),
  };
}

export function showLoad(parts: FigureParts, look: WeightLook) {
  const { onTop, ends } = loadMarkup(look);
  parts.loadTop.innerHTML = onTop;
  parts.loadEnds.innerHTML = ends;
}

export function applyPose(parts: FigureParts, pose: Pose) {
  const dipped = `translate(0 ${pose.dip.toFixed(1)})`;
  parts.body.setAttribute("transform", dipped);
  parts.shoulders.setAttribute("transform", dipped);
  for (const follower of parts.barFollowers) follower.setAttribute("transform", `translate(0 ${pose.barY.toFixed(1)})`);

  const legs = HIPS.map((hip, index) => {
    const dippedHip = { x: hip.x, y: hip.y + pose.dip };
    const knee = joint(dippedHip, FEET[index], THIGH, SHIN);
    return segment(dippedHip, knee) + segment(knee, FEET[index]).replace("M", "L");
  }).join("");
  for (const path of parts.legs) path.setAttribute("d", legs);

  const hands = handsFor(pose);
  const elbows = SHOULDERS.map((shoulder, index) => {
    const dippedShoulder = { x: shoulder.x, y: shoulder.y + pose.dip };
    return { shoulder: dippedShoulder, elbow: joint(dippedShoulder, hands[index], UPPER_ARM, FOREARM), hand: hands[index] };
  });
  const upper = elbows.map(({ shoulder, elbow }) => segment(shoulder, elbow)).join("");
  const fore = elbows.map(({ elbow, hand }) => segment(elbow, hand)).join("");
  for (const path of parts.upperArms) path.setAttribute("d", upper);
  for (const path of parts.forearms) path.setAttribute("d", fore);
  parts.hands.forEach((circle, index) => {
    circle.setAttribute("cx", hands[index].x.toFixed(1));
    circle.setAttribute("cy", hands[index].y.toFixed(1));
  });

  parts.svg.dataset.pose = pose.face;
  parts.svg.dataset.sweat = String(pose.sweat);
}

export function loadAnchors(): { x: number; y: number }[] {
  return LOAD_X.map((x) => ({ x, y: FLOOR_BAR_Y + 30 }));
}
