import type { Earning, GameDefinition, GameSession } from "../games/types";
import { startAutosave, startLoop } from "./loop";
import {
  isGameAvailable,
  modifiersFor,
  newlyUnlocked,
  requirementProgress,
  type MetricsByGame,
} from "./progression";
import { loadState, saveState } from "./save";
import type { Requirement, Unlock } from "./unlocks";

export type Runtime = ReturnType<typeof createRuntime>;

export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

const PROGRESSION_KEY = "incremental:progression";
const WALLET_KEY = "incremental:wallet";
const ALL_GAMES_UNLOCKED_KEY = "incremental:all-games-unlocked";

function saveKeyFor(gameId: string): string {
  return `incremental:${gameId}`;
}

export function createRuntime(games: GameDefinition[], storage: Storage) {
  const unlocked = new Set(loadState<string[]>(storage, PROGRESSION_KEY)?.state ?? []);
  const states = new Map<string, unknown>();
  let wallet = loadState<number>(storage, WALLET_KEY)?.state ?? 0;
  let allGamesUnlocked = loadState<boolean>(storage, ALL_GAMES_UNLOCKED_KEY)?.state ?? false;
  const gameListeners = new Map<string, Set<(state: unknown) => void>>();
  const frameListeners = new Set<() => void>();
  const unlockListeners = new Set<(unlock: Unlock) => void>();
  let focusedGameId: string | null = null;

  function gameById(gameId: string): GameDefinition {
    return games.find((game) => game.id === gameId)!;
  }

  function collect<S>(gameId: string, { state, earned }: Earning<S>) {
    states.set(gameId, state);
    wallet += earned;
  }

  function loadGame(game: GameDefinition) {
    const saved = loadState(storage, saveKeyFor(game.id));
    if (!saved) {
      states.set(game.id, game.logic.createInitialState());
      return;
    }
    collect(game.id, game.logic.restoreState(saved.state));
    const offlineSeconds = Math.min(saved.elapsedSeconds, MAX_OFFLINE_SECONDS);
    const context = { modifiers: modifiersFor(game.id, unlocked), isFocused: false };
    collect(game.id, game.logic.tick(states.get(game.id), offlineSeconds, context));
  }

  function isOpen(gameId: string): boolean {
    return allGamesUnlocked || isGameAvailable(gameId, unlocked);
  }

  function loadAvailableGames() {
    for (const game of games) {
      if (isOpen(game.id) && !states.has(game.id)) loadGame(game);
    }
  }

  function hideUnearnedGames() {
    for (const [id, state] of states) {
      if (isOpen(id)) continue;
      saveState(storage, saveKeyFor(id), state);
      states.delete(id);
    }
  }

  function metrics(): MetricsByGame {
    return Object.fromEntries([...states].map(([id, state]) => [id, gameById(id).logic.metrics(state)]));
  }

  function checkUnlocks() {
    for (const unlock of newlyUnlocked(unlocked, metrics())) {
      unlocked.add(unlock.id);
      if (unlock.reward.kind === "game") loadGame(gameById(unlock.reward.gameId));
      unlockListeners.forEach((listener) => listener(unlock));
    }
  }

  function notify(gameIds: Iterable<string>) {
    for (const id of gameIds) {
      gameListeners.get(id)?.forEach((listener) => listener(states.get(id)));
    }
    frameListeners.forEach((listener) => listener());
  }

  function tick(seconds: number) {
    const cappedSeconds = Math.min(seconds, MAX_OFFLINE_SECONDS);
    for (const [id, state] of states) {
      const context = { modifiers: modifiersFor(id, unlocked), isFocused: id === focusedGameId };
      collect(id, gameById(id).logic.tick(state, cappedSeconds, context));
    }
    checkUnlocks();
    notify(states.keys());
  }

  function save() {
    saveState(storage, PROGRESSION_KEY, [...unlocked]);
    saveState(storage, WALLET_KEY, wallet);
    saveState(storage, ALL_GAMES_UNLOCKED_KEY, allGamesUnlocked);
    for (const [id, state] of states) saveState(storage, saveKeyFor(id), state);
  }

  function subscribe<T>(listeners: Set<T>, listener: T): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  loadAvailableGames();

  return {
    tick,
    save,

    start(): () => void {
      const stopLoop = startLoop(tick);
      const stopAutosave = startAutosave(save);
      return () => {
        stopLoop();
        stopAutosave();
      };
    },

    isAvailable: (gameId: string) => states.has(gameId),

    isUnlocked: (unlockId: string) => unlocked.has(unlockId),

    focus(gameId: string | null) {
      focusedGameId = gameId;
    },

    wallet: () => wallet,

    addMoney(amount: number) {
      wallet += amount;
    },

    allGamesUnlocked: () => allGamesUnlocked,

    setAllGamesUnlocked(isOn: boolean) {
      allGamesUnlocked = isOn;
      saveState(storage, ALL_GAMES_UNLOCKED_KEY, isOn);
      if (isOn) loadAvailableGames();
      else hideUnearnedGames();
    },

    income: (gameId: string) => gameById(gameId).logic.incomePerSecond(states.get(gameId), modifiersFor(gameId, unlocked)),

    totalIncome: () =>
      [...states].reduce(
        (total, [id, state]) => total + gameById(id).logic.incomePerSecond(state, modifiersFor(id, unlocked)),
        0,
      ),

    modifiers: (gameId: string) => modifiersFor(gameId, unlocked),

    progress: (requirement: Requirement) => requirementProgress(requirement, metrics()),

    session<S>(game: GameDefinition<S>): GameSession<S> {
      function afterAction() {
        checkUnlocks();
        notify([game.id]);
      }

      return {
        state: () => states.get(game.id) as S,
        modifiers: () => modifiersFor(game.id, unlocked),
        wallet: () => wallet,
        update(action) {
          states.set(game.id, action(states.get(game.id) as S));
          afterAction();
        },
        earn(action) {
          collect(game.id, action(states.get(game.id) as S));
          afterAction();
        },
        buy(cost, action) {
          if (wallet < cost) return false;
          wallet -= cost;
          states.set(game.id, action(states.get(game.id) as S));
          afterAction();
          return true;
        },
        onChange(listener) {
          if (!gameListeners.has(game.id)) gameListeners.set(game.id, new Set());
          return subscribe(gameListeners.get(game.id)!, listener as (state: unknown) => void);
        },
      };
    },

    onFrame: (listener: () => void) => subscribe(frameListeners, listener),

    onUnlock: (listener: (unlock: Unlock) => void) => subscribe(unlockListeners, listener),

    resetGame(gameId: string) {
      storage.removeItem(saveKeyFor(gameId));
      states.set(gameId, gameById(gameId).logic.createInitialState());
      notify([gameId]);
    },

    resetAll() {
      storage.removeItem(PROGRESSION_KEY);
      storage.removeItem(WALLET_KEY);
      wallet = 0;
      for (const game of games) storage.removeItem(saveKeyFor(game.id));
      unlocked.clear();
      states.clear();
      loadAvailableGames();
    },
  };
}
