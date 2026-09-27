import "@fontsource-variable/space-grotesk";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import { formatNumber } from "../../engine/format";
import { createShop, type ShopItem } from "../../engine/shop";
import { createTabs } from "../../engine/tabs";
import { formatIncome, formatMoney } from "../../platform/currency";
import type { GameSession } from "../types";
import { DOLLARS_PER_MASS, GENERATORS, TIERS, type GeneratorDefinition } from "./config";
import {
  absorb,
  buyGenerator,
  currentTier,
  generatorCost,
  holeGrowth,
  incomePerSecond,
  nextTier,
  tapValue,
  tierIndex,
  tierProgress,
  unlockedGenerators,
  type BlackHoleState,
} from "./state";
import "./style.css";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function generatorItem(generator: GeneratorDefinition): ShopItem<BlackHoleState> {
  return {
    name: generator.name,
    details: (state) =>
      `${formatIncome(generator.massPerSecond * DOLLARS_PER_MASS)} · ${state.generators[generator.id]} possédé(s)`,
    cost: (state) => generatorCost(state, generator.id),
    buy: (state) => buyGenerator(state, generator.id),
  };
}

function removeOnAnimationEnd(node: HTMLElement) {
  node.addEventListener("animationend", () => node.remove());
}

function spawnDebris(stage: HTMLElement, emoji: string) {
  const debris = element("span", "debris", emoji);
  debris.style.setProperty("--angle", `${Math.random() * 360}deg`);
  removeOnAnimationEnd(debris);
  stage.append(debris);
}

interface ScreenPoint {
  clientX: number;
  clientY: number;
}

function spawnGainText(stage: HTMLElement, point: ScreenPoint, text: string) {
  const bounds = stage.getBoundingClientRect();
  const gain = element("span", "gain", text);
  gain.style.left = `${point.clientX - bounds.left}px`;
  gain.style.top = `${point.clientY - bounds.top}px`;
  removeOnAnimationEnd(gain);
  stage.append(gain);
}

export function mount(root: HTMLElement, session: GameSession<BlackHoleState>): () => void {
  const resources = element("section", "resources");
  const amount = element("p", "resource-amount");
  const rate = element("p", "resource-rate");
  const wallet = element("p", "resource-wallet");
  resources.append(amount, rate, wallet);

  const holePanel = element("section", "hole-panel");
  const tierName = element("p", "tier-name");
  const tierFlavor = element("p", "tier-flavor");
  const stage = element("div", "stage");
  const hole = element("button", "black-hole");
  hole.type = "button";
  hole.setAttribute("aria-label", "Absorber de la matière");
  hole.append(element("span", "accretion-disk is-back"), element("span", "accretion-disk is-front"));
  stage.append(hole);
  const progress = element("div", "tier-progress");
  const progressBar = element("div", "tier-progress-bar");
  progress.append(progressBar);
  const nextTierLabel = element("p", "tier-next");
  holePanel.append(tierName, tierFlavor, stage, progress, nextTierLabel);

  const shopPanel = element("section", "shop-panel");
  const shopList = element("div", "shop");
  const lockedHint = element("p", "shop-locked");
  shopPanel.append(shopList, lockedHint);

  root.append(
    resources,
    holePanel,
    shopPanel,
    createTabs([
      { label: "Trou noir", panel: holePanel },
      { label: "Boutique", panel: shopPanel },
    ]),
  );

  let shownTier = -1;
  let renderShop = (_: BlackHoleState) => {};

  function rebuildShop(state: BlackHoleState) {
    shopList.replaceChildren();
    renderShop = createShop(shopList, unlockedGenerators(state).map(generatorItem), session);
    const nextLocked = GENERATORS.find((g) => g.unlockTier > shownTier);
    lockedHint.textContent = nextLocked
      ? `Prochain générateur au stade ${TIERS[nextLocked.unlockTier].name} ${TIERS[nextLocked.unlockTier].emoji}`
      : "";
  }

  function render(state: BlackHoleState) {
    if (tierIndex(state.absorbedMass) !== shownTier) {
      shownTier = tierIndex(state.absorbedMass);
      rebuildShop(state);
    }

    const modifiers = session.modifiers();
    const tier = currentTier(state);
    const next = nextTier(state);
    amount.textContent = formatNumber(state.absorbedMass);
    rate.textContent = formatIncome(incomePerSecond(state, modifiers));
    wallet.textContent = formatMoney(session.wallet());
    tierName.textContent = `${tier.emoji} ${tier.name} · +${formatNumber(tapValue(state, modifiers))} par clic`;
    tierFlavor.textContent = tier.flavor;
    progressBar.style.width = `${tierProgress(state) * 100}%`;
    nextTierLabel.textContent = next
      ? `Prochain stade : ${next.name} ${next.emoji} à ${formatNumber(next.threshold)} de masse absorbée`
      : "Stade ultime atteint";
    stage.style.setProperty("--growth", String(holeGrowth(state.absorbedMass)));
    renderShop(state);
  }

  function absorbAt(point: ScreenPoint) {
    const walletBefore = session.wallet();
    session.earn((state) => absorb(state, session.modifiers()));
    spawnDebris(stage, currentTier(session.state()).emoji);
    spawnGainText(stage, point, `+${formatMoney(session.wallet() - walletBefore)}`);
  }

  hole.addEventListener("pointerdown", (event) => {
    if (event.button === 0) absorbAt(event);
  });
  hole.addEventListener("click", (event) => {
    const isKeyboardActivation = event.detail === 0;
    if (!isKeyboardActivation) return;
    const bounds = hole.getBoundingClientRect();
    absorbAt({ clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 });
  });

  render(session.state());
  return session.onChange(render);
}
