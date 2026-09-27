import { formatNumber } from "../../engine/format";
import { createShop, type ShopItem } from "../../engine/shop";
import { createTabs } from "../../engine/tabs";
import { formatIncome, formatMoney } from "../../platform/currency";
import type { GameSession, Modifiers } from "../types";
import { DEBUNK, DEBUNK_MESSAGES, SCOPES, UPGRADES } from "./config";
import {
  buyUpgrade,
  canLevelUp,
  crushDebunk,
  incomePerSecond,
  isLastScope,
  levelUp,
  population,
  spreadPerSecond,
  spreadRate,
  tapPower,
  upgradeCost,
  whisper,
  whisperEarning,
  type RumorState,
} from "./state";
import "@fontsource-variable/caveat";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource/special-elite";
import "./style.css";

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

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)} %`;
}

function formatWhisperPower(state: RumorState, modifiers: Modifiers): string {
  const power = tapPower(state, modifiers);
  const believers = `+${formatNumber(power, Number.isInteger(power) ? 0 : 1)} croyant${power > 1 ? "s" : ""}`;
  const boosted = modifiers.tap === 1 ? believers : `${believers} (×${Number(modifiers.tap.toFixed(2))})`;
  return `${boosted} · +${formatMoney(whisperEarning(state, modifiers))}`;
}

const shopItems: ShopItem<RumorState>[] = UPGRADES.map((upgrade) => ({
  name: upgrade.name,
  details: (state) => {
    const effects = [
      upgrade.tapPower && `+${formatNumber(upgrade.tapPower)} par chuchotement`,
      upgrade.spreadRate && `+${formatPercent(upgrade.spreadRate)} propagation`,
    ].filter(Boolean);
    return `${effects.join(" · ")} — possédé : ${state.upgrades[upgrade.id]}`;
  },
  cost: (state) => upgradeCost(state, upgrade.id),
  buy: (state) => buyUpgrade(state, upgrade.id),
}));

export function mount(root: HTMLElement, session: GameSession<RumorState>): () => void {
  const resources = element("header", "resources");
  const amount = element("p", "resource-amount");
  const rate = element("p", "resource-rate");
  const income = element("p", "resource-income");
  resources.append(amount, rate, income);

  const mainPanel = element("section", "rumor-main");
  const scopeLabel = element("p", "rumor-scope");
  const rumorText = element("blockquote", "rumor-text");
  const progress = element("div", "rumor-progress");
  const progressFill = element("div", "rumor-progress-fill");
  progress.append(progressFill);
  const progressLabel = element("p", "rumor-progress-label");
  const levelUpButton = button("rumor-level-up");
  const whisperButton = button("rumor-whisper");
  const whisperLabel = element("span", "", "Chuchoter");
  const whisperPower = element("small", "rumor-whisper-power");
  whisperButton.append(whisperLabel, whisperPower);
  mainPanel.append(scopeLabel, rumorText, progress, progressLabel, levelUpButton, whisperButton);

  const shopPanel = element("section");
  const shopList = element("div", "shop");
  shopPanel.append(shopList);

  const debunkCard = button("rumor-debunk");
  const debunkTitle = element("strong", "", "Démenti !");
  const debunkMessage = element("span", "rumor-debunk-message");
  const debunkHint = element("small", "", `Tape vite pour l'écraser, sinon −${DEBUNK.penalty * 100} % de croyants`);
  const debunkTimer = element("span", "rumor-debunk-timer");
  debunkCard.append(debunkTitle, debunkMessage, debunkHint, debunkTimer);

  const tabs = createTabs([
    { label: "Rumeur", panel: mainPanel },
    { label: "Boutique", panel: shopPanel },
  ]);
  root.append(resources, mainPanel, shopPanel, tabs, debunkCard);

  const renderShop = createShop(shopList, shopItems, session);

  whisperButton.addEventListener("click", () => session.earn((s) => whisper(s, session.modifiers())));
  levelUpButton.addEventListener("click", () => session.update(levelUp));
  debunkCard.addEventListener("click", () => session.update((s) => crushDebunk(s, Math.random)));

  let renderedScopeIndex = -1;

  function renderScope(state: RumorState) {
    if (renderedScopeIndex === state.scopeIndex) return;
    renderedScopeIndex = state.scopeIndex;
    const scope = SCOPES[state.scopeIndex];
    scopeLabel.textContent = `${scope.name} · niveau ${state.scopeIndex + 1}/${SCOPES.length}`;
    rumorText.textContent = `« ${scope.rumor} »`;
    rumorText.animate([{ transform: "scale(0.8)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], 400);
  }

  function renderDebunk(state: RumorState) {
    debunkCard.hidden = !state.debunk;
    if (!state.debunk) return;
    debunkMessage.textContent = DEBUNK_MESSAGES[state.debunk.messageIndex];
    debunkTimer.style.transform = `scaleX(${state.debunk.secondsLeft / DEBUNK.durationSeconds})`;
  }

  function render(state: RumorState) {
    const modifiers = session.modifiers();
    const cap = population(state);
    amount.textContent = formatNumber(state.believers);
    rate.textContent = `croyants · +${formatNumber(spreadPerSecond(state, modifiers), 1)}/s · propagation ${formatPercent(spreadRate(state, modifiers))}`;
    income.textContent = `Ils rapportent ${formatIncome(incomePerSecond(state, modifiers))}`;

    renderScope(state);
    progressFill.style.transform = `scaleX(${state.believers / cap})`;
    progressLabel.textContent =
      isLastScope(state) && state.believers >= cap * 0.99
        ? "Le monde entier y croit. Mission accomplie."
        : `${formatNumber(state.believers)} / ${formatNumber(cap)} y croient`;

    levelUpButton.hidden = !canLevelUp(state);
    if (canLevelUp(state)) levelUpButton.textContent = `Passer au niveau supérieur : ${SCOPES[state.scopeIndex + 1].name}`;
    whisperPower.textContent = formatWhisperPower(state, modifiers);

    renderDebunk(state);
    renderShop(state);
  }

  let previous = session.state();
  const unsubscribe = session.onChange((state) => {
    const debunkHit = previous.debunk && !state.debunk && state.believers < previous.believers;
    if (debunkHit) amount.animate([{ color: "#d97b7f", transform: "scale(0.9)" }, {}], 600);
    previous = state;
    render(state);
  });

  render(previous);

  return unsubscribe;
}
