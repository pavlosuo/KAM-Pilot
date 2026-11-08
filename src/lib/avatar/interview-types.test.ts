import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, MAX_INTERVIEW_QUESTIONS, shouldAutoSave } from "./interview-types";

const full = { ...EMPTY_DRAFT, customerId: "C1", role: "CFO", country: "Sweden", decisions: ["Budget"], goals: ["Cost −5%"] };

describe("interview auto-save", () => {
  it("asks at most 5 questions", () => {
    expect(MAX_INTERVIEW_QUESTIONS).toBe(5);
  });
  it("saves as soon as every required item is known, without a confirmation turn", () => {
    expect(shouldAutoSave(full, 3)).toBe(true);
  });
  it("saves after the 5th answer even when items are missing", () => {
    expect(shouldAutoSave({ ...EMPTY_DRAFT, customerId: "C1", role: "CFO" }, 5)).toBe(true);
    expect(shouldAutoSave({ ...EMPTY_DRAFT, customerId: "C1", role: "CFO" }, 4)).toBe(false);
  });
  it("never saves without a company", () => {
    expect(shouldAutoSave({ ...full, customerId: null }, 5)).toBe(false);
  });
});
