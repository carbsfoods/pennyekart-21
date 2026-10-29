# Group Leader commission rule on the Allocation table

## Rule

When a community's creator is a **Pro** in e-Life **and** that Pro reports to a **Group Leader**
(e-Life `pennyekart_agents.parent_agent_id`) **and the Pro's ward equals the Group Leader's ward**,
the Allocation table adds a commission row for that Group Leader on that community.

- The Pro keeps their own creator commission — the Group Leader share is additional.
- Rate: the Group Leader rule from Settings → commission rules (currently 15%, admin-editable).
- The community always sits in the creator's ward, so no separate community-ward check is needed.
- Group Leader matching uses the e-Life agent's mobile, so the payout still links to their
  Pennyekart wallet when one exists (same flow as other e-Life recipients).

## Changes

### 1. e-Life bridge: expose the reporting leader (`elife-role-allocations` edge function)

- While building the people list from `pennyekart_agents`, resolve each person's
  `parent_agent_id` in memory (the rows are already fetched — no extra queries) and return a
  `parent` object: `{ name, mobile, role, ward }`.
- Helper `attachParents` in `elife-role-allocations/allocation.ts`, covered by its test file.

### 2. Shared allocation library

- `AllocationPerson` (src/lib/elifeAllocation.ts) gains the optional `parent` field.
- `AreaCommunity` (src/lib/commissionAllocation.ts) gains `creator_mobile` so creators can be
  matched to e-Life agents by mobile (last 10 digits, prefix-tolerant).
- New `buildGroupLeaderRows(people, communities, rateForRole)`: for each community, find the
  active e-Life person whose role normalizes to "pro" and whose mobile matches the creator's;
  require their parent to normalize to "group leader" and both wards to be present and equal;
  emit one `group_leader` row at the Group Leader rate. `recipient_type` becomes the new
  `"group_leader"`, slotted right after "creator" in the row ordering and labels.

### 3. Allocation table (admin → Communities → Commission tab)

- `CommunityCommissionTable` passes the creator's mobile (already fetched profile, one extra
  column) into the communities list, and calls `buildGroupLeaderRows` with the full active
  e-Life people list (Pro / Group Leader are currently filtered out of the hierarchy list —
  that filter stays for the existing rows).
- "Group leader" badge/label added to the recipient display; header copy mentions the rule.
- No database change: `recipient_type` is free text and the save/allocate/overlap-protection
  functions work with the new type as-is.

## Tests

- `commissionAllocation.test.ts`: GL row appears for a same-ward Pro→Group Leader pair;
  no row when wards differ, parent is missing, or parent isn't a Group Leader; creator row
  still exists alongside the GL row; mobile matching tolerates a 91/0 prefix.
- `elife-role-allocations/allocation_test.ts`: parent resolution.

## Verification

- Run the vitest suite and confirm the build is clean.
- Note: the live e-Life lookup can't be exercised from here (no super-admin browser session for
  an external Supabase), so the first real "Calculate & save" is where the rule meets live data —
  rows appear only for Pros whose e-Life record has a ward set and a Group Leader parent in the
  same ward.
