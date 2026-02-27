# Bull Logistic — Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Git

---

## 1. Local Development

```bash
# Clone & install
git clone <your-repo-url>
cd bull-logistic
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and NEXTAUTH_SECRET

# Push schema to database
npx prisma db push

# Seed demo data
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

**Demo Credentials** (after seeding):
| Role | Phone | Password |
|-------|-------------|----------|
| Admin | 9000000001 | admin123 |
| LM | 9000000002 | admin123 |
| CM 1 | 9000000003 | admin123 |
| CM 2 | 9000000004 | admin123 |

---

## 2. AWS Deployment

### Option A: AWS Amplify (Recommended)

1. **Push to GitHub** — commit all files and push to a GitHub repo.
2. **Create Amplify App**:
   - Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
   - Click "Host web app" → Connect to GitHub
   - Select your repo and branch
3. **Environment Variables**: Add in Amplify Console → App Settings → Environment Variables:
   - `DATABASE_URL` — your RDS connection string
   - `NEXTAUTH_URL` — your Amplify app URL (e.g., `https://main.xxxx.amplifyapp.com`)
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
4. **Build Settings**: Amplify auto-detects Next.js. Default build spec works.
5. **Deploy**: Amplify will build and deploy automatically on each push.

### Option B: AWS App Runner

1. **Create RDS PostgreSQL instance** (db.t3.micro for dev)
2. **Push Docker image** or connect GitHub repo
3. Set environment variables in App Runner configuration
4. Configure VPC to allow App Runner → RDS connectivity

### PostgreSQL (RDS) Setup

1. Go to **RDS Console** → Create Database
2. Choose **PostgreSQL** engine (v15+)
3. Settings:
   - DB instance: `bull-logistic-db`
   - Master username: `postgres`
   - Master password: (your choice)
   - Instance: `db.t3.micro` (free tier eligible)
4. Connectivity: Allow connections from your Amplify/App Runner environment
5. Get the **endpoint** from the RDS dashboard
6. Set `DATABASE_URL=postgresql://postgres:PASSWORD@ENDPOINT:5432/bull_logistic`
7. Run migrations: `npx prisma db push`

---

## 3. Post-Deployment

```bash
# Run seed on production (optional)
DATABASE_URL="your-production-url" npx tsx prisma/seed.ts

# Generate Prisma client for production
npx prisma generate
```

---

## 4. Useful Commands

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (DESTRUCTIVE)
npx prisma db push --force-reset

# Generate types after schema changes
npx prisma generate
```
