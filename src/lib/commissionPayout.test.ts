import { describe, expect, it } from "vitest";
import {
  commissionAmount,
  commissionRange,
  overlapsCommissionPeriod,
  payoutHeld,
  payoutRequestable,
  committedPayoutAmount,
  payoutReviewActions,
  reviseCommissionChange,
  PAYOUT_HOLD_PERCENT,
} from "./commissionPayout";

describe("community commission payments", () => {
  it("divides community profit using the configured role rate", () => {
    expect(commissionAmount(500, 12)).toBe(60);
  });
  it("rounds the allocated commission to currency precision", () => {
    expect(commissionAmount(123.45, 12)).toBe(14.81);
  });
  it("does not create a negative commission from a loss", () => {
    expect(commissionAmount(-500, 12)).toBe(0);
  });
  it("blocks a repeat or overlapping date period", () => {
    expect(overlapsCommissionPeriod({ period_from: "2026-10-01", period_to: "2026-10-20" }, "2026-10-20", "2026-10-31")).toBe(true);
    expect(overlapsCommissionPeriod({ period_from: "2026-10-01", period_to: "2026-10-20" }, "2026-10-21", "2026-10-31")).toBe(false);
  });
  it("includes the entire selected date period in India time", () => {
    expect(commissionRange("2026-10-01", "2026-10-20")).toEqual({ from: "2026-09-30T18:30:00.000Z", to: "2026-10-20T18:29:59.999Z" });
  });
});

describe("sales commission payout requests", () => {
  it("holds 20% of the sales commission", () => {
    expect(PAYOUT_HOLD_PERCENT).toBe(20);
    expect(payoutHeld(500)).toBe(100);
  });

  it("limits the requestable amount to 80% of total sales commission", () => {
    expect(payoutRequestable(500, 0)).toBe(400);
  });

  it("counts pending, verified and approved requests against the limit", () => {
    expect(payoutRequestable(500, 150)).toBe(250);
  });

  it("never allows a request above the held limit", () => {
    expect(payoutRequestable(500, 600)).toBe(0);
  });

  it("does not go negative from rounding or bad input", () => {
    expect(payoutRequestable(-50, 0)).toBe(0);
    expect(payoutRequestable(33.33, 0)).toBe(26.66);
  });

  it("reserves pending, verified, and approved requests but excludes rejected requests", () => {
    expect(committedPayoutAmount([
      { requested_amount: 25, status: "pending" },
      { requested_amount: 30, status: "verified" },
      { requested_amount: 35, status: "approved" },
      { requested_amount: 100, status: "rejected" },
    ])).toBe(90);
  });

  it("requires verification before approval and hides actions after processing", () => {
    expect(payoutReviewActions("pending")).toEqual(["verify", "reject"]);
    expect(payoutReviewActions("verified")).toEqual(["approve", "reject"]);
    expect(payoutReviewActions("approved")).toEqual([]);
    expect(payoutReviewActions("rejected")).toEqual([]);
  });
});

describe("revising an already-allocated commission", () => {
  it("rounds the revised amount and returns the wallet adjustment", () => {
    expect(reviseCommissionChange(100, 123.456)).toEqual({ amount: 123.46, delta: 23.46 });
  });
  it("debits the wallet when the commission is reduced", () => {
    expect(reviseCommissionChange(80, 60)).toEqual({ amount: 60, delta: -20 });
  });
  it("rejects zero, negative and unchanged revisions", () => {
    expect(reviseCommissionChange(100, 0)).toBeNull();
    expect(reviseCommissionChange(100, -5)).toBeNull();
    expect(reviseCommissionChange(100, 100)).toBeNull();
    expect(reviseCommissionChange(100, 100.001)).toBeNull();
  });
});
