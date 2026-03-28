# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Start dev server with Turbopack

# Production
pnpm build            # prisma generate + next build
pnpm start            # Start production server

# Linting
pnpm lint             # ESLint 9 flat config

# Database
npx prisma db push    # Push schema changes to database
npx prisma generate   # Regenerate Prisma client
npx prisma studio     # Open Prisma Studio GUI
npx tsx prisma/seed.ts  # Seed demo data

# Push notifications
# Test via POST /api/push/test (requires active push subscription)
```

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` — PostgreSQL 15+ connection string
- `NEXTAUTH_SECRET` — random secret for JWT signing
- `NEXTAUTH_URL` — app URL (http://localhost:3000 for dev)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — for push notifications

Demo credentials after seeding: phone `900000000{1-4}`, password `admin123` (roles: Admin/LM/CM/CM).

## Architecture

**Bull Logistic** is a Next.js 16 App Router PWA for managing agricultural commodity (castor) pickup and delivery logistics across pickup centers and delivery factories.

### Core Domain Flow

```
CM submits MasterRequest (with ChildPickups)
  → LM reviews & approves
  → Vehicle/driver assigned → DeliveryDetail created
  → 6-stage delivery pipeline tracked
  → Financials calculated (weight × rate)
```

### Role-Based Access (3 roles)
- **ADMIN** — full system access, user/center/factory management
- **LM** (Logistics Manager) — approves requests, manages deliveries, sees all CMs
- **CM** (Center Manager) — submits pickups for their assigned centers only

Route protection in `src/middleware.ts`; per-action auth checks via `auth()` at top of every server action.

### Server Actions over REST

Nearly all mutations use **Next.js Server Actions** in `src/actions/` (not REST endpoints). Only 3 API routes exist: NextAuth handler, push subscribe, and factory admin GET/POST.

### Urgent Approval Saga Pattern

When a CM modifies a request in `FINDING_VEHICLE` or `PROCESSED` status, changes are serialized as JSON into the `UrgentApproval` table (status: PENDING). On LM approval, `resolveUrgentApproval()` replays and applies the mutation. This avoids message queues while preserving data integrity.

### Data Model Hierarchy

```
User → UserCenterMapping → Center
MasterRequest → ChildPickup[]      (demand layer)
MasterRequest → DeliveryDetail     (execution layer)
MasterRequest → UrgentApproval[]   (approval layer)
MasterRequest → RequestMessage[]   (messaging)
```

Weight changes in `ChildPickup` roll up to `MasterRequest.totalEstWeight`, which cascades to `DeliveryDetail` financial fields.

### Audit Trail

`logActivity()` in `src/lib/audit.ts` records every mutation with old/new JSON snapshots in `ActivityLog`. It is non-blocking (wrapped in try/catch) and supports a 1-minute undo window (`ageMs < 60000`). The `LogDiff` component renders human-readable diffs.

### Push Notifications

VAPID web push via `src/lib/webpush.ts`. `sendPushToRoles(roles, payload)` fans out to all subscribed users of given roles using `Promise.allSettled()`. Stale subscriptions (410/404 responses) are auto-cleaned. Service worker in `public/sw.js`.

### Key Conventions

- **Serialization boundary**: Prisma results passed to Client Components must go through `JSON.parse(JSON.stringify())` to strip Date objects and BigInts.
- **Prisma singleton**: `src/lib/prisma.ts` uses global singleton to prevent connection pool exhaustion during HMR.
- **Path aliases**: `@/*` maps to `src/*`.
- **CM data isolation**: All CM-facing server actions filter by `cmId = user.id` and check center membership before allowing mutations.
- **bcryptjs**: Imported dynamically in `src/lib/auth.ts` to handle ESM/CJS compatibility.

### Directory Map

| Path | Purpose |
|------|---------|
| `src/app/(app)/` | Authenticated route group (dashboard, pickups, deliveries, admin, messages) |
| `src/app/api/` | REST API routes (auth, push subscribe/test, factories) |
| `src/actions/` | Server Actions — all business logic and DB mutations |
| `src/components/` | React components, organized by feature |
| `src/components/layout/` | Header, Sidebar, BottomNav, theme/auth providers |
| `src/components/shared/` | Cross-feature: ChatPopup, PushManager, LogDiff, notifications |
| `src/lib/` | Infrastructure: Prisma client, NextAuth config, audit logger, web push |
| `src/types/index.ts` | Centralized TypeScript types + `NAV_ITEMS` constant |
| `prisma/schema.prisma` | 11 models, 7 enums — source of truth for data layer |
