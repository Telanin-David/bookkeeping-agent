import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import BrandLogo from '@/components/brand/BrandLogo';
import HeaderActions from '@/components/landing/HeaderActions';
import { Laptop, Phone, Snip } from '@/components/landing/Frames';
import chat from '@/assets/landing/phone-chat-2.webp';
import chatReceipt from '@/assets/landing/phone-chat-4.webp';
import alerts from '@/assets/landing/phone-alerts.webp';
import profit from '@/assets/landing/phone-profit.webp';
import stock from '@/assets/landing/phone-stock.webp';
import invoice from '@/assets/landing/invoice.webp';
import stepSay from '@/assets/landing/step-say.webp';
import stepList from '@/assets/landing/step-list.webp';
import stepProfit from '@/assets/landing/step-profit.webp';
import desk from '@/assets/landing/desk-dashboard.webp';

// The home page, for visitors. Every screen on it is a screenshot of the real app with a
// sample shop's books (Amaka Provisions), retaken whenever the app's look changes.
// Prices and plan limits mirror apps/backend/src/services/plans.ts: keep them in step.

export const metadata: Metadata = {
  title: 'sabeebook: bookkeeping you can talk to',
  description: 'Tell sabeebook what you sold, spent and gave on credit. It keeps your books, tracks who owes you and shows your real profit. 14 days free.',
  openGraph: {
    title: 'sabeebook: bookkeeping you can talk to',
    description: 'Tell it what you sold. It keeps the books. 14 days free, then ₦5,000 a month.',
    type: 'website',
  },
};

const TRIAL_DAYS = 14;

export default function Home() {
  return (
    <div className="min-h-screen bg-brand-paper text-brand-black [color-scheme:light]">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <BothPlaces />
        <SmallThings />
        <Pricing />
        <Questions />
        <FinalCall />
      </main>
      <Footer />
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-brand-forest">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="sabeebook home" className="shrink-0">
          <BrandLogo priority className="w-[116px] sm:w-[132px]" />
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] text-brand-paper/70 md:flex">
          <a href="#how" className="transition hover:text-brand-paper">How it works</a>
          <a href="#pricing" className="transition hover:text-brand-paper">Pricing</a>
          <a href="#questions" className="transition hover:text-brand-paper">Questions</a>
        </nav>
        <HeaderActions />
      </div>
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-forest text-brand-paper">
      {/* Ruled lines, like the exercise book most shops keep their accounts in. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-100 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 39px, rgba(247,248,244,0.06) 39px, rgba(247,248,244,0.06) 40px)' }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[max(1rem,calc(50%-36rem))] hidden w-px bg-brand-yellow/20 lg:block" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:pb-20 lg:pt-20">
        <div className="max-w-xl lg:pl-6">
          <p className="text-[14px] font-medium text-brand-leaf">Bookkeeping for shops, in plain words</p>
          <h1 className="mt-4 font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
            Tell it what you sold.
            <span className="block text-brand-yellow">It keeps the books.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-brand-paper/75 sm:text-lg">
            Type your sales, expenses and debts the way you&apos;d tell a friend. sabeebook writes them down,
            keeps track of who owes you, and shows the profit you&apos;re really making.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="inline-flex h-12 items-center rounded-full bg-brand-yellow px-6 text-[15px] font-semibold text-brand-black transition hover:bg-[#ffd94a]">
              Start free for {TRIAL_DAYS} days
            </Link>
            <a href="#how" className="inline-flex h-12 items-center rounded-full px-5 text-[15px] font-medium text-brand-paper/85 ring-1 ring-inset ring-brand-paper/20 transition hover:bg-white/[0.06] hover:text-brand-paper">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-[13px] text-brand-paper/50">No card needed. Works in your phone&apos;s browser.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[320px] lg:mr-6">
          <Phone src={chat} alt="sabeebook's chat: the owner types 'Sold 2 bags of rice for 164k cash. Mama Tunde took 5 cartons of Indomie, 72,500, she'll pay Friday' and the assistant records both" priority />
          <div className="absolute -bottom-10 -left-32 hidden w-[176px] -rotate-[5deg] shadow-[0_30px_50px_-20px_rgba(0,0,0,0.6)] xl:block">
            <Snip src={invoice} alt="The invoice sabeebook made for Mama Tunde: 5 cartons of Indomie, ₦72,500, balance due" sizes="176px" className="rounded-xl bg-white" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How it works ───────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      title: 'Tell it',
      body: 'One message for a whole morning’s sales is fine: “Sold rice 82k, two cartons of milk 48k, Iya Bisi took oil on credit.”',
      img: stepSay, alt: 'An owner’s message and the assistant’s reply',
    },
    {
      title: 'It writes it down',
      body: 'Every sale, expense and debt lands in your book with the date, the customer and the amount. Wrong? Say “that was 700, not 650” and it’s fixed.',
      img: stepList, alt: 'The list of recorded sales, each marked Paid',
    },
    {
      title: 'You see where you stand',
      body: 'Profit this month, sales, who owes you and what’s running low, on one screen and in plain words.',
      img: stepProfit, alt: 'The dashboard: profit this month, sales this month and active alerts',
    },
  ];
  return (
    <section id="how" className="scroll-mt-16 border-b border-black/[0.07]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHead kicker="How it works" title="Three steps. No accounting words." />
        <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-yellow font-display text-[15px] font-bold text-brand-black">{i + 1}</span>
                <h3 className="font-display text-xl font-semibold">{s.title}</h3>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-black/65">{s.body}</p>
              <Snip src={s.img} alt={s.alt} className="mt-6 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.5)]" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────

function Features() {
  return (
    <section className="border-b border-black/[0.07]">
      <div className="mx-auto max-w-6xl space-y-24 px-4 py-20 sm:px-6 sm:py-28 lg:space-y-32">
        <Feature
          kicker="Money owed to you"
          title="Know who owes you, and since when."
          points={['Part-payments, with the date each one came in', 'An email when a debt goes past its due date', 'What you owe suppliers, and when it’s due']}
          visual={<Phone src={alerts} alt="Alerts: Sugar is out of stock, and Alhaji Musa owes ₦148,000 that was due on 14 Oct" className="mx-auto w-full max-w-[290px]" time="08:06" />}
        >
          Record a credit sale in one line. sabeebook keeps the balance right through every part-payment,
          and reminds you when a debt is overdue, so Alhaji Musa&apos;s ₦148,000 doesn&apos;t quietly become a gift.
        </Feature>

        <Feature
          flip
          kicker="Receipts and invoices"
          title="A proper receipt in seconds, ready for WhatsApp."
          points={['From the chat, or from any sale in your book', 'Share as a PDF, or print it', 'Your shop’s logo and signature on a paid plan']}
          visual={
            <div className="mx-auto flex w-full max-w-[460px] items-end">
              <Phone src={chatReceipt} alt="The assistant shows the invoice for Mama Tunde in the chat" className="w-[64%] shrink-0" />
              <div className="relative z-10 -ml-[12%] mb-[-6%] w-[48%] shrink-0 rotate-[4deg] shadow-[0_24px_40px_-16px_rgba(0,0,0,0.45)]">
                <Snip src={invoice} alt="The invoice it made: Amaka Provisions, Mama Tunde, 5 cartons of Indomie, ₦72,500, balance due" sizes="(min-width: 1024px) 220px, 45vw" className="rounded-xl bg-white" />
              </div>
            </div>
          }
        >
          Ask for a receipt or an invoice and it&apos;s ready, with your shop&apos;s name, the customer, the items
          and what&apos;s still owed. Send it straight to your customer.
        </Feature>

        <Feature
          kicker="Real profit"
          title="Profit on what you actually sold."
          points={['Sales, minus what those goods cost you', 'Minus rent, fuel, salaries and other running costs', 'Compared with the same point last month']}
          visual={<Phone src={profit} alt="The profit page: ₦351,741 profit so far in October, with how it's worked out" className="mx-auto w-full max-w-[290px]" />}
        >
          Not just money in minus money out. sabeebook works out what you really kept, then tells you what&apos;s
          eating it, like &ldquo;your biggest running cost is rent.&rdquo;
        </Feature>

        <Feature
          flip
          kicker="Stock"
          title="Your shelf, counted as you sell."
          points={['Sales take goods off the shelf; restocks put them back', 'A warning before something runs out', 'Count the shelf to see what went missing']}
          visual={<Phone src={stock} alt="The stock list: six products with how many are left, sugar out of stock" className="mx-auto w-full max-w-[290px]" />}
        >
          Keep a list of what you sell and sabeebook keeps the count. You&apos;ll know sugar is finished before a
          customer asks for it.
        </Feature>
      </div>
    </section>
  );
}

function Feature({ kicker, title, points, visual, flip, children }: {
  kicker: string; title: string; points: string[]; visual: ReactNode; flip?: boolean; children: ReactNode;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <div className={flip ? 'lg:order-2' : undefined}>
        <p className="text-[14px] font-medium text-brand-green">{kicker}</p>
        <h3 className="mt-3 font-display text-3xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-[2.6rem]">{title}</h3>
        <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-black/65 sm:text-[17px]">{children}</p>
        <ul className="mt-7 max-w-lg divide-y divide-black/[0.08] border-y border-black/[0.08]">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 py-3 text-[15px] text-black/80">
              <Tick className="mt-[3px] shrink-0 text-brand-green" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? 'lg:order-1' : undefined}>{visual}</div>
    </div>
  );
}

// ── Phone and laptop ───────────────────────────────────────

function BothPlaces() {
  return (
    <section className="overflow-hidden bg-brand-black text-brand-paper">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28">
        <div className="max-w-2xl">
          <p className="text-[14px] font-medium text-brand-leaf">Phone and laptop</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
            On your phone at the shop. On the laptop at home.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-brand-paper/65">
            The same books in both places. When the bank or your accountant asks, download your profit and loss,
            debts and stock as PDF reports.
          </p>
        </div>
        <Laptop src={desk} alt="sabeebook on a laptop: the dashboard for Amaka Provisions" className="mt-14 max-w-5xl sm:mt-16" />
      </div>
    </section>
  );
}

// ── Smaller features ───────────────────────────────────────

function SmallThings() {
  const items = [
    ['Bring your old records', 'Import sales and expenses from an Excel or CSV file in a few taps.'],
    ['Staff and salaries', 'Keep a staff list, get a reminder on pay day, and record salaries in one go.'],
    ['More than one shop', 'Run up to three shops from one account, each with its own books.'],
    ['Fix anything by saying so', 'Change an amount, a name or a date by telling the assistant, or edit it yourself.'],
    ['Naira and Nigerian time', 'Every amount in ₦, every day counted on Nigerian time, so daily totals add up.'],
    ['Your records stay yours', 'Only you can see your shop’s sales, customers and debts.'],
  ];
  return (
    <section className="border-b border-black/[0.07]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHead kicker="And more" title="The small things that save you time." />
        <dl className="mt-12 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([t, d]) => (
            <div key={t} className="border-t border-black/[0.1] py-6">
              <dt className="font-display text-[19px] font-semibold">{t}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-black/60">{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ── Pricing ────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 border-b border-black/[0.07] bg-white/60">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHead
          kicker="Pricing"
          title="Simple prices, in naira."
          lead={`Every new account gets ${TRIAL_DAYS} days of everything free, with 40 messages to the assistant. No card needed to start.`}
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <Plan
            name="Free"
            price="₦0"
            note="For writing your book yourself"
            points={['Record sales, expenses and debts', 'Receipts and invoices, with a small “Made with sabeebook” line', 'One shop']}
          />
          <Plan
            featured
            className="order-first lg:order-none"
            name="Monthly"
            price="₦5,000"
            per="a month"
            note="About ₦167 a day"
            points={[
              'The assistant: 6 messages a day, and one message can hold a whole day’s sales',
              'Profit and loss, debt and stock reports',
              'Your logo and signature on receipts',
              'Overdue-debt emails, staff and salaries, Excel import',
              'Up to 3 shops',
            ]}
          />
          <Plan
            name="Yearly"
            price="₦50,000"
            per="a year"
            note="About ₦137 a day: two months free"
            points={['Everything in Monthly, for a whole year', 'One payment, then nothing to renew until next year']}
          />
        </div>
        <p className="mt-6 text-[14px] text-black/55">Pay with Paystack. If you stop paying, your records stay and you move to the free plan.</p>
      </div>
    </section>
  );
}

function Plan({ name, price, per, note, points, featured, className }: {
  name: string; price: string; per?: string; note: string; points: string[]; featured?: boolean; className?: string;
}) {
  return (
    <div className={cn(featured
      ? 'flex flex-col rounded-3xl bg-brand-forest p-7 text-brand-paper shadow-[0_30px_60px_-30px_rgba(11,56,38,0.7)] sm:p-8'
      : 'flex flex-col rounded-3xl bg-white p-7 ring-1 ring-black/[0.08] sm:p-8', className)}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">{name}</h3>
        {featured && <span className="rounded-full bg-brand-yellow px-2.5 py-1 text-[12px] font-semibold text-brand-black">Most shops</span>}
      </div>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="font-display text-[2.6rem] font-bold leading-none tracking-[-0.03em]">{price}</span>
        {per && <span className={featured ? 'text-[15px] text-brand-paper/60' : 'text-[15px] text-black/50'}>{per}</span>}
      </p>
      <p className={featured ? 'mt-2 text-[14px] text-brand-paper/60' : 'mt-2 text-[14px] text-black/50'}>{note}</p>
      <ul className={featured ? 'mt-6 flex-1 space-y-3 border-t border-white/10 pt-6' : 'mt-6 flex-1 space-y-3 border-t border-black/[0.08] pt-6'}>
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[15px] leading-snug">
            <Tick className={featured ? 'mt-[2px] shrink-0 text-brand-yellow' : 'mt-[2px] shrink-0 text-brand-green'} />
            <span className={featured ? 'text-brand-paper/85' : 'text-black/75'}>{p}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={featured
          ? 'mt-8 inline-flex h-12 items-center justify-center rounded-full bg-brand-yellow text-[15px] font-semibold text-brand-black transition hover:bg-[#ffd94a]'
          : 'mt-8 inline-flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-brand-black ring-1 ring-inset ring-black/15 transition hover:bg-black/[0.04]'}
      >
        {name === 'Free' ? 'Start free' : `Start ${TRIAL_DAYS} days free`}
      </Link>
    </div>
  );
}

// ── Questions ──────────────────────────────────────────────

function Questions() {
  const qs: [string, string][] = [
    ['Do I need to know accounting?',
      'No. Talk about your shop the way you normally would. sabeebook does the sorting: what’s a sale, what’s a cost, who owes what.'],
    ['What if the assistant gets something wrong?',
      'Everything it records shows up in your book straight away, so you can check it. Tell it what to change (“it was Emeka, not Ade”) or edit the entry yourself. When an amount isn’t clear, it asks instead of guessing.'],
    ['Who can see my shop’s records?',
      'Only you, when you’re signed in. The sabeebook team’s own dashboard shows counts, like how many shops signed up, never your sales, customers or debts.'],
    ['Do I need to install anything?',
      'No. Open sabeebook in your phone’s browser and sign up. You can add it to your home screen so it opens like an app.'],
    ['Does it work without internet?',
      'No, it needs a connection to save your records. It uses very little data, because it’s mostly text.'],
    ['Can I bring in my old records?',
      'Yes. If they’re in Excel or a CSV file, the Import page reads them in. Records in a notebook you can type in, or just tell the assistant.'],
    ['How do I pay?',
      'With Paystack, monthly or yearly. If you stop paying, nothing is deleted: your records stay and you move to the free plan.'],
  ];
  return (
    <section id="questions" className="scroll-mt-16 border-b border-black/[0.07]">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead kicker="Questions" title="What owners ask first." />
        <div className="divide-y divide-black/[0.1] border-y border-black/[0.1]">
          {qs.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-display text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="relative h-4 w-4 shrink-0">
                  <span className="absolute left-0 top-1/2 h-[2px] w-4 -translate-y-1/2 rounded bg-brand-green" />
                  <span className="absolute left-1/2 top-0 h-4 w-[2px] -translate-x-1/2 rounded bg-brand-green transition-transform group-open:scale-y-0" />
                </span>
              </summary>
              <p className="pb-5 pr-10 text-[15px] leading-relaxed text-black/65">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Last call ──────────────────────────────────────────────

function FinalCall() {
  return (
    <section className="bg-brand-forest text-brand-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-[3.4rem]">
              Close today&apos;s books <span className="text-brand-yellow">in one message.</span>
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-brand-paper/70">
              Start with {TRIAL_DAYS} days of everything. If it doesn&apos;t save you time, it costs you nothing.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex h-12 items-center rounded-full bg-brand-yellow px-7 text-[15px] font-semibold text-brand-black transition hover:bg-[#ffd94a]">
              Start free
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium text-brand-paper/85 ring-1 ring-inset ring-brand-paper/20 transition hover:bg-white/[0.06]">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-brand-black text-brand-paper/55">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-[14px] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <BrandLogo className="w-[104px]" />
          <span className="hidden text-brand-paper/40 sm:inline">Easy bookkeeping for busy people.</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#how" className="hover:text-brand-paper">How it works</a>
          <a href="#pricing" className="hover:text-brand-paper">Pricing</a>
          <a href="#questions" className="hover:text-brand-paper">Questions</a>
          <Link href="/login" className="hover:text-brand-paper">Sign in</Link>
        </nav>
        <p className="text-brand-paper/35">© {new Date().getFullYear()} sabeebook</p>
      </div>
    </footer>
  );
}

// ── Bits ───────────────────────────────────────────────────

function SectionHead({ kicker, title, lead }: { kicker: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[14px] font-medium text-brand-green">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">{title}</h2>
      {lead && <p className="mt-4 text-[17px] leading-relaxed text-black/60">{lead}</p>}
    </div>
  );
}

function Tick({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
