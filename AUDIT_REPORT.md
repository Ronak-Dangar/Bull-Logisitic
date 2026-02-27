# Bull Logistic — Comprehensive Project Audit Report

**Date:** February 27, 2026  
**Next.js Version:** 16.1.6 (Turbopack)  
**Build Status:** ✅ Compiles successfully  
**ESLint:** ❌ **160 problems** (147 errors, 13 warnings)  
**TypeScript:** ✅ No type errors (but ~40 `as any` casts mask real issues)

---

## 1. CRITICAL ISSUES — Fix Immediately

---

### [S1] Privilege Escalation in `undoActivity`

- **File:** `src/actions/dashboard.ts` (lines 73–127)
- **Severity:** 🔴 Critical / Security

**Problem:**  
The `undoActivity` server action only checks `!!session` — any authenticated user (including low-privilege CM users) can undo **any** activity log entry in the system. This means a CM can:
- Delete any `DeliveryDetail` or `MasterRequest` record
- Overwrite arbitrary fields on any entity by supplying a tampered `oldValue` in a real or spoofed audit log

The `oldValue` JSON blob from the database is cast `as Record<string, any>` and passed **directly** into `prisma.*.update()` with no field whitelist or ownership check.

```ts
// src/actions/dashboard.ts ~line 91
const dataToRestore = oldValue as Record<string, any>; // ← danger
await prisma.deliveryDetail.update({ where: { id: entityId }, data: dataToRestore });
```

**Fix:**
1. Add an `ADMIN`-only role check before the action proceeds.
2. Whitelist the specific fields that are allowed to be restored (e.g., `status`, `note`) — never pass the raw blob.

---

### [S2] `"use server"` on a Utility Module Exposes `logActivity` as a Public Server Action

- **File:** `src/lib/audit.ts` (line 1)
- **Severity:** 🔴 Critical / Security

**Problem:**  
`audit.ts` has `"use server"` at the top of the file. This directive marks **every exported function in the file** as a callable Server Action. Any authenticated client can invoke `logActivity` directly to inject fake audit entries with arbitrary `action`, `entityType`, `entityId`, `oldValue`, and `newValue`.

```ts
// src/lib/audit.ts line 1
"use server"; // ← should NOT be here — this is a library, not an action file
```

**Fix:**  
Remove the `"use server"` directive. `audit.ts` is a reusable utility module called from within other server actions — it does not need to be callable from the client.

---

### [B1] Enum Value Mismatch Breaks the "Add Stop" Feature

- **File:** `src/components/pickups/AddStopModal.tsx` (line 16)
- **Severity:** 🔴 Critical / Bug

**Problem:**  
`AddStopModal` uses the local string literal `"COLLECTION_CENTER"` for the pickup location type. The Prisma schema defines the enum as:

```prisma
enum PickupLocationType {
  CENTER  // ← correct value
  BFH
}
```

The `as any` cast in `src/actions/pickups.ts` (line 135) hides the mismatch from TypeScript, but Prisma will throw a **runtime error** when trying to save a stop, as `"COLLECTION_CENTER"` is not a valid enum value.

```ts
// AddStopModal.tsx line 16
const [type, setType] = useState<"COLLECTION_CENTER" | "BFH">("COLLECTION_CENTER"); // ← wrong

// pickups.ts line 135
pickupLocType: c.pickupLocType as any, // ← masks the error at compile time
```

**Fix:**  
Change `"COLLECTION_CENTER"` → `"CENTER"` everywhere in `AddStopModal.tsx` and update the state type.

---

### [S3] Missing Authorization on `updateChildPickup`

- **File:** `src/actions/pickups.ts` (lines 142–196)
- **Severity:** 🔴 Critical / Security

**Problem:**  
Any authenticated user can call `updateChildPickup` with any `childPickupId` and modify weight, bags, and loading status — including stops belonging to other users' requests. No ownership check is performed.

**Fix:**  
Before updating, fetch the `ChildPickup` with its parent `MasterRequest`, then verify the requesting user is either the `cmId` owner or has an ADMIN/LM role.

---

## 2. HIGH SEVERITY

---

### [S4] No Authorization Scope on Messaging

- **File:** `src/actions/messages.ts` (lines 6–45)
- **Severity:** 🟠 High / Security

`getMessages` and `sendMessage` accept any `masterReqId` without checking if the caller owns or has access to that request. A CM can read and inject messages into any pickup request.

---

### [S5] `getPickupById` — No Ownership Check

- **File:** `src/actions/pickups.ts` (lines 69–86)
- **Severity:** 🟠 High / Security

Any authenticated user can fetch any pickup request by ID regardless of who created it.

---

### [S6] `getDeliveryById` — No Ownership Check

- **File:** `src/actions/deliveries.ts` (lines 47–62)
- **Severity:** 🟠 High / Security

Same issue as S5 — delivery data is not scoped to the requesting user's role or ownership.

---

### [S7] No Rate Limiting / Account Lockout on Login

- **File:** `src/lib/auth.ts`
- **Severity:** 🟠 High / Security

The credentials authentication handler has no protection against brute-force attacks. An attacker can try unlimited password combinations.

**Fix:** Use a library like `rate-limiter-flexible` or an IP-based middleware to throttle failed login attempts.

---

### [S8] Hardcoded Seed Password `"admin123"`

- **File:** `prisma/seed.ts` (line 7 area)
- **Severity:** 🟠 High / Security

All seeded users are created with the same trivial password. If `prisma db seed` is ever run against a production database (accidentally or otherwise), every account is instantly compromised.

**Fix:** Generate passwords from an environment variable (`process.env.SEED_PASSWORD`) or prompt interactively. Never hardcode credentials.

---

### [S9] Push Subscription Endpoint Hijack

- **File:** `src/app/api/push/subscribe/route.ts` (lines 14–21)
- **Severity:** 🟠 High / Security

The upsert operation updates `userId` for an existing `endpoint`. A malicious user can POST with another user's known push endpoint to redirect their notifications or silently take over someone else's push channel.

---

### [S11] No Password Complexity Validation

- **File:** `src/actions/admin.ts` (lines 23–34)
- **Severity:** 🟠 High / Security

`createUser` and `resetPassword` accept passwords of any content including empty strings (if the client `required` attribute is bypassed with a direct API call). No minimum length or character rules are enforced server-side.

---

### [S15] No Role Check on `createDelivery`

- **File:** `src/actions/deliveries.ts` (lines 75–129)
- **Severity:** 🟠 High / Security

Any authenticated user (including CM) can create deliveries and mark pickup requests as `PROCESSED`. This should be restricted to ADMIN or LM roles.

---

### [S16] No Role Check on `updateDelivery`

- **File:** `src/actions/deliveries.ts` (lines 131–183)
- **Severity:** 🟠 High / Security

Any authenticated user can modify delivery financial data including `ratePerTon`, `advancePaid`, `actuallyPaid`, etc.

---

### [B2] `totalEstBags` Never Saved on Create

- **File:** `src/actions/pickups.ts` (line 120)
- **Severity:** 🟠 High / Bug

`totalEstBags` is calculated from child pickups but is **never included in the `prisma.masterRequest.create` data object**. The schema default is `0`, so all newly created master requests permanently display 0 bags until some unrelated update triggers a recalculation.

```ts
const totalEstBags = data.children.reduce(...); // ← calculated
// ↓ but never used here:
await prisma.masterRequest.create({ data: { totalEstWeight, /* totalEstBags missing */ } });
```

---

### [P1] No Pagination on `getPickups`

- **File:** `src/actions/pickups.ts` (lines 24–60)
- **Severity:** 🟠 High / Performance

Fetches **all** master requests with deeply nested `include` (child pickups, delivery details, message counts). As data grows this will cause severe response time degradation and potential memory issues.

---

### [P2] No Pagination on `getDeliveries`

- **File:** `src/actions/deliveries.ts` (lines 11–46)
- **Severity:** 🟠 High / Performance

Same issue — entire delivery table is fetched with all relational includes on every page load.

---

### [P3] No Database Indexes

- **File:** `prisma/schema.prisma`
- **Severity:** 🟠 High / Performance

No explicit `@@index` directives on frequently queried/filtered columns:

| Model | Missing Index |
|---|---|
| `MasterRequest` | `status`, `cmId`, `pickupDate` |
| `DeliveryDetail` | `status` |
| `ActivityLog` | `createdAt`, `(entityType, entityId)` |
| `ChildPickup` | `parentId`, `loadingStatus` |

Prisma only auto-creates indexes for `@id`, `@unique`, and FK relation fields.

---

### [A1] No `aria-label` on Icon-Only Buttons

- **Files:** `Header.tsx`, `BottomNav.tsx`, `Sidebar.tsx`, all modal components
- **Severity:** 🟠 High / Accessibility

Dozens of interactive buttons use only icon children with no accessible label. Screen readers will announce them as unlabeled. Examples: theme toggle, sign-out, close modal, delete, expand/collapse.

---

## 3. MEDIUM SEVERITY

---

### [T1] ~40 `(session.user as any)` Casts — Root Cause

- **Files:** All server actions and multiple components
- **Severity:** 🟡 Medium / Type Safety

A `SessionUser` interface is defined in `src/types/index.ts` but the NextAuth module types are never augmented. Every file that needs `session.user.id`, `.role`, or `.phone` must cast to `any`.

**Fix:** Add a `next-auth.d.ts` type declaration file:

```ts
// src/types/next-auth.d.ts
import { Role } from "@prisma/client";
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      phone: string;
    } & DefaultSession["user"];
  }
}
```

This eliminates all ~40 `as any` casts across the codebase at once.

---

### [T2] `data as any` Passed to Prisma

- **File:** `src/actions/admin.ts` (lines 32, 85, 93)
- **Severity:** 🟡 Medium / Type Safety

Raw untyped objects are passed to Prisma's update/create calls. Prisma's entire type-safety guarantee is bypassed — invalid field names or wrong types will fail at runtime, not compile time.

---

### [T3] All Client Component Props Typed as `any[]`

- **Files:** `ActivityClient.tsx`, `CentersClient.tsx`, `FactoriesClient.tsx`, `MappingClient.tsx`, `UsersClient.tsx`, `DeliveriesClient.tsx`, `PickupsClient.tsx`
- **Severity:** 🟡 Medium / Type Safety

Every admin and feature client component accepts its primary data prop as `any[]`, providing zero compile-time safety. Should use typed interfaces derived from Prisma's generated types.

---

### [W1] `middleware.ts` Is Deprecated in Next.js 16

- **File:** `src/middleware.ts`
- **Severity:** 🟡 Medium / Next.js

The build shows: *⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.*  
See: https://nextjs.org/docs/messages/middleware-to-proxy

---

### [R1] No Error Boundaries (`error.tsx` / `not-found.tsx`)

- **Severity:** 🟡 Medium / Next.js

No `error.tsx` or `not-found.tsx` exists anywhere in the app. Any unhandled server action failure or missing page shows Next.js's raw default error screen with no user-friendly messaging or recovery flow.

---

### [B4] Optimistic UI Updates Without Rollback on Error

- **File:** `src/components/deliveries/DeliveriesClient.tsx` (lines 220–230)
- **Severity:** 🟡 Medium / Bug

`handleStatusAdvance`, `handleCompleteConfirm`, and `handleInvoiceConfirm` mutate local component state **before** awaiting the server action. If the server action throws, the UI state is never reverted — the screen shows a false status until the user manually refreshes.

---

### [B5] Same Optimistic Update Issue in `PickupsClient`

- **File:** `src/components/pickups/PickupsClient.tsx` (lines 133–138)
- **Severity:** 🟡 Medium / Bug

The `handleStatusChange` function is missing a `catch` block entirely — errors are silently swallowed, UI state diverges from database state.

---

### [P4] `JSON.parse(JSON.stringify(data))` for Serialization

- **Files:** Multiple server page components
- **Severity:** 🟡 Medium / Performance

Used on every server component page to strip non-serializable Prisma `Date` objects before passing to client components. This is a double string allocation + re-parse on every request. For large payloads this is wasteful.

**Fix:** Use `superjson` or write targeted mappers that convert only the Date fields.

---

### [P5] O(n²) Computation in Dashboard Stats

- **File:** `src/components/dashboard/DashboardClient.tsx` (line 112)
- **Severity:** 🟡 Medium / Performance

`statusDistribution.reduce()` recalculates the total on every iteration of a surrounding `.map()`, making it O(n²). The total should be computed once before the map.

---

### [P6] Client-Side Search/Filter on Full Unfiltered Dataset

- **File:** `src/components/pickups/PickupsClient.tsx` (lines 121–132)
- **Severity:** 🟡 Medium / Performance

All pickups are fetched from the server and then filtered in the browser by search text and status. This compounds the pagination issue (P1) — the server sends everything and the browser discards most of it.

---

### [A2] Modals Are Not Accessible

- **Files:** `CreatePickupModal.tsx`, `CreateDeliveryModal.tsx`, `AddStopModal.tsx`, `CentersClient.tsx`
- **Severity:** 🟡 Medium / Accessibility

All modals are missing: `role="dialog"`, `aria-modal="true"`, focus trapping, and `Escape` key handling. Keyboard and screen reader users cannot properly interact with or dismiss these dialogs.

---

### [A3] `window.confirm()` / `window.alert()` Used Throughout

- **Files:** `CentersClient.tsx` (L29), `FactoriesClient.tsx` (L40), `DashboardClient.tsx` (L66), `AddStopModal.tsx` (L33)
- **Severity:** 🟡 Medium / Accessibility & UX

Native browser dialogs block the main thread, cannot be styled, and fail in some environments (e.g., within iframes). Replace with in-UI confirmation modals.

---

## 4. LOW SEVERITY

---

### [B3] `idealPayment` Uses Estimated Weight Instead of Actual

- **File:** `src/actions/deliveries.ts` (line 96)
- Uses `totalEstWeight` for payment calculation even when actual weights are available.

---

### [B6] Unused Import `getCenters` in Factories Page

- **File:** `src/app/(app)/admin/factories/page.tsx` (line 2)
- `getCenters` is imported but never used. ESLint warns on this.

---

### [R4] Messages Page Missing from Navigation

- **File:** `src/types/index.ts` (lines 28–36)
- The `/messages` page exists and is functional but has no entry in `NAV_ITEMS`. It is unreachable via the sidebar or bottom nav for any role.

---

### [Q3] `@types/web-push` in `dependencies` Instead of `devDependencies`

- **File:** `package.json` (line 18)
- Type-only packages should be in `devDependencies` to avoid being included in production bundles.

---

### [Q5] No Input Validation on Financial Server Action Fields

- **File:** `src/actions/deliveries.ts`
- `ratePerTon`, `advancePaid`, `actuallyPaid`, `miscAmount` accept any number including negatives, `NaN` (from failed `parseFloat`), and `Infinity`. These pass through to the database.

---

### [Q6] Delete Buttons Have No Loading State

- **Files:** `CentersClient.tsx`, `FactoriesClient.tsx`
- A user can double-click a delete button before the first request resolves, firing duplicate delete requests.

---

### [P8] `recharts` Appears Unused

- **File:** `package.json` (line 25)
- `recharts` is listed as a dependency but no component imports it. If unused it adds ~200KB to the potential bundle unnecessarily.

---

### [W2] 13 Unused Import Warnings (ESLint)

The following imports are defined but never used:

| File | Unused Symbol |
|---|---|
| `ActivityClient.tsx` | `User2` |
| `MappingClient.tsx` | `Link` |
| `UsersClient.tsx` | `Plus`, `cn` |
| `DeliveriesClient.tsx` | `Calendar`, `delivery` (param) |
| `CreateDeliveryModal.tsx` | `DollarSign`, `Phone`, `User2` |
| `CreatePickupModal.tsx` | `Home` |
| `ChatPopup.tsx` | `AnimatePresence` |
| `api/push/test/route.ts` | `req` (parameter) |
| `admin/factories/page.tsx` | `getCenters` |

---

## Summary Table

| Severity | Count |
|---|---|
| 🔴 Critical | 4 |
| 🟠 High | 12 |
| 🟡 Medium | 13 |
| ⚪ Low | 8 |
| **ESLint errors** | **147** |
| **ESLint warnings** | **13** |

---

## Top 5 Priorities

| Priority | Item | File |
|---|---|---|
| 1 | **[S1]** Add ADMIN-only role check to `undoActivity`; whitelist restorable fields | `src/actions/dashboard.ts` |
| 2 | **[S2]** Remove `"use server"` from `audit.ts` — it is a library, not a client action | `src/lib/audit.ts` |
| 3 | **[B1]** Fix `"COLLECTION_CENTER"` → `"CENTER"` in `AddStopModal` to match Prisma enum | `src/components/pickups/AddStopModal.tsx` |
| 4 | **[T1]** Add NextAuth module type augmentation to eliminate all ~40 `as any` session casts | `src/types/next-auth.d.ts` (new file) |
| 5 | **[S3–S6, S15–S16]** Add consistent role + ownership checks to all server actions | `src/actions/*` |
