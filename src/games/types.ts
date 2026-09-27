export type Genre = "clicker" | "merge" | "simulation" | "missions" | "cards";

export const GENRE_LABELS: Record<Genre, string> = {
  clicker: "Clicker",
  merge: "Fusion",
  simulation: "Simulation",
  missions: "Missions",
  cards: "Cartes",
};

/** Multipliers earned from cross-game unlocks. 1 means no bonus. */
export interface Modifiers {
  production: number;
  tap: number;
}

export const NO_MODIFIERS: Modifiers = { production: 1, tap: 1 };

export interface TickContext {
  modifiers: Modifiers;
  /** False while the game runs in the background or catches up offline progress. */
  isFocused: boolean;
}

/** A game state together with the money it produced for the shared wallet. */
export interface Earning<S> {
  state: S;
  earned: number;
}

export interface GameLogic<S> {
  createInitialState: () => S;
  /** Fills fields missing from older saves; `earned` converts any legacy per-game balance into money once. */
  restoreState: (saved: S) => Earning<S>;
  tick: (state: S, seconds: number, context: TickContext) => Earning<S>;
  /** Money per second this game produces on its own, shown in the navigation bar. */
  incomePerSecond: (state: S, modifiers: Modifiers) => number;
  /** Numbers that unlock requirements can target, e.g. { absorbedMass: 1200 }. */
  metrics: (state: S) => Record<string, number>;
}

export interface GameSession<S> {
  state: () => S;
  modifiers: () => Modifiers;
  /** Balance of the wallet shared by every game. */
  wallet: () => number;
  /** Applies a free action, e.g. selecting or merging. */
  update: (action: (state: S) => S) => void;
  /** Applies an action that produces money, e.g. a tap, and credits the wallet. */
  earn: (action: (state: S) => Earning<S>) => void;
  /** Pays `cost` from the wallet and applies the purchase. Returns false when the wallet is too low. */
  buy: (cost: number, action: (state: S) => S) => boolean;
  /** Called after every platform frame and every action. Returns an unsubscribe function. */
  onChange: (listener: (state: S) => void) => () => void;
}

export interface GameView<S> {
  /** Renders the game inside root and returns a cleanup that removes listeners and timers. */
  mount: (root: HTMLElement, session: GameSession<S>) => () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GameDefinition<S = any> {
  id: string;
  name: string;
  genre: Genre;
  emoji: string;
  /** CSS color used for this game's chip, card and highlights. */
  accent: string;
  pitch: string;
  logic: GameLogic<S>;
  loadView: () => Promise<GameView<S>>;
}
