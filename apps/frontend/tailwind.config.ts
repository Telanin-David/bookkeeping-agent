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
        // Dark base
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
        // Warm amber accent — used sparingly
        amber: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Keep glass-safe semantic colors
        glass: {
          border:   'rgba(255,255,255,0.08)',
          surface:  'rgba(255,255,255,0.04)',
          elevated: 'rgba(255,255,255,0.07)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 4px 24px rgba(0,0,0,0.4)',
        'glass-sm': '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 2px 12px rgba(0,0,0,0.3)',
        'amber-glow': '0 0 20px rgba(245,158,11,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
