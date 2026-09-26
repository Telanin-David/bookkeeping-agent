// config.ts reads the environment when it is imported, so each case loads a fresh copy.
function loadConfigWith(env: Record<string, string>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    let loaded: typeof import('./config') | undefined;
    jest.isolateModules(() => { loaded = require('./config'); });
    return loaded!.config;
  } finally {
    process.env = saved;
  }
}

describe('JWT_ACCESS_SECRET strength', () => {
  const strong = 'k3J9xQ2mV8pL5wR1tY7uE4oI6aS0dF3gH9jK2lZ8'; // 40 characters

  it('refuses to start in production with a short secret', () => {
    expect(() => loadConfigWith({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'short-secret' }))
      .toThrow(/too weak/);
  });

  it('refuses to start in production with the .env.example placeholder', () => {
    expect(() => loadConfigWith({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'change-me-to-a-long-random-string' }))
      .toThrow(/too weak/);
  });

  it('starts in production with a long random secret', () => {
    expect(loadConfigWith({ NODE_ENV: 'production', JWT_ACCESS_SECRET: strong }).jwt.accessSecret).toBe(strong);
  });

  it('allows a short secret in local development', () => {
    expect(loadConfigWith({ NODE_ENV: 'development', JWT_ACCESS_SECRET: 'dev' }).jwt.accessSecret).toBe('dev');
  });
});
