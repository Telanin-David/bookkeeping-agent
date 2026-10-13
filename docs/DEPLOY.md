# Putting Bookkeeping AI live on your VPS

This guide takes a fresh VPS to a live app at `https://yourdomain.com`. Do the steps in order. Every grey box is something to copy and paste into the server, one box at a time. After each box, check it finished without an error before moving on.

Plan for **2 to 3 hours**. Most of that is waiting: for your domain to point at the server, and for the app to build.

## How it fits together

```
Phone / laptop ──HTTPS──▶ nginx (ports 80/443, the only door open)
                            ├── /api/...  ──▶ backend  (Node, 127.0.0.1:4000) ──▶ PostgreSQL
                            └── everything else ──▶ web app (Next.js, 127.0.0.1:3000)
```

- Everything runs on one server under one domain. One address means sign-in cookies just work, with no cross-domain problems.
- The backend and web app restart by themselves if they crash or the server reboots (systemd).
- A backup of the database and uploaded logos runs every night.

## What you need before you start

| Item | Where to get it | Needed for |
|---|---|---|
| VPS IP address and root password | Your VPS provider's email or dashboard | Everything |
| Access to your domain's DNS settings | Where you bought the domain | Step 1 |
| **Anthropic API key** | console.anthropic.com → API Keys | The app **won't start** without it |
| Email sending (SMTP) details | Brevo (free, 300 emails a day) or similar | Sign-up confirmation, "forgot password", alert emails. You can launch without it and add it later, but until you do, nobody can reset a forgotten password. |
| Paystack secret key | Paystack dashboard → Settings → API Keys & Webhooks | Online payments. You can launch without it. |

**Never paste keys or passwords into chats, emails or GitHub.** They only go into the settings file on the server (step 7).

The server should run **Ubuntu 24.04** (22.04 also works; step 4 explains the difference) with at least **1 GB of RAM**; 2 GB is more comfortable. If your provider asks which system to install, choose Ubuntu 24.04.

## Want Claude Code to do the typing?

It can do most of it. Claude Code can run **on your VPS itself**: it reads this guide, types the commands, checks each result and explains any error. It asks your permission before every command. It uses your Claude subscription.

**What it can't do for you** (these happen on websites or need your keys):
- Step 1: the DNS records, on your domain company's website.
- Step 6: adding the deploy key on GitHub.
- Getting keys from Anthropic, Brevo and Paystack, and typing them into the settings file (step 7).
- Checking the site on your phone.

**How:**

1. Do **step 1** (DNS) and **step 2** (log in to the server) yourself.
2. Do **step 6** yourself, after installing git with `apt update && apt install -y git`. That puts the code, with this guide inside it, on the server.
3. Install Claude Code and start it in the app's folder:

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   cd /srv/bookkeeping
   claude
   ```

   If it says `claude: command not found`, log out (`exit`), log back in, and run the last two lines again. The first time, it asks you to log in to your Claude account: it shows a link, you open it on your phone or laptop, approve, and paste the code it gives you back into the server.
4. Type this to Claude Code, with your real domain:

   > Follow docs/DEPLOY.md to put this app live on this server. My domain is yourdomain.com. Steps 1, 2 and 6 are done. Stop and ask me whenever a step needs me. Never open or print apps/backend/.env — I'll add the keys myself with nano.

5. Read each command it proposes before you approve it. It runs as root on your live server, so don't switch on "accept everything" for this job.

---

## Step 1: Point your domain at the server

Do this first, because it can take from a few minutes to a few hours to take effect.

In your domain's DNS settings (at the company you bought it from), create two **A records**:

| Type | Name / Host | Value / Points to |
|---|---|---|
| A | `@` | your VPS IP address |
| A | `www` | your VPS IP address |

Delete any existing A or AAAA records for `@` or `www` that point elsewhere (e.g. a "parking page").

To check: open dnschecker.org, type your domain, choose **A**, and look for your server's IP. You can carry on with steps 2 to 9 while you wait. Step 10 needs this working.

## Step 2: Log in to the server

- **Windows:** open **PowerShell**.
- **Mac:** open **Terminal**.

Type this (with your real IP) and press Enter:

```bash
ssh root@YOUR_SERVER_IP
```

The first time, it asks whether to trust the server: type `yes`. Then enter the root password. Nothing appears while you type the password; that's normal.

You're in when the line starts with something like `root@yourserver:~#`.

**Set your domain once per login.** Change `yourdomain.com` to your real domain (no `https://`, no `www`) and run it. Later steps use it. If you log out and back in, run this line again.

```bash
DOMAIN=yourdomain.com
```

## Step 3: Update the server, turn on the firewall, add swap

```bash
apt update && apt upgrade -y
timedatectl set-timezone Africa/Lagos
apt install -y git curl build-essential ufw fail2ban unattended-upgrades nginx certbot python3-certbot-nginx
```

If it asks about restarting services or keeping a config file, press Enter to accept the default.

Turn on the firewall. Only SSH (to log in) and web traffic are allowed in:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

You should see `OpenSSH` and `Nginx Full` listed as `ALLOW`. (`fail2ban`, installed above, blocks anyone who keeps guessing your password.)

**Swap space** gives the server extra memory, which the app build needs on small servers:

```bash
if [ -z "$(swapon --show)" ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h
```

The `Swap:` line should now show about 2.0Gi.

> If your VPS provider has its own firewall in their dashboard, make sure ports **22, 80 and 443** are open there too.

## Step 4: Install Node.js and PostgreSQL

Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
```

It should print `v22.` followed by more numbers.

PostgreSQL (the database). The app is tested on version 16.

- **Ubuntu 24.04:**
  ```bash
  apt install -y postgresql
  ```
- **Ubuntu 22.04:** its own PostgreSQL is older, so get 16 from PostgreSQL's official source:
  ```bash
  apt install -y postgresql-common
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt install -y postgresql-16
  ```

Check it's running:

```bash
systemctl is-active postgresql
```

It should print `active`. (Not sure which Ubuntu you have? `cat /etc/os-release` tells you.)

## Step 5: Create the database

This makes a random password, a database user and an empty database. Keep this login session open until step 7, which uses the password.

```bash
DB_PASSWORD=$(openssl rand -hex 24)
sudo -u postgres psql -c "CREATE ROLE bookkeeping LOGIN PASSWORD '$DB_PASSWORD'"
sudo -u postgres psql -c "CREATE DATABASE bookkeeping OWNER bookkeeping"
```

You should see `CREATE ROLE` and `CREATE DATABASE`.

## Step 6: Get the code onto the server

The app runs as its own user, `bookkeeping`, not as root, so a bug in the app can't take over the server.

```bash
useradd --system --create-home --home-dir /home/bookkeeping --shell /bin/bash bookkeeping
mkdir -p /srv/bookkeeping /srv/bookkeeping-data/uploads
chown -R bookkeeping:bookkeeping /srv/bookkeeping /srv/bookkeeping-data
```

Give the server read-only access to your GitHub repository with a **deploy key**:

```bash
sudo -u bookkeeping ssh-keygen -t ed25519 -N "" -C "vps-deploy" -f /home/bookkeeping/.ssh/id_ed25519
cat /home/bookkeeping/.ssh/id_ed25519.pub
```

1. Copy the whole line it prints (it starts with `ssh-ed25519`).
2. On GitHub, open the repository `Telanin-David/bookkeeping-agent` → **Settings** → **Deploy keys** → **Add deploy key**.
3. Title: `VPS`. Paste the line into **Key**. Leave **Allow write access** unticked. Click **Add key**.

Now download the code. If it asks whether to trust `github.com`, type `yes`.

```bash
sudo -u bookkeeping git clone git@github.com:Telanin-David/bookkeeping-agent.git /srv/bookkeeping
```

## Step 7: The settings file

This writes the backend's settings with strong random secrets filled in.

```bash
JWT_SECRET=$(openssl rand -hex 32)
cat > /srv/bookkeeping/apps/backend/.env <<EOF
DATABASE_URL=postgresql://bookkeeping:${DB_PASSWORD}@localhost:5432/bookkeeping
PORT=4000
NODE_ENV=production
BUSINESS_TIME_ZONE=Africa/Lagos
TRUST_PROXY=1
FRONTEND_URL=https://${DOMAIN}

JWT_ACCESS_SECRET=${JWT_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ANTHROPIC_API_KEY=
CHAT_MODEL=
CHAT_DAILY_LIMIT=20

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=Bookkeeping AI <alerts@${DOMAIN}>

ALERT_WORKER=on
ALERT_WORKER_INTERVAL_MS=600000
ALERT_EMAIL_GAP_MS=3600000

STORAGE_DRIVER=local
UPLOAD_DIR=/srv/bookkeeping-data/uploads

BILLING_ENABLED=true
TRIAL_DAYS=14
TRIAL_MESSAGES=40
PAYSTACK_SECRET_KEY=
PAYSTACK_BASE_URL=https://api.paystack.co
EOF
echo "NEXT_PUBLIC_API_URL=https://${DOMAIN}" > /srv/bookkeeping/apps/frontend/.env.production.local
chown bookkeeping:bookkeeping /srv/bookkeeping/apps/backend/.env /srv/bookkeeping/apps/frontend/.env.production.local
chmod 600 /srv/bookkeeping/apps/backend/.env
```

Now add your keys. Open the file in the `nano` editor:

```bash
nano /srv/bookkeeping/apps/backend/.env
```

- Move with the arrow keys. Put your Anthropic key right after `ANTHROPIC_API_KEY=`, with no spaces and no quotes.
- If you have them, fill in the `SMTP_` lines (Brevo: host `smtp-relay.brevo.com`, port `587`, your Brevo login, and the SMTP key from Brevo's **SMTP & API** page).
- Leave `PAYSTACK_SECRET_KEY=` empty for now (step 12).
- Save: press **Ctrl+O**, then **Enter**. Exit: **Ctrl+X**.

To check your paste worked without printing the key on screen:

```bash
grep -c '^ANTHROPIC_API_KEY=sk-ant-' /srv/bookkeeping/apps/backend/.env
```

It should print `1`.

**About `BILLING_ENABLED=true`:** with this on, every owner gets the 14-day free trial (40 assistant messages) from the day they sign up, then the free plan unless they pay. Until Paystack is set up, the Plan screen tells owners to pay you by bank transfer, and you switch their plan on from your admin page. If you want everything free at launch, change it to `false`. You can switch it on later, and every existing owner then gets their 14-day trial from that day.

> Also set a monthly spending limit in console.anthropic.com → **Limits**, so a surprise can never run up a big AI bill.

## Step 8: Build the app, set up the database, start it

Install and build. This takes 5 to 15 minutes; let it finish.

```bash
cd /srv/bookkeeping
sudo -u bookkeeping -H npm ci
sudo -u bookkeeping -H npm run build
```

Set up the database tables:

```bash
sudo -u bookkeeping -H deploy/migrate.sh
```

It lists `Applying 001_initial.sql` up to `013_billing.sql`, then `Database is up to date.`

Start the backend and web app, and set them to start by themselves after a reboot:

```bash
cp deploy/bookkeeping-api.service deploy/bookkeeping-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now bookkeeping-api bookkeeping-web
sleep 5
curl -s http://127.0.0.1:4000/api/v1/health; echo
curl -s -o /dev/null -w "web app: %{http_code}\n" http://127.0.0.1:3000/login
```

You should see `{"status":"ok",...}` and `web app: 200`. If not, go to **When something goes wrong** below.

## Step 9: Connect your domain (nginx)

```bash
sed "s/DOMAIN_NAME/${DOMAIN}/g" /srv/bookkeeping/deploy/nginx-site.conf > /etc/nginx/sites-available/bookkeeping
ln -sf /etc/nginx/sites-available/bookkeeping /etc/nginx/sites-enabled/bookkeeping
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

`nginx -t` should say `syntax is ok` and `test is successful`.

## Step 10: HTTPS (the padlock)

Step 1 has to be working first: dnschecker.org must show your server's IP for both `yourdomain.com` and `www.yourdomain.com`. Put your own email address in the command; Let's Encrypt only uses it to warn you about certificate problems.

```bash
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect --agree-tos -m you@youremail.com -n
```

It ends with `Successfully deployed certificate`. Certificates renew by themselves. To confirm renewal will work:

```bash
certbot renew --dry-run
```

Now open **https://yourdomain.com** on your phone. You should see the login page with a padlock.

> Sign-in needs HTTPS, so don't test logging in before this step.

## Step 11: Your account and the admin page

1. On the site, **sign up** with your own email address and set up your shop.
2. Make yourself the admin (use the email you signed up with):

   ```bash
   cd /srv/bookkeeping/apps/backend
   sudo -u bookkeeping -H npm run make-admin -- you@youremail.com
   ```

3. Sign out and back in. The menu now has **Admin**: users, AI costs, and **Money in** (payments, the passes switch, "Record payment").

Admins always have every feature and no message limit.

## Step 12: Paystack (when you're ready to take payments online)

Start with **test mode**, so no real money moves:

1. Paystack dashboard → **Settings → API Keys & Webhooks**, with the dashboard in **Test Mode**.
2. Set **Test Webhook URL** to `https://yourdomain.com/api/v1/billing/paystack/webhook`.
3. Copy the **Test Secret Key** (starts `sk_test_`). Put it after `PAYSTACK_SECRET_KEY=` in the settings file:

   ```bash
   nano /srv/bookkeeping/apps/backend/.env
   systemctl restart bookkeeping-api
   ```

4. Sign up on the site as a test owner (another email address), open **Plan**, tap **Pay ₦5,000**, and pay with one of Paystack's test cards (Paystack's docs list them under "Test Payments"). You should come back to "Payment received", and the payment should show on your admin page.

Going live: switch the Paystack dashboard to **Live Mode**, set the **Live Webhook URL** to the same address, put the **Live Secret Key** (`sk_live_…`) in the settings file, and restart the backend as above.

## Step 13: Nightly backups

```bash
echo "30 2 * * * bookkeeping /srv/bookkeeping/deploy/backup.sh >> /srv/bookkeeping-data/backup.log 2>&1" > /etc/cron.d/bookkeeping-backup
sudo -u bookkeeping /srv/bookkeeping/deploy/backup.sh
ls -lh /srv/bookkeeping-data/backups
```

This runs every night at 2:30am and keeps 14 days of backups. The last command should list a `db-…dump` file and an `uploads-…tar.gz` file.

**A backup on the same server dies with the server.** About once a week, copy the newest one to your laptop. On your laptop (not the server), run:

```bash
scp root@YOUR_SERVER_IP:/srv/bookkeeping-data/backups/db-*.dump .
```

If your VPS provider offers automatic snapshots or backups, turn them on too.

## Step 14: Launch checks

On your phone, at `https://yourdomain.com`:

- [ ] Sign up, set up a shop, and land on the dashboard.
- [ ] Record a sale with the form. It shows on Transactions and the dashboard.
- [ ] Send the assistant a message ("I sold 2 crates of Coke for 7,000"). It answers and the sale is saved.
- [ ] Open a receipt and tap **Share PDF**.
- [ ] Download a Profit & Loss report.
- [ ] Upload a shop logo (Shops → Branding); it shows on a receipt.
- [ ] If SMTP is set: the confirmation email arrives (check spam), and **Forgot password** sends a link.
- [ ] Reboot the server (`reboot`), wait a minute, and check the site comes back by itself.

---

## Putting updates live later

When new code is merged on GitHub, log in to the server and run:

```bash
/srv/bookkeeping/deploy/update.sh
```

It pulls the new code, installs, builds, applies any new database changes and restarts. It ends with `Updated and running.` The site can show errors for a minute or two while it rebuilds, so run it at a quiet time.

## When something goes wrong

**See what the app is saying** (the last 100 lines of its log):

```bash
journalctl -u bookkeeping-api -n 100 --no-pager
journalctl -u bookkeeping-web -n 100 --no-pager
```

**Is everything running?**

```bash
systemctl status bookkeeping-api bookkeeping-web nginx postgresql --no-pager
```

| What you see | What it usually means | Fix |
|---|---|---|
| `502 Bad Gateway` | The backend or web app isn't running | Read its log (above); fix the cause; `systemctl restart bookkeeping-api bookkeeping-web` |
| Log says `Missing required environment variable: ANTHROPIC_API_KEY` | The key isn't in the settings file | Step 7, then `systemctl restart bookkeeping-api` |
| Log says `JWT_ACCESS_SECRET` is too short or a placeholder | The settings file was edited by hand | Make a new one with `openssl rand -hex 32` and put it in `.env` |
| Log mentions `password authentication failed` | The database password in `.env` doesn't match | Check `DATABASE_URL` in `.env` against step 5 |
| Build stops with `Killed` or `JavaScript heap out of memory` | Not enough memory | Check swap (step 3), then run the build again |
| certbot says it couldn't verify the domain | The domain doesn't point at this server yet, or port 80 is blocked | Wait for DNS (step 1); check the provider's firewall allows 80 and 443 |
| You're signed out every time the page reloads | You're on `http://` instead of `https://`, or `FRONTEND_URL` doesn't match the address | Use `https://yourdomain.com`; check `FRONTEND_URL` in `.env`, then restart the backend |
| Logo or spreadsheet upload fails | The upload folder isn't writable | `chown -R bookkeeping:bookkeeping /srv/bookkeeping-data` |

After **any** change to `apps/backend/.env`, restart the backend: `systemctl restart bookkeeping-api`.
After changing `apps/frontend/.env.production.local`, rebuild: run `/srv/bookkeeping/deploy/update.sh`.

## Where everything lives

| What | Where |
|---|---|
| The code | `/srv/bookkeeping` |
| Backend settings and secrets | `/srv/bookkeeping/apps/backend/.env` |
| Uploaded logos and signatures | `/srv/bookkeeping-data/uploads` |
| Backups | `/srv/bookkeeping-data/backups` |
| Services | `bookkeeping-api` (backend), `bookkeeping-web` (web app) |
| nginx site | `/etc/nginx/sites-available/bookkeeping` |
