import { BLACKJACK, DEALER_STANDS_ON } from "./config";

export interface HouseRules {
  /** Profit per unit bet on a natural blackjack, before the win multiplier. */
  blackjackPays: number;
  bribeChance: number;
  charmChance: number;
  tiesWin: boolean;
  /** Profit per unit bet on a won hand. */
  winMultiplier: number;
}

/** Final totals from 0 to 21, and BUST for anything above. */
type Distribution = number[];

const BUST = BLACKJACK + 1;
const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Infinite-deck odds: four ranks out of thirteen are worth ten. */
function chanceOf(value: number): number {
  return value === 10 ? 4 / 13 : 1 / 13;
}

function bestTotal(hard: number, hasAce: boolean): number {
  return hasAce && hard + 10 <= BLACKJACK ? hard + 10 : hard;
}

function emptyDistribution(): Distribution {
  return new Array(BUST + 1).fill(0);
}

function addScaled(target: Distribution, source: Distribution, weight: number) {
  source.forEach((chance, total) => (target[total] += chance * weight));
}

function memoize<A extends unknown[]>(compute: (...args: A) => Distribution) {
  const cache = new Map<string, Distribution>();
  return (...args: A): Distribution => {
    const key = args.join();
    if (!cache.has(key)) cache.set(key, compute(...args));
    return cache.get(key)!;
  };
}

/** Where a hand ends when it hits below 17, possibly drawing once more when bribed. */
function dealerFinals(bribeChance: number) {
  const finals = memoize((hard: number, hasAce: boolean, hasFumbled: boolean): Distribution => {
    const result = emptyDistribution();
    if (hard > BLACKJACK) {
      result[BUST] = 1;
      return result;
    }
    const drawn = (fumbled: boolean) => {
      const next = emptyDistribution();
      for (const value of CARD_VALUES) {
        addScaled(next, finals(hard + value, hasAce || value === 1, fumbled), chanceOf(value));
      }
      return next;
    };

    const total = bestTotal(hard, hasAce);
    if (total < DEALER_STANDS_ON) return drawn(hasFumbled);
    if (hasFumbled || bribeChance === 0) {
      result[total] = 1;
      return result;
    }
    addScaled(result, drawn(true), bribeChance);
    result[total] += 1 - bribeChance;
    return result;
  });
  return (hard: number, hasAce: boolean) => finals(hard, hasAce, false);
}

/** Where the dealer-mimic player ends, with the lucky charm redrawing some busting cards once. */
function playerFinals(charmChance: number) {
  const finals = memoize((hard: number, hasAce: boolean): Distribution => {
    const result = emptyDistribution();
    const total = bestTotal(hard, hasAce);
    if (total >= DEALER_STANDS_ON) {
      result[total] = 1;
      return result;
    }

    const bustChance = CARD_VALUES.filter((value) => hard + value > BLACKJACK).reduce((sum, v) => sum + chanceOf(v), 0);
    const redrawn = bustChance * charmChance;
    for (const value of CARD_VALUES) {
      if (hard + value > BLACKJACK) continue;
      addScaled(result, finals(hard + value, hasAce || value === 1), chanceOf(value) * (1 + redrawn));
    }
    result[BUST] += bustChance * (1 - charmChance) + redrawn * bustChance;
    return result;
  });
  return finals;
}

interface Opening {
  natural: number;
  others: Distribution;
}

function afterOpening(finals: (hard: number, hasAce: boolean) => Distribution): Opening {
  let natural = 0;
  const others = emptyDistribution();
  for (const first of CARD_VALUES) {
    for (const second of CARD_VALUES) {
      const chance = chanceOf(first) * chanceOf(second);
      const hasAce = first === 1 || second === 1;
      if (hasAce && first + second === 11) natural += chance;
      else addScaled(others, finals(first + second, hasAce), chance);
    }
  }
  return { natural, others };
}

function computeExpectedReturn(rules: HouseRules): number {
  const player = afterOpening(playerFinals(rules.charmChance));
  const dealer = afterOpening(dealerFinals(rules.bribeChance));
  const tieResult = rules.tiesWin ? rules.winMultiplier : 0;

  let value = player.natural * (1 - dealer.natural) * rules.blackjackPays * rules.winMultiplier;
  value -= dealer.natural * (1 - player.natural);
  player.others.forEach((playerChance, playerTotal) => {
    if (playerChance === 0) return;
    if (playerTotal === BUST) {
      value -= playerChance * (1 - dealer.natural);
      return;
    }
    dealer.others.forEach((dealerChance, dealerTotal) => {
      const chance = playerChance * dealerChance;
      if (dealerTotal === BUST || playerTotal > dealerTotal) value += chance * rules.winMultiplier;
      else if (playerTotal === dealerTotal) value += chance * tieResult;
      else value -= chance;
    });
  });
  return value;
}

const cache = new Map<string, number>();

/** Exact net return per unit bet of the dealer-mimic strategy (hit to 16, stand on 17), infinite deck. */
export function expectedReturn(rules: HouseRules): number {
  const key = JSON.stringify(rules);
  if (!cache.has(key)) cache.set(key, computeExpectedReturn(rules));
  return cache.get(key)!;
}
