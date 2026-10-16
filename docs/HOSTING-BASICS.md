# Hosting explained simply

**What this is:** before you set anything up, this explains every word you'll meet, in plain English. No experience needed.

**The idea that helps:** think of putting sabeebook online like **opening a shop in a big market**.

---

## The big picture in one story

You want customers anywhere in Nigeria to open **sabeebook.com** on their phone and use your app, day and night.

1. **You rent a shop space** in a big, secure market that never closes. That's your **server** (VPS), rented from **Hostinger**.
2. **The shop space has a plot number**, like `102.89.34.11`, so it can be found. That's the **IP address**.
3. **Nobody remembers plot numbers**, so you put up a **signboard name**: sabeebook.com. That's your **domain**.
4. **A public directory** tells everyone "sabeebook.com is at plot 102.89.34.11". That's **DNS**.
5. **You furnish the shop**: you install the system, the app, the store room for records and a security guard. That's what most of the setup steps do.
6. **You get an official seal** that proves the shop is genuine and keeps conversations private. That's the **padlock (HTTPS)**.
7. **Customers walk in.** That's sabeebook being live.

Now the words, one by one.

---

## The words

### The place: server, VPS, Hostinger

- **Server:** a computer that's always on, sitting in a special building with constant power and fast internet (a **data centre**). It does one job: serve your app to anyone who asks, day and night. It has no screen or keyboard; you control it from your laptop.
- **VPS ("Virtual Private Server"):** one big, powerful computer is split into many smaller, separate ones, and you rent one of them. Like one **lockable shop inside a big plaza**: the building is shared, but your shop is private.
- **Hostinger:** the company you rent the VPS from, like the plaza's landlord. **hPanel** is Hostinger's website where you manage what you rent.

### Finding the shop: IP address, domain, DNS

- **IP address:** the server's number on the internet, four numbers with dots, like `102.89.34.11`. It's how computers find each other. **Where you get it:** Hostinger shows it on your VPS page once the server is set up.
- **Domain:** the easy name people type, like `sabeebook.com`. You rent it yearly from a **domain seller** (also called a **registrar**), such as Hostinger, Namecheap or Whogohost.
- **DNS ("Domain Name System"):** the internet's **phone book**. When someone types sabeebook.com, their phone quietly asks DNS "what's the number for this name?" and gets back your server's IP address.
  - **DNS record:** one line in that phone book.
  - **A record:** the kind of line that says "this name → this IP address". You'll add one for `sabeebook.com` (written `@`, meaning "the domain itself") and one for `www.sabeebook.com`.
  - **CNAME record:** a line that says "this name is the same as that other name". Hostinger often has one that makes `www` follow the main domain.
  - **Where you change it:** on the website of the company you bought the domain from, on a page called **DNS**, **DNS records** or **Manage DNS**.
- **Propagation:** after you change the phone book, it takes time (minutes to hours) for every phone book copy around the world to update. You just wait.

### Inside the server: Ubuntu, root, terminal, SSH, commands

- **Operating system:** the basic software that makes a computer work. Your laptop runs Windows or macOS.
- **Ubuntu:** a free operating system made for servers. You choose it once, when you set up the VPS. "24.04" is the version (April 2024); it gets security updates for years.
- **Root:** the server's **administrator account**, the master key that can do anything.
  - **Root password:** that key's password. You choose it in Hostinger when you set up the VPS.
  - Keep it secret and keep it safe.
- **Terminal:** a window where you **type instructions** to a computer instead of clicking buttons. A server has no screen, so this is how you talk to it.
  - On Windows it's called **PowerShell**, on a Mac **Terminal**.
  - Hostinger also has a **Browser terminal** inside hPanel, which works in your web browser.
- **Command:** one typed instruction, e.g. `apt update` means "check for the latest updates". You paste it, press **Enter**, and the server does it.
- **SSH ("Secure Shell"):** a **secure phone line** from your laptop to the server, so you can type commands into it from anywhere. `ssh root@102.89.34.11` means "call the server at this number and log in as the administrator".
- **sudo:** "do this as the administrator". You'll see `sudo -u bookkeeping`, which means "do this as the app's own user, not as the administrator" (that's safer).

### Keeping it safe: firewall, ports, HTTPS

- **Ports:** numbered **doors** on the server. Different kinds of visitors use different doors:
  - **22:** the **staff door**. It's how you log in with SSH.
  - **80:** the **customer door**, plain and not secure.
  - **443:** the **secure customer door**, used by HTTPS.
- **Firewall:** the **security guard at the gate**. It keeps every door locked except 22, 80 and 443.
- **fail2ban:** a guard who **bans anyone who keeps guessing your password**.
- **HTTPS / the padlock:** shows in the browser's address bar when the connection is private and the site is genuine. Without it, passwords and shop data could be read on the way. Phones also warn people away from sites without it.
  - **SSL certificate:** the official **seal** that makes the padlock appear.
  - **Let's Encrypt:** a free, trusted organisation that issues the seal.
  - **certbot:** the tool that fetches the seal and renews it every few months, by itself.

### The app itself: frontend, backend, database, nginx

- **Frontend (the "web app"):** the **shop floor**: the screens your customers see and tap.
- **Backend (the "API"):** the **back office**. It checks who's signed in, saves sales, works out profit, makes PDFs, and talks to the AI.
- **Database (PostgreSQL):** the **ledger and store room**, where every shop's sales, debts, stock and accounts are kept safely. "Postgres" is the same thing.
- **nginx** (say "engine-x"): the **receptionist at the entrance**. Every visitor arrives at nginx first, and it sends them to the shop floor (frontend) or the back office (backend), depending on what they asked for.
- **Node.js:** the **engine** that runs sabeebook's code. The app is written in a language called JavaScript, and Node.js is what runs JavaScript on a server.

### Getting the app onto the server: GitHub, build, settings

- **GitHub:** the website where sabeebook's **code** (its blueprint) is stored safely.
  - **Repository** ("repo"): one project's folder on GitHub. Yours is `Telanin-David/bookkeeping-agent`.
  - **Deploy key:** a special key you give the server so it can **take a copy of the code but never change it**. It's like a warehouse key that only opens the "collect" door.
- **Clone:** download a copy of the code from GitHub onto the server.
- **Build:** turn the code into the fast, finished version that runs for customers, like turning blueprints and materials into the finished product. It takes several minutes.
- **The settings file (`.env`):** a file on the server with the app's settings and secret keys: where the database is, your web address, your API keys. It stays on the server only.
- **API key:** a password that lets one service use another. Your **Anthropic API key** lets sabeebook use Claude, the AI behind the assistant, and Anthropic bills you for what's used. **Where you get it:** console.anthropic.com → **API Keys** → **Create Key**.
- **Migrations:** the steps that **set up the shelves in the store room**: they create the database tables for sales, stock, debts and so on.

### Keeping it running: services, memory, backups

- **Service (systemd):** the **shop manager** who makes sure the app is always running. If it crashes, the manager restarts it; if the server restarts, the manager opens the shop again automatically.
- **RAM / memory:** the server's **desk space**, where it holds what it's working on right now. Hostinger's plans have 4 GB or more.
- **Swap:** **extra desk space borrowed from the filing cabinet** (the disk). It's slower, but it stops the server running out of room during the build.
- **Backup:** a **photocopy of the whole ledger** every night, kept for 14 days, so nobody loses their records if something goes wrong.
- **Cron:** a **timer** that does a job at the same time every day. It runs the backup at 2:30am.

### Payments and email: Paystack, webhook, SMTP

- **Paystack:** the Nigerian company that takes card, bank transfer and USSD payments for you.
  - **Test mode:** practice payments, no real money.
  - **Live mode:** real money.
  - **Secret key:** Paystack's API key for your account.
- **Webhook:** **Paystack phoning sabeebook** to say "this person just paid". The plan then switches on even if the customer closes their phone. The **webhook URL** is the phone number you give Paystack for that call.
- **SMTP:** the standard way apps **send emails**, like a post office.
- **Brevo:** a company that runs that post office for you (free for 300 emails a day). Without it, "Forgot password" emails can't be sent.

---

## What happens when a customer opens sabeebook

1. They type **sabeebook.com** on their phone.
2. Their phone asks **DNS** (the phone book), and it answers `102.89.34.11`.
3. The phone goes to your **server** at that number, through the secure door, **port 443**. The **padlock** shows.
4. The **firewall** (the guard) lets them through, because 443 is open.
5. **nginx** (the receptionist) sends them to the **frontend**, which shows the sign-in screen.
6. They sign in and type "I sold 2 crates of Coke for 7000".
7. The **backend** (the back office) asks Claude, using your **API key**, then saves the sale in the **database** (the ledger).
8. The answer comes back to their phone, all in a second or two.

---

## What you'll do, in plain words

| Phase | In plain words | Roughly |
|---|---|---|
| **0. Set up the VPS** | In Hostinger: choose Ubuntu, set the administrator password, get the IP address | 15 min |
| **1. Point the domain** | Add a phone-book entry: sabeebook.com → your server's IP | 5 min, then waiting |
| **2. Log in** | Open the terminal and connect to the server | 5 min |
| **3–5. Prepare the server** | Updates, security guard, extra desk space, the engine (Node.js), the store room (database) | 30 min |
| **6. Get the code** | Give the server a warehouse key, and download sabeebook | 10 min |
| **7. Settings** | Write the settings file and paste your Anthropic key | 10 min |
| **8. Build and start** | Build the app, set up the shelves, start the shop manager | 20 min |
| **9–10. Open the doors** | Set up the receptionist (nginx), then get the padlock | 10 min |
| **11. Your account** | Sign up, and make yourself the admin | 5 min |
| **13–14. Finish** | Nightly backups, then test everything on your phone | 15 min |

**About 2½–3½ hours for a first time.** The padlock step (10) has to wait until the phone book (DNS) has updated. If that's slow, everything else can still be done tonight, and the padlock can follow in the morning.

**The full step-by-step instructions are in `docs/DEPLOY.md`.** Better still, do it **together with me in the chat, one step at a time**: I tell you what to press and why, you tell me what you see, and we move on only when it has worked.
