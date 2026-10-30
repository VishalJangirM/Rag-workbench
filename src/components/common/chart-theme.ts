/** Shared recharts styling aligned with the design tokens. */
export const CHART_COLORS = {
  primary: "var(--color-chart-1)",
  success: "var(--color-chart-2)",
  warning: "var(--color-chart-3)",
  violet: "var(--color-chart-4)",
  danger: "var(--color-chart-5)",
  muted: "var(--color-muted-foreground)",
} as const;

export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.violet,
  CHART_COLORS.danger,
  CHART_COLORS.muted,
];

export const axisTick = { fill: "var(--color-muted-foreground)", fontSize: 11 } as const;

export const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "8px",
  fontSize: 12,
  color: "var(--color-popover-foreground)",
} as const;

export const gridStroke = "var(--color-border)";
