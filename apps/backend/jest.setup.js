// config.ts throws on missing required env vars at import time; give tests inert values.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.ANTHROPIC_API_KEY ??= 'sk-ant-test';
