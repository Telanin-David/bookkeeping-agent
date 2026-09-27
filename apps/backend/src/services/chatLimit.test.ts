jest.mock('./db');

import * as db from './db';
import { config } from '../config';
import { getDailyUsage, limitReachedMessage } from './chatLimit';

const mockDb = db as jest.Mocked<typeof db>;

beforeEach(() => jest.clearAllMocks());

describe('getDailyUsage', () => {
  it('counts down from the daily limit (20 unless CHAT_DAILY_LIMIT says otherwise)', async () => {
    expect(config.anthropic.chatDailyLimit).toBe(20);
    mockDb.countChatMessagesOn.mockResolvedValue(5);
    mockDb.isAdmin.mockResolvedValue(false);
    expect(await getDailyUsage('user-1')).toEqual({ used: 5, limit: 20, remaining: 15 });
    expect(mockDb.countChatMessagesOn).toHaveBeenCalledWith('user-1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 'Africa/Lagos');
  });

  it('never goes below zero left', async () => {
    mockDb.countChatMessagesOn.mockResolvedValue(23);
    mockDb.isAdmin.mockResolvedValue(false);
    expect((await getDailyUsage('user-1')).remaining).toBe(0);
  });

  it('never limits an admin', async () => {
    mockDb.countChatMessagesOn.mockResolvedValue(50);
    mockDb.isAdmin.mockResolvedValue(true);
    expect(await getDailyUsage('admin-1')).toEqual({ used: 50, limit: null, remaining: null });
  });
});

it('tells the owner when messages come back and what still works', () => {
  expect(limitReachedMessage(20)).toMatch(/today's 20 messages.*midnight.*Add transaction form/);
});
