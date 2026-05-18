# Bull Logistic

A Progressive Web App (PWA) for managing agricultural commodity (castor) pickup and delivery logistics across pickup centers and delivery factories.

Built with **Next.js 16** (App Router), **Prisma**, **PostgreSQL**, and **Tailwind CSS 4**.

---

## Table of Contents

- [Business Logic](#business-logic)
  - [Core Domain Flow](#core-domain-flow)
  - [Roles & Permissions](#roles--permissions)
  - [Pickup Management](#pickup-management)
  - [Delivery Pipeline](#delivery-pipeline)
  - [Urgent Approval System](#urgent-approval-system)
  - [Financial Calculations](#financial-calculations)
  - [Messaging](#messaging)
  - [Dashboard & Analytics](#dashboard--analytics)
  - [Audit Trail & Undo](#audit-trail--undo)
  - [Push Notifications](#push-notifications)
  - [Admin Panel](#admin-panel)
- [Tech Setup Guide](#tech-setup-guide)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the App](#running-the-app)
  - [Demo Credentials](#demo-credentials)
- [Architecture & Technical Logic](#architecture--technical-logic)
  - [Data Model](#data-model)
  - [Server Actions (No REST)](#server-actions-no-rest)
  - [Directory Structure](#directory-structure)
  - [Key Technical Conventions](#key-technical-conventions)
  - [Tech Stack](#tech-stack)

---

## Business Logic

### Core Domain Flow

```
CM submits Pickup Request (MasterRequest with ChildPickup stops)
  → LM reviews & changes status to FINDING_VEHICLE
  → Vehicle/driver found → LM creates DeliveryDetail (status auto-set to PROCESSED)
  → 6-stage delivery pipeline tracked (SCHEDULED → LOADING → IN_TRANSIT → AT_FACTORY → COMPLETED → RECEIPT_SUBMITTED)
  → Financials auto-calculated (weight × rate per ton)
```

### Roles & Permissions

| Role | Access Level |
|------|-------------|
| **ADMIN** | Full system access — user management, center/factory CRUD, all data visibility, activity logs |
| **LM** (Logistics Manager) | Approves/rejects pickup requests, manages deliveries, assigns vehicles, resolves urgent approvals, sees all CMs' data |
| **CM** (Center Manager) | Submits pickup requests only for their assigned centers, tracks their own requests/deliveries, can message LMs |

Route protection is enforced in `src/middleware.ts`. Every server action verifies the session via `auth()` at the top.

### Pickup Management

**Creating a Pickup Request:**
- CM selects commodity (default: Castor), destination factory, pickup date
- Adds one or more "stops" (ChildPickups) — either from an assigned Center or a BFH (village) location
- Each stop has estimated weight and bags; weight auto-calculates from bags at 74.5 kg/bag
- Total weight/bags roll up to the parent MasterRequest

**Request Statuses:**
| Status | Meaning |
|--------|---------|
| `SUBMITTED` | New request, awaiting LM review |
| `FINDING_VEHICLE` | LM approved, searching for transport |
| `UNABLE_TO_FIND` | No vehicle available — CM may self-arrange |
| `PROCESSED` | Vehicle assigned, delivery created |
| `OVER_TO_NEXT` | Deferred to next scheduling cycle |
| `REJECTED` | Request denied |

**Editing Stops:**
- CMs can freely edit stops on `SUBMITTED` requests
- Once a request is in `FINDING_VEHICLE` or `PROCESSED` status, CM edits trigger the Urgent Approval flow (see below)
- LMs/Admins can edit any stop at any time without approval

**Weight Roll-Up Logic:**
When any ChildPickup's weight or bags change, the system:
1. Recalculates total weight/bags across all stops
2. Updates the parent MasterRequest totals
3. If a DeliveryDetail exists, updates `totalWeightFinal`, `totalBags`, and recalculates `idealPayment`

### Delivery Pipeline

**Creating a Delivery:**
- LM assigns a vehicle (number, driver name, contact, transporter)
- Sets rate per ton, advance payment, expected delivery date
- System auto-creates a `DeliveryDetail` linked to the MasterRequest
- MasterRequest status moves to `PROCESSED` with approval timestamp

**Delivery Statuses (6-stage pipeline):**
```
SCHEDULED → LOADING → IN_TRANSIT → AT_FACTORY → COMPLETED → RECEIPT_SUBMITTED
```

- Status advances are logged and trigger push notifications to the CM
- `COMPLETED` auto-sets `actualDeliveryDt` if not already set
- Status can be undone (rolled back one step) — clears auto-set dates on rollback

**Delivery Fields:**
- Vehicle: number, driver name/contact, transporter name/contact
- Logistics: expected delivery date, scheduled pickup time, invoice number
- Financials: rate per ton, ideal payment, advance paid (+ date), final payment (+ date), misc charges, waiting charges
- Receipt: receipt URL (uploaded after completion)

### Urgent Approval System

When a CM modifies a request that's already in `FINDING_VEHICLE` or `PROCESSED` status:

1. The change is **not applied immediately**
2. Instead, the change is serialized as JSON into the `UrgentApproval` table (status: `PENDING`)
3. LMs/Admins see pending approvals and can approve or deny
4. **On approval:** the system replays the mutation (add stop, update stop, remove stop, or change factory)
5. **On denial:** the change is discarded, CM is notified

Supported change types:
- `ADD_STOP` — CM wants to add a new pickup stop
- `UPDATE_STOP` — CM wants to modify weight/bags/location on an existing stop
- `DELETE_STOP` — CM wants to remove a stop (cannot remove the last one)
- `UPDATE_FACTORY` — CM wants to change the delivery destination

### Financial Calculations

```
idealPayment = ratePerTon × (totalWeightFinal / 1000)
totalPayment = idealPayment + miscAmount - waitingCharges
remaining    = totalPayment - advancePaid
```

- `ratePerTon` is set per delivery (per metric ton)
- `totalWeightFinal` cascades from pickup stop weights
- `waitingCharges` are stored as absolute values (always deducted)
- Financial fields auto-recalculate when weight or rate changes

### Messaging

- Per-request chat thread between CM and LM
- Messages stored in `RequestMessage` linked to a `MasterRequest`
- Push notifications sent to the CM when LM messages (and vice versa)
- Message list shows all requests with message counts

### Dashboard & Analytics

- **KPIs:** Total requests, in-transit deliveries, incomplete deliveries, over-to-next count
- **Status Distribution:** Pie/bar chart of request statuses (via Recharts)
- **Recent Activity:** Latest audit log entries with user/role
- **Pending Requests:** Unprocessed requests queue for LMs

### Audit Trail & Undo

Every mutation is logged in `ActivityLog` with:
- Who did it (user ID)
- What changed (entity type, entity ID)
- Before/after JSON snapshots (`oldValue` / `newValue`)
- Timestamp

**Undo:** Actions within 60 seconds can be undone. The system restores `oldValue` for UPDATE/STATUS_CHANGE actions, or deletes the entity for CREATE actions.

The `LogDiff` component renders human-readable before/after diffs in the UI.

### Push Notifications

- VAPID web push via service worker (`public/sw.js`)
- `sendPushToRoles(roles, payload)` — fans out to all subscribed users of given roles
- `sendPushToUser(userId, payload)` — targets a specific user
- Stale subscriptions (410/404) are auto-cleaned from the database
- Notifications include action URLs for deep linking

**Notification triggers:**
- New pickup request submitted → LM/Admin notified
- Request status changed → CM notified
- Delivery status advanced/reverted → CM notified
- Urgent approval requested → LM/Admin notified
- Urgent approval resolved → CM notified
- New message → recipient notified

### Admin Panel

- **Users:** CRUD users with phone-based auth, assign roles, reset passwords
- **Centers:** CRUD pickup centers (type: CENTER or VILLAGE)
- **Factories:** CRUD delivery factories with location
- **User-Center Mapping:** Assign CMs to specific centers (controls data isolation)
- **Activity Logs:** Full audit trail browser with diff viewer

---

## Tech Setup Guide

### Prerequisites

- **Node.js** 18+
- **pnpm** (package manager)
- **PostgreSQL** 15+

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd bull-logistic

# Install dependencies
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database — PostgreSQL connection string
DATABASE_URL="postgresql://postgres:password@localhost:5432/bull_logistic?schema=public"

# NextAuth — authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"

# Push Notifications — VAPID keys (generate with: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-key"
VAPID_PRIVATE_KEY="your-private-key"
VAPID_EMAIL="mailto:your-email@example.com"
```

### Database Setup

```bash
# Push schema to database (creates tables)
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed demo data (optional)
npx tsx prisma/seed.ts

# Open Prisma Studio (visual database browser)
npx prisma studio
```

### Running the App

```bash
# Development (with Turbopack)
pnpm dev

# Production build
pnpm build
pnpm start

# Lint
pnpm lint
```

The app runs at `http://localhost:3000`.

### Demo Credentials

After seeding, use these phone numbers to log in:

| Phone | Role | Purpose |
|-------|------|---------|
| `9000000001` | ADMIN | Full access |
| `9000000002` | LM | Logistics Manager |
| `9000000003` | CM | Center Manager |
| `9000000004` | CM | Center Manager (2nd) |

Password for all: `admin123`

---

## Architecture & Technical Logic

### Data Model

```
User → UserCenterMapping → Center         (access control)
MasterRequest → ChildPickup[]              (demand layer — pickup stops)
MasterRequest → DeliveryDetail             (execution layer — vehicle/transport)
MasterRequest → UrgentApproval[]           (approval layer — deferred mutations)
MasterRequest → RequestMessage[]           (communication layer)
ActivityLog                                (audit layer — old/new JSON snapshots)
PushSubscription                           (notification layer)
Factory                                    (delivery destinations)
```

### Server Actions (No REST)

Nearly all mutations use **Next.js Server Actions** (`src/actions/`), not REST API routes. Only 3 API routes exist:
- `/api/auth/[...nextauth]` — NextAuth handler
- `/api/push/subscribe` — Push subscription management
- `/api/factories` — Factory admin GET/POST

Server actions provide type-safe, zero-boilerplate mutations with automatic revalidation.

### Directory Structure

| Path | Purpose |
|------|---------|
| `src/app/(app)/` | Authenticated route group (dashboard, pickups, deliveries, admin, messages) |
| `src/app/api/` | REST API routes (auth, push, factories) |
| `src/actions/` | Server Actions — all business logic and DB mutations |
| `src/components/` | React components, organized by feature |
| `src/components/layout/` | Header, Sidebar, BottomNav, theme/auth providers |
| `src/components/shared/` | Cross-feature: ChatPopup, PushManager, LogDiff, notifications |
| `src/lib/` | Infrastructure: Prisma client, NextAuth config, audit logger, web push |
| `src/types/index.ts` | Centralized TypeScript types + `NAV_ITEMS` constant |
| `prisma/schema.prisma` | 11 models, 7 enums — source of truth for data layer |
| `public/sw.js` | Service worker for push notifications + PWA |

### Key Technical Conventions

- **Serialization boundary:** Prisma results passed to Client Components go through `JSON.parse(JSON.stringify())` to strip Date/BigInt objects
- **Prisma singleton:** `src/lib/prisma.ts` uses a global singleton to prevent connection pool exhaustion during HMR
- **Path aliases:** `@/*` maps to `src/*`
- **CM data isolation:** All CM-facing server actions filter by `cmId = user.id` and verify center membership
- **bcryptjs:** Imported dynamically in `src/lib/auth.ts` for ESM/CJS compatibility
- **Weight from bags:** Auto-calculated at 74.5 kg per bag in the pickup form
- **PWA:** Installable as mobile app with offline notification support via service worker

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Database | PostgreSQL 15+ via Prisma ORM |
| Auth | NextAuth v5 (credentials provider, phone + password) |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| Push | Web Push (VAPID) |
| PDF | html2pdf.js (voucher generation) |
| File Storage | AWS S3 (receipt uploads) |
| Theme | next-themes (dark/light mode) |
