import "@fontsource/bangers";
import "./style.css";
import { createShop, type ShopItem } from "../../engine/shop";
import { createTabs } from "../../engine/tabs";
import { formatIncome, formatMoney } from "../../platform/currency";
import type { GameSession } from "../types";
import { MAX_LEVEL, SPECIES } from "./config";
import {
  buyIncubator,
  buySlime,
  buyTapUpgrade,
  canMerge,
  incubatorCost,
  isDiscovered,
  isGridFull,
  isIncubatorUnlocked,
  mergeSlimes,
  productionPerSecond,
  slimeCost,
  slimeCount,
  slimeProduction,
  tap,
  tapUpgradeCost,
  tapValue,
  type SlimeLabState,
} from "./state";

const TOAST_DURATION_MS = 2500;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  created.textContent = text;
  return created;
}

function speciesOf(level: number) {
  return SPECIES[level - 1];
}

function restartAnimation(target: HTMLElement, className: string) {
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
}

export function mount(root: HTMLElement, session: GameSession<SlimeLabState>): () => void {
  let selectedSlot: number | null = null;
  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  let renderedSlots: SlimeLabState["slots"] | undefined;
  let knownHighestLevel = session.state().highestLevel;

  const resources = element("header", "resources");
  const speciesStat = element("p", "resource-amount");
  const speciesFound = element("span");
  const speciesLabel = element("span", "resource-label");
  speciesStat.append(speciesFound, speciesLabel);
  const labIncome = element("p", "resource-rate");
  resources.append(speciesStat, labIncome);

  const labPanel = element("section", "lab");
  const bigSlime = element("button", "big-slime");
  bigSlime.type = "button";
  bigSlime.setAttribute("aria-label", "Presser le slime");
  const grid = element("div", "merge-grid");
  const slotButtons = session.state().slots.map((_, index) => {
    const button = element("button", "slot");
    button.type = "button";
    button.addEventListener("click", () => onSlotTap(index));
    grid.append(button);
    return button;
  });
  const hint = element("p", "hint");
  const labShop = element("div", "shop");
  labPanel.append(bigSlime, grid, hint, labShop);

  const shopPanel = element("section", "upgrades");
  const upgradesShop = element("div", "shop");
  shopPanel.append(upgradesShop);

  const bestiaryPanel = element("section", "bestiary");
  const bestiaryCount = element("p", "bestiary-count");
  const bestiaryList = element("ul", "bestiary-list");
  bestiaryPanel.append(bestiaryCount, bestiaryList);

  const toast = element("div", "toast");
  toast.setAttribute("role", "status");

  const tabs = createTabs([
    { label: "🧪 Labo", panel: labPanel },
    { label: "🛒 Boutique", panel: shopPanel },
    { label: "📖 Bestiaire", panel: bestiaryPanel },
  ]);
  root.append(resources, labPanel, shopPanel, bestiaryPanel, tabs, toast);

  const slimeItem: ShopItem<SlimeLabState> = {
    name: "Acheter un slime",
    details: (s) =>
      isGridFull(s)
        ? "Labo plein : fusionnez !"
        : `${speciesOf(s.spawnLevel).emoji} ${speciesOf(s.spawnLevel).name} · ${formatIncome(slimeProduction(s.spawnLevel) * session.modifiers().production)}`,
    cost: slimeCost,
    buy: buySlime,
    isAvailable: (s) => !isGridFull(s),
  };
  const tapItem: ShopItem<SlimeLabState> = {
    name: "Spatule renforcée",
    details: (s) => {
      const current = tapValue(s, session.modifiers());
      return `Pression : ${formatMoney(current)} → ${formatMoney(current * 2)}`;
    },
    cost: tapUpgradeCost,
    buy: buyTapUpgrade,
  };
  const incubatorItem: ShopItem<SlimeLabState> = {
    name: "Couveuse",
    details: (s) => {
      if (s.spawnLevel + 2 > MAX_LEVEL) return "Couveuse au maximum";
      if (!isIncubatorUnlocked(s)) return "Découvrez une nouvelle espèce pour l'améliorer";
      return `Les slimes achetés naissent ${speciesOf(s.spawnLevel + 1).name}`;
    },
    cost: incubatorCost,
    buy: buyIncubator,
    isAvailable: isIncubatorUnlocked,
  };

  const renderLabShop = createShop(labShop, [slimeItem], session);
  const renderUpgradesShop = createShop(upgradesShop, [tapItem, incubatorItem], session);

  function onSlotTap(index: number) {
    const state = session.state();
    if (selectedSlot !== null && canMerge(state, selectedSlot, index)) {
      const from = selectedSlot;
      selectedSlot = null;
      session.update((s) => mergeSlimes(s, from, index));
      restartAnimation(slotButtons[index], "merged");
      return;
    }
    selectedSlot = selectedSlot === index || state.slots[index] === null ? null : index;
    renderLab(state);
  }

  function announceSpecies(level: number) {
    const species = speciesOf(level);
    toast.textContent = `Nouvelle espèce ! ${species.emoji} ${species.name}`;
    toast.style.setProperty("--slime-color", species.color);
    restartAnimation(toast, "visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("visible"), TOAST_DURATION_MS);
  }

  function renderLab(state: SlimeLabState) {
    renderedSlots = state.slots;
    if (selectedSlot !== null && state.slots[selectedSlot] === null) selectedSlot = null;
    const selectedLevel = selectedSlot === null ? null : state.slots[selectedSlot];
    state.slots.forEach((level, index) => {
      const button = slotButtons[index];
      button.classList.toggle("empty", level === null);
      button.classList.toggle("selected", index === selectedSlot);
      button.classList.toggle("match", selectedSlot !== null && canMerge(state, selectedSlot, index));
      if (level === null) {
        button.replaceChildren();
        button.setAttribute("aria-label", "Emplacement vide");
        return;
      }
      const species = speciesOf(level);
      button.style.setProperty("--slime-color", species.color);
      button.setAttribute("aria-label", `${species.name}, niveau ${level}`);
      button.replaceChildren(element("span", "slot-emoji", species.emoji), element("span", "slot-level", String(level)));
    });

    hint.textContent =
      selectedLevel == null
        ? "Touchez deux slimes identiques pour les fusionner."
        : `${speciesOf(selectedLevel).name} sélectionné : touchez son jumeau !`;
  }

  function renderBestiary(state: SlimeLabState) {
    bestiaryCount.textContent = `${state.highestLevel} / ${MAX_LEVEL} espèces découvertes`;
    bestiaryList.replaceChildren(
      ...SPECIES.map((species, index) => {
        const level = index + 1;
        const discovered = isDiscovered(state, level);
        const entry = element("li", discovered ? "species" : "species unknown");
        entry.style.setProperty("--slime-color", discovered ? species.color : "var(--surface-2)");
        const name = element("span", "species-name", discovered ? species.name : "???");
        const details = element(
          "span",
          "species-details",
          discovered ? `Niveau ${level} · ${formatIncome(slimeProduction(level))}` : `Niveau ${level}`,
        );
        entry.append(element("span", "species-blob", discovered ? species.emoji : "❓"), name, details);
        return entry;
      }),
    );
  }

  function render(state: SlimeLabState) {
    if (state.highestLevel > knownHighestLevel) {
      knownHighestLevel = state.highestLevel;
      announceSpecies(state.highestLevel);
      renderBestiary(state);
    }
    if (state.slots !== renderedSlots) renderLab(state);

    speciesFound.textContent = `${state.highestLevel}`;
    speciesLabel.textContent = ` / ${MAX_LEVEL} espèces`;
    labIncome.textContent = `${slimeCount(state)} slimes · ${formatIncome(productionPerSecond(state, session.modifiers()))} · ${formatMoney(session.wallet())} en poche`;
    renderLabShop(state);
    renderUpgradesShop(state);
  }

  bigSlime.addEventListener("click", () => {
    session.earn((s) => tap(s, session.modifiers()));
    restartAnimation(bigSlime, "squish");
  });

  renderBestiary(session.state());
  render(session.state());
  const unsubscribe = session.onChange(render);

  return () => {
    unsubscribe();
    clearTimeout(toastTimeout);
  };
}
