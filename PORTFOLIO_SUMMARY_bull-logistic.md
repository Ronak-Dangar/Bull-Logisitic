# Bull Logistic — Portfolio Summary

## 1. PROJECT OVERVIEW
- **Project Name:** Bull Logistic
- **Purpose:** A domain-specific delivery management system for Bull Agritech's agricultural commodity (castor) logistics operations in Gujarat, India. Manages the full pickup → delivery lifecycle with multi-stop routing, role-based access, approval workflows, real-time push notifications, and comprehensive audit logging.
- **Industry/Domain:** AgriTech / Logistics & Supply Chain Management
- **Current Stage:** Production

## 2. TECH STACK & ARCHITECTURE

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| React | React / React DOM | 19.2.3 |
| Language | TypeScript (strict mode) | ^5 |
| CSS | Tailwind CSS v4 (`@tailwindcss/postcss`) | v4 |
| ORM | Prisma + `@prisma/client` | ^6.19.2 |
| Database | PostgreSQL | 15+ |
| Auth | NextAuth.js v5 (Auth.js) | 5.0.0-beta.30 |
| Bundler (Dev) | Turbopack | Built-in |
| Animations | Framer Motion | ^12.34.3 |
| Charts | Recharts | ^3.7.0 |
| Icons | Lucide React | ^0.575.0 |
| Push Notifications | web-push + Service Worker | ^3.6.7 |
| Passwords | bcryptjs | ^3.0.3 |
| Theming | next-themes | ^0.4.6 |
| Linting | ESLint 9 + eslint-config-next | ^9 |

- **Architectural Pattern:** Server-First Hybrid Architecture — Next.js 16 App Router with Server Components for data fetching, Client Components for interactivity, and Server Actions replacing REST for all mutation logic (RPC over HTTP). Only 3 REST API routes remain (auth handler, push endpoints, factory admin).
- **Database:** PostgreSQL (AWS RDS) via Prisma ORM — 11 models, 7 enums, 274-line schema
- **Infrastructure:** AWS Amplify (auto-detect Next.js, git-push deploys), AWS RDS PostgreSQL (db.t3.micro)

## 3. SYSTEM DESIGN HIGHLIGHTS

### High-Level Architecture
Server Components fetch data via parallel `Promise.all()` calls to Server Actions, serialize via `JSON.parse(JSON.stringify(...))`, and pass to Client Components. Route groups split authenticated `(app)` routes from the login page.

### Key Design Decisions
- **Server Actions over REST** — deliberate choice to use typed server functions for all business logic. Reduces API surface, improves type safety, and co-locates mutations with validation.
- **Urgent Approval as a Saga** — rather than allowing direct mutations on approved requests, pending changes are stored as serialized JSON and replayed on approval. Lightweight saga pattern preserving data integrity without an external queue.
- **Cascading Aggregation** — child weight changes roll up to parent totals and cascade to delivery financials automatically.
- **1-Minute Undo Window** — `undoActivity()` checks `ageMs > 60000` against JSON snapshots in the activity log; pragmatic alternative to full event sourcing.

### Data Flow
`Center Manager submits pickup → MasterRequest + ChildPickups created → LM assigns delivery → Vehicle/driver tracked → Status pipeline (SCHEDULED → LOADING → IN_TRANSIT → AT_FACTORY → COMPLETED → RECEIPT_SUBMITTED) → Financial calculations → Activity logged → Push notifications dispatched`

### Notable Design Patterns
- **Audit Trail / Event Sourcing (lite)** — `logActivity()` records every mutation with old/new JSON snapshots
- **Saga-like Approval Queue** — `UrgentApproval` stores pending mutations as JSON; `resolveUrgentApproval()` replays or discards
- **Singleton** — Prisma client prevents connection pool exhaustion during HMR
- **Guard Clause Authentication** — every server action starts with `auth()` check
- **Strategy Pattern** — `resolveUrgentApproval` switches on `pendingData.type`

## 4. CORE FEATURES & MODULES

| Module | Description |
|--------|-------------|
| **Role-Based Access Control** | 3-tier RBAC (ADMIN, LM, CM) with middleware and per-action enforcement |
| **Multi-Stop Pickup Management** | MasterRequest → ChildPickup hierarchy with CENTER/BFH stop types and weight roll-up (692 lines) |
| **Urgent Approval Workflow** | Pending mutations serialized as JSON for LM/Admin review with push notifications |
| **Delivery & Logistics Management** | 1:1 delivery-to-request linking, vehicle/driver tracking, financial fields, 6-stage status pipeline |
| **Real-Time Messaging** | Per-request message threads with push notification cross-alerts |
| **Admin Panel** | Full CRUD for Users, Centers, Factories, User-Center Mappings, Activity Log viewer |
| **Dashboard & Analytics** | KPIs, status distribution, recent activity, 1-minute undo window, urgent approval banner |
| **Push Notifications (PWA)** | VAPID Web Push with Service Worker, stale subscription cleanup, `Promise.allSettled()` fan-out |
| **Progressive Web App** | Standalone PWA with manifest, screenshots, apple-web-app-capable, service worker |

**Most Technically Complex:** Multi-stop Pickup Management (692 lines — weight aggregation, status flow, CM scoping, urgent approval interplay) and the Urgent Approval Saga pattern.

## 5. SCALE & PERFORMANCE INDICATORS

| Optimization | Detail |
|-------------|--------|
| Turbopack | Dev mode HMR via `next dev --turbopack` |
| Parallel Data Fetching | All pages use `Promise.all()` for concurrent server action calls |
| Selective Prisma Queries | `select`/`include` for minimal data transfer |
| Server Components by Default | Only interactive components opt into `"use client"` |
| Fire-and-Forget Notifications | Push notifications don't block response (`.catch(console.error)`) |
| `Promise.allSettled()` | Push fan-out won't fail batch on single error |
| Tailwind v4 CSS | Tree-shaken, PostCSS-based |
| Font Optimization | `next/font/google` with `variable` approach |
| Body Size Limit | Server Actions capped at 2MB |

## 6. CODE QUALITY & ENGINEERING STANDARDS

- **Testing:** No automated tests detected (gap)
- **Code Organization:** Clean 4-layer separation — `actions/` (business logic), `components/` (UI), `lib/` (infrastructure), `types/` (shared types)
- **Linting:** ESLint 9 flat config with `core-web-vitals` + TypeScript presets
- **TypeScript:** Strict mode enabled, path aliases, centralized type exports
- **Error Handling:** Non-crashing audit logging (try/catch wraps all activity calls), graceful push notification failures, stale subscription cleanup (410/404 auto-delete), FK validation before insert
- **Security:** Server Actions (mutations not exposed as public API), middleware route protection, per-action auth checks, JWT sessions, bcrypt hashing (cost 10), VAPID push, HTTPS detection, `.env.example` for credentials

## 7. INTEGRATIONS & THIRD-PARTY SERVICES

| Service | Purpose |
|---------|---------|
| NextAuth.js v5 | Credentials provider + JWT sessions |
| bcryptjs | Password hashing |
| web-push | VAPID Web Push notifications |
| Framer Motion | Page/component animations |
| Recharts | Dashboard charting |
| next-themes | Dark/light mode |
| Lucide React | Icon system |
| AWS Amplify | Deployment target |
| AWS RDS | Managed PostgreSQL |

## 8. TECH LEAD CONTRIBUTIONS (inferred from code)

- **Domain-Driven Schema Layering** — Prisma schema organized into named layers (Access, Demand, Execution, Intelligence, Approval) with clear boundary comments
- **Saga-Pattern Approval Workflow** — serialized JSON mutations replayed on approval, a production-grade alternative to message queues
- **Cascading Financial Recalculation** — weight changes on any child pickup trigger upward aggregation to parent, then cascade to delivery financials
- **Non-Blocking Notification Architecture** — fire-and-forget with `Promise.allSettled()` and auto-cleanup of dead subscriptions
- **Audit-as-a-Service** — defensive `logActivity()` with FK validation, never-crash design, and `LogDiff` component for human-readable diffs
- **Serialization Boundary Management** — consistent `JSON.parse(JSON.stringify())` for Prisma→Client Component bridge
- **Mobile-First PWA Design** — `100dvh`, `safe-area-inset-bottom`, `BottomNav` for mobile, standalone manifest with orientation lock

## 9. PORTFOLIO PITCH

> Built and architected a production **logistics management PWA** for agricultural commodity operations using Next.js 16, handling multi-stop pickup routing, delivery lifecycle tracking, real-time push notifications, and a saga-based approval workflow — serving field operations teams across Gujarat, India.

## 10. TAGS

`#NextJS` `#TypeScript` `#PostgreSQL` `#Prisma` `#PWA` `#ServerActions` `#RBAC` `#WebPush` `#AuditTrail` `#AgriTech` `#Logistics` `#RealTime` `#SagaPattern` `#TailwindCSS` `#AWS`

---

*Generated by GitHub Copilot Portfolio Analyzer*
*Last analyzed: March 5, 2026*
