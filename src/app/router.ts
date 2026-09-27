export type Route = { page: "catalog" } | { page: "game"; gameId: string };

export const CATALOG_HREF = "#/";

const GAME_PATH = /^#\/games\/([\w-]+)$/;

export function parseRoute(hash: string): Route {
  const match = GAME_PATH.exec(hash);
  return match ? { page: "game", gameId: match[1] } : { page: "catalog" };
}

export function gameHref(gameId: string): string {
  return `#/games/${gameId}`;
}
