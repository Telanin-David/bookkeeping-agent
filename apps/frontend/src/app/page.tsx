import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  ArrowRight, ArrowsClockwise, Check, CheckCircle, FileArrowUp, FilePdf, Lock, PencilSimple, ShareNetwork, Storefront,
  UsersThree, Warning,
} from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';
import SiteHeader from '@/components/landing/SiteHeader';
import BrandLogo from '@/components/brand/BrandLogo';
import { Laptop, Phone, Snip } from '@/components/landing/Frames';
import { Bee, CountTrail, FlightPath, Grain, HexBadge, Honeycomb, MarketStall } from '@/components/landing/Art';
import chat from '@/assets/landing/phone-chat-2.webp';
import alerts from '@/assets/landing/phone-alerts.webp';
import profit from '@/assets/landing/phone-profit.webp';
import stock from '@/assets/landing/phone-stock.webp';
import invoice from '@/assets/landing/invoice.webp';
import stepSay from '@/assets/landing/step-say.webp';
import stepList from '@/assets/landing/step-list.webp';
import stepProfit from '@/assets/landing/step-profit.webp';
import desk from '@/assets/landing/desk-dashboard.webp';

// The home page, for visitors. Every app screen on it is a screenshot of the real app with a
// sample shop's books (Amaka Provisions); the figures in the floating cards are that shop's
// too. Retake the screenshots when the app's look changes.
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
    <div className="min-h-screen overflow-x-clip bg-[#FAF6EA] font-display text-brand-black [color-scheme:light]">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <OneMessage />
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

// ── Shared pieces ──────────────────────────────────────────

/** Frosted glass on a dark background. */
function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn(
      'rounded-2xl border border-white/15 bg-white/[0.09] text-brand-paper shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl',
      className,
    )}
    >
      {children}
    </div>
  );
}

function Kicker({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'honey' }) {
  return (
    <p className={cn('inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em]', tone === 'honey' ? 'text-brand-yellow' : 'text-brand-green')}>
      <span aria-hidden className="h-[7px] w-[7px] rotate-45 rounded-[1px] bg-current" />
      {children}
    </p>
  );
}

function PrimaryButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex h-[52px] items-center gap-2 rounded-full bg-brand-yellow pl-6 pr-2 text-[15px] font-semibold text-brand-black shadow-[0_12px_32px_-10px_rgba(245,201,40,0.7),inset_0_1px_0_rgba(255,255,255,0.5)] transition hover:bg-[#ffd94a]',
        className,
      )}
    >
      {children}
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-black text-brand-yellow transition group-hover:translate-x-0.5">
        <ArrowRight size={16} weight="bold" />
      </span>
    </Link>
  );
}

// ── Hero ───────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#052117] text-brand-paper">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(50% 55% at 76% 46%, rgba(245,201,40,0.22), transparent 70%), radial-gradient(45% 55% at 6% 4%, rgba(77,165,105,0.30), transparent 70%), linear-gradient(180deg, #052117 0%, #0B3826 100%)',
        }}
      />
      <Honeycomb id="hex-hero" className="absolute -right-24 -top-16 -z-10 h-[760px] w-[900px] text-brand-yellow/[0.10] [mask-image:radial-gradient(closest-side,black_30%,transparent)]" />
      <Grain />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-14 pt-24 sm:gap-16 sm:px-6 sm:pt-36 lg:grid-cols-[1.2fr_0.8fr] lg:gap-4 lg:pb-24 lg:pt-40">
        <div>
          <p className="flex items-end gap-3 text-[15px] font-medium text-brand-paper/85 sm:text-[16px]">
            <CountTrail className="h-[30px] w-[82px] shrink-0 text-brand-leaf sm:h-[34px] sm:w-[92px]" />
            <span className="pb-[3px]">Bookkeeping for Nigerian shops</span>
          </p>
          <h1 className="mt-5 font-display text-[2.6rem] sm:mt-7 font-bold leading-[0.95] tracking-[-0.045em] sm:text-[4.4rem] lg:text-[4.6rem]">
            Tell it what you sold.
            <span className="mt-2 block">
              <span className="landing-honey">It keeps the books.</span>
            </span>
          </h1>
          <p className="mt-6 max-w-[33rem] text-[16px] leading-relaxed text-brand-paper/75 sm:mt-8 sm:text-[19px]">
            Type your sales, expenses and debts the way you&apos;d tell a friend. sabeebook writes them down,
            keeps track of who owes you, and shows the profit you&apos;re really making.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
            <PrimaryButton href="/signup" className="justify-between sm:justify-start">Start free for {TRIAL_DAYS} days</PrimaryButton>
            <a href="#how" className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-6 text-[15px] font-medium text-brand-paper/90 transition hover:bg-white/[0.12] sm:h-[52px]">
              See how it works
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-brand-paper/60 sm:mt-8 sm:gap-x-6 sm:text-[14px]">
            {['No card needed', 'Works in your phone’s browser', 'Every amount in naira'].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check size={15} weight="bold" className="text-brand-leaf" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[420px] lg:max-w-none">
          <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-yellow/25 blur-[110px]" />
          <FlightPath
            viewBox="0 0 320 200"
            d="M14 196 C 40 130, 130 170, 170 100 S 262 26, 300 30"
            beeAt={[300, 22]}
            beeSize={60}
            className="absolute -left-10 -top-24 hidden h-[200px] w-[320px] lg:block"
          />
          <div className="relative mx-auto w-[220px] [perspective:1800px] sm:w-[290px]">
            <div className="sm:[transform:rotateY(-13deg)_rotateX(5deg)_rotateZ(1.5deg)]">
              <Phone src={chat} priority alt="sabeebook's chat: the owner types 'Sold 2 bags of rice for 164k cash. Mama Tunde took 5 cartons of Indomie, 72,500, she'll pay Friday' and the assistant records both" />
            </div>

            <Glass className="landing-float absolute -left-14 -top-4 w-[196px] bg-[#0d3a28]/80 p-3 sm:-left-36 sm:top-14 sm:w-[220px] sm:p-3.5">
              <div className="flex items-center gap-2.5">
                <CheckCircle size={30} weight="fill" className="shrink-0 text-brand-leaf" />
                <div className="min-w-0">
                  <p className="text-[12px] text-brand-paper/60">Recorded · 2 bags of rice</p>
                  <p className="font-display text-[19px] font-bold tabular-nums">₦164,000</p>
                </div>
              </div>
            </Glass>

            <Glass className="landing-float-2 absolute -right-14 top-[63%] w-[206px] bg-[#0d3a28]/80 p-3 sm:-right-28 sm:top-[60%] sm:w-[228px] sm:p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-[12px] font-bold text-brand-black">MT</span>
                <div className="min-w-0">
                  <p className="text-[12px] text-brand-paper/60">Mama Tunde owes you</p>
                  <p className="whitespace-nowrap font-display text-[17px] font-bold tabular-nums">₦72,500 <span className="text-[12px] font-medium text-brand-yellow">· due Friday</span></p>
                </div>
              </div>
            </Glass>

            <Glass className="landing-float-3 absolute -bottom-12 -left-12 w-[176px] bg-[#0d3a28]/80 p-3.5 sm:-bottom-6 sm:-left-44 sm:w-[218px] sm:p-4">
              <p className="text-[12px] text-brand-paper/60">Profit this month</p>
              <p className="mt-0.5 font-display text-[24px] font-bold tabular-nums landing-honey">₦388,595</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[10%] rounded-full bg-brand-leaf" /></div>
              <p className="mt-1.5 text-[11px] text-brand-paper/55">You keep about ₦100 of every ₦1,000</p>
            </Glass>
          </div>
        </div>
      </div>

      <SayItStrip />
    </section>
  );
}

/** Things an owner can type, sliding past. */
function SayItStrip() {
  const lines = [
    'Sold 2 bags of rice for 164k cash',
    'Mama Tunde took Indomie on credit, she’ll pay Friday',
    'Paid shop rent, 150k',
    'Bought 20 cartons of Indomie for 240k',
    'Iya Bisi paid 32k of what she owes',
    'Who owes me money?',
    'How much did I make this month?',
    'Give me a receipt for Mama Tunde',
    'Fuel for the generator, 18k',
    'I counted 7 bags of rice on the shelf',
  ];
  return (
    <div className="relative border-t border-white/10 bg-black/20 py-5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 sm:px-6">
        <p className="hidden shrink-0 text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-yellow md:block">Say it your way</p>
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div className="landing-marquee flex w-max gap-3">
            {[...lines, ...lines].map((l, i) => (
              <span key={i} aria-hidden={i >= lines.length} className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-[14px] text-brand-paper/80">
                “{l}”
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── How it works ───────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { title: 'Tell it', body: 'One message for a whole morning’s sales is fine. Type it the way you’d say it.', img: stepSay, alt: 'An owner’s message and the assistant’s reply' },
    { title: 'It writes it down', body: 'Every sale, expense and debt lands in your book with the date, the customer and the amount.', img: stepList, alt: 'The list of recorded sales, each marked Paid' },
    { title: 'You see where you stand', body: 'Profit, sales, who owes you and what’s running low, on one screen and in plain words.', img: stepProfit, alt: 'The dashboard: profit this month, sales this month and active alerts' },
  ];
  return (
    <section id="how" className="relative scroll-mt-24 overflow-hidden">
      <Honeycomb id="hex-how" className="absolute inset-0 h-full w-full text-brand-green/[0.05] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-32">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div className="landing-rise">
            <Kicker>How it works</Kicker>
            <h2 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
              Three steps.<br />No accounting words.
            </h2>
          </div>
          <p className="landing-rise max-w-md text-[17px] leading-relaxed text-black/60 lg:justify-self-end">
            No ledgers to learn, no columns to fill. If you can send a text message, you can keep proper books.
          </p>
        </div>

        <div className="relative mt-10 md:mt-16">
          <FlightPath
            viewBox="0 0 1000 120"
            d="M70 70 C 200 -10, 300 140, 420 60 S 640 -10, 760 60 S 900 120, 960 40"
            beeAt={[968, 34]}
            stroke="#147A45"
            tone="light"
            className="absolute -top-10 left-0 hidden h-[120px] w-full md:block"
          />
          <ol className="relative grid items-start gap-4 md:grid-cols-3 md:gap-6">
            {steps.map((s, i) => (
              <li key={s.title} className={cn('landing-rise flex flex-col rounded-[28px] border border-black/[0.06] bg-white/80 p-5 shadow-[0_30px_60px_-40px_rgba(11,56,38,0.45)] sm:p-6', i === 1 && 'md:mt-14', i === 2 && 'md:mt-28')}>
                <div className="flex items-center gap-3">
                  <HexBadge className="h-12 w-[44px] text-brand-yellow">
                    <span className="font-display text-[17px] font-bold text-brand-black">{i + 1}</span>
                  </HexBadge>
                  <h3 className="font-display text-[22px] font-bold tracking-[-0.02em]">{s.title}</h3>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-black/60">{s.body}</p>
                <Snip src={s.img} alt={s.alt} className="mt-5 rounded-[18px]" />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ── Features: a bento of four ──────────────────────────────

function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 pb-16 sm:pb-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="landing-rise max-w-2xl">
          <Kicker>What it does for you</Kicker>
          <h2 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            Your whole shop, in one book.
          </h2>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-12">
          {/* Debts */}
          <article className="landing-rise relative isolate overflow-hidden rounded-[32px] bg-[#0B3826] p-7 text-brand-paper sm:min-h-[560px] sm:p-9 lg:col-span-7">
            <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(60% 60% at 90% 100%, rgba(245,201,40,0.20), transparent 70%)' }} />
            <Honeycomb id="hex-debts" className="absolute -right-10 bottom-0 -z-10 h-[420px] w-[520px] text-brand-yellow/[0.08] [mask-image:radial-gradient(closest-side,black,transparent)]" />
            <Grain />
            <div className="max-w-[19rem] sm:max-w-[16.5rem] lg:max-w-[17.5rem]">
              <Kicker tone="honey">Money owed to you</Kicker>
              <h3 className="mt-3 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[2.4rem]">Know who owes you, and since when.</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-brand-paper/70">
                Record a credit sale in one line. sabeebook follows every part-payment and reminds you when a debt is overdue, so
                nobody&apos;s ₦148,000 quietly becomes a gift.
              </p>
            </div>
            <div className="mt-8 h-[300px] overflow-hidden sm:absolute sm:-bottom-24 sm:right-8 sm:mt-0 sm:h-auto sm:w-[250px] sm:overflow-visible lg:right-10 lg:w-[270px]">
              <Phone src={alerts} alt="Alerts: Alhaji Musa owes ₦148,000 that was due on 14 Oct; sugar is out of stock; a ₦25,000 bill to Mr. Femi is due" time="08:06" className="mx-auto w-[240px] sm:w-full" />
            </div>
            <Glass className="relative z-10 -mt-14 w-full max-w-[290px] p-4 sm:absolute sm:bottom-10 sm:left-9 sm:mt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold">Iya Bisi</p>
                <p className="text-[12px] text-brand-paper/60">3 cartons of Peak milk</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[44%] rounded-full bg-gradient-to-r from-brand-leaf to-brand-yellow" />
              </div>
              <div className="mt-2 flex justify-between text-[12px] tabular-nums">
                <span className="text-brand-paper/70">Paid ₦32,000</span>
                <span className="font-semibold text-brand-yellow">₦40,000 still owed</span>
              </div>
            </Glass>
          </article>

          {/* Receipts */}
          <article className="landing-rise relative isolate overflow-hidden rounded-[32px] bg-brand-yellow p-7 text-brand-black sm:p-9 lg:col-span-5 lg:min-h-[560px]">
            <Honeycomb id="hex-receipts" className="absolute inset-0 -z-10 h-full w-full text-[#B8860B]/[0.18] [mask-image:linear-gradient(to_top,black,transparent_75%)]" />
            <Kicker>Receipts &amp; invoices</Kicker>
            <h3 className="mt-3 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[2.4rem]">A proper receipt, ready for WhatsApp.</h3>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-black/70">
              Ask for one in the chat or tap any sale. Share it as a PDF, or print it. Your logo and signature on a paid plan.
            </p>
            <div className="relative mx-auto mt-8 w-[230px] sm:w-[250px]">
              <div className="rotate-[-4deg] shadow-[0_40px_60px_-24px_rgba(17,23,19,0.55)]">
                <Snip src={invoice} alt="The invoice sabeebook made for Mama Tunde: Amaka Provisions, 5 cartons of Indomie, ₦72,500, balance due" sizes="260px" className="rounded-2xl bg-white" />
              </div>
              <div className="absolute -right-4 bottom-10 flex items-center gap-2 rounded-full bg-brand-black px-4 py-2.5 text-[13px] font-semibold text-brand-paper shadow-xl sm:-right-12">
                <ShareNetwork size={16} weight="bold" className="text-brand-yellow" /> Share PDF
              </div>
            </div>
          </article>

          {/* Profit */}
          <article className="landing-rise relative overflow-hidden rounded-[32px] border border-black/[0.06] bg-white p-7 sm:p-9 lg:col-span-5 lg:min-h-[500px]">
            <Kicker>Real profit</Kicker>
            <h3 className="mt-3 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[2.4rem]">Profit on what you actually sold.</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-black/60">
              Sales, minus what those goods cost you, minus rent, fuel and salaries. Then it tells you what&apos;s eating it.
            </p>
            <div className="mx-auto mt-7 max-w-[440px] overflow-hidden rounded-[22px] bg-[#09090b] shadow-[0_30px_60px_-30px_rgba(11,56,38,0.6)]">
              <div className="relative h-[270px] overflow-hidden">
                <Image src={profit} alt="The profit page: ₦388,595 profit so far in October, and what it's made of" placeholder="blur" sizes="(min-width: 1024px) 420px, 90vw" className="absolute inset-x-0 -top-[21%] h-auto w-full" />
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#09090b] to-transparent" />
              </div>
            </div>
          </article>

          {/* Stock */}
          <article className="landing-rise relative isolate overflow-hidden rounded-[32px] bg-brand-black p-7 text-brand-paper sm:min-h-[480px] sm:p-9 lg:col-span-7 lg:min-h-[500px]">
            <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(55% 70% at 15% 100%, rgba(77,165,105,0.25), transparent 70%)' }} />
            <Grain />
            <div className="max-w-[19rem] sm:max-w-[17rem] lg:max-w-[19rem]">
              <Kicker tone="honey">Stock</Kicker>
              <h3 className="mt-3 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[2.4rem]">Your shelf, counted as you sell.</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-brand-paper/65">
                Sales take goods off the shelf and restocks put them back. You&apos;ll know sugar is finished before a customer asks for it.
              </p>
              <Glass className="mt-7 inline-flex items-center gap-3 p-3.5 pr-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9472F]/90"><Warning size={18} weight="fill" /></span>
                <div>
                  <p className="text-[13px] font-semibold">Sugar, 50kg bag</p>
                  <p className="text-[12px] text-brand-paper/60">Out of stock · 0 bags</p>
                </div>
              </Glass>
            </div>
            <div className="mt-8 h-[300px] overflow-hidden sm:absolute sm:-bottom-0 sm:right-10 sm:mt-0 sm:h-[400px] sm:w-[240px] lg:w-[250px]">
              <Phone src={stock} alt="The stock list: six products with how many are left, sugar out of stock" className="mx-auto w-[230px] sm:mt-10 sm:w-full" />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

// ── One message ────────────────────────────────────────────

function OneMessage() {
  return (
    <section className="relative isolate overflow-hidden bg-brand-yellow">
      <Honeycomb id="hex-honey" className="absolute inset-0 -z-10 h-full w-full text-[#B8860B]/[0.22] [mask-image:radial-gradient(70%_90%_at_80%_50%,black,transparent)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="landing-rise">
          <h2 className="font-display text-[2.6rem] font-bold leading-[0.98] tracking-[-0.045em] text-brand-black sm:text-[4.4rem]">
            One message can hold a whole day&apos;s sales.
          </h2>
          <Link href="/signup" className="group mt-8 inline-flex h-[52px] items-center gap-2 rounded-full bg-brand-black pl-6 pr-2 text-[15px] font-semibold text-brand-yellow transition hover:bg-[#1d2620]">
            Try it free for {TRIAL_DAYS} days
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-yellow text-brand-black transition group-hover:translate-x-0.5">
              <ArrowRight size={16} weight="bold" />
            </span>
          </Link>
        </div>
        <div className="landing-rise relative">
          <div className="ml-auto max-w-[360px] rounded-[22px] rounded-br-md bg-brand-black px-5 py-4 text-[16px] leading-relaxed text-brand-paper shadow-[0_30px_50px_-24px_rgba(17,23,19,0.6)]">
            Sold rice 82k, 2 cartons of milk 48k, Semovita 16.5k. Iya Bisi took a keg of oil on credit, 78k.
          </div>
          <div className="mt-3 flex max-w-[360px] items-start gap-3 rounded-[22px] rounded-bl-md bg-white/70 px-5 py-4 text-[15px] leading-relaxed text-brand-black shadow-[0_24px_40px_-24px_rgba(17,23,19,0.4)] backdrop-blur">
            <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-brand-green" />
            <span>Four entries, each in its place: three sales, and Iya Bisi&apos;s ₦78,000 on credit.</span>
          </div>
          <p className="mt-4 text-[13px] text-black/55">An example of how you can write. The assistant records each item separately.</p>
        </div>
      </div>
    </section>
  );
}

// ── Phone and laptop ───────────────────────────────────────

function BothPlaces() {
  const reports = [
    ['Profit & Loss', 'What you earned, spent and kept'],
    ['Credit Report', 'Who owes you, and how late'],
    ['Stock Report', 'What’s on your shelves'],
  ];
  return (
    <section className="relative isolate overflow-hidden bg-[#052117] text-brand-paper">
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(50% 45% at 50% 75%, rgba(245,201,40,0.18), transparent 70%), linear-gradient(180deg,#052117,#0B3826)' }} />
      <Grain />
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-32">
        <div className="landing-rise mx-auto max-w-3xl text-center">
          <Kicker tone="honey">Phone and laptop</Kicker>
          <h2 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            On your phone at the shop. On the laptop at home.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-brand-paper/65">
            The same books in both places. When the bank or your accountant asks, download a report as a PDF.
          </p>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl sm:mt-16">
          <div className="w-[175%] [perspective:2200px] sm:w-full">
            <div className="landing-rise [transform:rotateX(9deg)] [transform-origin:50%_100%]">
              <Laptop src={desk} alt="sabeebook on a laptop: Amaka Provisions' dashboard with profit, sales, alerts and recent sales" />
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3 lg:absolute lg:-bottom-6 lg:left-1/2 lg:mt-0 lg:w-[880px] lg:-translate-x-1/2">
            {reports.map(([t, d]) => (
              <Glass key={t} className="flex items-center gap-3 p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-yellow text-brand-black"><FilePdf size={20} weight="fill" /></span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{t}</p>
                  <p className="text-[12px] text-brand-paper/60">{d}</p>
                </div>
              </Glass>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Smaller features ───────────────────────────────────────

function SmallThings() {
  const items: [ReactNode, string, string][] = [
    [<FileArrowUp key="i" size={22} weight="bold" />, 'Bring your old records', 'Import sales and expenses from an Excel or CSV file in a few taps.'],
    [<UsersThree key="i" size={22} weight="bold" />, 'Staff and salaries', 'Keep a staff list, get a reminder on pay day, and record salaries in one go.'],
    [<Storefront key="i" size={22} weight="bold" />, 'More than one shop', 'Run up to three shops from one account, each with its own books.'],
    [<PencilSimple key="i" size={22} weight="bold" />, 'Fix anything by saying so', '“That was 700, not 650.” Or edit the entry yourself.'],
    [<ArrowsClockwise key="i" size={22} weight="bold" />, 'Part-payments, done right', 'Every payment towards a debt, with its date. The balance is always right.'],
    [<Lock key="i" size={22} weight="bold" />, 'Your records stay yours', 'Only you can see your shop’s sales, customers and debts.'],
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-32">
        <div className="landing-rise max-w-2xl">
          <Kicker>And more</Kicker>
          <h2 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.04em] sm:text-6xl">The small things that save you time.</h2>
        </div>
        <div className="mt-10 divide-y divide-black/[0.06] overflow-hidden rounded-[26px] border border-black/[0.06] bg-white/80 sm:mt-14 sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent lg:grid-cols-3">
          {items.map(([icon, t, d]) => (
            <div key={t} className="landing-rise group flex gap-4 p-5 sm:block sm:rounded-[26px] sm:border sm:border-black/[0.06] sm:bg-white/70 sm:p-6 sm:shadow-[0_24px_50px_-40px_rgba(11,56,38,0.5)] sm:transition sm:hover:-translate-y-1 sm:hover:bg-white">
              <HexBadge className="h-11 w-10 text-[#0B3826] sm:h-14 sm:w-[52px]"><span className="text-brand-yellow">{icon}</span></HexBadge>
              <div>
                <h3 className="font-display text-[19px] font-bold tracking-[-0.02em] sm:mt-5 sm:text-[20px]">{t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-black/60 sm:mt-2">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="relative isolate scroll-mt-24 overflow-hidden bg-[#052117] text-brand-paper">
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(40% 50% at 50% 55%, rgba(245,201,40,0.16), transparent 70%), radial-gradient(40% 50% at 0% 0%, rgba(77,165,105,0.25), transparent 70%), linear-gradient(180deg,#0B3826,#052117)' }} />
      <Honeycomb id="hex-price" className="absolute -left-20 top-0 -z-10 h-[600px] w-[700px] text-brand-yellow/[0.07] [mask-image:radial-gradient(closest-side,black,transparent)]" />
      <Grain />
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-32">
        <div className="landing-rise mx-auto max-w-2xl text-center">
          <Kicker tone="honey">Pricing</Kicker>
          <h2 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.04em] sm:text-6xl">Simple prices, in naira.</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-brand-paper/65">
            Every new account gets {TRIAL_DAYS} days of everything free, with 40 messages to the assistant. No card needed to start.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-md items-stretch gap-4 sm:mt-16 lg:max-w-none lg:grid-cols-3 lg:gap-5">
          <Plan name="Free" className="order-last lg:order-none" price="₦0" note="For writing your book yourself" points={['Record sales, expenses and debts', 'Receipts and invoices, with a small “Made with sabeebook” line', 'One shop']} />
          <Plan
            featured
            className="order-first lg:order-none"
            name="Monthly"
            price="₦5,000"
            per="/ month"
            note="About ₦167 a day"
            points={[
              'The assistant: 6 messages a day, and one message can hold a whole day’s sales',
              'Profit & Loss, credit and stock reports',
              'Your logo and signature on receipts',
              'Overdue-debt emails, staff and salaries, Excel import',
              'Up to 3 shops',
            ]}
          />
          <Plan name="Yearly" price="₦50,000" per="/ year" note="About ₦137 a day: two months free" points={['Everything in Monthly, for a whole year', 'One payment, then nothing to renew until next year']} />
        </div>
        <p className="mt-6 text-center text-[14px] text-brand-paper/50 lg:mt-8">Pay with Paystack. If you stop paying, your records stay and you move to the free plan.</p>
      </div>
    </section>
  );
}

function Plan({ name, price, per, note, points, featured, className }: {
  name: string; price: string; per?: string; note: string; points: string[]; featured?: boolean; className?: string;
}) {
  return (
    <div className={cn('landing-rise relative', className)}>
      {featured && <div aria-hidden className="absolute -inset-px rounded-[30px] bg-gradient-to-b from-brand-yellow via-brand-yellow/40 to-transparent" />}
      <div className={cn(
        'relative flex h-full flex-col rounded-[29px] p-7 backdrop-blur-xl sm:p-8',
        featured ? 'bg-[#0d3a28]/95 shadow-[0_40px_80px_-30px_rgba(245,201,40,0.35)]' : 'border border-white/[0.12] bg-white/[0.06]',
      )}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[22px] font-bold">{name}</h3>
          {featured && <span className="rounded-full bg-brand-yellow px-3 py-1 text-[12px] font-bold text-brand-black">Most shops</span>}
        </div>
        <p className="mt-6 flex items-baseline gap-1.5">
          <span className={cn('font-display text-[3rem] font-bold leading-none tracking-[-0.04em]', featured && 'landing-honey')}>{price}</span>
          {per && <span className="text-[15px] text-brand-paper/55">{per}</span>}
        </p>
        <p className="mt-2 text-[14px] text-brand-paper/55">{note}</p>
        <ul className="mt-7 flex-1 space-y-3.5 border-t border-white/10 pt-7">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px] leading-snug text-brand-paper/85">
              <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', featured ? 'bg-brand-yellow text-brand-black' : 'bg-white/10 text-brand-leaf')}>
                <Check size={12} weight="bold" />
              </span>
              {p}
            </li>
          ))}
        </ul>
        {featured
          ? <PrimaryButton href="/signup" className="mt-9 justify-between">Start {TRIAL_DAYS} days free</PrimaryButton>
          : (
            <Link href="/signup" className="mt-9 inline-flex h-[52px] items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[15px] font-semibold text-brand-paper transition hover:bg-white/[0.12]">
              {name === 'Free' ? 'Start free' : `Start ${TRIAL_DAYS} days free`}
            </Link>
          )}
      </div>
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
    <section id="questions" className="relative scroll-mt-24 overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:gap-14 sm:px-6 sm:py-32 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="landing-rise lg:sticky lg:top-28 lg:self-start">
          <Kicker>Questions</Kicker>
          <h2 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.04em] sm:text-6xl">What owners ask first.</h2>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-black/60">
            Still unsure? Try it with your own shop for {TRIAL_DAYS} days. It costs nothing, and there&apos;s no card to enter.
          </p>
          <Bee className="mt-10 hidden w-28 lg:block" />
        </div>
        <div className="space-y-3">
          {qs.map(([q, a]) => (
            <details key={q} className="landing-rise group rounded-[22px] border border-black/[0.06] bg-white/75 px-6 shadow-[0_20px_40px_-36px_rgba(11,56,38,0.5)] open:bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-[18px] font-bold tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B3826] transition group-open:rotate-45">
                  <span className="absolute h-[2px] w-3.5 rounded bg-brand-yellow" />
                  <span className="absolute h-3.5 w-[2px] rounded bg-brand-yellow" />
                </span>
              </summary>
              <p className="pb-6 pr-10 text-[15px] leading-relaxed text-black/65">{a}</p>
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
    <section className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="relative isolate mx-auto max-w-[1400px] overflow-hidden rounded-[36px] bg-[#052117] text-brand-paper">
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(45% 70% at 78% 60%, rgba(245,201,40,0.25), transparent 70%), radial-gradient(40% 60% at 0% 0%, rgba(77,165,105,0.3), transparent 70%), linear-gradient(160deg,#0B3826,#052117)' }} />
        <Honeycomb id="hex-final" className="absolute -left-10 bottom-0 -z-10 h-[500px] w-[600px] text-brand-yellow/[0.07] [mask-image:radial-gradient(closest-side,black,transparent)]" />
        <Grain />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:px-10 sm:py-24 lg:grid-cols-2">
          <div className="landing-rise">
            <h2 className="font-display text-[2.7rem] font-bold leading-[0.98] tracking-[-0.045em] sm:text-[4.2rem]">
              Close today&apos;s books <span className="landing-honey">in one message.</span>
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-brand-paper/70">
              Start with {TRIAL_DAYS} days of everything. If it doesn&apos;t save you time, it costs you nothing.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <PrimaryButton href="/signup">Start free</PrimaryButton>
              <Link href="/login" className="inline-flex h-[52px] items-center rounded-full border border-white/15 bg-white/[0.06] px-6 text-[15px] font-medium text-brand-paper/90 transition hover:bg-white/[0.12]">
                Sign in
              </Link>
            </div>
          </div>
          <MarketStall className="landing-rise mx-auto h-auto w-full max-w-[520px]" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="text-black/55">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-[14px] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#052117] px-3.5 py-2"><BrandLogo className="w-[96px]" /></span>
          <span className="hidden text-black/45 sm:inline">Easy bookkeeping for busy people.</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#how" className="hover:text-black">How it works</a>
          <a href="#pricing" className="hover:text-black">Pricing</a>
          <a href="#questions" className="hover:text-black">Questions</a>
          <Link href="/login" className="hover:text-black">Sign in</Link>
        </nav>
        <p className="text-black/40">© {new Date().getFullYear()} sabeebook</p>
      </div>
    </footer>
  );
}
