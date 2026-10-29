export const normalizeRole = (raw: unknown) =>
  String(raw ?? "").trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

export const normalizeMobile = (raw: unknown) => {
  const s = String(raw ?? "").replace(/\D/g, "");
  return s.length >= 10 ? s.slice(-10) : "";
};
const MOBILE_COLS = ["mobile", "mobile_number", "phone", "phone_number", "whatsapp_number"];
const ROLE_COLS = ["role", "role_name", "designation", "agent_role", "position", "rank"];

export const pickMobile = (row: Record<string, unknown>) => {
  for (const c of MOBILE_COLS) { const m = normalizeMobile(row[c]); if (m) return m; }
  return "";
};
export const pickRole = (row: Record<string, unknown>) => {
  for (const c of ROLE_COLS) { const r = normalizeRole(row[c]); if (r) return r; }
  return "";
};

export const toIds = (v: unknown): string[] => {
  if (v === null || v === undefined || v === "") return [];
  if (Array.isArray(v)) return v.flatMap(toIds);
  if (typeof v === "object") { const o = v as Record<string, unknown>; return toIds(o.id ?? o.panchayath_id); }
  const s = String(v).trim();
  if (s.startsWith("[") || s.startsWith("{")) {
    try { return toIds(JSON.parse(s.replace(/^\{(.*)\}$/, "[$1]"))); } catch { /* fall through */ }
  }
  return s.split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean);
};

/** The reporting leader of an e-Life agent, resolved from the already-fetched agent rows. */
export interface ElifeParent {
  id: string;
  name: string | null;
  mobile: string | null;
  role: string;
  ward: string | number | null;
}

const pickName = (r: Record<string, unknown>) =>
  String(r.name ?? r.full_name ?? r.username ?? r.display_name ?? "").trim() || null;

/**
 * Attaches each person's reporting parent (pennyekart_agents.parent_agent_id) in memory.
 * Only pennyekart_agents rows carry the reporting link; admins are left untouched.
 */
export const attachParents = (people: any[], agentRows: Record<string, unknown>[]): any[] => {
  const byId = new Map(agentRows.map((r) => [String(r.id), r]));
  for (const p of people) {
    const row = byId.get(String(p.id ?? "").split(":")[1] ?? "");
    const parentId = row?.parent_agent_id;
    const parent = parentId != null && parentId !== "" ? byId.get(String(parentId)) : undefined;
    if (!parent) continue;
    p.parent = {
      id: String(parent.id),
      name: pickName(parent),
      mobile: pickMobile(parent) || null,
      role: pickRole(parent),
      ward: parent.ward ?? null,
    };
  }
  return people;
};

/** Columns that hold a person's list of allocated panchayaths (e-Life uses responsible_panchayath_ids). */
const MULTI_PANCHAYATH_COLS = [
  "responsible_panchayath_ids", "panchayath_ids", "assigned_panchayaths", "allocated_panchayaths", "panchayaths",
];

const isCoordinator = (role: string) => normalizeRole(role) === "coordinator";

/**
 * Coordinators work inside one panchayath (their panchayath_id, split into responsible wards).
 * Every other role is allocated several panchayaths; their home panchayath_id is only a fallback.
 */
export const allocatedPanchayathIds = (row: Record<string, unknown>, role: string): string[] => {
  const home = toIds(row.panchayath_id);
  if (isCoordinator(role)) return [...new Set(home)];
  const multi = MULTI_PANCHAYATH_COLS.flatMap((c) => toIds(row[c]));
  return [...new Set(multi.length ? multi : home)];
};

/** Wards a coordinator is responsible for inside their panchayath. */
export const allocatedWards = (row: Record<string, unknown>, role: string): string[] =>
  isCoordinator(role) ? [...new Set(toIds(row.responsible_wards))] : [];
