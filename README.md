# Bull Logistic

A Next.js application for Bull Agritech's logistic operations.

## Features

- **Delivery Management System**: Manage pickup requests, deliveries, and tracking.
- **PWA Ready**: Includes offline caching and app installation support.
- **Database**: PostgreSQL with Prisma ORM.

## Getting Started

First, install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values. Note that `.env` is ignored by git for security purposes.

```bash
cp .env.example .env
```

## Database

This project uses Prisma with PostgreSQL. Ensure your `DATABASE_URL` is set in `.env`, then run:

```bash
npx prisma generate
npx prisma db push
```

## Deployment

Refer to `DEPLOYMENT.md` for detailed deployment instructions, including setting up an AWS EC2 instance.
