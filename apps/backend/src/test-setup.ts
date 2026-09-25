// config.ts reads these eagerly at import time, so every test needs them set
// before anything under src/ is imported — regardless of whether that test
// actually touches the database, JWTs, or the Anthropic API.
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/test';
process.env['JWT_ACCESS_SECRET'] ??= 'test-access-secret';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-secret';
process.env['ANTHROPIC_API_KEY'] ??= 'sk-ant-test-key';
