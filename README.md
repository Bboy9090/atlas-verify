# Atlas Verify

Atlas Verify is a case-based identity verification and enrichment platform designed for investigators, compliance teams, and analysts. It aggregates lawful public data and licensed enrichment sources into structured case files with audit logging.

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

## 🚀 Deployment Options

Choose whichever option fits best. **Vercel** is the quickest way to get a live website. **Docker** is best for running it on your own computer or server. See [Using it on iPhone](#-using-it-on-iphone) once the site is live.

---

### Option 1 – Deploy to Vercel (recommended – free, ~5 min)

Vercel is the easiest way to get a public URL you can open from any phone or computer.

1. **Fork** this repository on GitHub (or push it to your own account).

2. Sign up for a free account at <https://vercel.com> and click **"Add New Project"**.

3. Import your GitHub repository. Vercel auto-detects Next.js.

4. Set the following **Environment Variables** in the Vercel dashboard before deploying:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your PostgreSQL connection string (see below) |
   | `NEXTAUTH_SECRET` | Random 32-char string – run `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | Leave **blank** – Vercel sets this automatically |
   | `NEXT_PUBLIC_BASE_URL` | Leave **blank** – Vercel sets this automatically |

5. **Database**: You need a free PostgreSQL database. Two easy options:
   * [Neon](https://neon.tech) – free tier, no credit card required. Copy the connection string from your project dashboard.
   * [Supabase](https://supabase.com) – free tier, copy the **Direct connection** string from `Project Settings → Database`.

6. Click **Deploy**. Vercel builds and deploys automatically.

7. After deployment, run the database migration once from your local machine:

   ```bash
   DATABASE_URL="<your-connection-string>" npx prisma migrate deploy
   ```

8. Open the URL Vercel gives you in any browser – including Safari on iPhone.

---

### Option 2 – Run locally with Docker (computer only)

Docker runs the full app + a local Postgres database in containers. No cloud account needed.

#### Prerequisites

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

#### Steps

```bash
# 1. Clone the repo (if you haven't already)
git clone https://github.com/Bboy9090/atlas-verify.git
cd atlas-verify

# 2. Create your local .env file from the template
cp .env.docker .env
```

Edit `.env` and set at minimum:

```
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"   # required
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

```bash
# 3. Start the app + database
docker compose up --build -d

# 4. Run database migrations (first time only)
docker compose exec app npx prisma migrate deploy

# 5. Open http://localhost:3000 in your browser
```

To stop: `docker compose down`
To stop and wipe the database: `docker compose down -v`

---

### Option 3 – Run locally without Docker

```bash
# 1. Install Node.js 20+ and Yarn
npm install -g yarn

# 2. Install dependencies
yarn install

# 3. Copy env file and fill in values
cp .env.example .env
# Edit .env with your DATABASE_URL and NEXTAUTH_SECRET

# 4. Push the schema and seed the database
npx prisma migrate dev

# 5. Start the development server
yarn dev
```

Open <http://localhost:3000>.

---

### Option 4 – Deploy to Railway / Render (alternative free hosts)

Both services offer free tiers with built-in Postgres.

**Railway** (<https://railway.app>):

1. Create a new project and add a **PostgreSQL** service.
2. Add a **GitHub repo** service pointing to this repository.
3. Set the same environment variables listed in the Vercel section above.
4. Copy the `DATABASE_URL` from the Railway Postgres service into the app service.
5. Railway auto-deploys on every push.

**Render** (<https://render.com>):

1. Create a **Web Service** from your GitHub repo.
2. Set **Build Command**: `npx prisma generate && yarn build`
3. Set **Start Command**: `yarn start`
4. Add a **PostgreSQL** database and link its internal URL as `DATABASE_URL`.
5. Add the remaining environment variables.

---

## 📱 Using it on iPhone

Once the app is live at any URL (Vercel, Railway, etc.) you can add it to your iPhone home screen so it opens like a native app – no App Store required.

1. Open **Safari** on your iPhone and navigate to your app's URL.
2. Tap the **Share** button (the square with an arrow pointing up) at the bottom of the screen.
3. Scroll down and tap **"Add to Home Screen"**.
4. Give it a name (e.g. *AtlasVerify*) and tap **Add**.

The app will appear on your home screen with its own icon and will open full-screen without browser chrome, just like a native app.

> **Note:** This only works in Safari on iOS. Chrome and Firefox on iPhone do not support PWA installation.

---

## Development Setup

1. Copy `.env.example` to `.env`
2. Add your DATABASE_URL and secrets
3. Install dependencies: `yarn install`
4. Run Prisma migrations: `npx prisma migrate dev`
5. Start development server: `yarn dev`

### Generate app icons

If you ever modify the brand colours, regenerate the PWA icons:

```bash
node scripts/generate-icons.js
```

---

## Legal Notice

Atlas Verify is intended only for lawful investigative, compliance, and verification purposes using publicly available or licensed data sources.

Unauthorized surveillance, harassment, or privacy violations are prohibited.

See `/docs/legal` for Acceptable Use Policy and Opt-Out process.
