# Putting sabeebook live: a learning guide

This guide takes you from **a brand-new Hostinger VPS** to **sabeebook live at `https://yourdomain.com`**. It's written for someone who has **never set up a server before**.

Every step tells you:
- **🏪 The shop picture:** where the step fits in the big picture;
- **What you're doing:** in plain English;
- **What each line means:** for every command you paste;
- **✅ What you should see:** how you know it worked;
- **⚠️ If it goes wrong:** what that looks like, and what to do.

The aim is that you **understand** what you're doing, not just copy and paste. By the end, you'll know how your own server works.

**Time:** about **2½ to 3½ hours** for a first time. Much of that is waiting for things to download or build.

---

# Part 1: The big picture

## Putting an app online is like opening a shop in a big market

You want customers anywhere in Nigeria to open **sabeebook.com** on their phone and use your app, day and night. Here's how that works, in shop terms:

| In the shop picture | In computer terms | What it is |
|---|---|---|
| A shop space you rent in a big, secure market that never closes | **Server** / **VPS**, from **Hostinger** | A computer that's always on, in a building with constant power and fast internet |
| The shop's plot number | **IP address**, e.g. `102.89.34.11` | The number computers use to find your server |
| The signboard name people remember | **Domain**: `sabeebook.com` | The easy name people type |
| The public directory that says "sabeebook.com is at plot 102.89.34.11" | **DNS** | The internet's phone book |
| Furnishing the shop: shelves, store room, security guard, receptionist | Installing **Ubuntu**, the **database**, the **firewall**, **nginx** | Most of this guide |
| The official seal that proves the shop is genuine | **HTTPS** / the **padlock** | Keeps passwords and data private on the way |
| The shop manager who opens up every morning and reopens after any trouble | **systemd services** | Keeps sabeebook running day and night |
| A photocopy of the ledger every night | **Backups** | So nobody ever loses their records |

## What happens when a customer opens sabeebook

1. They type **sabeebook.com** on their phone.
2. Their phone asks **DNS** (the phone book): "where is sabeebook.com?" It answers: `102.89.34.11`.
3. The phone goes to your **server** at that number, through the secure door (**port 443**). The **padlock** shows in the address bar.
4. The **firewall** (the security guard) lets them in, because that door is allowed.
5. **nginx** (the receptionist) sends them to the **frontend** (the shop floor), which shows the sign-in screen.
6. They type *"I sold 2 crates of Coke for 7000"*.
7. The **backend** (the back office) asks Claude, the AI, using your **API key**, then saves the sale in the **database** (the ledger).
8. The answer appears on their phone. All in a second or two.

Each step of this guide sets up one of these pieces. **If something breaks later, this list tells you where to look.** Site not found? It's the phone book (step 1). No padlock? It's the seal (step 10). An error page? The shop manager or the back office (step 8).

---

# Part 2: Before you start

## How to paste and run a command

A **terminal** is a window where you **type instructions** to a computer instead of clicking. A server has no screen, so this is how you talk to it. A **command** is one typed instruction.

1. **Copy** the whole grey box from this guide.
2. **Paste** it into the terminal:
   - **Windows (PowerShell):** click inside the window, then right-click (or **Ctrl+V**). If it asks *"You are about to paste text that contains multiple lines"*, click **Paste anyway**.
   - **Mac (Terminal):** **Cmd+V**.
   - **Hostinger's Web console:** **Ctrl+Shift+V**, or right-click → **Paste**. Test it first with a harmless word: some web consoles don't allow pasting. If yours doesn't, use your laptop's own terminal (step 2).
3. Press **Enter** if the last line hasn't run by itself.
4. **Wait** until you see the **prompt** again: the line that starts with `root@...:~#`. **The prompt means "I'm ready for your next instruction".** While a command is still working, the prompt doesn't show.
5. **Read the last few lines.** Words like `error`, `failed`, `denied` or `not found` mean something went wrong. **Stop, and don't paste the next box.** Send me those lines.

## Three rules

- **One box at a time.** Wait for the prompt before pasting the next one.
- **Never paste a password or key into a chat**, an email or GitHub, and that includes this chat with me. Keys only ever go into the settings file on the server (step 7).
- **When you see `yourdomain.com` in a command box, leave it as it is.** The command fills in your real domain by itself, after you tell the server your domain in step 2. The only exceptions are step 2 itself and your own email address in steps 10 and 11.

## What you need

| Item | Where you get it | Used in |
|---|---|---|
| Your **Hostinger** login | hostinger.com (the account you bought the VPS with) | Step 0 |
| A login where you **bought the domain** (maybe Hostinger too) | That company's website | Step 1 |
| Your **GitHub** login (the account that owns `Telanin-David/bookkeeping-agent`) | github.com | Step 6 |
| An **Anthropic API key** | console.anthropic.com (step 7 shows how) | Step 7. **The app won't start without it.** |
| *(Can wait)* Brevo login | brevo.com, free | Emails, e.g. "Forgot password" |
| *(Can wait)* Paystack login | dashboard.paystack.com | Online payments |

> **What's an API key?** A password that lets one service use another. Your **Anthropic API key** lets sabeebook use Claude, the AI behind the assistant. Anthropic bills you for what's used, so keep the key secret.

---

# Part 3: The steps

## Step 0: Set up your new VPS on Hostinger

**🏪 The shop picture:** you've rented an empty shop space. Before you can use it, you choose what it's built on, and you get the master key and the plot number.

**What you're doing:** a VPS you've just bought is an empty computer in Hostinger's building.
- **VPS** stands for "Virtual Private Server": one big computer split into many separate small ones, and you rent one. It's like a lockable shop inside a big plaza.
- You'll choose its **operating system**, the basic software every computer needs (your laptop runs Windows or macOS).
- For servers, the standard choice is **Ubuntu**: free, safe, and what this guide is written for.
- You'll also set the **root password**. **Root** is the server's administrator account, the master key that can do anything.

> Hostinger changes its screens from time to time, so a button may have a slightly different name. Look for the closest match. If you're stuck, send me a screenshot (with any password covered).

1. Go to **hostinger.com** and click **Log in**. You're now in **hPanel**, Hostinger's control room for what you rent.
2. In the menu (at the top or down the left side), click **VPS**. You'll see your server, probably with a **Setup** button. Click **Setup**.
3. **Location** (if it asks): pick a European one, such as **France**, **United Kingdom**, **Netherlands** or **Germany**. **Why:** it's the closest Hostinger has to Nigeria, so the app feels fastest for your customers.
4. **Operating system:** choose **Plain OS** (sometimes called **Operating system** or **Clean OS**), then **Ubuntu 24.04**. The number is the version, released April 2024, with years of security updates. Ubuntu 22.04 also works if 24.04 isn't offered.
   - **Don't pick** anything "with a control panel" (CloudPanel, cPanel, Plesk…) or an "application" (Docker, Coolify, WordPress…). **Why:** those install their own website software, which clashes with the way this guide sets things up.
5. **Malware scanner** (if offered): leave it **off**. **Why:** it hunts attacks on PHP websites (like WordPress), and sabeebook isn't PHP, so it adds a program to the server without protecting much. The real protection is in step 3. You can switch it on later under **Security → Malware Scanner** if you change your mind.
   - **Docker** (if offered): leave it **off** too. This guide doesn't use it.
6. **Root password:** type a **strong password** (12+ characters, mixing letters, numbers and symbols). **Write it down somewhere safe**, like a password manager or a notebook at home. Anyone with it controls the whole server.
   - If it offers an **SSH key**, skip it for now. The password is enough tonight.
7. Click **Next** / **Finish setup**. Hostinger takes a few minutes to prepare the server. Wait until it says **Running** (or shows a green dot).
8. Click your server to open its **Overview** page. **Write down:**
   - the **IP address**: four numbers with dots, like `102.89.34.11`. This is your server's "plot number", the address computers use to find it.
   - the **SSH username**, usually `root`.
9. Find **Firewall** (under the server's **Security** settings). If Hostinger's firewall is on, make sure it **allows ports 22, 80 and 443**. Either add an **Accept** rule for each, or switch Hostinger's firewall off; step 3 sets up a firewall on the server itself.

   **What are ports?** Numbered **doors** on the server:
   - **22** is the **staff door**, how you log in;
   - **80** is the **customer door** (plain);
   - **443** is the **secure customer door**.

   If any of these are blocked here, nothing else in this guide can reach the internet.

✅ **What you should see:** your server shows **Running**, and you have its **IP address** and **root password** written down.

⚠️ **Picked the wrong system?** No harm done: the server is still empty. In hPanel, open the server, find **OS & Panel → Operating System** (or **Change OS**), choose plain **Ubuntu 24.04**, and confirm. This wipes the server and starts it fresh.

---

## Step 1: Point your domain at the server

**🏪 The shop picture:** you put your shop's name and plot number in the public directory, so anyone looking for "sabeebook.com" is sent to your plot.

**What you're doing:** you're adding entries to **DNS**, the internet's phone book. When someone types sabeebook.com, their phone quietly asks DNS "what's the number for this name?", and DNS answers with your server's IP address.
- **DNS record:** one line in that phone book.
- **A record:** the kind of line that says "this name → this IP address".
- **`@`:** short for "the domain itself" (sabeebook.com).
- **`www`:** the www.sabeebook.com version.

You make these changes on the website of the company you **bought the domain from** (also called the **registrar**). Changes take from minutes to a few hours to reach every phone book around the world. That wait is called **propagation**. **That's why you do this early:** it can spread while you do the other steps.

1. Log in where you bought the domain. Open your list of domains and click yours.
2. Look for **DNS**, **Manage DNS**, **DNS Zone** or **DNS Records**, and click it.
3. Click **Add record** and fill in:
   - **Type:** `A`
   - **Name / Host:** `@`
   - **Points to / Value:** your server's IP address (from step 0)
   - **TTL:** leave it as it is. It's how long phones remember the answer before asking again.
   - Click **Save**.
4. Add a second record the same way, but with **Name / Host:** `www`.
5. If the list already has other **A** (or **AAAA**) records for `@` or `www`, such as a "parking page" the seller added, **delete** them. **Why:** with two addresses listed, some visitors land on the wrong one.

> **If your domain is on Namecheap:** sign in → **Domain List** → **Manage** next to your domain.
> - On the **Domain** tab, **NAMESERVERS** should say **Namecheap BasicDNS**. If it says **Custom DNS**, the phone book lives at that other company instead.
> - Open the **Advanced DNS** tab. Under **HOST RECORDS**, delete Namecheap's parking records with the bin icon: the **CNAME** for `www` (pointing to `parkingpage.namecheap.com`) and the **URL Redirect** for `@`.
> - **ADD NEW RECORD → A Record**, Host `@`, Value your IPv4, TTL **Automatic**, then click the **green tick ✓** (without it, nothing is saved). Repeat with Host `www`.
> - Use the **IPv4** address only (four numbers with dots). Don't add an **AAAA** (IPv6) record.
>
> **If your domain is on Hostinger:** in hPanel, click **Domains** → your domain → **DNS / Nameservers** (or **Manage DNS records**).
> - Hostinger usually already has an **A** record for `@` pointing to a parking page. Click **Edit**, change **Points to** to your server's IP, and click **Update**. Edit it; don't add a second one.
> - If there's a **CNAME** record for `www` pointing to your domain, **leave it**. A CNAME means "this name is the same as that name", so `www` simply follows `@`, and you can skip point 4.
> - If the page says the domain uses **other nameservers** (not Hostinger's), the phone-book entries live at that other company instead.

✅ **What you should see:** go to **dnschecker.org**, type your domain, choose **A**, and press **Search**. Green ticks with your server's IP mean the phone book has updated. **Don't wait for it**: carry on with steps 2–9, and check again before step 10.

⚠️ **If it still shows the old IP, or nothing, after a few hours:** check you edited the right domain, and that the record is type **A** with name `@`.

---

## Step 2: Log in to the server

**🏪 The shop picture:** you walk in through the staff door with your master key.

**What you're doing:** you open a **secure line** from your laptop to the server so you can give it instructions. This is called **SSH** ("Secure Shell"): an encrypted phone line between your laptop and the server.

**Open a terminal on your laptop:**
- **Windows:** press the **Windows key**, type `PowerShell`, and press **Enter**.
- **Mac:** press **Cmd+Space**, type `Terminal`, and press **Enter**.
- **Or, easier:** in hPanel, click **VPS** → **Manage**, then **Web console** on the Overview page (next to **Reboot**). A black window opens. If it shows `login:`, type `root`, press **Enter**, then type the root password (nothing shows while you type) and press **Enter**. Once you see the prompt, skip to "Tell the server your domain" below.
- **From your phone (later):** apps like **Termius** (iPhone and Android) or **JuiceSSH** (Android) make the same secure call. Fine for quick checks after launch; use a laptop for the setup itself, especially step 7.

Type this, with **your** IP address instead of the example, and press **Enter**:

```bash
ssh root@102.89.34.11
```

**What it means:** "`ssh`: open a secure line, to the server at `102.89.34.11`, and log in as `root` (the administrator)."

- The first time, it asks *"Are you sure you want to continue connecting?"*. Type `yes` and press **Enter**. Your laptop is meeting this server for the first time and wants you to confirm.
- It asks for the **password**: type or paste the root password from step 0 and press **Enter**. **Nothing appears while you type, not even dots.** That's normal: it hides the password from anyone watching.

✅ **What you should see:** a line like `root@srv123456:~#`. That's the **prompt**:
- `root` is who you are;
- `srv123456` is the server's name;
- `#` means "administrator, ready".

⚠️ **If it goes wrong:**
- `Permission denied`: the password is wrong. Try again carefully, or reset it in hPanel.
- `Connection timed out`: check the IP, and that Hostinger's firewall allows port 22 (step 0, point 9).

> If Hostinger gave you a username other than `root`, log in with that name, then type `sudo -i` and press **Enter**. `sudo` means "do this as the administrator", and `-i` keeps you as the administrator from then on.

**Tell the server your domain.** Change `yourdomain.com` to your real domain (no `https://`, no `www`), then run it:

```bash
DOMAIN=yourdomain.com
echo "Your domain is: $DOMAIN"
```

**What each line means:**
- `DOMAIN=yourdomain.com`: "remember the word **DOMAIN** as my web address". Later commands use `$DOMAIN` (the `$` means "the value of") instead of you typing your domain again and again, which avoids typos.
- `echo "Your domain is: $DOMAIN"`: `echo` means "say this back to me", so you can check the spelling.

✅ **What you should see:** `Your domain is: sabeebook.com` (with your real domain).

⚠️ **Important:** the server forgets this when you log out. If you close the window or the connection drops, log in again and **run this box again** before carrying on.

---

## Step 3: Update the server, add a security guard and extra memory

**🏪 The shop picture:** you fix the locks, hire a security guard for the gate, and bring in tools.

**What you're doing:** you install the latest security fixes and the tools sabeebook needs, lock every door except the three you use, and give the server some spare memory.

```bash
apt update && apt upgrade -y
timedatectl set-timezone Africa/Lagos
apt install -y git curl build-essential ufw fail2ban unattended-upgrades nginx certbot python3-certbot-nginx
```

**What each line means:**
- `apt` is Ubuntu's **app store for servers**.
  - `apt update`: "check the store for the latest versions".
  - `&&`: "and if that worked, then…".
  - `apt upgrade -y`: "install all updates", where `-y` means "yes to everything, don't ask me".
- `timedatectl set-timezone Africa/Lagos`: set the server's clock to Nigerian time, so dates on receipts and reports are right.
- `apt install -y …`: install these tools:
  - **git:** downloads your code from GitHub (step 6);
  - **curl:** fetches things from the internet;
  - **build-essential:** tools some parts of the app need when they're installed;
  - **ufw:** the **firewall**, the security guard who keeps doors locked;
  - **fail2ban:** bans anyone who keeps guessing your password;
  - **unattended-upgrades:** installs security fixes by itself in future;
  - **nginx** (say "engine-x"): the **receptionist** who greets every visitor and sends them to the right part of the app;
  - **certbot:** fetches the **padlock** certificate (step 10).

✅ **What you should see:** lots of text scrolling, then the prompt again. It takes a few minutes.

⚠️ If a coloured screen pops up asking about restarting services or keeping a file, just press **Enter**. That accepts the safe default.

**Now the security guard (firewall):**

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

**What each line means:**
- `ufw allow OpenSSH`: keep the **staff door (port 22)** open. That's the one you're using right now; without it you'd lock yourself out.
- `ufw allow 'Nginx Full'`: keep the **customer doors (ports 80 and 443)** open, for website visitors.
- `ufw --force enable`: switch the guard on. Every other door is now locked.
- `ufw status`: show what the guard allows.

✅ **What you should see:** a list with `OpenSSH` and `Nginx Full` marked `ALLOW`.

**Now extra memory (swap):**

```bash
if [ -z "$(swapon --show)" ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h
```

**What it means:**
- A server has **RAM**, its "desk space" for what it's working on right now. Building the app (step 8) needs a lot of it.
- **Swap** is extra desk space borrowed from the disk: slower, but it stops the server running out of room.
- The box says: "if there's no swap yet (`if [ -z … ]`), make a 2 GB swap file, lock it so only the administrator can use it, switch it on, and remember it after restarts (`/etc/fstab`)".
- `free -h` shows the server's memory in human-friendly sizes.

✅ **What you should see:** in the `free -h` output, the `Swap:` line shows about `2.0Gi`.

---

## Step 4: Install the engine (Node.js) and the store room (database)

**🏪 The shop picture:** you install the machine that runs the shop, and the store room where every record is kept.

**What you're doing:**
- **Node.js** is the **engine** that runs sabeebook. The app is written in JavaScript, and Node.js runs JavaScript on a server.
- **PostgreSQL** (or "Postgres") is the **database**: the ledger and store room where every shop's sales, debts, stock and accounts are kept safely.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
```

**What each line means:**
- `curl … | bash -`: download NodeSource's setup script and run it. NodeSource is the official supplier of Node.js for Ubuntu, and the script adds them to the server's "app store".
- `apt install -y nodejs`: install Node.js, version 22.
- `node -v`: "Node, what version are you?"

✅ **What you should see:** `v22.` followed by numbers.

**The database.** First, check which Ubuntu you have:

```bash
grep VERSION= /etc/os-release
```

**What it means:** "look in the file that describes this system (`/etc/os-release`) for the line with its version". `grep` means "find lines containing…".

- If it says **24.04**:
  ```bash
  apt install -y postgresql
  ```
- If it says **22.04**, its built-in PostgreSQL is too old, so get version 16 from PostgreSQL's own supplier:
  ```bash
  apt install -y postgresql-common
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt install -y postgresql-16
  ```

Check the database is running:

```bash
systemctl is-active postgresql
```

**What it means:** `systemctl` talks to the server's **service manager** (more on it in step 8). This asks: "is the database switched on?"

✅ **What you should see:** `active`.

---

## Step 5: Create sabeebook's database

**🏪 The shop picture:** in the store room, you put up sabeebook's own locked cabinet, and keep its key safe.

**What you're doing:** you create an empty database for sabeebook, and a database user with a strong password. The app logs in to the database with that user.

```bash
DB_PASSWORD=$(openssl rand -hex 24)
echo "$DB_PASSWORD" > /root/sabeebook-db-password && chmod 600 /root/sabeebook-db-password
sudo -u postgres psql -c "CREATE ROLE bookkeeping LOGIN PASSWORD '$DB_PASSWORD'"
sudo -u postgres psql -c "CREATE DATABASE bookkeeping OWNER bookkeeping"
```

**What each line means:**
- `openssl rand -hex 24`: make a **long random password**. Nobody could guess it, and you never need to type it.
- `echo … > /root/sabeebook-db-password`: save it in a file in the administrator's own folder. `chmod 600` means "only the administrator can read this file". Step 7 reads the password from here.
- `sudo -u postgres psql -c "…"`: "as the database's own administrator (`postgres`), give the database this instruction". `psql` is the tool for talking to PostgreSQL.
  - `CREATE ROLE bookkeeping LOGIN PASSWORD …`: create a database user called `bookkeeping`, with that password.
  - `CREATE DATABASE bookkeeping OWNER bookkeeping`: create an empty database for sabeebook, owned by that user.

✅ **What you should see:** `CREATE ROLE`, then `CREATE DATABASE`.

⚠️ **If you see `already exists`:** you've run this step before, which is fine. Carry on.

---

## Step 6: Get sabeebook's code onto the server

**🏪 The shop picture:** your app's blueprint is kept in a warehouse called **GitHub**. You give the server a key that only opens the "collect a copy" door, then fetch a copy.

**What you're doing:**
- **GitHub** is the website where sabeebook's **code** (its blueprint) is stored. Your project's folder there is called a **repository** (repo): `Telanin-David/bookkeeping-agent`. It's private.
- You'll make a **deploy key**: a key that lets this server **download** the code, but **never change** it.
- Then you'll **clone** the code, meaning download a copy.

**First, give the app its own user and folders:**

```bash
useradd --system --create-home --home-dir /home/bookkeeping --shell /bin/bash bookkeeping
mkdir -p /srv/bookkeeping /srv/bookkeeping-data/uploads
chown -R bookkeeping:bookkeeping /srv/bookkeeping /srv/bookkeeping-data
```

**What each line means:**
- `useradd … bookkeeping`: create a user called `bookkeeping` just for the app. **Why:** if someone ever found a weakness in the app, they'd only get this small account, not the master key to the whole server.
- `mkdir -p …`: make the folders:
  - `/srv/bookkeeping` for the code;
  - `/srv/bookkeeping-data/uploads` for shop logos and signatures people upload.
- `chown -R bookkeeping:bookkeeping …`: "change owner" to the app's user, so the app can use these folders.

**Now make the deploy key:**

```bash
sudo -u bookkeeping mkdir -p -m 700 /home/bookkeeping/.ssh
sudo -u bookkeeping ssh-keygen -t ed25519 -N "" -C "sabeebook-vps" -f /home/bookkeeping/.ssh/id_ed25519
cat /home/bookkeeping/.ssh/id_ed25519.pub
```

**What each line means:**
- `mkdir … .ssh`: make the app user's private key folder (`-m 700`: only that user can open it).
- `ssh-keygen …`: make a new key pair. A key pair has two halves:
  - a **private** half that stays on the server, like the key itself;
  - a **public** half you give to GitHub, like the shape of the lock.

  `ed25519` is the type of key (modern and strong), and `-C "sabeebook-vps"` is a label so you can recognise it.
- `cat …id_ed25519.pub`: show the **public half** on screen (`cat` means "show what's in this file"). It's safe to share with GitHub.

✅ **What you should see:** one long line starting with `ssh-ed25519` and ending with `sabeebook-vps`.

**Copy that line:**
- **Windows:** select it with the mouse, then right-click (or **Ctrl+Shift+C**).
- **Mac:** select it, then **Cmd+C**.

**Add it on GitHub** (in your web browser):

1. Go to **github.com/Telanin-David/bookkeeping-agent**.
2. Click **Settings**: the last tab along the top of the repository page, with a gear icon.
3. In the left menu, under **Security**, click **Deploy keys**.
4. Click **Add deploy key**.
5. **Title:** `VPS`. **Key:** paste the line.
6. Leave **Allow write access** **unticked**. That keeps it a read-only key: the server can collect copies but never change your code.
7. Click **Add key**. GitHub may ask for your password or a 2-factor code, to make sure it's really you.

**Back in the terminal, download the code:**

```bash
sudo -u bookkeeping git clone git@github.com:Telanin-David/bookkeeping-agent.git /srv/bookkeeping
```

**What it means:** "as the app's user, use **git** (the code-downloading tool) to **clone** (download a copy of) this repository into `/srv/bookkeeping`".

When it asks *"Are you sure you want to continue connecting?"*, type `yes`. The server is meeting GitHub for the first time.

✅ **What you should see:** lines like `Receiving objects: 100%`, then the prompt.

⚠️ **`Permission denied (publickey)`:** GitHub doesn't recognise the key. Check you pasted the whole line on GitHub's **Deploy keys** page for the right repository, then run the clone command again.

---

## Step 7: The settings file

**🏪 The shop picture:** you write the shop's instruction sheet: where the store room is, what the shop is called, and the secret keys. It's locked in the manager's drawer.

**What you're doing:** sabeebook reads its settings from a file called **`.env`** (say "dot env"). It holds:
- where the database is, and its password;
- your web address;
- a long random **secret** the app uses to sign people in safely;
- your **API keys**.

The file stays **only on the server**, never on GitHub.

First, check your domain is still remembered. If this prints nothing after the colon, redo the domain box in step 2.

```bash
echo "Your domain is: $DOMAIN"
```

**Write the settings file:**

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

**What it means:**
- **The first two lines** read the database password saved in step 5, and make a new random secret for signing people in. That secret is called **JWT**: a "pass" the app gives a person when they sign in.
- **`cat > … <<EOF` … `EOF`** writes everything between those two markers into the settings file. Each `${…}` is filled in automatically.
- **The important lines inside it:**

  | Line | What it means |
  |---|---|
  | `DATABASE_URL` | Where the store room is (on this same server, `localhost`), with its user and password |
  | `NODE_ENV=production` | "This is the real, live shop", which switches on the stricter safety checks |
  | `TRUST_PROXY=1` | There's one receptionist (nginx) in front of the app, so the app knows each visitor's real address |
  | `FRONTEND_URL` | Your web address |
  | `ANTHROPIC_API_KEY=` | Empty for now; you add it next |
  | `SMTP_…` | Email settings, for later (Brevo) |
  | `UPLOAD_DIR` | Where uploaded logos are kept |
  | `BILLING_ENABLED=true` | Plans and payments switched on (explained below) |
  | `PAYSTACK_SECRET_KEY=` | Empty for now (step 12) |

- **The `echo` line** writes the frontend's one setting: the web address its screens should talk to.
- **`chown` and `chmod 600`** make the settings file readable only by the app and the administrator.

**Get your Anthropic API key** (in your web browser):

1. Go to **console.anthropic.com** and log in.
2. Click **API Keys**, then **Create Key**.
3. Name it `sabeebook VPS`, then click **Create**.
4. Click **Copy**. **You only see the key once.** If you lose it, delete it and make a new one.
5. While you're there, set a **monthly spending limit** (on the **Limits** page, or **Billing → Limits**). Then a surprise can never run up a big bill.

**Put the key into the settings file**, using **nano**, a simple text editor that works inside the terminal:

```bash
nano /srv/bookkeeping/apps/backend/.env
```

1. Use the **arrow keys** to move to the line `ANTHROPIC_API_KEY=`. Press **End** to jump to the end of that line. (nano doesn't use the mouse.)
2. Paste the key straight after the `=`, with no spaces and no quotes. On Windows, right-click; on a Mac, **Cmd+V**.
3. **Save:** press **Ctrl+O** (the letter O, "write Out"), then **Enter** to confirm the file name.
4. **Exit:** press **Ctrl+X**.

**Check the key went in**, without showing it on screen:

```bash
grep -c '^ANTHROPIC_API_KEY=sk-ant-' /srv/bookkeeping/apps/backend/.env
```

**What it means:** "count (`-c`) the lines that start with `ANTHROPIC_API_KEY=sk-ant-`". Anthropic keys start with `sk-ant-`.

✅ **What you should see:** `1`.

⚠️ **If it prints `0`:** the key isn't on that line. Open the file again with nano and check there's no space after the `=`.

> **About `BILLING_ENABLED=true`:** every owner gets the **14-day free trial with 40 assistant messages** from the day they sign up, then the free plan unless they pay. Until Paystack is set up (step 12), the Plan screen tells owners to pay you by bank transfer, and you switch their plan on from your Admin page. If you'd rather launch with everything free, change it to `false` the same way you added the key.

---

## Step 8: Build sabeebook and start it

**🏪 The shop picture:** you assemble the shop from the blueprint, put up the shelves in the store room, and hire the manager who keeps the doors open day and night.

**What you're doing:** you're doing three things.
1. **Build:** turn the code into the fast, finished app.
2. **Migrate:** create the database's tables (the shelves).
3. **Start the services:** hand sabeebook over to the server's manager.

**Install and build** (takes **5–15 minutes**, and can look stuck; it isn't):

```bash
cd /srv/bookkeeping
sudo -u bookkeeping -H npm ci
sudo -u bookkeeping -H npm run build
```

**What each line means:**
- `cd /srv/bookkeeping`: "go into the code folder". `cd` means "change directory"; a directory is a folder.
- `npm` is Node.js's tool for building blocks (called **packages**).
  - `npm ci`: download every building block the app is made from, at the exact versions it was tested with.
  - `npm run build`: turn the code into the finished app, both the shop floor (**frontend**) and the back office (**backend**).
- `sudo -u bookkeeping -H`: run it as the app's user, not as the administrator.

✅ **What you should see:** at the end of the build, lines listing the app's pages, then the prompt. No `ERR!` or `error`.

⚠️ **If it ends with `Killed` or `out of memory`:** the server ran out of desk space. Check the swap from step 3 is on (`free -h`), then run the box again.

**Put up the shelves (database tables):**

```bash
sudo -u bookkeeping -H deploy/migrate.sh
```

**What it means:** run sabeebook's **migrations**: the instructions that create the database tables for sales, debts, stock, plans and so on. It keeps a list of what it has already done, so it's safe to run again later.

✅ **What you should see:** `Applying 001_initial.sql` … up to `013_billing.sql`, then `Database is up to date.`

⚠️ **If it stops with `password authentication failed`:** the database password in the settings file doesn't match. Run step 7's first box again.

**Hire the shop manager:**

```bash
cp deploy/bookkeeping-api.service deploy/bookkeeping-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now bookkeeping-api bookkeeping-web
sleep 5
curl -s http://127.0.0.1:4000/api/v1/health; echo
curl -s -o /dev/null -w "web app: %{http_code}\n" http://127.0.0.1:3000/login
```

**What each line means:**
- The server has a built-in **manager** called **systemd**. You give it a **service** file for each part of sabeebook:
  - **`bookkeeping-api`**: the **backend**, the back office that talks to the database and the AI;
  - **`bookkeeping-web`**: the **frontend**, the screens people see.

  systemd starts them, **restarts them if they ever crash**, and **starts them again after the server reboots**.
- `cp …`: copy the two service files into systemd's folder.
- `systemctl daemon-reload`: "manager, read the new files".
- `systemctl enable --now …`: "start them **now**, and every time the server starts (`enable`)".
- `sleep 5`: wait 5 seconds for them to wake up.
- The two `curl` lines visit the app from inside the server, to check it's alive:
  - `127.0.0.1` means "this same machine";
  - `4000` is the backend's internal door, `3000` the frontend's.

✅ **What you should see:** `{"status":"ok",...}` and `web app: 200`. `200` is the web's code for "OK, here's the page".

⚠️ **If you don't:** see **When something goes wrong** at the end of this guide. Its first box shows what the app is saying.

---

## Step 9: The receptionist (nginx)

**🏪 The shop picture:** you put a receptionist at the entrance. Every visitor arrives there first and is shown to the right room.

**What you're doing:** visitors arrive at **nginx** (the receptionist), which sends anything starting with `/api` to the backend and everything else to the frontend. This step gives nginx those instructions, with your domain filled in.

```bash
echo "Your domain is: $DOMAIN"
sed "s/DOMAIN_NAME/${DOMAIN}/g" /srv/bookkeeping/deploy/nginx-site.conf > /etc/nginx/sites-available/bookkeeping
ln -sf /etc/nginx/sites-available/bookkeeping /etc/nginx/sites-enabled/bookkeeping
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

**What each line means:**
- `echo …`: check the domain is still remembered. It should print your domain.
- `sed "s/DOMAIN_NAME/…/g" … > …`: take sabeebook's nginx instructions, replace the placeholder `DOMAIN_NAME` with your domain everywhere, and save the result in nginx's folder. `sed` means "find and replace".
- `ln -sf …`: switch the instructions **on**, by putting a shortcut in nginx's "enabled" folder.
- `rm -f …default`: remove nginx's "Welcome to nginx" sample page.
- `nginx -t && systemctl reload nginx`: check the instructions have no mistakes, and if so, tell nginx to use them.

✅ **What you should see:** `syntax is ok` and `test is successful`.

⚠️ **If `nginx -t` shows an error:** copy the error lines and send them to me.

---

## Step 10: The padlock (HTTPS)

**🏪 The shop picture:** you get the official seal that proves your shop is genuine and keeps every conversation with customers private.

**What you're doing:** **HTTPS** is the padlock in the browser's address bar.
- It means the connection is **private**: passwords and shop data can't be read on the way.
- It also proves the site is **genuine**.
- Phones warn people away from sites without it, and sabeebook's sign-in **won't work** without it.

The padlock comes from an **SSL certificate** (the seal). **Let's Encrypt**, a trusted organisation, gives these out free, and **certbot** is the tool that fetches the certificate and renews it by itself.

**First, check step 1 (the phone book) has updated:**

```bash
curl -4 -s ifconfig.me; echo
getent ahostsv4 $DOMAIN | head -1
```

**What each line means:**
- `curl -4 -s ifconfig.me`: "what's **this server's** IP address?" It asks a small public website that tells you.
- `getent ahostsv4 $DOMAIN`: "what IP does the **phone book** give for my domain?"

✅ **The two IP addresses must be the same.** That means your domain now leads to this server.

⚠️ **If the second line is empty, or shows a different IP:** the phone book hasn't updated yet. Wait 15–30 minutes and try again. The seal can only be issued once your domain points here, because Let's Encrypt checks it really is your server.

**When they match, get the padlock.** Put your own email address in place of `you@youremail.com`:

```bash
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect --agree-tos -m you@youremail.com -n
```

**What it means:**
- `certbot --nginx`: get a certificate and set it up in nginx for you.
- `-d … -d www…`: for your domain, and the www version.
- `--redirect`: send anyone who types `http://` to the safe `https://`.
- `--agree-tos`: accept Let's Encrypt's terms.
- `-m you@…`: your email, only used to warn you if the certificate ever has a problem.
- `-n`: don't ask questions.

✅ **What you should see:** `Successfully deployed certificate`.

Check it will renew by itself (certificates last 3 months):

```bash
certbot renew --dry-run
```

**What it means:** "practise a renewal without actually doing it". It should end saying the renewal **succeeded**.

🎉 **Open `https://yourdomain.com` on your phone.** You should see the sabeebook sign-in page with a padlock.

⚠️ **If certbot says it couldn't verify your domain:**
- the phone book isn't updated yet, so wait and retry; or
- port 80 is blocked in Hostinger's firewall (step 0, point 9).

---

## Step 11: Your account, and the Admin page

**🏪 The shop picture:** you're the first customer, then you give yourself the owner's badge.

1. On the site, tap **Sign up**. Create your account with your own email, and set up your shop.
2. Make yourself the **admin** (use the email you just signed up with):

   ```bash
   cd /srv/bookkeeping/apps/backend
   sudo -u bookkeeping -H npm run make-admin -- you@youremail.com
   ```

   **What it means:** go to the backend's folder, and run sabeebook's small `make-admin` tool for that email address. The admin sees the business dashboard: how many owners you have, AI costs, payments, the switch for the weekly and day passes, and **Record payment** for bank transfers.
3. Sign out and back in. The menu now has **Admin**.

✅ **What you should see:** an **Admin** item in the menu.

---

## Step 12: Paystack (can wait until after launch)

**🏪 The shop picture:** you install a card machine at the till, so customers can pay without cash.

**What you're doing:**
- **Paystack** takes card, bank transfer and USSD payments for you.
- **Test mode** is practice money; **live mode** is real money.
- Your **secret key** is Paystack's API key for your account.
- The **webhook** is Paystack **phoning sabeebook** to say "this person just paid", so their plan switches on even if they close their phone. The **webhook URL** is the number you give Paystack to call.

**Start in test mode:**

1. Log in at **dashboard.paystack.com**. Make sure the switch at the top says **Test Mode**.
2. Click **Settings** (bottom of the left menu), then the **API Keys & Webhooks** tab.
3. In **Test Webhook URL**, type `https://yourdomain.com/api/v1/billing/paystack/webhook`. Here, put your real domain yourself, because this is a web form, not a command. Then click **Save changes**.
4. Copy the **Test Secret Key** (it starts with `sk_test_`).
5. Put it after `PAYSTACK_SECRET_KEY=` in the settings file (the same nano steps as step 7), then restart the back office so it reads the new key:

   ```bash
   nano /srv/bookkeeping/apps/backend/.env
   systemctl restart bookkeeping-api
   ```

6. **Test:** sign up with a **different** email (a test owner), open **Plan**, tap **Pay ₦5,000 for Monthly**, and pay with a Paystack test card (Paystack's documentation lists them under "Test Payments").

✅ **What you should see:** you come back to **Payment received**, and the payment shows on your Admin page.

**Going live:** switch Paystack to **Live Mode**. It may ask you to finish **Activate business / Compliance** first. Then repeat points 2–5 with the **Live Webhook URL** and **Live Secret Key** (`sk_live_…`).

---

## Step 13: Nightly backups

**🏪 The shop picture:** every night, someone photocopies the whole ledger and files it away.

**What you're doing:** a **backup** is a copy of the whole database and all uploaded logos. **cron** is the server's built-in **timer** that runs a job at the same time every day.

```bash
echo "30 2 * * * bookkeeping /srv/bookkeeping/deploy/backup.sh >> /srv/bookkeeping-data/backup.log 2>&1" > /etc/cron.d/bookkeeping-backup
sudo -u bookkeeping /srv/bookkeeping/deploy/backup.sh
ls -lh /srv/bookkeeping-data/backups
```

**What each line means:**
- `echo "30 2 * * * …" > /etc/cron.d/…`: tell the timer to run sabeebook's backup tool at **2:30am every day**. `30 2` is minute 30 of hour 2, and each `*` means "every day, month and weekday". It also writes what happened into a log file.
- `sudo -u bookkeeping …backup.sh`: run a backup **now**, to check it works.
- `ls -lh …`: list the backups folder (`ls` means "list"; `-lh` shows sizes in a readable way).

✅ **What you should see:** a `db-…dump` file and an `uploads-…tar.gz` file. Backups older than 14 days are deleted automatically.

**Also keep a copy off the server.** A backup on the same server dies with the server. About **once a week**, open a **new** terminal window on your laptop (not logged in to the server) and run this, with your server's IP:

```bash
scp root@102.89.34.11:/srv/bookkeeping-data/backups/db-*.dump .
```

**What it means:** `scp` is "secure copy". It copies the backup files from the server to the folder you're in on your laptop (the `.` at the end means "here").

If hPanel offers automatic **snapshots** or **backups** for your VPS, switch those on too.

---

## Step 14: Launch checks (on your phone)

Open `https://yourdomain.com` and tick these off:

- [ ] Sign up, set up a shop, and reach the dashboard.
- [ ] Record a sale with the form. It shows on Transactions (in green) and on the dashboard.
- [ ] Ask the assistant: *"I sold 2 crates of Coke for 7000"*. It replies, with the bee beside its reply, and the sale is saved.
- [ ] Open a receipt and tap **Share PDF**.
- [ ] Download a **Profit & Loss** report.
- [ ] Upload a shop logo (**Shops → Branding**). It appears on a receipt.
- [ ] **Restart the server and check sabeebook comes back by itself:**

  ```bash
  reboot
  ```

  **What it means:** restart the whole server, like switching a computer off and on. The connection closes; wait a minute, then open the site. If it loads, your shop manager (systemd) is doing its job after power cuts or restarts.

**You're live.** 🐝

---

# Part 4: After launch

## Email (Brevo), so "Forgot password" works

**🏪 The shop picture:** you open an account at the post office so the shop can send letters.

**What you're doing:**
- **SMTP** is the standard way apps **send emails**.
- **Brevo** runs that "post office" for you, free for 300 emails a day.
- Without it, nobody can reset a forgotten password, and alerts only show inside the app.

1. Sign up at **brevo.com**.
2. Go to **Senders, Domains & Dedicated IPs → Domains → Add a domain**, and type your domain. Brevo shows a few records (TXT and CNAME). Add each one on your domain's **DNS** page, the same way as step 1, then click **Verify** in Brevo. **Why:** these records prove to Gmail and others that the emails really come from you, so they don't land in spam.
3. Go to **SMTP & API → SMTP**, click **Generate a new SMTP key**, and copy it. Note the **SMTP login** shown on the page.
4. Open the settings file and fill in:
   - `SMTP_HOST=smtp-relay.brevo.com`
   - `SMTP_USER=` your SMTP login
   - `SMTP_PASS=` the key
5. Save, and restart the back office:

   ```bash
   nano /srv/bookkeeping/apps/backend/.env
   systemctl restart bookkeeping-api
   ```

## Putting updates live

When new code is merged on GitHub, log in (step 2) and run:

```bash
/srv/bookkeeping/deploy/update.sh
```

**What it means:** sabeebook's update tool.
1. It downloads the new code.
2. It builds it.
3. It puts up any new database shelves.
4. It restarts the app.

✅ It ends with **Updated and running.** The site can show errors for a minute while it rebuilds, so do it at a quiet time, like late at night.

## Let Claude Code do the typing (optional)

Claude Code can run **on your server** and type this guide's commands for you. It asks your permission before each one, and explains any errors. It uses your Claude subscription.

You still do these yourself, because they happen on websites or involve your keys:
- steps 0 and 1;
- step 6's GitHub part;
- adding keys to the settings file;
- checking the site on your phone.

1. Do **steps 0, 1, 2 and 6** yourself (for step 6, first run `apt update && apt install -y git`).
2. Install Claude Code and start it:

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   cd /srv/bookkeeping
   claude
   ```

   If it says `claude: command not found`, type `exit`, log in again, and run the last two lines again. The first time, it shows a link: open it on your phone, approve, and paste back the code it gives you.
3. Tell it:

   > Follow docs/DEPLOY.md to put this app live on this server. My domain is yourdomain.com. Steps 0, 1, 2 and 6 are done. Stop and ask me whenever a step needs me. Never open or print apps/backend/.env — I'll add the keys myself with nano.

4. **Read each command before approving it.** It's working on your live server as the administrator.

---

# Part 5: When something goes wrong

## First, find out what the app is saying

```bash
journalctl -u bookkeeping-api -n 100 --no-pager
journalctl -u bookkeeping-web -n 100 --no-pager
```

**What it means:**
- `journalctl` shows the **log**: the diary that the shop manager (systemd) keeps for each part of sabeebook.
- `-u bookkeeping-api` picks the back office's diary (`-web` is the shop floor's);
- `-n 100` shows the last 100 lines;
- `--no-pager` prints it all at once instead of page by page.

**The last lines usually say exactly what's wrong.**

## Is everything switched on?

```bash
systemctl status bookkeeping-api bookkeeping-web nginx postgresql --no-pager
```

**What it means:** "manager, how are these four doing?" They are the back office, the shop floor, the receptionist and the store room. Each should say **active (running)**.

## Common problems

| What you see | What it means, in the shop picture | What to do |
|---|---|---|
| The site doesn't load at all, or "can't be reached" | The phone book doesn't lead here yet, or the guard is blocking the door | Check step 1 on dnschecker.org; check Hostinger's firewall allows 80 and 443 |
| **502 Bad Gateway** | The receptionist is there, but the back office or shop floor is closed | Read the log (above), fix what it says, then `systemctl restart bookkeeping-api bookkeeping-web` |
| Log says `Missing required environment variable: ANTHROPIC_API_KEY` | The instruction sheet is missing the AI key | Step 7 (the nano part), then `systemctl restart bookkeeping-api` |
| Log mentions `JWT_ACCESS_SECRET` | The sign-in secret was changed by hand | Run `openssl rand -hex 32` and paste the result after `JWT_ACCESS_SECRET=` |
| Log mentions `password authentication failed` | The store-room key in the instruction sheet is wrong | Compare `DATABASE_URL` in `.env` with `cat /root/sabeebook-db-password` |
| Build ends with **Killed** | The server ran out of desk space | Check swap with `free -h` (step 3), then build again |
| certbot couldn't verify the domain | The seal office checked the phone book and didn't find your server | Wait for step 1 to update; check port 80 is open |
| Signed out every time the page reloads | You're on `http://`, not the secure `https://` | Use `https://yourdomain.com`; check `FRONTEND_URL` in `.env` |
| Logo or spreadsheet upload fails | The app isn't allowed to write in the uploads folder | `chown -R bookkeeping:bookkeeping /srv/bookkeeping-data` |
| `Permission denied (publickey)` in step 6 | The warehouse doesn't recognise the server's key | Redo step 6's GitHub part |

**Two rules to remember:**
- After **any** change to `apps/backend/.env`, run `systemctl restart bookkeeping-api`, so the back office reads the new instructions.
- After changing `apps/frontend/.env.production.local`, run `/srv/bookkeeping/deploy/update.sh`.

**Still stuck?** Send me the last 20 lines of the log, but **never** a key or password.

---

# Part 6: Reference

## Where everything lives

| What | Where on the server |
|---|---|
| The code | `/srv/bookkeeping` |
| The settings file (with secrets) | `/srv/bookkeeping/apps/backend/.env` |
| The database password | `/root/sabeebook-db-password` |
| Uploaded logos and signatures | `/srv/bookkeeping-data/uploads` |
| Backups | `/srv/bookkeeping-data/backups` |
| The two services (shop manager's names) | `bookkeeping-api` (back office), `bookkeeping-web` (shop floor) |
| The receptionist's instructions | `/etc/nginx/sites-available/bookkeeping` |

## Word list

| Word | In plain English |
|---|---|
| **API key** | A password that lets one service use another (e.g. sabeebook using Claude) |
| **Backend** | The back office: saves records, works out profit, talks to the AI |
| **Build** | Turning code into the finished, fast app |
| **Certificate (SSL)** | The official seal behind the padlock |
| **Clone** | Download a copy of the code from GitHub |
| **Command** | One typed instruction to the server |
| **cron** | The server's daily timer |
| **Database (PostgreSQL)** | The ledger and store room for all records |
| **Deploy key** | A read-only key that lets the server download code from GitHub |
| **DNS** | The internet's phone book: names → IP addresses |
| **DNS record / A record** | One line in that phone book / a line saying "this name → this IP" |
| **Domain** | The name people type: sabeebook.com |
| **`.env`** | The settings file with the app's secrets |
| **Firewall** | The security guard who keeps doors locked |
| **Frontend** | The shop floor: the screens people see |
| **GitHub / repository** | The website where code is stored / one project's folder there |
| **HTTPS / padlock** | A private, genuine connection |
| **IP address** | The server's number on the internet |
| **Log** | The diary each service keeps |
| **Migration** | Instructions that set up the database's tables |
| **nano** | A simple text editor inside the terminal |
| **nginx** | The receptionist who sends visitors to the right place |
| **Node.js** | The engine that runs sabeebook's code |
| **Port** | A numbered door on the server (22 staff, 80/443 customers) |
| **Prompt** | The `root@…#` line meaning "ready for your next instruction" |
| **Propagation** | The wait while phone books worldwide update |
| **Root** | The server's administrator account, the master key |
| **Server / VPS** | The computer you rent that's always on |
| **Service (systemd)** | The manager who keeps each part running and restarts it |
| **SSH** | A secure line from your laptop to the server |
| **Swap** | Extra memory borrowed from the disk |
| **Terminal** | The window where you type commands |
| **Ubuntu** | The server's operating system (free, made for servers) |
| **Webhook** | Paystack phoning sabeebook to say someone paid |
