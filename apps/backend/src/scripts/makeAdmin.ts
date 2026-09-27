// Gives an account the business dashboard (or takes it away), from the server only:
//   npm run make-admin -- someone@example.com
//   npm run make-admin -- someone@example.com --remove
// There is deliberately no way to do this from the app itself.
import { db } from '../config';

async function main(): Promise<void> {
  const [email, flag] = process.argv.slice(2);
  if (!email || (flag && flag !== '--remove')) {
    console.error('Usage: npm run make-admin -- someone@example.com [--remove]');
    process.exitCode = 1;
    return;
  }
  const makeAdmin = flag !== '--remove';
  const { rows } = await db.query(
    'UPDATE users SET is_admin = $2 WHERE LOWER(email) = LOWER($1) RETURNING name, email',
    [email, makeAdmin],
  );
  if (rows.length === 0) {
    console.error(`No account with the email ${email}. Sign up in the app first.`);
    process.exitCode = 1;
    return;
  }
  console.log(`${rows[0]['name']} <${rows[0]['email']}> ${makeAdmin ? 'can now open' : 'can no longer open'} the business dashboard.`);
}

main()
  .catch((err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; })
  .finally(() => db.end());
