import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#09090b',
          900: '#0f0f12',
          800: '#18181c',
          700: '#27272a',
          600: '#3f3f46',
          500: '#71717a',
          400: '#a1a1aa',
          300: '#d4d4d8',
          200: '#e4e4e7',
          100: '#f4f4f5',
          50:  '#fafafa',
        },
      },
      fontFamily: {
        sans:    ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.07) inset, 0 4px 24px rgba(0,0,0,0.4)',
        'glass-lg': '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 8px 40px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
