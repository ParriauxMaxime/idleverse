import "@fontsource/alfa-slab-one";
import "@fontsource/rye";
import { formatNumber } from "../../engine/format";
import { createShop, type ShopItem } from "../../engine/shop";
import { createTabs } from "../../engine/tabs";
import { formatIncome, formatMoney } from "../../platform/currency";
import type { GameSession, Modifiers } from "../types";
import {
  COACH_SINK_MULTIPLIER,
  MAGNESIA_PAYOUT_MULTIPLIER,
  PROTEIN_STRENGTH_BONUS,
  SINK_GRACE_SECONDS,
  TRAINING_STRENGTH_MULTIPLIER,
  UPGRADES,
  type UpgradeDefinition,
  type UpgradeId,
} from "./config";
import {
  applyPose,
  CELEBRATION_MS,
  celebrationPose,
  createFigure,
  FALL_MS,
  liftPose,
  loadAnchors,
  showLoad,
  TRIUMPH_MS,
} from "./figure";
import {
  buyUpgrade,
  buyWeight,
  canBuyUpgrade,
  currentWeight,
  incomePerSecond,
  isAutomated,
  liftPayout,
  nextWeight,
  tap,
  tapsPerLift,
  upgradeCost,
  type StrongmanState,
} from "./state";
import "./style.css";

const LIFT_SMOOTHING_PER_SECOND = 22;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function percent(multiplier: number): string {
  return `${Math.round(Math.abs(multiplier) * 100)} %`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

const UPGRADE_EFFECTS: Record<UpgradeId, (state: StrongmanState, modifiers: Modifiers) => string> = {
  protein: (state) => `Force +${percent(PROTEIN_STRENGTH_BONUS)} · niveau ${state.upgrades.protein}`,
  training: (state) => `Force ×${TRAINING_STRENGTH_MULTIPLIER} · niveau ${state.upgrades.training}`,
  coach: (state) =>
    canBuyUpgrade(state, "coach")
      ? `Chute −${percent(1 - COACH_SINK_MULTIPLIER)} · ${state.upgrades.coach}/${UPGRADES.find((u) => u.id === "coach")!.maxLevel}`
      : `Complet : ${state.upgrades.coach}/${state.upgrades.coach}`,
  magnesia: (state) => `Levées ×${String(MAGNESIA_PAYOUT_MULTIPLIER).replace(".", ",")} · niveau ${state.upgrades.magnesia}`,
  autoLift: (state, modifiers) => {
    const gain = incomePerSecond(buyUpgrade(state, "autoLift"), modifiers) - incomePerSecond(state, modifiers);
    return `+1 poussée/s (${formatIncome(gain)}) · niveau ${state.upgrades.autoLift}`;
  },
};

function upgradeItem(upgrade: UpgradeDefinition, session: GameSession<StrongmanState>): ShopItem<StrongmanState> {
  return {
    name: upgrade.name,
    details: (state) => `${UPGRADE_EFFECTS[upgrade.id](state, session.modifiers())} — ${upgrade.blurb}`,
    cost: (state) => upgradeCost(state, upgrade.id),
    buy: (state) => buyUpgrade(state, upgrade.id),
    isAvailable: (state) => canBuyUpgrade(state, upgrade.id),
  };
}

function removeOnAnimationEnd(node: Element) {
  node.addEventListener("animationend", () => node.remove());
}

function replayClass(node: Element, className: string) {
  node.classList.remove(className);
  void node.getBoundingClientRect();
  node.classList.add(className);
}

export function mount(root: HTMLElement, session: GameSession<StrongmanState>): () => void {
  const resources = element("header", "resources");
  const amount = element("p", "resource-amount");
  const amountLabel = element("p", "sm-amount-label");
  const rate = element("p", "resource-rate");
  resources.append(amount, amountLabel, rate);

  const showPanel = element("section", "sm-show");
  const billing = element("p", "sm-billing", "L'homme le plus fort du monde");
  const stage = element("button", "sm-stage");
  stage.type = "button";
  stage.setAttribute("aria-label", "Soulever la barre");
  const figure = createFigure(stage);
  const striker = element("div", "sm-striker");
  const bell = element("span", "sm-bell");
  const track = element("span", "sm-striker-track");
  const puck = element("span", "sm-striker-puck");
  track.append(puck);
  striker.append(bell, track);
  stage.append(striker);

  const placard = element("div", "sm-placard");
  const weightName = element("p", "sm-weight-name");
  const weightStats = element("p", "sm-weight-stats");
  const boast = element("p", "sm-boast");
  placard.append(weightName, weightStats, boast);
  const hint = element("p", "sm-hint");
  showPanel.append(billing, stage, hint, placard);

  const shopPanel = element("section", "sm-shop");
  const weightsTitle = element("h2", "sm-shop-title", "Le râtelier");
  const weightsList = element("div", "shop");
  const collectionDone = element("p", "sm-collection-done", "Tout a été soulevé. Même le chapiteau. Surtout le chapiteau.");
  const upgradesTitle = element("h2", "sm-shop-title", "L'entraînement");
  const upgradesList = element("div", "shop");
  shopPanel.append(weightsTitle, weightsList, collectionDone, upgradesTitle, upgradesList);

  root.append(
    resources,
    showPanel,
    shopPanel,
    createTabs([
      { label: "Le spectacle", panel: showPanel },
      { label: "La baraque", panel: shopPanel },
    ]),
  );

  const renderUpgrades = createShop(
    upgradesList,
    UPGRADES.map((upgrade) => upgradeItem(upgrade, session)),
    session,
  );
  let renderWeights = (_: StrongmanState) => {};
  let shownWeightIndex = -1;

  function rebuildWeights(state: StrongmanState) {
    shownWeightIndex = state.weightIndex;
    showLoad(figure, currentWeight(state).look);
    weightsList.replaceChildren();
    const next = nextWeight(state);
    collectionDone.hidden = next !== undefined;
    renderWeights = next
      ? createShop(
          weightsList,
          [
            {
              name: `${next.name} · ${formatNumber(next.kilograms)} kg`,
              details: () => `${formatMoney(next.payout)} la levée — « ${next.boast} »`,
              cost: () => next.cost,
              buy: buyWeight,
            },
          ],
          session,
        )
      : () => {};
  }

  let shownLift = session.state().lift;
  let shownLifts = session.state().liftsCompleted;
  let celebrationStart = -Infinity;
  let hasBoomed = true;
  let lastFrame = performance.now();

  function toScreen(x: number, y: number) {
    const matrix = figure.svg.getScreenCTM();
    const bounds = stage.getBoundingClientRect();
    const point = matrix ? new DOMPoint(x, y).matrixTransform(matrix) : new DOMPoint(bounds.width / 2, bounds.height / 2);
    return { left: point.x - bounds.left, top: point.y - bounds.top };
  }

  function spawn(className: string, text: string, position: { left: number; top: number }) {
    const node = element("span", className, text);
    node.style.left = `${position.left}px`;
    node.style.top = `${position.top}px`;
    removeOnAnimationEnd(node);
    stage.append(node);
    return node;
  }

  function startCelebration(state: StrongmanState, now: number) {
    const earned = (state.liftsCompleted - shownLifts) * liftPayout(state);
    shownLifts = state.liftsCompleted;
    celebrationStart = now;
    hasBoomed = false;
    replayClass(bell, "is-ringing");
    spawn("sm-gain", `+${formatMoney(earned)}`, toScreen(150, -30));
  }

  function boom() {
    hasBoomed = true;
    replayClass(stage, "is-shaking");
    spawn("sm-boum", "Boum !", toScreen(150, 230));
    for (const anchor of loadAnchors()) {
      spawn("sm-dust is-left", "", toScreen(anchor.x, anchor.y));
      spawn("sm-dust is-right", "", toScreen(anchor.x, anchor.y));
    }
  }

  function renderStage(state: StrongmanState) {
    const now = performance.now();
    const seconds = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;

    if (state.liftsCompleted > shownLifts && now - celebrationStart >= CELEBRATION_MS) startCelebration(state, now);

    const elapsed = now - celebrationStart;
    if (elapsed < CELEBRATION_MS) {
      if (!hasBoomed && elapsed >= TRIUMPH_MS + FALL_MS) boom();
      shownLift = 0;
      applyPose(figure, celebrationPose(elapsed));
      puck.style.setProperty("--lift", "1");
      return;
    }

    shownLift += (state.lift - shownLift) * (1 - Math.exp(-LIFT_SMOOTHING_PER_SECOND * seconds));
    applyPose(figure, liftPose(shownLift));
    puck.style.setProperty("--lift", shownLift.toFixed(3));
  }

  function hintFor(state: StrongmanState): string {
    if (isAutomated(state)) return "Il soulève tout seul. Vos coups accélèrent la cadence !";
    if (state.lift > 0 && state.secondsSinceTap > SINK_GRACE_SECONDS) return "Ça redescend ! Tapez, tapez !";
    if (state.liftsCompleted === 0) return "Tapez sur l'Hercule, vite et sans vous arrêter !";
    return "Ne lâchez rien : si vous arrêtez, la barre redescend.";
  }

  function render(state: StrongmanState) {
    if (state.weightIndex !== shownWeightIndex) rebuildWeights(state);

    const modifiers = session.modifiers();
    const weight = currentWeight(state);
    const taps = tapsPerLift(state, modifiers);
    amount.textContent = formatNumber(state.liftsCompleted);
    amountLabel.textContent = state.liftsCompleted > 1 ? "levées réussies" : "levée réussie";
    rate.textContent = isAutomated(state)
      ? `Tout seul : ${formatIncome(incomePerSecond(state, modifiers))}`
      : "Il n'attend que vous";
    weightName.textContent = weight.name;
    weightStats.textContent = `${formatNumber(weight.kilograms)} kg · ${formatMoney(liftPayout(state))} la levée · ${plural(taps, "coup")}`;
    boast.textContent = `« ${weight.boast} »`;
    hint.textContent = hintFor(state);

    renderStage(state);
    renderWeights(state);
    renderUpgrades(state);
  }

  function lift() {
    session.earn((state) => tap(state, session.modifiers()));
  }

  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    lift();
  });
  stage.addEventListener("click", (event) => {
    const isKeyboardActivation = event.detail === 0;
    if (isKeyboardActivation) lift();
  });
  const preventDefault = (event: Event) => event.preventDefault();
  for (const type of ["contextmenu", "dblclick", "gesturestart", "selectstart"]) {
    stage.addEventListener(type, preventDefault);
  }

  render(session.state());
  return session.onChange(render);
}
