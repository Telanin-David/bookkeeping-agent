import 'dotenv/config';
import { Pool } from 'pg';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '4000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  isDev: (process.env['NODE_ENV'] ?? 'development') === 'development',

  db: {
    url: required('DATABASE_URL'),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
  },

  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
  },

  sendgrid: {
    apiKey: process.env['SENDGRID_API_KEY'] ?? '',
    fromEmail: process.env['SENDGRID_FROM_EMAIL'] ?? 'noreply@bookkeepingagent.com',
  },

  twilio: {
    accountSid: process.env['TWILIO_ACCOUNT_SID'] ?? '',
    authToken: process.env['TWILIO_AUTH_TOKEN'] ?? '',
    fromNumber: process.env['TWILIO_FROM_NUMBER'] ?? '',
  },

  storage: {
    driver: (process.env['STORAGE_DRIVER'] ?? 'local') as 'local' | 's3',
    s3Bucket: process.env['AWS_S3_BUCKET'] ?? '',
    s3Region: process.env['AWS_REGION'] ?? 'us-east-1',
  },

  cors: {
    frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  },
};

export const db = new Pool({
  connectionString: config.db.url,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
