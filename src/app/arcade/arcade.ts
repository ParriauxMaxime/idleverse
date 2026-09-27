import "@fontsource/bungee";
import "@fontsource/press-start-2p";
import "@fontsource-variable/caveat";
import "./arcade.css";
import { GENRE_LABELS, type GameDefinition } from "../../games/types";
import { formatIncome, formatMoney } from "../../platform/currency";
import { gameUnlock, progressionRank } from "../../platform/progression";
import type { Runtime } from "../../platform/runtime";
import { UNLOCKS, type Unlock } from "../../platform/unlocks";
import { describeReward } from "../describe";
import { element } from "../dom";
import { gameHref } from "../router";

interface ArcadeActions {
  onResetAll: () => void;
  onToggleAllGames: (isOn: boolean) => void;
}

interface TrackedRequirement {
  unlock: Unlock;
  fill: HTMLElement;
}

function scribbledProgress(): { bar: HTMLElement; fill: HTMLElement } {
  const bar = element("span", "scribbled-progress");
  const fill = element("span", "scribbled-progress-fill");
  bar.append(fill);
  return { bar, fill };
}

function sign(): HTMLElement {
  const board = element("header", "arcade-sign");
  board.append(
    element("p", "arcade-sign-kicker", "Salle de jeux"),
    element("h1", "arcade-sign-title", "L'Incrémental"),
    element("p", "arcade-sign-subtitle", "Chez Dédé · depuis 1987"),
  );
  return board;
}

function ownerNote(): HTMLElement {
  const note = element("aside", "owner-note");
  const rules = element("ol", "owner-note-rules");
  rules.append(
    element("li", "", "Interdit de taper sur les bornes. Sauf sur les boutons."),
    element("li", "", "Une borne en panne se répare quand vous avez fait vos preuves ailleurs."),
    element("li", "", "Pas de crédit. Même pour les habitués."),
  );
  note.append(element("p", "owner-note-title", "Mot du patron"), rules, element("p", "owner-note-signature", "— Dédé"));
  return note;
}

function coinMachine(runtime: Runtime) {
  const machine = element("section", "coin-machine");
  machine.setAttribute("aria-label", "Machine à monnaie");
  const balance = element("p", "coin-machine-balance");
  balance.setAttribute("role", "status");
  const income = element("p", "coin-machine-income");
  machine.append(
    element("p", "coin-machine-label", "Machine à monnaie"),
    element("span", "coin-machine-sticker", "capricieuse"),
    balance,
    income,
    element("span", "coin-machine-slot"),
    element("p", "coin-machine-warning", "Pas de crédit"),
  );

  return {
    element: machine,
    render() {
      balance.textContent = formatMoney(runtime.wallet());
      income.textContent = `${formatIncome(runtime.totalIncome())} qui tombent tout seuls`;
    },
  };
}

function cabinetScreen(game: GameDefinition, isAvailable: boolean): HTMLElement {
  const screen = element("span", "cabinet-screen");
  if (isAvailable) {
    screen.append(element("span", "cabinet-screen-emoji", game.emoji), element("span", "cabinet-screen-text", "▶ Jouer"));
  } else {
    screen.append(element("span", "cabinet-out-of-order", "En panne"));
  }
  return screen;
}

function controlPanel(): HTMLElement {
  const panel = element("span", "cabinet-controls");
  panel.setAttribute("aria-hidden", "true");
  panel.append(
    element("span", "cabinet-joystick"),
    element("span", "cabinet-button cabinet-button-a"),
    element("span", "cabinet-button cabinet-button-b"),
  );
  return panel;
}

function cabinet(game: GameDefinition, runtime: Runtime, track: (unlock: Unlock, container: HTMLElement) => void) {
  const isAvailable = runtime.isAvailable(game.id);
  const body = isAvailable ? element("a", "cabinet") : element("div", "cabinet is-off");
  body.dataset.game = game.id;
  body.style.setProperty("--accent", game.accent);
  if (body instanceof HTMLAnchorElement) {
    body.href = gameHref(game.id);
    body.setAttribute("aria-label", `Jouer à ${game.name}`);
  }

  body.append(
    element("span", "cabinet-marquee", game.name),
    cabinetScreen(game, isAvailable),
    controlPanel(),
    element("span", "cabinet-label", GENRE_LABELS[game.genre]),
    element("span", "cabinet-coin-door", "25¢"),
  );

  const unlock = gameUnlock(game.id);
  if (!isAvailable && unlock) {
    const note = element("span", "taped-note");
    note.append(element("span", "taped-note-title", "Revenez quand :"));
    track(unlock, note);
    body.append(note);
  }
  return body;
}

function prize(unlock: Unlock, runtime: Runtime, track: (unlock: Unlock, container: HTMLElement) => void): HTMLElement {
  const isWon = runtime.isUnlocked(unlock.id);
  const tag = element("li", `prize-tag${isWon ? " is-won" : ""}`);
  tag.append(element("p", "prize-tag-reward", describeReward(unlock.reward)));
  if (isWon) {
    tag.append(element("span", "prize-tag-stamp", "Gagné !"));
  } else {
    track(unlock, tag);
  }
  return tag;
}

const CASH_DRAWER_AMOUNTS = [1_000, 10_000, 100_000];

function servicePanel(runtime: Runtime, { onResetAll, onToggleAllGames }: ArcadeActions): HTMLElement {
  const panel = element("details", "service-panel");
  panel.append(element("summary", "service-panel-summary", "🔑 Local technique — réservé au patron"));

  const isGodMode = runtime.allGamesUnlocked();
  const keySwitch = element("button", "key-switch");
  keySwitch.type = "button";
  keySwitch.setAttribute("aria-pressed", String(isGodMode));
  keySwitch.append(
    element("span", "key-switch-label", "Mode Dieu : toutes les bornes branchées"),
    element("span", "key-switch-state", isGodMode ? "Branché" : "Coupé"),
  );
  keySwitch.addEventListener("click", () => onToggleAllGames(!isGodMode));

  const drawer = element("div", "cash-drawer");
  drawer.append(element("span", "cash-drawer-label", "Tiroir-caisse du patron"));
  for (const amount of CASH_DRAWER_AMOUNTS) {
    const button = element("button", "cash-drawer-button", `+${formatMoney(amount)}`);
    button.type = "button";
    button.addEventListener("click", () => runtime.addMoney(amount));
    drawer.append(button);
  }

  const breaker = element("button", "breaker", "Disjoncteur général : tout remettre à zéro");
  breaker.type = "button";
  breaker.addEventListener("click", () => {
    if (confirm("Effacer toute ta progression dans tous les jeux ?")) onResetAll();
  });

  panel.append(keySwitch, drawer, breaker);
  if (isGodMode) panel.open = true;
  return panel;
}

export function renderArcade(root: HTMLElement, games: GameDefinition[], runtime: Runtime, actions: ArcadeActions) {
  document.title = "L'Incrémental · Salle de jeux";
  document.body.dataset.page = "arcade";
  const tracked: TrackedRequirement[] = [];

  function track(unlock: Unlock, container: HTMLElement) {
    const { bar, fill } = scribbledProgress();
    container.append(element("span", "requirement-text", unlock.requirement.label), bar);
    tracked.push({ unlock, fill });
  }

  const machine = coinMachine(runtime);
  const wall = element("section", "arcade-wall");
  wall.append(sign(), machine.element, ownerNote());

  const row = element("div", "cabinet-row");
  row.append(
    ...[...games].sort((a, b) => progressionRank(a.id) - progressionRank(b.id)).map((game) => cabinet(game, runtime, track)),
  );

  const shelf = element("ul", "prize-shelf");
  shelf.append(...UNLOCKS.filter((unlock) => unlock.reward.kind === "bonus").map((unlock) => prize(unlock, runtime, track)));
  const counter = element("section", "prize-counter");
  counter.append(
    element("h2", "prize-counter-title", "Comptoir à lots"),
    element("p", "prize-counter-subtitle", "Les lots se gagnent en jouant, pas en pleurant."),
    shelf,
  );

  const floor = element("section", "arcade-floor");
  floor.append(row, counter, servicePanel(runtime, actions));

  const arcade = element("main", "arcade");
  arcade.append(wall, floor);
  root.append(arcade);

  function render() {
    machine.render();
    for (const { unlock, fill } of tracked) {
      fill.style.width = `${runtime.progress(unlock.requirement) * 100}%`;
    }
  }

  render();
  const stopRendering = runtime.onFrame(render);
  return () => {
    stopRendering();
    delete document.body.dataset.page;
  };
}
