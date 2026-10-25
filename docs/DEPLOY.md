# Deploying to a VPS

The whole product runs on one server with Docker: PostgreSQL, the app, Caddy (automatic HTTPS for
every shop subdomain) and a nightly backup job. No hosting-provider features are used, so any VPS
works (Hetzner, DigitalOcean, OVH, a local provider…).

**Server size:** 2 vCPU / 2 GB RAM / 40 GB disk is plenty for dozens of shops. Ubuntu 24.04 LTS.

## 1. DNS (do this first, it takes time to propagate)

At your domain registrar / DNS provider, point both records at the server's public IP:

| Type | Name | Value |
|---|---|---|
| A | `@` (e.g. `example.com`) | `<server IP>` |
| A | `*` (wildcard, every shop and `admin.`) | `<server IP>` |

That's all: no wildcard certificate and no DNS API keys. Caddy gets a certificate per hostname the
first time it is visited, and only after the app confirms the hostname is a real shop
(`/api/tls-check`).

## 2. Prepare the server

```bash
ssh root@<server IP>
```

```bash
apt update && apt upgrade -y && apt install -y git ufw
```

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 3. Get the code and configure it

```bash
git clone <your repo URL> /opt/pos && cd /opt/pos
```

```bash
cp .env.example .env && nano .env
```

Set these in `.env` (generate secrets with `openssl rand -base64 32`):

| Variable | Value |
|---|---|
| `ROOT_DOMAIN` | `example.com` (no `https://`, no port) |
| `APP_NAME` | your product name |
| `BETTER_AUTH_SECRET` | random secret |
| `APP_SECRET` | random secret (encrypts device passcodes, **never change it after launch** or saved passcodes become unreadable) |
| `POSTGRES_PASSWORD` | long random password |
| `ACME_EMAIL` | your e-mail (Let's Encrypt notices) |
| `CONTACT_WHATSAPP`, `CONTACT_EMAIL` | shown on the landing page (optional) |

`DATABASE_URL` is set by `docker-compose.prod.yml`; leave it as it is.

**Keep a copy of `.env` somewhere safe** (password manager). Without `APP_SECRET` a restored backup
can't decrypt passcodes.

## 4. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The app applies database migrations automatically on every start. Check it's healthy:

```bash
docker compose -f docker-compose.prod.yml ps
```

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

## 5. Create your super admin (and optionally the demo shop)

The seed creates the device catalog, your super admin account, a "Basic" plan and the **demo shop**
(`demo.example.com`, full of realistic data for showing to shops). In production it refuses to run
without a password:

```bash
docker compose -f docker-compose.prod.yml exec -e SEED_PASSWORD='<strong password>' -e SEED_ADMIN_EMAIL='you@example.com' app ./node_modules/.bin/prisma db seed
```

- Super admin: `you@example.com` at `https://admin.example.com`.
- Demo shop staff (`owner@demo.local`, `tech@demo.local`, `tech2@demo.local`, `cashier@demo.local`)
  use the same `SEED_PASSWORD`. Use them to demo the product, or deactivate them in the demo shop's
  settings if you don't want a demo shop.

Then open `https://admin.example.com`, create the real shops and their owners, and send each owner
their URL (`https://<slug>.example.com`).

## Using Supabase (or any hosted Postgres) instead of the bundled database

The app only needs a Postgres URL, so the database can live on Supabase (the development setup does):

1. In `.env` set `DATABASE_URL` to the Supabase **session pooler** URL with the app role, e.g.
   `postgresql://pos_app.<project-ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`
   and `DATABASE_CA_CERT=./certs/supabase-prod-ca-2021.crt` (Supabase's root CA, already in the repo).
2. Remove the `db` and `backup` services from `docker-compose.prod.yml` and the `DATABASE_URL` line under `app`
   (the value from `.env` is used). Supabase takes daily backups on paid plans; on the free plan, keep a
   `pg_dump` cron on the VPS.
3. Migrations run on app start as usual. Every table has Row Level Security enabled, so Supabase's public
   REST API can't read the data.

## 6. Day-to-day operations

**Update to a new version**

```bash
cd /opt/pos && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

**Backups:** the `backup` service writes `backups/pos_<date>.dump` (database, including shop logos) every night at 03:00 server time and keeps 14 days. Copy them
off the server regularly, e.g. from your own computer:

```bash
rsync -av root@<server IP>:/opt/pos/backups/ ./pos-backups/
```

**Take a backup right now**

```bash
docker compose -f docker-compose.prod.yml exec backup sh -c 'pg_dump -Fc -f /backups/pos_manual.dump'
```

**Restore a backup** (stops the app, replaces ALL data with the backup):

```bash
docker compose -f docker-compose.prod.yml stop app
```

```bash
docker compose -f docker-compose.prod.yml exec backup sh -c 'pg_restore --clean --if-exists -d "$PGDATABASE" /backups/pos_<date>.dump'
```

```bash
docker compose -f docker-compose.prod.yml start app
```


**Logs**

```bash
docker compose -f docker-compose.prod.yml logs --tail 200 app
```

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| Browser shows a certificate error for a new shop | DNS wildcard record exists and points to this server; the shop exists in the admin panel (Caddy only issues certificates for real shops). |
| 404 on `https://<slug>.example.com` | Slug typo, or the shop doesn't exist. |
| Login works but you're sent back to login | `ROOT_DOMAIN` in `.env` must exactly match the domain (no `www`, no port). |
| "Shop is read-only" banner | Subscription expired or suspended: record a payment or change the status in the admin panel. |
| App container restarting | `docker compose … logs app`; usually a wrong `POSTGRES_PASSWORD`/`.env` change. |

## Notes

- Everything runs in one app container. The public status page's rate limiter is in memory, so
  don't scale to several app containers without moving it to the database first.
- Moving servers = copy `.env`, the latest backup files, re-point DNS, restore.

## Current setup: Vercel (free Hobby plan) + Supabase + Cloudflare DNS

The live POS (https://demo.inchouf.com, https://pos-admin.inchouf.com) runs on Vercel, project
`inchouf-pos` (team "Hassan Mezher"), functions in Frankfurt (`vercel.json` → `fra1`, next to Supabase).
DNS stays on Cloudflare: `demo` and `pos-admin` are CNAMEs to `cname.vercel-dns.com`, **DNS only** (grey
cloud), so the existing Worker sites on inchouf.com are not involved.

Production environment variables (Vercel → Project → Settings → Environment Variables):
`DATABASE_URL` (Supabase **transaction pooler**, port 6543, `sslmode=require`), `DATABASE_CA_CERT` (the PEM
text of `certs/supabase-prod-ca-2021.crt`), `BETTER_AUTH_SECRET`, `APP_SECRET` (never change it: it decrypts
saved device passcodes), `ROOT_DOMAIN=inchouf.com`, `ADMIN_SUBDOMAIN=pos-admin`.

**Deploy a new version:** push to `main` on GitHub (https://github.com/hassanlmezher/POS-PhoneStore).
Vercel is connected to the repo and builds + deploys every push to `main` automatically (other branches get
preview deployments). Manual fallback from the project folder: `vercel deploy --prod`.

Database migrations are not run by Vercel: apply them first with `pnpm exec prisma migrate deploy`.

**Add a shop on inchouf.com:** just create it in the admin panel. Its address `<slug>.inchouf.com` is set up
automatically (Vercel domain + Cloudflare DNS-only CNAME), and the shop page in the admin shows its status with a
"Set up web address" button to retry. This needs two keys in the Vercel environment variables:
`VERCEL_API_TOKEN` (Vercel → Account Settings → Tokens, scope: the team) and `CLOUDFLARE_API_TOKEN`
(Cloudflare → My Profile → API Tokens → "Edit zone DNS" template, zone inchouf.com). Manual fallback:
`vercel domains add <slug>.inchouf.com inchouf-pos` and a Cloudflare `CNAME <slug> → cname.vercel-dns.com`, DNS only.

**Limits of the free plan:** Vercel Hobby is for non-commercial use. When shops start paying, upgrade to
Vercel Pro or move to a VPS with the Docker setup above.


## Keeping the free Supabase database awake

Supabase pauses free projects after 7 days without activity. The app prevents this on its own:

- **Vercel Cron** (in `vercel.json`) calls `/api/keepalive` every day at 06:00 UTC. It writes one tiny row
  (`Heartbeat` table), which counts as real database activity.
- **GitHub Actions backup** (`.github/workflows/keepalive.yml`) calls the same address every 3 days. GitHub
  turns scheduled workflows off after 60 days without commits in a public repository; re-enable it from the
  repository's Actions tab if that happens (Vercel Cron keeps working either way).
- Check it any time: open `https://pos-admin.inchouf.com/api/keepalive`, which shows the last heartbeat time.

On a paid Supabase plan or your own Postgres (Docker) none of this is needed, and it's harmless.
