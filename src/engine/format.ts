const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export function formatNumber(value: number, decimals = 0): string {
  if (value < 1000) {
    const factor = 10 ** decimals;
    return (Math.floor(value * factor) / factor).toFixed(decimals);
  }

  const tier = Math.floor(Math.log10(value) / 3);
  if (tier >= SUFFIXES.length) return value.toExponential(2);

  return `${(value / 1000 ** tier).toFixed(1)}${SUFFIXES[tier]}`;
}
