import "@fontsource-variable/fredoka";
import "./app/theme.css";
import "./app/app.css";
import "./engine/engine.css";
import { renderArcade } from "./app/arcade/arcade";
import { describeReward } from "./app/describe";
import { element } from "./app/dom";
import { mountGameScreen } from "./app/gameScreen";
import { createNavBar } from "./app/navBar";
import { CATALOG_HREF, parseRoute } from "./app/router";
import { showToast } from "./app/toast";
import { findGame, GAMES } from "./games/registry";
import { createRuntime } from "./platform/runtime";

const app = document.querySelector<HTMLElement>("#app")!;

function startApp() {
  const runtime = createRuntime(GAMES, localStorage);
  const navBar = createNavBar(runtime, GAMES);
  const page = document.createElement("div");
  page.className = "page";
  app.append(navBar.element, page);

  let unmountPage = () => {};

  function renderRoute() {
    unmountPage();
    unmountPage = () => {};
    page.replaceChildren();

    const route = parseRoute(location.hash);
    if (route.page === "catalog") {
      navBar.setActive(null);
      unmountPage = renderArcade(page, GAMES, runtime, {
        onResetAll() {
          runtime.resetAll();
          navBar.rebuild();
          renderRoute();
        },
        onToggleAllGames(isOn) {
          runtime.setAllGamesUnlocked(isOn);
          navBar.rebuild();
          renderRoute();
        },
      });
      return;
    }

    const game = findGame(route.gameId);
    if (!game || !runtime.isAvailable(game.id)) {
      location.hash = CATALOG_HREF;
      return;
    }
    navBar.setActive(game.id);
    unmountPage = mountGameScreen(page, game, runtime);
  }

  runtime.onUnlock((unlock) => {
    showToast(`🔓 ${describeReward(unlock.reward)}`);
    if (parseRoute(location.hash).page === "catalog") renderRoute();
  });

  window.addEventListener("hashchange", renderRoute);
  runtime.start();
  renderRoute();
}

const SINGLE_TAB_LOCK = "incremental-game";

function runWhileHoldingLock() {
  startApp();
  return new Promise<never>(() => {});
}

function showAlreadyOpen(): HTMLElement {
  const message = element("main", "already-open");
  message.append(
    element("p", "", "Le jeu est déjà ouvert dans un autre onglet."),
    element("p", "already-open-hint", "Ferme-le : la partie reprendra ici automatiquement."),
  );
  app.append(message);
  return message;
}

// Web Locks only exist in secure contexts (https or localhost), not on a LAN IP.
if (navigator.locks) {
  void navigator.locks.request(SINGLE_TAB_LOCK, { ifAvailable: true }, async (lock) => {
    if (lock) return runWhileHoldingLock();

    // A reload briefly overlaps with the previous page, so queue for the lock instead of giving up.
    const message = showAlreadyOpen();
    void navigator.locks.request(SINGLE_TAB_LOCK, () => {
      message.remove();
      return runWhileHoldingLock();
    });
  });
} else {
  startApp();
}
