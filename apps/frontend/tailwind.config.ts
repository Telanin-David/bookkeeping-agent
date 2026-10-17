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
        // sabeebook brand sheet. `leaf` is the logo's lighter green ("book" on dark), for green
        // text and icons on the dark background, where the brand green is too dark to read.
        brand: {
          green:  '#147A45',
          'green-hover': '#18904F',
          leaf:   '#4DA569',
          yellow: '#F5C928',
          black:  '#111713',
          paper:  '#F7F8F4',
          // The app icon's background: the home page's deep green.
          forest: '#0B3826',
        },
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
        // The brand sheet's geometric face, for headings everywhere and the home page's text.
        // Outfit has no ₦, so "sabeebook naira" (globals.css) supplies that one character.
        display: ['"Outfit Variable"', '"sabeebook naira"', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
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
