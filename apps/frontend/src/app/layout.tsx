import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import '@fontsource-variable/outfit';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title:       'sabeebook',
  description: 'Easy bookkeeping for busy people.',
};

export const viewport: Viewport = {
  themeColor:  '#09090b',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
