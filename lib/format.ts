export function formatCny(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmountByType(type: "expense" | "income" | "transfer", amount: number) {
  if (type === "income") {
    return `+${formatCny(amount)}`;
  }

  if (type === "transfer") {
    return formatCny(amount);
  }

  return `-${formatCny(amount)}`;
}
