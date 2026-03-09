# Atlas Verify

Atlas Verify is a case-based identity verification and enrichment platform designed for investigators, compliance teams, and analysts. It aggregates lawful public data and licensed enrichment sources into structured case files with audit logging.

---

## ⚠️ Security – Rotate Your Credentials First

> **If you forked or cloned this repository before March 2026**, the `.env` file was briefly tracked by git and contained real credentials. Those credentials have been **invalidated**. Before running the app you must create fresh ones.

**Checklist – do this once before anything else:**

1. **Rotate your Neon database password**
   - Log in to <https://neon.tech> → your project → **Settings → Connection details**.
   - Click **"Reset password"** (or create a new role). Copy the new connection string.

2. **Generate a strong `NEXTAUTH_SECRET`**

   ```bash
   openssl rand -base64 32
   ```

   Copy the output – you will use it in the next step.

3. **Create your local `.env` from the template** (the file is no longer tracked by git)

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and paste in your new `DATABASE_URL` and `NEXTAUTH_SECRET`.

4. **Never commit `.env`** – it is now listed in `.gitignore` and git will refuse to stage it.

---

## 🥇 #1 Deployment Recommendation – Vercel

> **Vercel is the single best option** for deploying this app as a live website accessible from any device including iPhone. It is free, takes ~5 minutes, gives you automatic HTTPS, and lets you store secrets securely so they never touch your repo.

### Why Vercel?

| Factor | Vercel |
|---|---|
| Cost | Free (Hobby tier) |
| Setup time | ~5 minutes |
| HTTPS / SSL | Automatic, no configuration |
| Secrets management | Dashboard env vars – never in source code |
| CI/CD | Auto-deploys on every `git push` |
| iPhone PWA | ✅ Works instantly once you have an HTTPS URL |
| Database | Pair with free [Neon](https://neon.tech) Postgres |

### Step-by-step Vercel deployment

1. **Push this repo to your own GitHub account** (fork or new repo).

2. Sign up at <https://vercel.com> (free, use "Continue with GitHub").

3. Click **"Add New Project"** → import your GitHub repository. Vercel detects Next.js automatically.

4. Before clicking Deploy, open **"Environment Variables"** and add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your new Neon connection string (from rotation step above) |
   | `NEXTAUTH_SECRET` | Output of `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | Leave **blank** – Vercel injects `VERCEL_URL` automatically |
   | `NEXT_PUBLIC_BASE_URL` | Leave **blank** – same reason |

5. Click **Deploy**. Vercel builds and hosts the app.

6. Run the database migration **once** after the first deploy:

   ```bash
   DATABASE_URL="<your-new-connection-string>" npx prisma migrate deploy
   ```

7. Open the `.vercel.app` URL Vercel gives you – in any browser or iPhone Safari.

---

## Other Deployment Options

### Option 2 – Run locally with Docker

Docker runs the full app + a local Postgres database with a single command.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# 1. Clone the repo
git clone https://github.com/Bboy9090/atlas-verify.git
cd atlas-verify

# 2. Create your .env from the docker template
cp .env.docker .env
# Edit .env – set NEXTAUTH_SECRET (openssl rand -base64 32) and adjust NEXTAUTH_URL if needed

# 3. Start app + database
docker compose up --build -d

# 4. Run migrations (first time only)
docker compose exec app npx prisma migrate deploy

# 5. Open http://localhost:3000
```

To stop: `docker compose down`  
To stop and wipe the database: `docker compose down -v`

---

### Option 3 – Run locally without Docker

```bash
npm install -g yarn
yarn install
cp .env.example .env   # then edit .env with your DATABASE_URL and NEXTAUTH_SECRET
npx prisma migrate dev
yarn dev
```

Open <http://localhost:3000>.

---

### Option 4 – Railway / Render (alternative free hosts)

**Railway** (<https://railway.app>): Create a project → add a PostgreSQL service → add your GitHub repo as a service → set the same env vars as Vercel. Auto-deploys on push.

**Render** (<https://render.com>): Create a Web Service → Build Command: `npx prisma generate && yarn build` → Start Command: `yarn start` → add a PostgreSQL database → link `DATABASE_URL`.

---

## 📱 Using it on iPhone

Once the app is live at an **HTTPS** URL (Vercel, Railway, Render, etc.):

1. Open **Safari** on your iPhone and navigate to the URL.
2. Tap the **Share** button (square with upward arrow) at the bottom.
3. Scroll down and tap **"Add to Home Screen"**.
4. Name it *AtlasVerify* and tap **Add**.

The app opens full-screen like a native app with its own home-screen icon. No App Store needed.

> **Note:** Only Safari on iOS supports PWA installation. Chrome and Firefox on iPhone do not.

---

## Core Features

* Case management system
* Subject profiles (name, phone, email, address)
* Enrichment pipeline (carrier lookup, web evidence)
* Timeline of findings
* Confidence scoring
* Audit logging
* Legal compliance safeguards

## Tech Stack

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* PostgreSQL (Neon)
* Prisma ORM
* NextAuth.js

---

## Development Setup

1. Copy `.env.example` to `.env` and fill in your values
2. Install dependencies: `yarn install`
3. Run Prisma migrations: `npx prisma migrate dev`
4. Start development server: `yarn dev`

### Generate app icons

```bash
node scripts/generate-icons.js
```

---

## Legal Notice

Atlas Verify is intended only for lawful investigative, compliance, and verification purposes using publicly available or licensed data sources.

Unauthorized surveillance, harassment, or privacy violations are prohibited.

See `/docs/legal` for Acceptable Use Policy and Opt-Out process.
