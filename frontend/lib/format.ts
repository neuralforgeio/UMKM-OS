// Currency formatting shared by every page: money must always render as
// "Rp 12.345" (Indonesian thousand separators, no decimals).

export function formatThousands(value: number): string {
  const digits = Math.round(Math.abs(value)).toString();
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatRupiah(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}Rp ${formatThousands(value)}`;
}
