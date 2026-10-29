import { describe, expect, it } from "vitest";
import { buildAllocation, communitiesInArea, normalizeAreaName, periodRange, type AreaCommunity } from "./commissionAllocation";
import type { AllocationPerson } from "./elifeAllocation";

const community = (id: string, area: string, ward: number, profit: number): AreaCommunity => ({
  community_id: id, community_name: id, creator_name: null, creator_mobile: null, local_body_name: area, ward_number: ward,
  member_count: 1, order_count: 1, revenue: profit, profit,
});
const person = (role: string, areas: string[], wards: string[] = []): AllocationPerson => ({
  id: role, source: "pennyekart_agents", name: role, mobile: null, role, ward: null, wards, is_active: true,
  panchayaths: areas.map((a) => ({ id: a, name: a, district: null })),
});
const communities = [
  community("A", "Pandikkad (പാണ്ടിക്കാട്)", 7, 100),
  community("B", "Pandikkad (പാണ്ടിക്കാട്)", 14, 200),
  community("C", "Amarambalam (അമരമ്പലം)", 2, 50),
];

describe("commission allocation by area", () => {
  it("matches e-Life panchayath names to Pennyekart local bodies", () => {
    expect(normalizeAreaName("Pandikkad")).toBe(normalizeAreaName("Pandikkad (പാണ്ടിക്കാട്)"));
  });

  it("gives a team leader every community in all allocated panchayaths", () => {
    const ids = communitiesInArea(person("team_leader", ["Pandikkad", "Amarambalam"]), communities).map((c) => c.community_id);
    expect(ids).toEqual(["A", "B", "C"]);
  });

  it("limits a coordinator to communities in their responsible wards", () => {
    const ids = communitiesInArea(person("coordinator", ["Pandikkad"], ["7", "8"]), communities).map((c) => c.community_id);
    expect(ids).toEqual(["A"]);
  });

  it("calculates commission from area profit and the role's configured rate", () => {
    const [row] = buildAllocation([person("team_leader", ["Pandikkad"])], communities, () => 12);
    expect(row.profit).toBe(300);
    expect(row.commission).toBe(36);
  });

  it("stores each month under its own period", () => {
    expect(periodRange("last_month", new Date(2026, 9, 20)).key).toBe("2026-09");
    expect(periodRange("this_month", new Date(2026, 9, 20)).key).toBe("2026-10");
  });
});

describe("hierarchy commission rows", () => {
  it("splits a role's share equally and limits coordinators to their wards", async () => {
    const { buildHierarchyRows } = await import("./commissionAllocation");
    const rows = buildHierarchyRows([
      person("coordinator", ["Pandikkad"], ["7"]),
      { ...person("team_leader", ["Pandikkad"]), id: "tl1" },
      { ...person("team_leader", ["Pandikkad"]), id: "tl2" },
      person("pro", ["Pandikkad"]),
    ], communities, () => 10);
    const coord = rows.filter((r) => r.recipient_type === "coordinator");
    expect(coord.map((r) => r.community_id)).toEqual(["A"]);
    expect(coord[0].calculated_commission).toBe(10);
    const tlA = rows.filter((r) => r.recipient_type === "team_leader" && r.community_id === "A");
    expect(tlA.map((r) => r.calculated_commission)).toEqual([5, 5]);
    expect(rows.some((r) => r.community_id === "C")).toBe(false);
  });

  it("gives super admin partners all communities in their panchayaths and splits the role share equally", async () => {
    const { buildHierarchyRows, rateRoleName } = await import("./commissionAllocation");
    expect(rateRoleName("super_admin_partner")).toBe("super admin");
    expect(rateRoleName("Super Admin Partner")).toBe("super admin");
    const rows = buildHierarchyRows([
      person("super_admin_partner", ["Pandikkad"]),
      { ...person("super_admin_partner", ["Pandikkad", "Amarambalam"]), id: "sap2" },
    ], communities, () => 8);
    const sap = rows.filter((r) => r.recipient_type === "super_admin");
    // Pandikkad A (₹100) and B (₹200) at 8% split between both partners: ₹4 and ₹8 each.
    const ab = sap.filter((r) => r.community_id === "A" || r.community_id === "B");
    expect(ab.map((r) => r.calculated_commission)).toEqual([4, 4, 8, 8]);
    expect(ab.every((r) => r.share_count === 2)).toBe(true);
    const c = sap.filter((r) => r.community_id === "C");
    expect(c.map((r) => r.calculated_commission)).toEqual([4]);
    expect(c[0].share_count).toBe(1);
    expect(sap.every((r) => r.commission_rate === 8)).toBe(true);
  });
});

describe("group leader rule", () => {
  const leader = { id: "gl1", name: "Group Leader", mobile: "9800000001", role: "group leader", ward: 7 };
  const pro = (ward: string | number | null = 7, parent: any = leader): AllocationPerson => ({
    id: "p1", source: "pennyekart_agents", name: "Pro", mobile: "919876543210", role: "pro",
    ward, parent, is_active: true, panchayaths: [],
  });
  const creatorComm = (profit: number): AreaCommunity => ({
    community_id: "A", community_name: "A", creator_name: "Pro", creator_mobile: "9876543210",
    local_body_name: "Pandikkad", ward_number: 7, member_count: 1, order_count: 1, revenue: profit, profit,
  });

  it("pays the reporting group leader of a same-ward pro at the group leader rate", async () => {
    const { buildGroupLeaderRows } = await import("./commissionAllocation");
    const rows = buildGroupLeaderRows([pro()], [creatorComm(200)], () => 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipient_type: "group_leader", recipient_name: "Group Leader", recipient_mobile: "9800000001",
      total_profit: 200, commission_rate: 10, share_count: 1, calculated_commission: 20,
    });
    expect(rows[0].customer_user_id).toBeNull();
  });

  it("skips a pro whose group leader is in another ward or not set", async () => {
    const { buildGroupLeaderRows } = await import("./commissionAllocation");
    expect(buildGroupLeaderRows([pro(14)], [creatorComm(200)], () => 10)).toHaveLength(0);
    expect(buildGroupLeaderRows([pro(null, { ...leader, ward: 7 })], [creatorComm(200)], () => 10)).toHaveLength(0);
    // Ward match is between the Pro and their Group Leader — any community the Pro creates pays.
    expect(buildGroupLeaderRows([pro(14, { ...leader, ward: 14 })], [{ ...creatorComm(200), ward_number: 14 }], () => 10)).toHaveLength(1);
  });

  it("skips pros whose parent is not a group leader, inactive pros and non-pro creators", async () => {
    const { buildGroupLeaderRows } = await import("./commissionAllocation");
    expect(buildGroupLeaderRows([pro(7, { ...leader, role: "coordinator" })], [creatorComm(200)], () => 10)).toHaveLength(0);
    expect(buildGroupLeaderRows([pro(7, null)], [creatorComm(200)], () => 10)).toHaveLength(0);
    expect(buildGroupLeaderRows([{ ...pro(), is_active: false }], [creatorComm(200)], () => 10)).toHaveLength(0);
    expect(buildGroupLeaderRows([pro()], [{ ...creatorComm(200), creator_mobile: "9000000000" }], () => 10)).toHaveLength(0);
  });
});
