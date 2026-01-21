export function formatAmount(value: number) {
  const numericValue = Number(value) || 0;
  return new Intl.NumberFormat("en-IN").format(numericValue);
}
