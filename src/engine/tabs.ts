export interface Tab {
  label: string;
  panel: HTMLElement;
}

export function createTabs(tabs: Tab[]): HTMLElement {
  const tabList = document.createElement("nav");
  tabList.className = "tabs";
  tabList.setAttribute("role", "tablist");

  const buttons = tabs.map(({ label, panel }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "tab");
    button.textContent = label;
    panel.classList.add("panel");
    panel.setAttribute("role", "tabpanel");
    button.addEventListener("click", () => select(button));
    tabList.append(button);
    return button;
  });

  function select(selected: HTMLButtonElement) {
    buttons.forEach((button, index) => {
      const isSelected = button === selected;
      button.setAttribute("aria-selected", String(isSelected));
      tabs[index].panel.hidden = !isSelected;
    });
  }

  select(buttons[0]);
  return tabList;
}
