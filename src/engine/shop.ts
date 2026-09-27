import type { GameSession } from "../games/types";
import { formatMoney } from "../platform/currency";

export interface ShopItem<S> {
  name: string;
  details: (state: S) => string;
  cost: (state: S) => number;
  buy: (state: S) => S;
  isAvailable?: (state: S) => boolean;
}

function span(className: string): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = className;
  return element;
}

export function createShop<S>(
  container: HTMLElement,
  items: ShopItem<S>[],
  session: GameSession<S>,
) {
  const rows = items.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-item";

    const name = span("shop-item-name");
    name.textContent = item.name;
    const details = span("shop-item-details");
    const cost = span("shop-item-cost");
    button.append(name, details, cost);

    button.addEventListener("click", () => session.buy(item.cost(session.state()), item.buy));
    container.append(button);
    return { item, button, details, cost };
  });

  return function renderShop(state: S) {
    for (const row of rows) {
      const cost = row.item.cost(state);
      const isAvailable = row.item.isAvailable?.(state) ?? true;
      row.button.disabled = !isAvailable || session.wallet() < cost;
      row.details.textContent = row.item.details(state);
      row.cost.textContent = formatMoney(cost);
    }
  };
}
