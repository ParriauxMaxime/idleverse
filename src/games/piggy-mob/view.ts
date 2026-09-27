import "@fontsource/limelight";
import "@fontsource/special-elite";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import { formatNumber } from "../../engine/format";
import { createShop, type ShopItem } from "../../engine/shop";
import { createTabs } from "../../engine/tabs";
import { CURRENCY, formatIncome, formatMoney } from "../../platform/currency";
import type { GameSession } from "../types";
import { MINI_PIG_SVG, PIG_SVG } from "./art";
import { GOONS, REPUTATION_BONUS_PER_CONTRACT, STORY_CONTRACTS, TIERS, TOOLS, type Contract, type Goon } from "./config";
import {
  availableGoons,
  buyNextTool,
  claimContract,
  contractAt,
  contractProgress,
  contractTarget,
  currentTier,
  damagePerSecond,
  goonCost,
  goonCount,
  hireGoon,
  incomePerSecond,
  integrity,
  isContractDone,
  nextRank,
  nextTool,
  payout,
  rank,
  reputationMultiplier,
  selectTier,
  smash,
  tapDamage,
  type ActiveContract,
  type PiggyState,
} from "./state";
import "./style.css";

const CRACK_STAGES = 5;
const GOON_EFFECTS_INTERVAL_MS = 260;
const GOON_THUD_INTERVAL_MS = 520;
const TELEGRAM_MS = 4_000;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function button(className: string, text = ""): HTMLButtonElement {
  const node = element("button", className, text);
  node.type = "button";
  return node;
}

function setText(node: HTMLElement, text: string) {
  if (node.textContent !== text) node.textContent = text;
}

function plural(count: number, word: string): string {
  return `${formatNumber(count)} ${word}${count > 1 ? "s" : ""}`;
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function describeGoal({ goal }: Contract): string {
  switch (goal.kind) {
    case "break":
      return goal.count === 1
        ? `Casse une tirelire ${TIERS[goal.tier].one}.`
        : `Casse ${goal.count} tirelires ${TIERS[goal.tier].many}.`;
    case "loot":
      return `Rapporte ${formatMoney(goal.amount)} de butin.`;
    case "quick":
      return `Casse une tirelire ${TIERS[goal.tier].one} en ${goal.maxHits} coups maximum.`;
    case "hire":
      return goal.count === 1 ? "Recrute un gars." : `Aie ${goal.count} gars dans la Famille.`;
    case "tool":
      return `Procure-toi ${TOOLS[goal.level].withArticle}.`;
  }
}

function describeProgress(state: PiggyState, active: ActiveContract): string {
  const contract = contractAt(active.id);
  const { goal } = contract;
  const progress = contractProgress(state, active);
  const target = contractTarget(contract);
  const needsTier = (goal.kind === "break" || goal.kind === "quick") && goal.tier >= state.unlockedTiers;
  if (needsTier) return `Pas encore de tirelires ${TIERS[goal.tier].many} sur le marché.`;

  switch (goal.kind) {
    case "break":
      return `${formatNumber(progress)} / ${formatNumber(target)} cassées`;
    case "loot":
      return `${formatMoney(progress)} / ${formatMoney(target)}`;
    case "hire":
      return `${formatNumber(progress)} / ${formatNumber(target)} gars`;
    case "tool":
      return `Outil actuel : ${TOOLS[state.toolLevel].name.toLowerCase()}`;
    case "quick":
      if (progress >= target) return "Du travail propre.";
      if (state.tierIndex !== goal.tier) return `Passe aux tirelires ${TIERS[goal.tier].many}.`;
      return `${plural(state.hits, "coup")} sur celle-ci`;
  }
}

function contractNumber(id: number): string {
  return id < STORY_CONTRACTS.length ? `Contrat n° ${String(id + 1).padStart(3, "0")}` : `Affaire courante n° ${id + 1}`;
}

function toolItem(state: PiggyState): ShopItem<PiggyState>[] {
  const tool = nextTool(state);
  if (!tool) return [];
  return [
    {
      name: tool.name,
      details: (s) => `${formatNumber(tool.damage)} dégâts par coup — tu tapes à ${formatNumber(TOOLS[s.toolLevel].damage)}`,
      cost: () => tool.cost,
      buy: buyNextTool,
    },
  ];
}

function goonItem(goon: Goon): ShopItem<PiggyState> {
  return {
    name: goon.name,
    details: (state) => {
      const income = (goon.damagePerSecond / currentTier(state).hp) * payout(state);
      return `${goon.motto} ${formatNumber(goon.damagePerSecond, 1)} dégâts/s ≈ ${formatIncome(income)} · ${plural(state.goons[goon.id], "recrue")}`;
    },
    cost: (state) => goonCost(state, goon.id),
    buy: (state) => hireGoon(state, goon.id),
  };
}

interface ScreenPoint {
  clientX: number;
  clientY: number;
}

interface ContractCard {
  id: number;
  card: HTMLElement;
  goal: HTMLElement;
  fill: HTMLElement;
  progress: HTMLElement;
  claim: HTMLButtonElement;
  stamp: HTMLElement;
  wasDone: boolean;
  isLeaving: boolean;
}

export function mount(root: HTMLElement, session: GameSession<PiggyState>): () => void {
  const resources = element("header", "resources");
  const amount = element("p", "resource-amount");
  const rate = element("p", "resource-rate");
  const wallet = element("p", "resource-wallet");
  const rankLine = element("p", "pm-rank");
  resources.append(amount, rate, wallet, rankLine);

  const den = element("section", "pm-den");
  const shelf = element("div", "pm-shelf");
  shelf.setAttribute("role", "group");
  shelf.setAttribute("aria-label", "Marchandise");
  const shelfButtons = TIERS.map((tier, index) => {
    const tierButton = button("pm-shelf-item");
    tierButton.dataset.tier = tier.id;
    tierButton.innerHTML = MINI_PIG_SVG;
    tierButton.append(element("span", "pm-shelf-name", tier.name));
    tierButton.addEventListener("click", () => session.update((s) => selectTier(s, index)));
    shelf.append(tierButton);
    return tierButton;
  });

  const stage = element("div", "pm-stage");
  const tierLabel = element("p", "pm-tier-label");
  const pig = button("pm-pig");
  pig.innerHTML = PIG_SVG;
  const pigArt = pig.querySelector<SVGElement>(".pm-pig-art")!;
  const cracks = [...pig.querySelectorAll<SVGElement>(".pm-crack")];
  const telegram = element("p", "pm-telegram");
  telegram.hidden = true;
  stage.append(tierLabel, pig, telegram);

  const gauge = element("div", "pm-gauge");
  const gaugeFill = element("div", "pm-gauge-fill");
  gauge.append(gaugeFill);
  const gaugeLabel = element("p", "pm-gauge-label");
  const flavor = element("p", "pm-flavor");
  const crew = element("p", "pm-crew");
  den.append(shelf, stage, gauge, gaugeLabel, flavor, crew);

  const office = element("section", "pm-office");
  const officeIntro = element("p", "pm-office-intro");
  const contractList = element("div", "pm-contracts");
  office.append(officeIntro, contractList);

  const arsenal = element("section", "pm-arsenal");
  const toolsTitle = element("h2", "pm-section-title", "Outillage");
  const toolsList = element("div", "shop");
  const toolsDone = element("p", "pm-shop-note", "Arsenal complet. Tu as de la dynamite, calme-toi.");
  const crewTitle = element("h2", "pm-section-title", "La Famille");
  const crewList = element("div", "shop");
  const crewLocked = element("p", "pm-shop-note");
  arsenal.append(toolsTitle, toolsList, toolsDone, crewTitle, crewList, crewLocked);

  const tabs = createTabs([
    { label: "Planque", panel: den },
    { label: "Contrats", panel: office },
    { label: "Arsenal", panel: arsenal },
  ]);
  const contractsTab = tabs.querySelectorAll<HTMLElement>('[role="tab"]')[1];
  root.append(resources, den, office, arsenal, tabs);

  const timers = new Set<number>();
  function later(action: () => void, ms: number) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      action();
    }, ms);
    timers.add(id);
  }

  function spawn(node: HTMLElement, host: HTMLElement, x: number, y: number, keyframes: Keyframe[], duration: number) {
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    host.append(node);
    node.animate(keyframes, { duration, fill: "forwards" }).finished.then(() => node.remove(), () => node.remove());
  }

  function stagePoint(point: ScreenPoint | null): { x: number; y: number } {
    const bounds = stage.getBoundingClientRect();
    if (point) return { x: point.clientX - bounds.left, y: point.clientY - bounds.top };
    const art = pigArt.getBoundingClientRect();
    return { x: art.left + art.width / 2 - bounds.left, y: art.top + art.height * 0.5 - bounds.top };
  }

  function flyingKeyframes(dx: number, rise: number, fall: number, spin: number): Keyframe[] {
    return [
      { transform: "translate(-50%, -50%)", opacity: 1, easing: "cubic-bezier(.2,.7,.4,1)" },
      {
        transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% - ${rise}px)) rotate(${spin * 0.4}deg)`,
        opacity: 1,
        offset: 0.35,
        easing: "cubic-bezier(.5,0,.9,.6)",
      },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${fall}px)) rotate(${spin}deg)`, opacity: 0 },
    ];
  }

  function spawnShards(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const shard = element("span", `pm-shard is-${i % 4}`);
      shard.style.setProperty("--size", `${between(8, 20)}px`);
      const keyframes = flyingKeyframes(between(-160, 160), between(40, 130), between(90, 200), between(-540, 540));
      spawn(shard, stage, x + between(-30, 30), y + between(-20, 20), keyframes, between(700, 1_000));
    }
  }

  function spawnCoins(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const coin = element("span", "pm-coin", CURRENCY.symbol);
      const keyframes = flyingKeyframes(between(-120, 120), between(70, 160), between(60, 150), between(-200, 200));
      spawn(coin, stage, x + between(-12, 12), y, keyframes, between(800, 1_150));
    }
  }

  function spawnFloat(className: string, text: string, x: number, y: number, distance: number, duration: number) {
    const keyframes: Keyframe[] = [
      { transform: "translate(-50%, -50%) scale(0.7)", opacity: 0 },
      { transform: "translate(-50%, -80%) scale(1.08)", opacity: 1, offset: 0.2 },
      { transform: `translate(-50%, calc(-50% - ${distance}px)) scale(1)`, opacity: 0 },
    ];
    spawn(element("span", className, text), stage, x, y, keyframes, duration);
  }

  function shake(strength: number) {
    if (prefersReducedMotion()) return;
    const angle = strength * (Math.random() < 0.5 ? -1 : 1);
    pigArt.animate(
      [
        { transform: "none" },
        { transform: `translate(${angle * 1.2}px, ${strength * 0.4}px) rotate(${angle}deg) scale(1.04, 0.94)` },
        { transform: `translate(${-angle}px, 0) rotate(${-angle * 0.6}deg) scale(0.98, 1.02)` },
        { transform: "none" },
      ],
      { duration: 90 + strength * 20, easing: "ease-out" },
    );
  }

  function dropNewPig() {
    if (prefersReducedMotion()) return;
    pig.animate(
      [
        { transform: "translateY(-45%) scale(0.92)", opacity: 0 },
        { transform: "translateY(0) scale(1.06, 0.92)", opacity: 1, offset: 0.7 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 340, easing: "cubic-bezier(.3,.1,.5,1)" },
    );
  }

  function celebrateBreak(breaks: number, loot: number, point: ScreenPoint | null) {
    const { x } = stagePoint(point);
    const center = stagePoint(null);
    if (!prefersReducedMotion()) {
      spawnShards(center.x, center.y, point ? 14 : 8);
      spawnCoins(center.x, center.y - 10, Math.min(12, 4 + breaks * 2));
    }
    const multiplier = breaks > 1 ? ` ×${formatNumber(breaks)}` : "";
    spawnFloat("pm-loot", `+${formatMoney(loot)}${multiplier}`, point ? x : center.x, center.y - 40, 90, 1_100);
    dropNewPig();
  }

  let tapPoint: ScreenPoint | null = null;

  function hitAt(point: ScreenPoint) {
    const damage = tapDamage(session.state(), session.modifiers());
    tapPoint = point;
    session.earn((state) => smash(state, session.modifiers()));
    tapPoint = null;
    const { x, y } = stagePoint(point);
    spawnFloat("pm-hit", `−${formatNumber(damage)}`, x + between(-10, 10), y - 16, 50, 600);
    shake(4);
  }

  pig.addEventListener("pointerdown", (event) => {
    if (event.button === 0) hitAt(event);
  });
  pig.addEventListener("click", (event) => {
    const isKeyboardActivation = event.detail === 0;
    if (!isKeyboardActivation) return;
    const bounds = pig.getBoundingClientRect();
    hitAt({ clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 });
  });
  pig.addEventListener("contextmenu", (event) => event.preventDefault());

  const cards: (ContractCard | null)[] = [];

  function buildCard(slot: number, active: ActiveContract): ContractCard {
    const contract = contractAt(active.id);
    const card = element("article", "pm-contract");
    const header = element("header", "pm-contract-header");
    header.append(element("span", "pm-contract-number", contractNumber(active.id)));
    header.append(element("span", "pm-contract-seal", "Confidentiel"));
    const brief = element("p", "pm-contract-brief", `« ${contract.brief} »`);
    const goal = element("p", "pm-contract-goal", describeGoal(contract));
    const bar = element("div", "pm-contract-bar");
    const fill = element("div", "pm-contract-fill");
    bar.append(fill);
    const progress = element("p", "pm-contract-progress");
    const terms = element("p", "pm-contract-terms");
    terms.append(element("span", "pm-contract-reward", `Prime : ${formatMoney(contract.reward)}`));
    terms.append(element("span", "", ` · réputation +${Math.round(REPUTATION_BONUS_PER_CONTRACT * 100)} %`));
    card.append(header, brief, goal, bar, progress, terms);
    if (contract.unlocksTier !== undefined) {
      card.append(element("p", "pm-contract-unlock", `Débloque les tirelires ${TIERS[contract.unlocksTier].many}`));
    }
    const claim = button("pm-contract-claim", "Encaisser la prime");
    const stamp = element("span", "pm-stamp", "Exécuté");
    stamp.setAttribute("aria-hidden", "true");
    card.append(claim, stamp);

    const entry: ContractCard = { id: active.id, card, goal, fill, progress, claim, stamp, wasDone: false, isLeaving: false };
    claim.addEventListener("click", () => claimSlot(slot, entry));
    return entry;
  }

  function claimSlot(slot: number, entry: ContractCard) {
    if (entry.isLeaving || !isContractDone(session.state(), session.state().board[slot])) return;
    entry.isLeaving = true;
    const reward = contractAt(entry.id).reward;
    const bounds = entry.card.getBoundingClientRect();
    const officeBounds = office.getBoundingClientRect();
    const gain = element("span", "pm-contract-gain", `+${formatMoney(reward)}`);
    gain.style.left = `${bounds.left - officeBounds.left + bounds.width / 2}px`;
    gain.style.top = `${bounds.top - officeBounds.top + office.scrollTop + bounds.height / 2}px`;
    office.append(gain);
    gain
      .animate(
        [
          { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
          { transform: "translate(-50%, -70%) scale(1.1)", opacity: 1, offset: 0.25 },
          { transform: "translate(-50%, -160%) scale(1)", opacity: 0 },
        ],
        { duration: 1_100, fill: "forwards" },
      )
      .finished.then(() => gain.remove(), () => gain.remove());

    const finish = () => session.earn((state) => claimContract(state, slot));
    if (prefersReducedMotion()) return finish();
    entry.card
      .animate(
        [
          { transform: "none", opacity: 1 },
          { transform: "translateX(110%) rotate(8deg)", opacity: 0 },
        ],
        { duration: 280, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" },
      )
      .finished.then(finish, finish);
  }

  function renderContracts(state: PiggyState) {
    let ready = 0;
    state.board.forEach((active, slot) => {
      let entry = cards[slot];
      if (!entry || entry.id !== active.id) {
        const fresh = buildCard(slot, active);
        if (entry) entry.card.replaceWith(fresh.card);
        else contractList.append(fresh.card);
        if (entry && !prefersReducedMotion()) {
          fresh.card.animate(
            [
              { transform: "translateY(-30%) rotate(-4deg)", opacity: 0 },
              { transform: "none", opacity: 1 },
            ],
            { duration: 320, easing: "cubic-bezier(.2,.8,.3,1)" },
          );
        }
        cards[slot] = entry = fresh;
      }

      const contract = contractAt(active.id);
      const done = isContractDone(state, active);
      if (done) ready++;
      entry.fill.style.transform = `scaleX(${contractProgress(state, active) / contractTarget(contract)})`;
      setText(entry.progress, describeProgress(state, active));
      entry.card.classList.toggle("is-done", done);
      entry.claim.hidden = !done;
      if (done && !entry.wasDone && !prefersReducedMotion()) {
        entry.stamp.animate(
          [
            { transform: "rotate(-14deg) scale(2.2)", opacity: 0 },
            { transform: "rotate(-14deg) scale(0.94)", opacity: 1, offset: 0.7 },
            { transform: "rotate(-14deg) scale(1)", opacity: 1 },
          ],
          { duration: 260, easing: "ease-in" },
        );
      }
      entry.wasDone = done;
    });

    if (ready > 0) contractsTab.dataset.ready = String(ready);
    else delete contractsTab.dataset.ready;
    setText(
      officeIntro,
      ready > 0
        ? "Le Parrain est satisfait. Passe prendre ton enveloppe."
        : "Trois enveloppes sur le bureau. Le Parrain n'aime pas attendre.",
    );
  }

  let renderShops = (_: PiggyState) => {};
  let shopKey = "";

  function rebuildShops(state: PiggyState) {
    toolsList.replaceChildren();
    crewList.replaceChildren();
    const renderTools = createShop(toolsList, toolItem(state), session);
    const renderCrew = createShop(crewList, availableGoons(state).map(goonItem), session);
    renderShops = (s) => {
      renderTools(s);
      renderCrew(s);
    };
    toolsDone.hidden = nextTool(state) !== undefined;
    const locked = GOONS.find((goon) => goon.unlockTier >= state.unlockedTiers);
    crewLocked.hidden = !locked;
    if (locked) crewLocked.textContent = `${locked.name} ne se dérange que pour les tirelires ${TIERS[locked.unlockTier].many}.`;
  }

  let shownTier = -1;
  let shownUnlocked = -1;
  let shownCracks = -1;

  function renderShelf(state: PiggyState) {
    if (state.tierIndex === shownTier && state.unlockedTiers === shownUnlocked) return;
    const isNewTier = shownUnlocked !== -1 && state.unlockedTiers > shownUnlocked;
    shownTier = state.tierIndex;
    shownUnlocked = state.unlockedTiers;
    const tier = currentTier(state);
    den.dataset.tier = tier.id;
    shelfButtons.forEach((shelfButton, index) => {
      const isLocked = index >= state.unlockedTiers;
      shelfButton.disabled = isLocked;
      shelfButton.classList.toggle("is-locked", isLocked);
      shelfButton.setAttribute("aria-pressed", String(index === state.tierIndex));
      shelfButton.setAttribute("aria-label", isLocked ? "Marchandise pas encore disponible" : `Tirelires ${TIERS[index].many}`);
    });
    tierLabel.textContent = `Tirelire ${tier.one}`;
    pig.setAttribute("aria-label", `Frapper la tirelire ${tier.one}`);
    flavor.textContent = tier.flavor;
    if (isNewTier) {
      telegram.textContent = `Nouvelle marchandise : tirelires ${TIERS[state.unlockedTiers - 1].many}. Stop.`;
      telegram.hidden = false;
      later(() => (telegram.hidden = true), TELEGRAM_MS);
    }
    dropNewPig();
  }

  function renderCracks(state: PiggyState) {
    const level = Math.min(CRACK_STAGES - 1, Math.floor((1 - integrity(state)) * CRACK_STAGES));
    if (level === shownCracks) return;
    shownCracks = level;
    cracks.forEach((crack) => crack.classList.toggle("is-visible", Number(crack.dataset.level) <= level));
  }

  function render(state: PiggyState) {
    const modifiers = session.modifiers();
    const tier = currentTier(state);
    const dps = damagePerSecond(state, modifiers);
    const currentRank = rank(state);
    const upcoming = nextRank(state);

    setText(amount, formatMoney(state.looted));
    setText(rate, `${formatIncome(incomePerSecond(state, modifiers))} · ${formatNumber(tapDamage(state, modifiers))} dégâts par coup`);
    setText(wallet, formatMoney(session.wallet()));
    setText(
      rankLine,
      `${currentRank.name} · réputation ×${reputationMultiplier(state).toFixed(2)}` +
        (upcoming ? ` · ${upcoming.name} dans ${plural(upcoming.contracts - state.contractsCompleted, "contrat")}` : ""),
    );

    renderShelf(state);
    renderCracks(state);
    const remaining = Math.ceil(tier.hp - state.damage);
    gaugeFill.style.transform = `scaleX(${integrity(state)})`;
    setText(
      gaugeLabel,
      `Solidité ${formatNumber(remaining)} / ${formatNumber(tier.hp)} · ${plural(state.hits, "coup")} · rapporte ${formatMoney(payout(state))}`,
    );
    setText(
      crew,
      goonCount(state) === 0
        ? "Personne ne cogne à ta place. L'arsenal recrute."
        : `${formatNumber(goonCount(state))} gars cognent pour toi : ${formatNumber(dps, 1)} dégâts/s`,
    );

    const key = `${state.toolLevel}:${state.unlockedTiers}`;
    if (key !== shopKey) {
      shopKey = key;
      rebuildShops(state);
    }
    renderShops(state);
    renderContracts(state);
  }

  let previous = session.state();
  let pendingBreaks = 0;
  let pendingLoot = 0;
  let lastGoonEffects = 0;
  let lastThud = 0;

  const unsubscribe = session.onChange((state) => {
    const breaks = state.tierIndex === previous.tierIndex ? state.broken - previous.broken : 0;
    const now = performance.now();
    if (breaks > 0) {
      pendingBreaks += breaks;
      pendingLoot += state.looted - previous.looted;
      if (tapPoint || now - lastGoonEffects > GOON_EFFECTS_INTERVAL_MS) {
        celebrateBreak(pendingBreaks, pendingLoot, tapPoint);
        pendingBreaks = 0;
        pendingLoot = 0;
        lastGoonEffects = now;
      }
    } else if (!tapPoint && state.damage > previous.damage && now - lastThud > GOON_THUD_INTERVAL_MS) {
      lastThud = now;
      shake(1.5);
    }
    previous = state;
    render(state);
  });

  render(previous);

  return () => {
    unsubscribe();
    timers.forEach((id) => clearTimeout(id));
  };
}
