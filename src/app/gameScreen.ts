import type { GameDefinition } from "../games/types";
import type { Runtime } from "../platform/runtime";
import { describeModifiers } from "./describe";
import { element } from "./dom";

export function mountGameScreen(root: HTMLElement, game: GameDefinition, runtime: Runtime): () => void {
  document.title = `${game.name} · Incrémental`;
  document.body.dataset.game = game.id;
  runtime.focus(game.id);

  const title = element("h1", "game-bar-title", `${game.emoji} ${game.name}`);
  const bonuses = element("p", "game-bar-bonuses", describeModifiers(runtime.modifiers(game.id)));

  const resetButton = element("button", "game-bar-reset chunky", "↺");
  resetButton.type = "button";
  resetButton.setAttribute("aria-label", "Recommencer ce jeu");

  const heading = element("div", "game-bar-heading");
  heading.append(title, bonuses);
  const bar = element("header", "game-bar");
  bar.append(heading, resetButton);

  const stage = element("main", `game game-${game.id}`);
  bar.style.setProperty("--accent", game.accent);
  stage.style.setProperty("--accent", game.accent);
  root.append(bar, stage);

  let unmountView = () => {};
  let isDisposed = false;

  async function start() {
    const view = await game.loadView();
    if (isDisposed) return;
    stage.replaceChildren();
    unmountView = view.mount(stage, runtime.session(game));
  }

  resetButton.addEventListener("click", () => {
    if (!confirm(`Recommencer « ${game.name} » à zéro ? Tes bonus débloqués sont conservés.`)) return;
    unmountView();
    runtime.resetGame(game.id);
    void start();
  });

  const stopBonusUpdates = runtime.onUnlock(() => {
    bonuses.textContent = describeModifiers(runtime.modifiers(game.id));
  });

  void start();

  return () => {
    isDisposed = true;
    delete document.body.dataset.game;
    stopBonusUpdates();
    unmountView();
    runtime.focus(null);
  };
}
