import type { GameDefinition } from "../games/types";
import { formatIncome, formatMoney } from "../platform/currency";
import { progressionRank } from "../platform/progression";
import type { Runtime } from "../platform/runtime";
import { element } from "./dom";
import { CATALOG_HREF, gameHref } from "./router";

export function createNavBar(runtime: Runtime, games: GameDefinition[]) {
  const nav = element("nav", "nav-bar");
  nav.setAttribute("aria-label", "Jeux");
  let activeGameId: string | null = null;
  const wallet = element("span", "nav-wallet");
  wallet.setAttribute("role", "status");
  let chips: { game: GameDefinition; chip: HTMLAnchorElement; income: HTMLElement }[] = [];

  function build() {
    const home = element("a", "nav-home", "🏠");
    home.href = CATALOG_HREF;
    home.setAttribute("aria-label", "Catalogue");

    chips = games
      .filter((game) => runtime.isAvailable(game.id))
      .sort((a, b) => progressionRank(a.id) - progressionRank(b.id))
      .map((game) => {
        const chip = element("a", "nav-chip");
        chip.href = gameHref(game.id);
        chip.style.setProperty("--accent", game.accent);
        const income = element("span", "nav-chip-income");
        chip.append(element("span", "nav-chip-emoji", game.emoji), income);
        return { game, chip, income };
      });

    nav.replaceChildren(home, wallet, ...chips.map(({ chip }) => chip));
    render();
  }

  function render() {
    wallet.textContent = formatMoney(runtime.wallet());
    wallet.setAttribute("aria-label", `Portefeuille : ${formatMoney(runtime.wallet())}`);
    for (const { game, chip, income } of chips) {
      const perSecond = formatIncome(runtime.income(game.id));
      income.textContent = perSecond;
      chip.classList.toggle("is-active", game.id === activeGameId);
      chip.setAttribute("aria-label", `${game.name} : ${perSecond}`);
    }
  }

  runtime.onFrame(render);
  runtime.onUnlock(build);
  build();

  return {
    element: nav,
    rebuild: build,
    setActive(gameId: string | null) {
      activeGameId = gameId;
      render();
    },
  };
}
