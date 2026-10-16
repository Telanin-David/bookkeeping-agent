# Putting sabeebook live on your VPS

A step-by-step guide in simple English. It takes a brand-new VPS to a live app at `https://yourdomain.com`.

- Do the steps **in order**, one grey box at a time.
- Each box says **what to do**, and **Why** says what it is for.
- Plan for **2 to 3 hours**. Much of it is waiting for things to download or build.

---

## Before you start

### Words used in this guide

| Word | What it means |
|---|---|
| **Your laptop** | The computer in front of you. You type on it. |
| **The server** (or VPS) | The computer you rented. It runs sabeebook day and night. You control it from your laptop by typing commands. |
| **Terminal** | The black window where you type commands. On Windows it's called **PowerShell**; on a Mac, **Terminal**. |
| **Command** | A line of text you paste into the terminal and run by pressing **Enter**. |
| **Domain** | Your web address, e.g. `sabeebook.com`. |

### How to run a command (read this once)

1. **Copy** the whole grey box from this guide.
2. **Paste** it into the terminal:
   - **Windows:** click inside the window, then **right-click** (or press **Ctrl+V**). If Windows asks *"You are about to paste text that contains multiple lines"*, click **Paste anyway**.
   - **Mac:** press **Cmd+V**.
3. Press **Enter** if the last line hasn't run by itself.
4. **Wait** until the line that starts with something like `root@...:~#` comes back. That line means "ready for the next command".
5. **Read the last few lines.** If you see `error`, `failed` or `denied`, **stop**. Send me those lines here, and I'll tell you what to do.

### Three rules

- **One box at a time.** Don't paste the next box until the last one is finished.
- **Never paste a password or key into a chat**, an email or GitHub, and that includes this chat with me. Keys only go into the settings file on the server (step 7).
- **When you see `yourdomain.com` in a command, leave it as it is.** The commands fill in your real domain by themselves, after you set it in step 2. The only exceptions are step 2 itself and your own email address in steps 10 and 11.

### What you need

| Item | Where you get it | Needed for |
|---|---|---|
| Your **Hostinger** login (where you bought the VPS) | hostinger.com | Step 0 |
| A login to the website where you **bought the domain** | That company | Step 1 |
| A login to **GitHub** (the account that owns `Telanin-David/bookkeeping-agent`) | github.com | Step 6 |
| An **Anthropic API key** | console.anthropic.com | Step 7. **The app will not start without it.** |
| *(Can wait)* Brevo email login | brevo.com, free | "Forgot password" and alert emails |
| *(Can wait)* Paystack login | dashboard.paystack.com | Online payments |

---

## Step 0: Set up your new VPS on Hostinger (first time only)

**Why:** a VPS you've just bought is like a new, empty computer in a data centre. Before anything else, you choose what system it runs (Ubuntu, a free system made for servers), and set its administrator password. Hostinger then switches it on and gives you its **IP address**: the number your laptop and your domain will use to reach it.

> Hostinger changes its screens from time to time, so a button may have a slightly different name. Look for the closest match. If you're stuck on a screen, send me a screenshot (with any passwords hidden).

1. Go to **hostinger.com** and click **Log in**. You land in Hostinger's control panel, called **hPanel**.
2. In the menu (top or left), click **VPS**. You'll see your new server, probably with a **Setup** button. Click **Setup**.
3. **Location** (if it asks): choose a European location such as **France**, **United Kingdom**, **Netherlands** or **Germany**. **Why:** Europe is the closest Hostinger has to Nigeria, so the app feels fastest for your customers.
4. **Type of setup / OS:** choose **Plain OS** (sometimes called **Operating system** or **Clean OS**), then **Ubuntu 24.04**. Ubuntu 22.04 also works if 24.04 isn't offered.
   - **Do NOT pick** an option "with a control panel" (CloudPanel, cPanel, Plesk, CyberPanel…) or an "application" (Docker, Coolify, WordPress…). **Why:** those install their own website software, which clashes with how this guide sets up sabeebook.
5. **Malware scanner** (if offered): you can leave it **on**. It doesn't get in the way.
6. **Root password:** type a **strong password** (at least 12 characters, mixing letters, numbers and symbols) and **write it down somewhere safe**, like a password manager or a paper notebook at home. **Why:** `root` is the server's administrator account; this password is the key to the whole server.
   - If it offers **SSH key**, skip it for now. The password is enough tonight.
7. Click **Next** / **Finish setup** / **Confirm**. Hostinger takes a few minutes to prepare the server. Wait until the status says **Running** (or shows a green dot).
8. Open the server's **Overview** page (click its name in the VPS list). Find and **write down**:
   - the **IP address**: four numbers with dots, like `102.89.34.11` (often under **VPS information** or **SSH access**);
   - the **SSH username**, which is usually `root`.

   **Why:** you need these two things to log in to the server (step 2) and to point your domain at it (step 1).
9. Look for **Firewall** (under the server's **Security** settings in hPanel). If Hostinger's firewall is switched on, make sure it allows ports **22**, **80** and **443**: add a rule to **Accept** each one, or switch the firewall off and rely on the one this guide sets up in step 3. **Why:** port 22 is how you log in; 80 and 443 are how website visitors arrive. If they're blocked here, nothing else in this guide can reach the internet.

> **Already chose the wrong system?** No harm done: the server is empty. In hPanel, open the server, find **OS & Panel → Operating System** (or **Change OS**), choose **Ubuntu 24.04** (plain, no panel), and confirm. This wipes the server and starts it fresh, which is fine for a new server.

---

## Step 1: Point your domain at the server (do this straight after step 0)

**Why:** right now your domain doesn't know where your server is. This step tells the internet: "when someone types sabeebook.com, send them to this server's IP address". It can take from a few minutes to a few hours to spread across the internet, so start it first and carry on with the other steps while it does.

On the website where you bought the domain:

1. **Log in**, then open your list of domains and click your domain.
2. Look for a button called **DNS**, **Manage DNS**, **DNS Zone** or **DNS Records**, and click it.
3. Click **Add record** (or **Add**). Fill in:
   - **Type:** `A`
   - **Name / Host:** `@` (the `@` means "the domain itself")
   - **Value / Points to / IP address:** your server's IP address
   - **TTL:** leave it as it is
   - Click **Save**.
4. Click **Add record** again and add a second one, the same way, but with **Name / Host:** `www`. This is so `www.yourdomain.com` works too.
5. If the list already has other **A** or **AAAA** records with name `@` or `www` (often a "parking page" the seller adds), **delete** them. **Why:** if two addresses are listed, some visitors land on the wrong one.

> **If you bought the domain on Hostinger too:** in hPanel, click **Domains**, click your domain, then **DNS / Nameservers** (or **Manage DNS records**).
> - Hostinger usually already has an **A** record for `@` pointing to a Hostinger parking page. **Edit** it: click **Edit**, change **Points to** to your VPS's IP address, and click **Update**. Don't add a second one.
> - If there's a **CNAME** record for `www` that points to your domain, **leave it**: `www` then follows `@` automatically, so you don't need the `www` A record from point 4.
> - If the page says your domain uses **other nameservers** (not Hostinger's), the DNS records live at that other company instead.

**To check it's working:** go to **dnschecker.org**, type your domain, choose **A** and press **Search**. Green ticks showing your server's IP mean it's done. You don't have to wait for this: carry on with steps 2–9, and come back to check before step 10.

---

## Step 2: Open the terminal and log in to the server

**Open the terminal on your laptop:**
- **Windows:** press the **Windows key**, type `PowerShell`, and press **Enter**.
- **Mac:** press **Cmd+Space**, type `Terminal`, and press **Enter**.

> **Easier option on Hostinger:** in hPanel, open your server and click **Browser terminal** (or **Terminal**). A terminal opens in your web browser, already logged in to the server, so you can skip the `ssh` part below and go straight to "Tell the server your domain". Pasting works with **Ctrl+Shift+V** (Windows) or **Cmd+V** (Mac), or with right-click → **Paste**. If pasting gives you trouble there, use PowerShell or Terminal instead.

Type this, with **your server's IP** instead of the example numbers, and press **Enter**:

```bash
ssh root@102.89.34.11
```

**Why:** `ssh` opens a secure connection from your laptop to the server, and `root` is the server's main administrator account.

- The first time, it asks *"Are you sure you want to continue connecting?"*. Type `yes` and press **Enter**. **Why:** your laptop is meeting this server for the first time and asks you to confirm it's the right one.
- It then asks for the **password**. Type or paste the root password and press **Enter**. **Nothing appears while you type it, not even dots. That's normal**, not a broken keyboard.

You're in when the line starts with something like `root@yourserver:~#`.

> If your VPS company gave you a username other than `root` (for example `ubuntu`), log in with that name instead, then type `sudo -i` and press **Enter**. **Why:** that switches you to the administrator account the guide expects.

**Tell the server your domain.** Change `yourdomain.com` to your real domain (no `https://`, no `www`), then run it:

```bash
DOMAIN=yourdomain.com
echo "Your domain is: $DOMAIN"
```

**Why:** later commands use your domain in several places. Setting it once here saves you typing it each time, and avoids typos. The second line repeats it back so you can check the spelling.

> **Important:** if you close the terminal or the connection drops, log in again and **run this box again** before carrying on. The server forgets it when you log out.

---

## Step 3: Update the server, switch on the firewall, add extra memory

```bash
apt update && apt upgrade -y
timedatectl set-timezone Africa/Lagos
apt install -y git curl build-essential ufw fail2ban unattended-upgrades nginx certbot python3-certbot-nginx
```

**Why:**
- The first line installs the latest security fixes.
- The second sets the server's clock to Lagos time.
- The third installs the tools the app needs:
  - **git** downloads your code;
  - **nginx** is the "front door" that visitors come through;
  - **certbot** gets you the padlock (HTTPS);
  - **ufw** is the firewall;
  - **fail2ban** blocks people who keep guessing your password.

This takes a few minutes. If a pink or purple screen pops up asking about restarting services or keeping a file, just press **Enter** (that accepts the default).

Now the **firewall**:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

**Why:** a firewall closes every door on the server except the ones you need. `OpenSSH` is the door you are using right now (keep it open, or you'll lock yourself out). `Nginx Full` is the door for website visitors (ports 80 and 443). The last line shows the result: you should see **OpenSSH** and **Nginx Full** with **ALLOW**.

Now **extra memory** (called swap):

```bash
if [ -z "$(swapon --show)" ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h
```

**Why:** building the app needs more memory than a small server has. This lends it 2 GB of disk space to use as extra memory. It only does this if the server doesn't already have some. In what it prints, the **Swap:** line should show about **2.0Gi**.

> If your VPS company's website has its own **firewall** settings, open ports **22, 80 and 443** there too. Otherwise visitors can't reach the server, even with everything here done right.

---

## Step 4: Install Node.js and the database

**Node.js** is what runs the app:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
```

**Why:** sabeebook is written in JavaScript, and Node.js (version 22) is what runs JavaScript on a server. The last line should print `v22.` and some numbers.

**PostgreSQL** is the database, where every shop's sales, debts and stock are stored. First check which Ubuntu you have:

```bash
grep VERSION= /etc/os-release
```

- If it says **24.04**, run:
  ```bash
  apt install -y postgresql
  ```
- If it says **22.04**, run this instead, because 22.04's own version is too old:
  ```bash
  apt install -y postgresql-common
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt install -y postgresql-16
  ```

Check the database is running:

```bash
systemctl is-active postgresql
```

It should print `active`.

---

## Step 5: Create the database

```bash
DB_PASSWORD=$(openssl rand -hex 24)
echo "$DB_PASSWORD" > /root/sabeebook-db-password && chmod 600 /root/sabeebook-db-password
sudo -u postgres psql -c "CREATE ROLE bookkeeping LOGIN PASSWORD '$DB_PASSWORD'"
sudo -u postgres psql -c "CREATE DATABASE bookkeeping OWNER bookkeeping"
```

**Why:**
- The first line makes a **long random password** for the database. It's far stronger than anything you'd make up, and you never need to type it.
- The second saves it in a file only the administrator can read. Step 7 reads it from there.
- The last two create the database's user (`bookkeeping`) and an empty database for the app.

You should see `CREATE ROLE` and `CREATE DATABASE`.

---

## Step 6: Get the code onto the server

**First, give the app its own user:**

```bash
useradd --system --create-home --home-dir /home/bookkeeping --shell /bin/bash bookkeeping
mkdir -p /srv/bookkeeping /srv/bookkeeping-data/uploads
chown -R bookkeeping:bookkeeping /srv/bookkeeping /srv/bookkeeping-data
```

**Why:** the app runs as its own user, `bookkeeping`, not as the administrator. If someone ever found a flaw in the app, they would only get that small account, not the whole server. The folders are where the code goes (`/srv/bookkeeping`) and where uploaded shop logos and backups go (`/srv/bookkeeping-data`).

**Then make a "deploy key"**, a key that lets the server download (but never change) your code from GitHub:

```bash
sudo -u bookkeeping mkdir -p -m 700 /home/bookkeeping/.ssh
sudo -u bookkeeping ssh-keygen -t ed25519 -N "" -C "sabeebook-vps" -f /home/bookkeeping/.ssh/id_ed25519
cat /home/bookkeeping/.ssh/id_ed25519.pub
```

**Why:** your code on GitHub is private. The key is like a house key made just for this server. The last line shows the **public half** of the key, which is safe to give to GitHub. The secret half stays on the server.

**Copy the line it prints.** It starts with `ssh-ed25519` and ends with `sabeebook-vps`.
- **Windows:** select the line with your mouse, then right-click (or press **Ctrl+Shift+C**).
- **Mac:** select it, then press **Cmd+C**.

**Add the key on GitHub** (in your web browser):

1. Go to **github.com/Telanin-David/bookkeeping-agent**.
2. Click **Settings**. It's the last tab at the top of the repository page, with a gear icon.
3. In the menu on the left, under **Security**, click **Deploy keys**.
4. Click the green **Add deploy key** button.
5. **Title:** type `VPS`. **Key:** paste the line you copied.
6. Leave **Allow write access** **unticked**. **Why:** the server only needs to read your code, never change it.
7. Click **Add key**. GitHub may ask for your password or a 2-factor code; that's GitHub making sure it's really you.

**Back in the terminal, download the code:**

```bash
sudo -u bookkeeping git clone git@github.com:Telanin-David/bookkeeping-agent.git /srv/bookkeeping
```

When it asks *"Are you sure you want to continue connecting?"*, type `yes` and press **Enter**. **Why:** the server is meeting GitHub for the first time.

It finishes with lines like `Receiving objects: 100%`. If it says **Permission denied (publickey)**, the deploy key wasn't added properly. Go back over the GitHub part above.

---

## Step 7: The settings file

First check your domain is still set. If this prints nothing after the colon, run the box at the end of step 2 again.

```bash
echo "Your domain is: $DOMAIN"
```

Now write the settings file:

```bash
DB_PASSWORD=$(cat /root/sabeebook-db-password)
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
EMAIL_FROM=sabeebook <alerts@${DOMAIN}>

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

**Why:** the app reads all its settings from this file. It holds:
- where the database is, and its password;
- your web address;
- a long random **secret** (`JWT_SECRET`) that the app uses to sign people in safely;
- your keys, which you add next.

The last line makes the file readable only by the app and the administrator.

**Get your Anthropic API key** (in your web browser):

1. Go to **console.anthropic.com** and log in.
2. Click **API Keys** (in the menu), then **Create Key**.
3. Name it `sabeebook VPS` and click **Create**.
4. Click **Copy**. **The key is shown only once**, so if you lose it, delete it and make a new one.

While you're there, set a **monthly spending limit** on the **Limits** page (or **Billing**, then **Limits**). **Why:** a surprise can then never run up a big AI bill.

**Put the key into the settings file.** Open the file in the `nano` editor:

```bash
nano /srv/bookkeeping/apps/backend/.env
```

1. Use the **arrow keys** to move to the line `ANTHROPIC_API_KEY=`, then press **End** to go to the end of the line.
2. Paste the key straight after the `=`, with no spaces and no quotes:
   - **Windows:** right-click.
   - **Mac:** **Cmd+V**.
3. **Save:** press **Ctrl+O** (the letter O), then **Enter**. **Why:** nano calls saving "Write Out".
4. **Exit:** press **Ctrl+X**.

**Check it went in**, without showing the key on screen:

```bash
grep -c '^ANTHROPIC_API_KEY=sk-ant-' /srv/bookkeeping/apps/backend/.env
```

It must print `1`. If it prints `0`, open the file again and check that line.

**About `BILLING_ENABLED=true`:**
- **What it does:** every owner gets the **14-day free trial (40 assistant messages)** from the day they sign up. After that they're on the free plan unless they pay.
- **Before Paystack is set up:** the Plan screen tells owners to pay you by bank transfer, and you switch their plan on from your Admin page.
- **To launch with everything free:** change `true` to `false` in this file, using the same nano steps.

---

## Step 8: Build the app, set up the database, start it

**Install and build.** This takes **5 to 15 minutes**. Let it run: it can look stuck, but it isn't.

```bash
cd /srv/bookkeeping
sudo -u bookkeeping -H npm ci
sudo -u bookkeeping -H npm run build
```

**Why:**
- `npm ci` downloads all the building blocks the app is made from.
- `npm run build` turns the code into the fast version that runs for visitors.
- `sudo -u bookkeeping` runs both as the app's own user, not as the administrator.

If the build ends with **Killed** or **out of memory**, check the swap from step 3 is on, then run the box again.

**Create the database tables:**

```bash
sudo -u bookkeeping -H deploy/migrate.sh
```

**Why:** this creates the tables for sales, debts, stock, plans and everything else, in the empty database from step 5. It lists `Applying 001_initial.sql` up to `013_billing.sql`, then `Database is up to date.`

**Start the app**, and make it start by itself whenever the server restarts:

```bash
cp deploy/bookkeeping-api.service deploy/bookkeeping-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now bookkeeping-api bookkeeping-web
sleep 5
curl -s http://127.0.0.1:4000/api/v1/health; echo
curl -s -o /dev/null -w "web app: %{http_code}\n" http://127.0.0.1:3000/login
```

**Why:** the app has two parts: the **backend** (the brain, which talks to the database and the AI) and the **web app** (the screens people see). These lines register both with the server's service manager (systemd). It restarts them if they ever crash, and starts them after a reboot. The last two lines check both are alive.

You should see `{"status":"ok",...}` and `web app: 200`. If you don't, see **When something goes wrong** at the end.

---

## Step 9: Connect your domain to the app (nginx)

```bash
echo "Your domain is: $DOMAIN"
sed "s/DOMAIN_NAME/${DOMAIN}/g" /srv/bookkeeping/deploy/nginx-site.conf > /etc/nginx/sites-available/bookkeeping
ln -sf /etc/nginx/sites-available/bookkeeping /etc/nginx/sites-enabled/bookkeeping
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

**Why:** nginx is the front door. When a visitor arrives at your domain, nginx sends them to the right part of the app: anything starting with `/api` goes to the backend, everything else to the web app. These lines write nginx's instructions with your domain filled in, remove nginx's default "Welcome" page, then check the instructions and switch them on.

`nginx -t` must say **syntax is ok** and **test is successful**.

---

## Step 10: The padlock (HTTPS)

**First check step 1 has worked.** These two lines print the server's IP, then the IP your domain points to:

```bash
curl -4 -s ifconfig.me; echo
getent ahostsv4 $DOMAIN | head -1
```

**Why:** the padlock can only be issued if your domain already points at this server. **The two IP addresses must be the same.** If the second line is empty or shows a different IP, wait 15–30 minutes and try again (the domain change from step 1 is still spreading).

**When they match**, get the padlock. Put **your own email address** in place of `you@youremail.com`:

```bash
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect --agree-tos -m you@youremail.com -n
```

**Why:** certbot gets a free security certificate from Let's Encrypt. This is what turns `http://` into `https://` with a padlock, so passwords and shop data are encrypted on the way. `--redirect` sends anyone who types `http://` to the safe `https://` version. Your email is only used to warn you if the certificate ever has a problem.

It ends with **Successfully deployed certificate**. The certificate renews by itself every few months. To check renewal will work:

```bash
certbot renew --dry-run
```

🎉 **Now open `https://yourdomain.com` on your phone.** You should see the sabeebook sign-in page with a padlock in the address bar.

---

## Step 11: Your own account, and the Admin page

1. On the site, tap **Sign up**, create your account with your own email address, and set up your shop.
2. Make yourself the **admin**. Put the email you just signed up with in place of `you@youremail.com`:

   ```bash
   cd /srv/bookkeeping/apps/backend
   sudo -u bookkeeping -H npm run make-admin -- you@youremail.com
   ```

   **Why:** the admin can see the business dashboard: how many owners you have, AI costs, payments, the switch for the weekly and day passes, and **Record payment** for bank transfers. Only you should have this.

3. On the site, **sign out and sign in again**. The menu now shows **Admin**.

As admin you always have every feature, with no message limit.

---

## Step 12: Paystack (can wait until after launch)

**Why:** this lets owners pay online by card, bank transfer or USSD, and their plan switches on by itself. Until you do it, owners can pay you by transfer and you click **Record payment** on the Admin page.

**Start in test mode** (no real money moves):

1. Log in at **dashboard.paystack.com**. Make sure the switch at the top says **Test Mode**.
2. Click **Settings** (bottom of the menu on the left), then the **API Keys & Webhooks** tab.
3. In **Test Webhook URL**, type `https://yourdomain.com/api/v1/billing/paystack/webhook`, with your real domain this time. Click **Save changes**. **Why:** the webhook is how Paystack tells the app "this person has paid", even if they close their phone before coming back to the app.
4. Copy the **Test Secret Key** (it starts with `sk_test_`).
5. Put it in the settings file after `PAYSTACK_SECRET_KEY=` (same nano steps as step 7), then restart the backend so it reads the new key:

   ```bash
   nano /srv/bookkeeping/apps/backend/.env
   systemctl restart bookkeeping-api
   ```

6. **Test it:**
   - Sign up on the site with a **different** email (a test owner).
   - Open **Plan**, tap **Pay ₦5,000 for Monthly**, and pay with one of Paystack's test cards. Paystack's documentation lists them under "Test Payments".
   - You should come back to **Payment received**, and the payment should show on your Admin page.

**Going live:** switch Paystack to **Live Mode**. Paystack may first ask you to finish **Activate business / Compliance**. Then repeat steps 2–5 with the **Live Webhook URL** and the **Live Secret Key** (`sk_live_…`).

---

## Step 13: Nightly backups

```bash
echo "30 2 * * * bookkeeping /srv/bookkeeping/deploy/backup.sh >> /srv/bookkeeping-data/backup.log 2>&1" > /etc/cron.d/bookkeeping-backup
sudo -u bookkeeping /srv/bookkeeping/deploy/backup.sh
ls -lh /srv/bookkeeping-data/backups
```

**Why:** every night at 2:30am, the server saves a copy of the whole database and all uploaded logos, and keeps the last 14 days. If something ever goes wrong, nobody loses their records. The second line runs a backup straight away so you can see it works. The last line should list a `db-…dump` file and an `uploads-…tar.gz` file.

**Keep a copy off the server too.** A backup on the same server is lost if the server is. About **once a week**, copy the newest one to your laptop. Open a **new** terminal window on your laptop (not logged in to the server) and run this, with your server's IP:

```bash
scp root@102.89.34.11:/srv/bookkeeping-data/backups/db-*.dump .
```

If your VPS company offers automatic **snapshots** or **backups** in its dashboard, switch those on as well.

---

## Step 14: Launch checks (on your phone)

Open `https://yourdomain.com` and tick these off:

- [ ] Sign up, set up a shop, and land on the dashboard.
- [ ] Record a sale with the form. It shows on Transactions (in green) and on the dashboard.
- [ ] Send the assistant: *"I sold 2 crates of Coke for 7000"*. It replies (the bee is beside its reply) and the sale is saved.
- [ ] Open a receipt and tap **Share PDF**.
- [ ] Download a **Profit & Loss** report.
- [ ] Upload your shop logo (**Shops → Branding**). It shows on a receipt.
- [ ] Restart the server, wait one minute, and check the site comes back by itself:
  ```bash
  reboot
  ```
  **Why:** this proves sabeebook starts on its own after a power cut or a restart by your VPS company. You'll be logged out of the server; that's expected.

**You're live.** 🐝

---

## Later: email (Brevo), so "Forgot password" works

**Why:** without email, nobody can reset a forgotten password, and alerts are only shown inside the app.

1. Sign up at **brevo.com** (the free plan is 300 emails a day).
2. Go to **Senders, Domains & Dedicated IPs → Domains → Add a domain**, and type your domain. Brevo shows a few records (TXT and CNAME). Add each one in your domain's **DNS** page, the same way as step 1, then click **Verify** in Brevo. **Why:** this proves to Gmail and others that the emails really come from you, so they don't land in spam.
3. Go to **SMTP & API → SMTP**, click **Generate a new SMTP key**, and copy it. The page also shows your **SMTP login**.
4. Open the settings file and fill in:
   - `SMTP_HOST=smtp-relay.brevo.com`
   - `SMTP_USER=` your SMTP login
   - `SMTP_PASS=` the key
5. Save, then restart the backend:

   ```bash
   nano /srv/bookkeeping/apps/backend/.env
   systemctl restart bookkeeping-api
   ```

---

## Want Claude Code to do the typing?

Claude Code can run **on your server** and type the commands of this guide for you. It asks your permission before every command, and explains any errors. It uses your Claude subscription.

You still do these yourself, because they happen on websites or involve your keys:
- step 1 (DNS);
- step 6's GitHub part;
- typing your keys into the settings file;
- checking the site on your phone.

1. Do **steps 1, 2 and 6** yourself. For step 6, first install git with `apt update && apt install -y git`.
2. Install Claude Code and start it:

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   cd /srv/bookkeeping
   claude
   ```

   If it says `claude: command not found`, type `exit`, log in again (step 2), and run the last two lines again. The first time, it shows a link: open it on your phone, approve, and paste the code it gives you back into the terminal.
3. Type this to Claude Code (with your real domain):

   > Follow docs/DEPLOY.md to put this app live on this server. My domain is yourdomain.com. Steps 1, 2 and 6 are done. Stop and ask me whenever a step needs me. Never open or print apps/backend/.env — I'll add the keys myself with nano.

4. **Read each command before you approve it.** It is working on your live server as the administrator, so don't switch on "accept everything".

---

## Putting updates live later

When new code is merged on GitHub, log in to the server (step 2) and run:

```bash
/srv/bookkeeping/deploy/update.sh
```

**Why:** it downloads the new code, builds it, updates the database if needed, and restarts the app. It ends with **Updated and running.** The site can show errors for a minute or two while it rebuilds, so do it at a quiet time, like late at night.

---

## When something goes wrong

**See what the app is saying** (the last 100 lines of its log):

```bash
journalctl -u bookkeeping-api -n 100 --no-pager
journalctl -u bookkeeping-web -n 100 --no-pager
```

**Check everything is running:**

```bash
systemctl status bookkeeping-api bookkeeping-web nginx postgresql --no-pager
```

Each one should say **active (running)**.

| What you see | What it usually means | What to do |
|---|---|---|
| **502 Bad Gateway** in the browser | The app isn't running | Read the log (above); fix what it says; then `systemctl restart bookkeeping-api bookkeeping-web` |
| Log says `Missing required environment variable: ANTHROPIC_API_KEY` | The key isn't in the settings file | Step 7 (the nano part), then `systemctl restart bookkeeping-api` |
| Log mentions `JWT_ACCESS_SECRET` | The secret line was changed by hand | Put a new one in: run `openssl rand -hex 32` and paste the result after `JWT_ACCESS_SECRET=` |
| Log mentions `password authentication failed` | The database password in the settings file is wrong | Compare `DATABASE_URL` in `.env` with `cat /root/sabeebook-db-password` |
| Build stops with **Killed** | Not enough memory | Check swap (step 3), run the build again |
| certbot says it couldn't verify the domain | The domain doesn't point here yet, or port 80 is blocked | Wait for step 1 to spread; open ports 80 and 443 in your VPS company's firewall |
| Signed out every time the page reloads | You're on `http://` not `https://`, or `FRONTEND_URL` is wrong | Use `https://yourdomain.com`; check `FRONTEND_URL` in `.env`, then restart the backend |
| Logo or spreadsheet upload fails | The upload folder can't be written to | `chown -R bookkeeping:bookkeeping /srv/bookkeeping-data` |
| `Permission denied (publickey)` in step 6 | GitHub doesn't have the deploy key | Redo step 6's GitHub part |

**Two rules to remember:**
- After **any** change to `apps/backend/.env`, run `systemctl restart bookkeeping-api`.
- After changing `apps/frontend/.env.production.local`, run `/srv/bookkeeping/deploy/update.sh`.

**Still stuck?** Send me the last 20 lines of the log (from the first box in this section), but **never** a key or password.

---

## Where everything lives

| What | Where |
|---|---|
| The code | `/srv/bookkeeping` |
| Settings and secrets | `/srv/bookkeeping/apps/backend/.env` |
| The database password | `/root/sabeebook-db-password` |
| Uploaded logos and signatures | `/srv/bookkeeping-data/uploads` |
| Backups | `/srv/bookkeeping-data/backups` |
| The two app services | `bookkeeping-api` (backend), `bookkeeping-web` (web app) |
| nginx's instructions | `/etc/nginx/sites-available/bookkeeping` |
