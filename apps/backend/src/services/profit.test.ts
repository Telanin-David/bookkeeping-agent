import { buildInsights, amount, previousMonth, type ProfitFigures } from './profit';
import { payDateIn, currentPayDate } from './staff';

const figures = (f: Partial<ProfitFigures>): ProfitFigures => {
  const base: ProfitFigures = {
    from: '2026-09-01', to: '2026-09-15', sales: 0, salesCount: 0, coverage: null, costOfGoodsSold: null,
    stockBought: 0, runningCosts: 0, running: [], method: 'spent', profit: 0, profitSold: null, profitSpent: 0, ...f,
  };
  base.runningCosts = f.runningCosts ?? base.running.reduce((s, l) => s + l.total, 0);
  base.profitSpent = f.profitSpent ?? base.sales - base.stockBought - base.runningCosts;
  base.profit = f.profit ?? (base.method === 'sold' ? base.profitSold! : base.profitSpent);
  return base;
};

const texts = (xs: { text: string }[]) => xs.map((x) => x.text);

describe('buildInsights', () => {
  const common = { month: '2026-09', inProgress: true, salariesDue: null, currency: 'NGN' };

  it('says nothing is recorded yet for an empty month', () => {
    expect(texts(buildInsights({ ...common, current: figures({}), before: null }))).toEqual(['Nothing recorded for this month yet.']);
  });

  it('compares with last month at the same point, and gives the margin', () => {
    const current = figures({ sales: 200000, running: [{ category: 'Rent', total: 50000, count: 1 }, { category: 'Fuel', total: 30000, count: 3 }] });
    const before = figures({ sales: 150000, running: [{ category: 'Rent', total: 50000, count: 1 }, { category: 'Fuel', total: 25000, count: 3 }] });
    const out = buildInsights({ ...common, current, before });
    expect(out[0]).toEqual({ kind: 'vs_last_month', tone: 'good', text: '₦45,000 better than at this point last month.' });
    expect(texts(out)).toContain('Out of every ₦1,000 you sell, you keep about ₦600.');
    expect(texts(out)).toContain('Your biggest running cost is Rent: ₦50,000 (63% of running costs).');
  });

  it('names a running cost that has shot up, but not a new one', () => {
    const current = figures({ sales: 100000, running: [{ category: 'Fuel', total: 60000, count: 4 }, { category: 'Rent', total: 40000, count: 1 }] });
    const before = figures({ sales: 100000, running: [{ category: 'fuel', total: 20000, count: 2 }] });
    const out = buildInsights({ ...common, current, before });
    expect(out.find((i) => i.kind === 'rising_cost')?.text).toBe('Fuel is up: ₦60,000, from ₦20,000 at this point last month.');
    expect(out.find((i) => i.kind === 'vs_last_month')?.tone).toBe('bad');
  });

  it('uses the full previous month once a month is over', () => {
    const out = buildInsights({ ...common, inProgress: false, current: figures({ sales: 1000 }), before: figures({ sales: 1000 }) });
    expect(out[0]!.text).toBe('About the same as in August.');
  });

  it('only mentions salaries when there are staff with pay still owed', () => {
    const current = figures({ sales: 100000, running: [{ category: 'Rent', total: 20000, count: 1 }] });
    const none = buildInsights({ ...common, current, before: null });
    expect(none.some((i) => i.kind === 'salaries_due')).toBe(false);
    const owed = buildInsights({ ...common, current, before: null, salariesDue: { total: 100000, people: [{ name: 'Ada' }] } });
    expect(owed.find((i) => i.kind === 'salaries_due')).toEqual({
      kind: 'salaries_due', tone: 'bad', text: "Salaries still to pay this month: ₦100,000. After paying them, you'd be ₦20,000 short.",
    });
  });

  it('suggests recording running costs only when there are sales and none at all', () => {
    const out = buildInsights({ ...common, current: figures({ sales: 50000 }), before: null });
    expect(out.some((i) => i.kind === 'no_running_costs')).toBe(true);
    const withRent = buildInsights({ ...common, current: figures({ sales: 50000, running: [{ category: 'Rent', total: 1, count: 1 }] }), before: null });
    expect(withRent.some((i) => i.kind === 'no_running_costs')).toBe(false);
  });

  it('explains stock still on the shelf when profit is counted on what was sold', () => {
    const current = figures({ sales: 100000, stockBought: 80000, method: 'sold', costOfGoodsSold: 60000, profitSold: 40000, coverage: 1 });
    const out = buildInsights({ ...common, current, before: null });
    expect(out.find((i) => i.kind === 'stock_on_shelf')?.text)
      .toBe("You bought ₦80,000 of stock and sold goods that cost ₦60,000. The rest is on your shelf, so it isn't counted as a cost yet.");
  });

  it('compares months the same way even if last month could only be counted roughly', () => {
    const current = figures({ sales: 100000, method: 'sold', costOfGoodsSold: 50000, profitSold: 50000, coverage: 1, stockBought: 0 });
    const before = figures({ sales: 100000, stockBought: 90000, costOfGoodsSold: 50000, profitSold: 50000, coverage: 0.5 });
    expect(buildInsights({ ...common, current, before })[0]!.text).toBe('About the same as at this point last month.');
  });
});

describe('money and months', () => {
  it('writes whole amounts without kobo', () => {
    expect(amount(45000, 'NGN')).toBe('₦45,000');
    expect(amount(45000.4, 'NGN')).toBe('₦45,000');
    expect(amount(12.5, 'NGN')).toBe('₦12.50');
    expect(amount(90, 'NGN')).toBe('₦90');
  });

  it('steps back a month across the year', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(previousMonth('2026-10')).toBe('2026-09');
  });
});

describe('pay dates', () => {
  it('uses the last day of shorter months', () => {
    expect(payDateIn(2026, 2, 30)).toBe('2026-02-28');
    expect(payDateIn(2028, 2, 31)).toBe('2028-02-29');
    expect(payDateIn(2026, 9, 25)).toBe('2026-09-25');
  });

  it("watches this month's pay date from the day before, last month's until then", () => {
    expect(currentPayDate(25, '2026-09-23')).toBe('2026-08-25');
    expect(currentPayDate(25, '2026-09-24')).toBe('2026-09-25');
    expect(currentPayDate(25, '2026-09-30')).toBe('2026-09-25');
    expect(currentPayDate(28, '2026-01-05')).toBe('2025-12-28');
    expect(currentPayDate(1, '2026-09-29')).toBe('2026-09-01');
    expect(currentPayDate(1, '2026-09-30')).toBe('2026-10-01');
    expect(currentPayDate(1, '2026-12-31')).toBe('2027-01-01');
    expect(currentPayDate(1, '2026-10-01')).toBe('2026-10-01');
  });
});
