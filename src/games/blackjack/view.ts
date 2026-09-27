import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import { formatNumber } from "../../engine/format";
import { createShop, type ShopItem } from "../../engine/shop";
import { createTabs } from "../../engine/tabs";
import { formatIncome, formatMoney } from "../../platform/currency";
import type { GameSession } from "../types";
import { CROUPIER_SVG, feltArc, PIP_LAYOUTS, SUIT_SPRITE, suitIcon } from "./art";
import {
  BLACKJACK_PAYOUT_LABELS,
  CHIP_VALUES,
  DEALER_STANDS_ON,
  FREE_CHIP,
  HANDS_PER_SECOND_PER_REGULAR,
  MIN_BET,
  PLAQUE_FROM,
  RANK_LABELS,
  UPGRADES,
  type Suit,
  type UpgradeDefinition,
  type UpgradeId,
} from "./config";
import {
  addToStake,
  autoBetOptions,
  availableChips,
  bribeChance,
  buyTable,
  buyUpgrade,
  canBuyUpgrade,
  canClaimFreeChip,
  canDeal,
  charmChance,
  claimFreeChip,
  clearStake,
  currentTable,
  deal,
  dealerStep,
  expectedValue,
  fitStake,
  handsPerSecond,
  handValue,
  hit,
  incomePerSecond,
  isBetting,
  isBust,
  isMaxed,
  nextTable,
  setAutoBet,
  setStake,
  stand,
  tableLimit,
  upgradeCost,
  winMultiplier,
  type BlackjackState,
  type Card,
  type Phase,
} from "./state";
import "./style.css";

const DEAL_STAGGER_MS = 170;
const CARD_FLIGHT_MS = 380;
const REVEAL_MS = 520;
const DEALER_STEP_MS = 680;
const EVENT_CALL_MS = 2_400;
const RACK_SIZE = 4;
const MAX_STACK = 9;

const SUIT_NAMES: Record<Suit, string> = { spades: "pique", hearts: "cœur", diamonds: "carreau", clubs: "trèfle" };
const RANK_NAMES: Record<number, string> = { 1: "l'as", 11: "le valet", 12: "la dame", 13: "le roi" };

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

function decimal(value: number, digits = 1): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

function percent(value: number): string {
  return `${decimal(Math.abs(value) * 100)} %`;
}

function signedPercent(value: number): string {
  return `${value < 0 ? "−" : "+"}${percent(value)}`;
}

function plural(count: number, word: string): string {
  return `${formatNumber(count)} ${word}${count > 1 ? "s" : ""}`;
}

function chipLabel(value: number): string {
  return formatNumber(value).replace(".0", "");
}

function cardName(card: Card): string {
  const rank = RANK_NAMES[card.rank] ?? `le ${card.rank}`;
  return `${rank} de ${SUIT_NAMES[card.suit]}`;
}

function chipNode(value: number, className = "bj-chip"): HTMLElement {
  const node = element("span", `${className}${value >= PLAQUE_FROM ? " is-plaque" : ""}`);
  node.dataset.chip = String(CHIP_VALUES.indexOf(value));
  node.append(element("span", "bj-chip-label", chipLabel(value)));
  return node;
}

/** Greedy split of an amount into the chips a croupier would push, biggest first. */
function chipsFor(amount: number): number[] {
  const chips: number[] = [];
  let rest = amount;
  for (const value of [...CHIP_VALUES].reverse()) {
    while (rest >= value && chips.length < MAX_STACK) {
      chips.push(value);
      rest -= value;
    }
  }
  return chips.reverse();
}

function stackNode(amount: number, className = "bj-stack"): HTMLElement {
  const stack = element("span", className);
  chipsFor(amount).forEach((value, index) => {
    const chip = chipNode(value);
    chip.style.setProperty("--level", String(index));
    stack.append(chip);
  });
  return stack;
}

function cardFace(card: Card): string {
  const label = RANK_LABELS[card.rank];
  const corner = (position: string) =>
    `<span class="bj-corner ${position}"><b>${label}</b>${suitIcon(card.suit, "bj-corner-suit")}</span>`;
  let center: string;
  if (card.rank === 1) {
    center = `<span class="bj-ace">${suitIcon(card.suit)}</span>`;
  } else if (card.rank > 10) {
    center = `<span class="bj-court"><b>${label}</b>${suitIcon(card.suit, "bj-court-suit")}</span>`;
  } else {
    const pips = PIP_LAYOUTS[card.rank]
      .map(([x, y]) => {
        const flip = y > 50 ? " is-flipped" : "";
        return `<span class="bj-pip${flip}" style="left:${x}%;top:${y}%">${suitIcon(card.suit)}</span>`;
      })
      .join("");
    center = `<span class="bj-pips">${pips}</span>`;
  }
  return `${corner("is-top")}${center}${corner("is-bottom")}`;
}

function cardNode(card: Card): HTMLElement {
  const node = element("div", "bj-card");
  node.dataset.suit = card.suit;
  node.classList.toggle("is-red", card.suit === "hearts" || card.suit === "diamonds");
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", cardName(card));
  const inner = element("div", "bj-card-inner");
  const face = element("div", "bj-card-face");
  face.innerHTML = cardFace(card);
  inner.append(face, element("div", "bj-card-back"));
  node.append(inner);
  return node;
}

function totalText(cards: Card[], isDecided: boolean): string {
  const { total, isSoft } = handValue(cards);
  return isSoft && total < 21 && !isDecided ? `${total - 10} / ${total}` : String(total);
}

interface Verdict {
  title: string;
  amount: string;
  call: string;
  tone: "win" | "push" | "loss";
}

function verdictFor(state: BlackjackState): Verdict {
  const profit = state.lastPayout - state.bet;
  const gain = `+${formatMoney(profit)}`;
  const loss = `−${formatMoney(state.bet)}`;
  switch (state.outcome) {
    case "blackjack":
      return { title: "Blackjack !", amount: gain, call: "Blackjack ! La maison s'incline.", tone: "win" };
    case "win":
      return isBust(state.dealer)
        ? { title: "La banque saute !", amount: gain, call: "La banque saute ! Pour vous.", tone: "win" }
        : { title: "Gagné", amount: gain, call: "Pour vous. Joliment joué.", tone: "win" };
    case "cousin":
      return { title: "Égalité gagnante", amount: gain, call: "Égalité… le chef de partie tranche pour vous.", tone: "win" };
    case "push":
      return { title: "Égalité", amount: "Mise rendue", call: "Égalité. Vous reprenez votre mise.", tone: "push" };
    case "bust":
      return { title: "Sauté", amount: loss, call: "Trop ! La banque ramasse.", tone: "loss" };
    case "dealerBlackjack":
      return { title: "Blackjack de la banque", amount: loss, call: "Blackjack de la banque. Navré.", tone: "loss" };
    default:
      return { title: "Perdu", amount: loss, call: "La banque gagne.", tone: "loss" };
  }
}

const UPGRADE_EFFECTS: Record<Exclude<UpgradeId, "regulars">, (state: BlackjackState) => string> = {
  rulebook: (state) => {
    const level = state.upgrades.rulebook;
    return isMaxed(state, "rulebook")
      ? `Le blackjack paie ${BLACKJACK_PAYOUT_LABELS[level]}. Du jamais vu.`
      : `Blackjack ${BLACKJACK_PAYOUT_LABELS[level]} → ${BLACKJACK_PAYOUT_LABELS[level + 1]}`;
  },
  bribe: (state) =>
    isMaxed(state, "bribe")
      ? `Carte de trop : ${percent(bribeChance(state))} des mains. Il ne peut pas faire plus sans se faire prendre.`
      : `Carte de trop : ${percent(bribeChance(state))} → ${percent(bribeChance(buyUpgrade(state, "bribe")))} des mains`,
  charm: (state) =>
    isMaxed(state, "charm")
      ? `Carte soufflée : ${percent(charmChance(state))}. Les quatre feuilles sont usées.`
      : `Carte soufflée : ${percent(charmChance(state))} → ${percent(charmChance(buyUpgrade(state, "charm")))}`,
  cousin: (state) => (isMaxed(state, "cousin") ? "Il veille sur vos égalités." : "Les égalités deviennent des victoires."),
  champagne: (state) =>
    `Gains ×${decimal(winMultiplier(state), 2)} → ×${decimal(winMultiplier(buyUpgrade(state, "champagne")), 2)}`,
};

function upgradeItem(upgrade: UpgradeDefinition & { id: Exclude<UpgradeId, "regulars"> }): ShopItem<BlackjackState> {
  return {
    name: upgrade.name,
    details: (state) => `${UPGRADE_EFFECTS[upgrade.id](state)} — ${upgrade.blurb}`,
    cost: (state) => upgradeCost(state, upgrade.id),
    buy: (state) => buyUpgrade(state, upgrade.id),
    isAvailable: (state) => canBuyUpgrade(state, upgrade.id),
  };
}

function regularsItem(session: GameSession<BlackjackState>): ShopItem<BlackjackState> {
  const upgrade = UPGRADES.find((u) => u.id === "regulars")!;
  return {
    name: upgrade.name,
    details: (state) => {
      const edge = expectedValue(state);
      if (edge <= 0) {
        return `Refuse de s'asseoir : jouée comme la banque, une main perd ${percent(edge)} de la mise. Rendez la table rentable d'abord.`;
      }
      const modifiers = session.modifiers();
      const gain = incomePerSecond(buyUpgrade(state, "regulars"), modifiers) - incomePerSecond(state, modifiers);
      return `+${decimal(HANDS_PER_SECOND_PER_REGULAR)} main/s (${formatIncome(gain)}) · ${plural(state.upgrades.regulars, "habitué")} — ${upgrade.blurb}`;
    },
    cost: (state) => upgradeCost(state, "regulars"),
    buy: (state) => buyUpgrade(state, "regulars"),
    isAvailable: (state) => canBuyUpgrade(state, "regulars"),
  };
}

function rules(state: BlackjackState): { top: string; bottom: string } {
  return {
    top: `LE BLACKJACK PAIE ${BLACKJACK_PAYOUT_LABELS[state.upgrades.rulebook].toUpperCase()}`,
    bottom: `LA BANQUE TIRE À ${DEALER_STANDS_ON - 1} ET RESTE À ${DEALER_STANDS_ON}`,
  };
}

export function mount(root: HTMLElement, session: GameSession<BlackjackState>): () => void {
  root.insertAdjacentHTML("beforeend", SUIT_SPRITE);

  const resources = element("header", "resources");
  const amount = element("p", "resource-amount");
  const amountLabel = element("p", "bj-amount-label");
  const rate = element("p", "resource-rate");
  resources.append(amount, amountLabel, rate);

  // The table

  const playPanel = element("section", "bj-play");
  const table = element("div", "bj-table");
  const room = element("div", "bj-room");
  room.innerHTML = CROUPIER_SVG;
  const rail = element("div", "bj-rail");
  const felt = element("div", "bj-felt");
  const shoe = element("div", "bj-shoe");
  shoe.setAttribute("aria-hidden", "true");

  const dealerRow = element("div", "bj-row is-dealer");
  const dealerHand = element("div", "bj-hand");
  const dealerTag = element("p", "bj-tag");
  const dealerTotal = element("span", "bj-total");
  dealerTag.append(element("span", "bj-tag-name", "Banque"), dealerTotal);
  dealerRow.append(dealerTag, dealerHand);

  const arc = element("div", "bj-arc-wrap");
  const arcArt = element("div", "bj-arc-art");

  const playerRow = element("div", "bj-row is-player");
  const playerHand = element("div", "bj-hand");
  const playerTag = element("p", "bj-tag");
  const playerTotal = element("span", "bj-total");
  playerTag.append(element("span", "bj-tag-name", "Vous"), playerTotal);
  playerRow.append(playerTag, playerHand);

  const spot = element("div", "bj-spot");
  const spotStack = element("div", "bj-spot-stack");
  const spotAmount = element("span", "bj-spot-amount");
  spot.append(spotStack, spotAmount);

  const verdict = element("div", "bj-verdict");
  const verdictTitle = element("p", "bj-verdict-title");
  const verdictAmount = element("p", "bj-verdict-amount");
  verdict.append(verdictTitle, verdictAmount);
  verdict.hidden = true;

  arc.append(arcArt, verdict);
  felt.append(shoe, dealerRow, arc, playerRow, spot);
  rail.append(felt);
  table.append(room, rail);

  const call = element("p", "bj-call");
  call.setAttribute("aria-live", "polite");

  const controls = element("div", "bj-controls");
  const bettingControls = element("div", "bj-betting");
  const rack = element("div", "bj-rack");
  const clearButton = button("bj-small", "Effacer");
  const maxButton = button("bj-small", "Mise max");
  const dealButton = button("bj-action is-deal");
  const dealLabel = element("span", "bj-action-label", "Distribuer");
  const dealAmount = element("span", "bj-action-note");
  dealButton.append(dealLabel, dealAmount);
  const freeChipButton = button("bj-action is-gift");
  freeChipButton.append(
    element("span", "bj-action-label", "Un jeton offert"),
    element("span", "bj-action-note", `${formatMoney(FREE_CHIP)} · la maison régale`),
  );
  const dealRow = element("div", "bj-deal-row");
  dealRow.append(clearButton, dealButton, freeChipButton, maxButton);
  bettingControls.append(rack, dealRow);

  const playControls = element("div", "bj-playing");
  const hitButton = button("bj-action is-hit");
  hitButton.append(element("span", "bj-action-label", "Tirer"), element("span", "bj-action-note", "une carte"));
  const standButton = button("bj-action is-stand");
  standButton.append(element("span", "bj-action-label", "Rester"), element("span", "bj-action-note", "à la banque"));
  playControls.append(hitButton, standButton);

  const waitControls = element("div", "bj-waiting");
  const waitButton = button("bj-action is-wait");
  waitButton.disabled = true;
  waitButton.append(element("span", "bj-action-label", "Rien ne va plus"), element("span", "bj-action-note", "la banque joue"));
  waitControls.append(waitButton);

  controls.append(bettingControls, playControls, waitControls);
  const regularsLine = element("p", "bj-regulars-line");
  playPanel.append(table, call, controls, regularsLine);

  // The private salon

  const salon = element("section", "bj-salon");
  const edgeCard = element("div", "bj-edge");
  const edgeTitle = element("p", "bj-edge-title", "L'avantage");
  const edgeValue = element("p", "bj-edge-value");
  const edgeNote = element("p", "bj-edge-note");
  edgeCard.append(edgeTitle, edgeValue, edgeNote);

  const tablesTitle = element("h2", "bj-salon-title", "Les salles");
  const tablesList = element("div", "shop");
  const tablesDone = element("p", "bj-salon-done", "Toutes les portes vous sont ouvertes. Même celle du coffre.");
  const upgradesTitle = element("h2", "bj-salon-title", "Les combines");
  const upgradesList = element("div", "shop");
  const regularsTitle = element("h2", "bj-salon-title", "Les habitués");
  const regularsList = element("div", "shop");
  const autoBet = element("div", "bj-autobet");
  const autoBetLabel = element("p", "bj-autobet-label", "Mise des habitués");
  const autoBetLess = button("bj-autobet-step", "−");
  autoBetLess.setAttribute("aria-label", "Baisser la mise des habitués");
  const autoBetValue = element("span", "bj-autobet-value");
  const autoBetMore = button("bj-autobet-step", "+");
  autoBetMore.setAttribute("aria-label", "Monter la mise des habitués");
  autoBet.append(autoBetLabel, autoBetLess, autoBetValue, autoBetMore);
  salon.append(edgeCard, tablesTitle, tablesList, tablesDone, upgradesTitle, upgradesList, regularsTitle, regularsList, autoBet);

  root.append(
    resources,
    playPanel,
    salon,
    createTabs([
      { label: "La table", panel: playPanel },
      { label: "Le salon privé", panel: salon },
    ]),
  );

  const renderUpgrades = createShop(
    upgradesList,
    UPGRADES.filter((upgrade) => upgrade.id !== "regulars").map((upgrade) =>
      upgradeItem(upgrade as UpgradeDefinition & { id: Exclude<UpgradeId, "regulars"> }),
    ),
    session,
  );
  const renderRegulars = createShop(regularsList, [regularsItem(session)], session);
  let renderTables = (_: BlackjackState) => {};

  // Table state shown on screen

  let shownTable = -1;
  let shownRules = "";
  let shownHand = -1;
  let shownPhase: Phase | null = null;
  let shownSpot = -1;
  let shownBlown = 0;
  let shownFumble = false;
  let holeCard: HTMLElement | null = null;
  let revealAt = 0;
  let revealTimer = 0;
  let dealerTimer = 0;
  let totalsAt = 0;
  let eventCall: { text: string; until: number } | null = null;

  function rebuildTable(state: BlackjackState) {
    shownTable = state.tableIndex;

    rack.replaceChildren(
      ...availableChips(state)
        .slice(-RACK_SIZE)
        .map((value) => {
          const chipButton = button("bj-rack-chip");
          chipButton.setAttribute("aria-label", `Miser ${formatMoney(value)}`);
          chipButton.append(chipNode(value));
          chipButton.addEventListener("click", () => {
            session.update((s) => addToStake(s, value));
            eventCall = null;
          });
          return chipButton;
        }),
    );

    tablesList.replaceChildren();
    const next = nextTable(state);
    tablesDone.hidden = next !== undefined;
    renderTables = next
      ? createShop(
          tablesList,
          [
            {
              name: next.name,
              details: () => `Mise jusqu'à ${formatMoney(next.limit)} — ${next.blurb}`,
              cost: () => next.cost,
              buy: buyTable,
            },
          ],
          session,
        )
      : () => {};
  }

  function say(text: string) {
    eventCall = { text, until: performance.now() + EVENT_CALL_MS };
  }

  function callFor(state: BlackjackState): string {
    if (eventCall && performance.now() < eventCall.until) return eventCall.text;
    switch (state.phase) {
      case "betting":
        return session.wallet() < MIN_BET ? "Plus un jeton ? La maison a le cœur tendre." : "Faites vos jeux.";
      case "player":
        return "Carte ou pas carte ?";
      case "dealer":
        if (state.dealerFumbled) return "Oups… une carte de trop.";
        return handValue(state.player).total > 21 ? "Trop ! Rien ne va plus." : "Rien ne va plus. La banque tire.";
      case "settled":
        return verdictFor(state).call;
    }
  }

  function flightFrom(node: HTMLElement, origin: DOMRect) {
    const target = node.getBoundingClientRect();
    node.style.setProperty("--from-x", `${origin.left + origin.width / 2 - (target.left + target.width / 2)}px`);
    node.style.setProperty("--from-y", `${origin.top + origin.height / 2 - (target.top + target.height / 2)}px`);
  }

  function dealCard(hand: HTMLElement, card: Card, delay: number | null, isFaceDown: boolean): HTMLElement {
    const node = cardNode(card);
    node.classList.toggle("is-face-down", isFaceDown);
    hand.append(node);
    if (delay !== null) {
      flightFrom(node, shoe.getBoundingClientRect());
      node.style.animationDelay = `${delay}ms`;
      node.classList.add("is-dealt");
    }
    return node;
  }

  function scheduleReveal(delay: number) {
    if (revealTimer || !holeCard?.classList.contains("is-face-down")) return;
    revealAt = performance.now() + delay;
    revealTimer = window.setTimeout(() => {
      revealTimer = 0;
      holeCard?.classList.remove("is-face-down");
      updateTotals(session.state());
    }, delay);
  }

  function scheduleDealer() {
    if (dealerTimer) return;
    const wait = Math.max(DEALER_STEP_MS, revealAt + REVEAL_MS - performance.now());
    dealerTimer = window.setTimeout(() => {
      dealerTimer = 0;
      session.earn((state) => dealerStep(state, Math.random, session.modifiers()));
    }, wait);
  }

  function isHoleHidden(): boolean {
    return holeCard?.classList.contains("is-face-down") ?? false;
  }

  function updateTotals(state: BlackjackState) {
    const isShown = state.player.length > 0 && performance.now() >= totalsAt;
    playerTag.hidden = !isShown;
    dealerTag.hidden = !isShown;
    if (!isShown) return;
    setText(playerTotal, totalText(state.player, state.phase !== "player"));
    setText(dealerTotal, isHoleHidden() ? totalText(state.dealer.slice(0, 1), false) : totalText(state.dealer, true));
  }

  function syncHands(state: BlackjackState, animate: boolean) {
    const isNewHand = state.handsDealt !== shownHand;
    if (isNewHand) {
      shownHand = state.handsDealt;
      shownBlown = state.blown.length;
      shownFumble = state.dealerFumbled;
      playerHand.replaceChildren();
      dealerHand.replaceChildren();
      holeCard = null;
      verdict.hidden = true;
      window.clearTimeout(revealTimer);
      revealTimer = 0;
      revealAt = 0;
    }
    const isFreshDeal = isNewHand && animate;
    if (isFreshDeal) totalsAt = performance.now() + 3 * DEAL_STAGGER_MS + CARD_FLIGHT_MS;

    state.player.forEach((card, index) => {
      if (index < playerHand.children.length) return;
      const delay = isFreshDeal ? index * 2 * DEAL_STAGGER_MS : 0;
      dealCard(playerHand, card, animate ? delay : null, false);
    });
    state.dealer.forEach((card, index) => {
      if (index < dealerHand.children.length) return;
      const delay = isFreshDeal ? (index * 2 + 1) * DEAL_STAGGER_MS : 0;
      const isHole = index === 1;
      const node = dealCard(dealerHand, card, animate ? delay : null, isHole && (state.phase === "player" || isFreshDeal));
      if (isHole) holeCard = node;
    });

    if (state.phase !== "player" && isHoleHidden()) {
      scheduleReveal(isFreshDeal ? 3 * DEAL_STAGGER_MS + CARD_FLIGHT_MS : 0);
    }
    if (state.blown.length > shownBlown) {
      say(`Le trèfle souffle ${cardName(state.blown.at(-1)!)}… quelle veine !`);
    }
    if (state.dealerFumbled && !shownFumble) say("Oups… le croupier tire une carte de trop.");
    shownBlown = state.blown.length;
    shownFumble = state.dealerFumbled;
  }

  function flyChips(amount: number, from: DOMRect, to: DOMRect) {
    const bounds = felt.getBoundingClientRect();
    const stack = stackNode(amount, "bj-stack bj-flying");
    stack.style.left = `${to.left + to.width / 2 - bounds.left}px`;
    stack.style.top = `${to.top + to.height / 2 - bounds.top}px`;
    stack.style.setProperty("--from-x", `${from.left + from.width / 2 - (to.left + to.width / 2)}px`);
    stack.style.setProperty("--from-y", `${from.top + from.height / 2 - (to.top + to.height / 2)}px`);
    stack.addEventListener("animationend", () => stack.remove());
    felt.append(stack);
  }

  function trayRect(): DOMRect {
    const bounds = room.getBoundingClientRect();
    return new DOMRect(bounds.left + bounds.width / 2 - 20, bounds.bottom - 18, 40, 12);
  }

  function showVerdict(state: BlackjackState, animate: boolean) {
    const { title, amount: text, tone } = verdictFor(state);
    setText(verdictTitle, title);
    setText(verdictAmount, text);
    verdict.dataset.tone = tone;
    verdict.hidden = false;
    verdict.classList.toggle("is-arriving", animate);
    if (!animate) return;
    if (tone === "win") flyChips(state.lastPayout - state.bet, trayRect(), spotStack.getBoundingClientRect());
    if (tone === "loss") flyChips(state.bet, spotStack.getBoundingClientRect(), trayRect());
  }

  function renderSpot(state: BlackjackState) {
    const value = isBetting(state) ? state.stake : state.bet;
    if (value === shownSpot) return;
    shownSpot = value;
    spotStack.replaceChildren(...stackNode(value).children);
    setText(spotAmount, value > 0 ? formatMoney(value) : "Misez");
  }

  function renderControls(state: BlackjackState) {
    const wallet = session.wallet();
    bettingControls.hidden = !isBetting(state);
    playControls.hidden = state.phase !== "player";
    waitControls.hidden = state.phase !== "dealer";

    const isBroke = canClaimFreeChip(state, wallet);
    freeChipButton.hidden = !isBroke;
    dealButton.hidden = isBroke;
    dealButton.disabled = !canDeal(state, wallet);
    const stake = fitStake(state, wallet).stake;
    setText(dealAmount, state.stake === 0 ? "posez vos jetons" : `mise ${formatMoney(stake)}`);
    clearButton.disabled = state.stake === 0;
    maxButton.disabled = state.stake >= Math.min(tableLimit(state), wallet);
  }

  function renderSalon(state: BlackjackState) {
    const modifiers = session.modifiers();
    const edge = expectedValue(state);
    edgeCard.dataset.side = edge > 0 ? "player" : "house";
    setText(edgeValue, edge > 0 ? `Pour vous : ${signedPercent(edge)}` : `Pour la maison : ${percent(edge)}`);
    setText(
      edgeNote,
      edge > 0
        ? `Jouée comme la banque (tirer jusqu'à 16, rester à 17), une main rapporte en moyenne ${percent(edge)} de la mise. Les habitués peuvent s'asseoir.`
        : `Jouée comme la banque (tirer jusqu'à 16, rester à 17), une main coûte en moyenne ${percent(edge)} de la mise. Aucun habitué ne s'assoit à une table perdante : trichez d'abord.`,
    );

    const options = autoBetOptions(state);
    const index = options.indexOf(state.autoBet);
    autoBet.hidden = state.upgrades.regulars === 0;
    setText(autoBetValue, formatMoney(state.autoBet));
    autoBetLess.disabled = index <= 0;
    autoBetMore.disabled = index === -1 || index >= options.length - 1;

    const hands = handsPerSecond(state);
    if (state.upgrades.regulars > 0) {
      regularsLine.hidden = false;
      setText(
        regularsLine,
        `${plural(state.upgrades.regulars, "habitué")} · ${decimal(hands)} main/s à ${formatMoney(state.autoBet)} · ${formatIncome(incomePerSecond(state, modifiers))}`,
      );
    } else {
      regularsLine.hidden = true;
    }

    renderTables(state);
    renderUpgrades(state);
    renderRegulars(state);
  }

  function renderResources(state: BlackjackState) {
    setText(amount, formatNumber(state.handsWon));
    setText(amountLabel, state.handsWon > 1 ? "mains gagnées" : "main gagnée");
    const table = currentTable(state);
    setText(rate, `${table.name} · mises de ${formatMoney(MIN_BET)} à ${formatMoney(table.limit)}`);
  }

  function render(state: BlackjackState, animate = true) {
    if (state.tableIndex !== shownTable) rebuildTable(state);
    const { top, bottom } = rules(state);
    if (top !== shownRules) {
      shownRules = top;
      arcArt.innerHTML = feltArc(top, bottom);
    }

    syncHands(state, animate);
    if (state.phase === "settled" && shownPhase !== "settled") showVerdict(state, animate && shownPhase !== null);
    if (state.phase === "dealer" && !isHoleHidden()) scheduleDealer();
    shownPhase = state.phase;

    updateTotals(state);
    renderSpot(state);
    renderControls(state);
    setText(call, callFor(state));
    renderResources(state);
    renderSalon(state);
  }

  // Actions

  function dealHand() {
    const state = session.state();
    const wallet = session.wallet();
    if (!canDeal(state, wallet)) return;
    const stake = fitStake(state, wallet).stake;
    eventCall = null;
    session.buy(stake, (s) => deal(fitStake(s, wallet), Math.random));
  }

  function hitCard() {
    if (session.state().phase === "player") session.update((state) => hit(state, Math.random));
  }

  function standHand() {
    if (session.state().phase === "player") session.update(stand);
  }

  function stepAutoBet(direction: number) {
    const state = session.state();
    const options = autoBetOptions(state);
    const next = options[options.indexOf(state.autoBet) + direction];
    if (next !== undefined) session.update((s) => setAutoBet(s, next));
  }

  dealButton.addEventListener("click", dealHand);
  hitButton.addEventListener("click", hitCard);
  standButton.addEventListener("click", standHand);
  clearButton.addEventListener("click", () => session.update(clearStake));
  maxButton.addEventListener("click", () => {
    const wallet = session.wallet();
    session.update((state) => setStake(state, Math.floor(wallet / MIN_BET) * MIN_BET));
  });
  freeChipButton.addEventListener("click", () => {
    say("Le casino vous offre un jeton. Bonne chance !");
    session.earn(claimFreeChip);
  });
  autoBetLess.addEventListener("click", () => stepAutoBet(-1));
  autoBetMore.addEventListener("click", () => stepAutoBet(1));

  function onKey(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === "t" || key === "h") hitCard();
    else if (key === "r" || key === "s") standHand();
    else if (key === "d" || (key === "enter" && document.activeElement === document.body)) dealHand();
  }
  document.addEventListener("keydown", onKey);

  const preventDefault = (event: Event) => event.preventDefault();
  for (const type of ["dblclick", "gesturestart", "selectstart"]) root.addEventListener(type, preventDefault);

  render(session.state(), false);
  const unsubscribe = session.onChange((state) => render(state));

  return () => {
    unsubscribe();
    window.clearTimeout(revealTimer);
    window.clearTimeout(dealerTimer);
    document.removeEventListener("keydown", onKey);
  };
}
