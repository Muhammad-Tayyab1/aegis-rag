export function billingMilestone(queryCount: number, thresholdValue?: string) {
  const threshold = Number(thresholdValue ?? 0);
  if (!Number.isInteger(threshold) || threshold <= 0 || queryCount < threshold)
    return 0;
  return Math.floor(queryCount / threshold) * threshold;
}
