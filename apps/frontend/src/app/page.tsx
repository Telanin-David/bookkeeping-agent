import { redirect } from 'next/navigation';

// Root redirects into the dashboard; auth guard lives in the dashboard layout.
export default function Home() {
  redirect('/');
}
