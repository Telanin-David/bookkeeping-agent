import ExcelJS from 'exceljs';
import {
  checkRows, detectKind, detectMonthFirst, guessMapping, mappingProblem, parseAmount, parseCsv, parseDate, parsePaid, parseType,
  readSheet, toSheet,
} from './importParse';

describe('parseDate', () => {
  it('reads day-first dates, as written in Nigeria', () => {
    expect(parseDate('25/09/2026')).toBe('2026-09-25');
    expect(parseDate('5/9/26')).toBe('2026-09-05');
    expect(parseDate('25-09-2026')).toBe('2026-09-25');
    expect(parseDate('25.09.2026')).toBe('2026-09-25');
  });
  it('reads month-first when the column says so', () => {
    expect(parseDate('09/25/2026', true)).toBe('2026-09-25');
  });
  it('reads ISO, month names and ordinals', () => {
    expect(parseDate('2026-09-25')).toBe('2026-09-25');
    expect(parseDate('2026-09-25T00:00:00')).toBe('2026-09-25');
    expect(parseDate('25 Sept 2026')).toBe('2026-09-25');
    expect(parseDate('25-Sep-26')).toBe('2026-09-25');
    expect(parseDate('Sep 25, 2026')).toBe('2026-09-25');
    expect(parseDate('1st October 2026')).toBe('2026-10-01');
  });
  it('reads Excel dates and date serials', () => {
    expect(parseDate(new Date(Date.UTC(2026, 8, 25)))).toBe('2026-09-25');
    expect(parseDate(46290)).toBe('2026-09-25');
  });
  it('refuses impossible or unreadable dates', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('yesterday')).toBeNull();
    expect(parseDate(5)).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe('detectMonthFirst', () => {
  it('defaults to day first, switches only on clear evidence', () => {
    expect(detectMonthFirst(['05/09/2026', '06/09/2026'])).toBe(false);
    expect(detectMonthFirst(['09/05/2026', '09/25/2026'])).toBe(true);
    expect(detectMonthFirst(['25/09/2026', '09/25/2026'])).toBe(false); // mixed: stay day first
  });
});

describe('parseAmount', () => {
  it('reads the ways people write money', () => {
    expect(parseAmount(5000)).toBe(5000);
    expect(parseAmount('5,000')).toBe(5000);
    expect(parseAmount('₦5,000.50')).toBe(5000.5);
    expect(parseAmount('NGN 12000')).toBe(12000);
    expect(parseAmount('N5000')).toBe(5000);
    expect(parseAmount('5k')).toBe(5000);
    expect(parseAmount('2.5K')).toBe(2500);
    expect(parseAmount('1.2m')).toBe(1_200_000);
    expect(parseAmount('(1,000)')).toBe(-1000);
    expect(parseAmount('-750')).toBe(-750);
  });
  it('refuses text that isn\'t an amount', () => {
    expect(parseAmount('five thousand')).toBeNull();
    expect(parseAmount('5,00')).toBeNull();
    expect(parseAmount('12-3')).toBeNull();
  });
});

describe('parseType', () => {
  it('understands everyday words', () => {
    expect(parseType('Sale')).toBe('sale');
    expect(parseType('sold')).toBe('sale');
    expect(parseType('Expense')).toBe('expense');
    expect(parseType('bought')).toBe('expense');
    expect(parseType('credit sale')).toBe('receivable');
    expect(parseType('owed')).toBe('receivable');
    expect(parseType('Bill')).toBe('payable');
    expect(parseType('banana')).toBeNull();
  });
});

describe('parsePaid', () => {
  it('reads yes/no and amounts paid', () => {
    expect(parsePaid('Yes', 20000)).toBe(20000);
    expect(parsePaid('paid', 20000)).toBe(20000);
    expect(parsePaid('no', 20000)).toBe(0);
    expect(parsePaid(null, 20000)).toBe(0);
    expect(parsePaid('5,000', 20000)).toBe(5000);
    expect(parsePaid(25000, 20000)).toBeNull();
    expect(parsePaid('maybe', 20000)).toBeNull();
  });
});

describe('guessMapping', () => {
  it('matches common header names', () => {
    expect(guessMapping(['Date', 'Item', 'Amount (₦)', 'Customer', 'Type'])).toEqual({
      date: 'Date', description: 'Item', amount: 'Amount (₦)', counterparty: 'Customer', type: 'Type',
    });
  });
  it('uses money in / out columns and assumes sales when nothing says otherwise', () => {
    expect(guessMapping(['Date', 'Narration', 'Money In', 'Money Out'])).toEqual({
      date: 'Date', description: 'Narration', moneyIn: 'Money In', moneyOut: 'Money Out',
    });
    expect(guessMapping(['Date', 'Product', 'Total'])).toMatchObject({ defaultType: 'sale' });
  });
});

describe('parseCsv and toSheet', () => {
  it('handles quotes, commas in values, CRLF, a BOM and a title row', () => {
    const grid = parseCsv('﻿SALES BOOK 2026\r\nDate,Item,Amount\r\n25/09/2026,"Rice, 2 bags","₦136,000"\r\n\r\n26/09/2026,"Say ""hi""",500\r\n');
    const sheet = toSheet(grid);
    expect(sheet.headers).toEqual(['Date', 'Item', 'Amount']);
    expect(sheet.rows.map((r) => r.cells)).toEqual([['25/09/2026', 'Rice, 2 bags', '₦136,000'], ['26/09/2026', 'Say "hi"', '500']]);
    expect(sheet.rows[0]!.rowNumber).toBe(3);
  });
  it('reads semicolon CSVs (Excel in some regions)', () => {
    expect(toSheet(parseCsv('Date;Amount\n25/09/2026;500\n')).rows[0]!.cells).toEqual(['25/09/2026', '500']);
  });
  it('names blank and repeated headers', () => {
    expect(toSheet(parseCsv('Date,,Amount,Amount\n1,2,3,4\n')).headers).toEqual(['Date', 'Column 2', 'Amount', 'Amount (2)']);
  });
});

describe('detectKind', () => {
  it('goes by the bytes, not the name', () => {
    expect(detectKind(Buffer.from('PK\u0003\u0004rest'))).toBe('xlsx');
    expect(detectKind(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]))).toBe('xls');
    expect(detectKind(Buffer.from('Date,Amount\n'))).toBe('csv');
    expect(detectKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBeNull();
  });
});

describe('readSheet (xlsx)', () => {
  it('reads real Excel cells: dates, numbers, formulas, rich text', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sales');
    ws.addRow(['Date', 'Item', 'Amount']);
    ws.addRow([new Date(Date.UTC(2026, 8, 25)), { richText: [{ text: 'Rice ' }, { text: '50kg' }] }, 68000]);
    ws.addRow([new Date(Date.UTC(2026, 8, 26)), 'Beans', { formula: '2*30000', result: 60000 }]);
    const sheet = await readSheet(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(sheet.headers).toEqual(['Date', 'Item', 'Amount']);
    const res = checkRows(sheet, guessMapping(sheet.headers), '2026-09-27');
    expect(res.valid.map((r) => [r.date, r.description, r.amount, r.type])).toEqual([
      ['2026-09-25', 'Rice 50kg', 68000, 'sale'], ['2026-09-26', 'Beans', 60000, 'sale'],
    ]);
  });
  it('refuses old .xls files with a way forward', async () => {
    await expect(readSheet(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]))).rejects.toThrow(/save it as \.xlsx/);
  });
});

describe('checkRows', () => {
  const sheet = toSheet(parseCsv([
    'Date,Details,Amount,Type,Customer,Due',
    '25/09/2026,Rice,68000,sale,,',
    '24/09/2026,Beans on credit,"₦20,000",credit sale,Mama Nkechi,30/09/2026',
    '23/09/2026,Diesel,7800,expense,,',
    'soon,Oil,500,sale,,',
    '22/09/2026,Salt,abc,sale,,',
    '21/09/2026,Mystery,100,gift,,',
    '01/10/2027,Future,100,sale,,',
    ',Subtotal,,,,',
    '20/09/2026,Refund,-100,sale,,',
  ].join('\n')));
  const mapping = guessMapping(sheet.headers);

  it('guesses the mapping for this file', () => {
    expect(mapping).toMatchObject({ date: 'Date', description: 'Details', amount: 'Amount', type: 'Type', counterparty: 'Customer', dueDate: 'Due' });
    expect(mappingProblem(mapping, sheet.headers)).toBeNull();
  });

  it('keeps good rows and explains the bad ones by row number', () => {
    const res = checkRows(sheet, mapping, '2026-09-27');
    expect(res.valid.map((r) => [r.rowNumber, r.type, r.amount, r.date, r.counterparty, r.dueDate])).toEqual([
      [2, 'sale', 68000, '2026-09-25', undefined, undefined],
      [3, 'receivable', 20000, '2026-09-24', 'Mama Nkechi', '2026-09-30'],
      [4, 'expense', 7800, '2026-09-23', undefined, undefined],
    ]);
    expect(res.problems.map((p) => [p.row, p.field])).toEqual([
      [5, 'date'], [6, 'amount'], [7, 'type'], [8, 'date'], [10, 'amount'],
    ]);
    expect(res.problems[2]!.message).toContain('"gift" isn\'t a type we know');
    expect(res.skippedEmpty).toBe(1);
  });

  it('reads positive as money in and negative as money out when asked', () => {
    const s = toSheet(parseCsv('Date,Amount\n25/09/2026,500\n25/09/2026,-200\n'));
    const res = checkRows(s, { date: 'Date', amount: 'Amount', defaultType: 'sign' }, '2026-09-27');
    expect(res.valid.map((r) => [r.type, r.amount])).toEqual([['sale', 500], ['expense', 200]]);
  });

  it('reads how much of a credit sale was already paid', () => {
    const s = toSheet(parseCsv('Date,Amount,Type,Paid?\n20/09/2026,20000,credit sale,yes\n21/09/2026,20000,credit sale,5000\n22/09/2026,20000,credit sale,\n23/09/2026,500,sale,yes\n24/09/2026,100,bill,lots\n'));
    const res = checkRows(s, guessMapping(s.headers), '2026-09-27');
    expect(res.valid.map((r) => [r.type, r.paid])).toEqual([['receivable', 20000], ['receivable', 5000], ['receivable', 0], ['sale', undefined]]);
    expect(res.problems.map((p) => [p.row, p.field])).toEqual([[6, 'paid']]);
  });

  it('reads Money in / Money out columns', () => {
    const s = toSheet(parseCsv('Date,Money in,Money out\n25/09/2026,500,\n25/09/2026,,200\n25/09/2026,5,5\n'));
    const res = checkRows(s, guessMapping(s.headers), '2026-09-27');
    expect(res.valid.map((r) => [r.type, r.amount])).toEqual([['sale', 500], ['expense', 200]]);
    expect(res.problems[0]!.message).toContain('both money in and money out');
  });

  it('flags a mapping that can\'t work', () => {
    expect(mappingProblem({ amount: 'Amount', defaultType: 'sale' }, ['Amount'])).toMatch(/date/);
    expect(mappingProblem({ date: 'Date', amount: 'Date', defaultType: 'sale' }, ['Date'])).toMatch(/same column/);
    expect(mappingProblem({ date: 'Nope', amount: 'Amount' }, ['Date', 'Amount'])).toMatch(/no column called "Nope"/);
  });
});
