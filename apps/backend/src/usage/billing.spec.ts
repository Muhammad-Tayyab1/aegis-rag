import { billingMilestone } from "./billing";

describe("billing milestones", () => {
  it("creates one milestone per configured usage interval", () => {
    expect(billingMilestone(99, "100")).toBe(0);
    expect(billingMilestone(100, "100")).toBe(100);
    expect(billingMilestone(199, "100")).toBe(100);
    expect(billingMilestone(200, "100")).toBe(200);
  });

  it("disables invalid and non-positive thresholds", () => {
    expect(billingMilestone(100, "0")).toBe(0);
    expect(billingMilestone(100, "invalid")).toBe(0);
    expect(billingMilestone(100, "1.5")).toBe(0);
  });
});
