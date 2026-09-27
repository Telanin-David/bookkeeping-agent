// Next.js 16 dropped `next lint`; ESLint runs directly with Next's recommended rules.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default [
  ...nextVitals,
  ...nextTs,
  {
    // These rules exist for the optional React Compiler, which this app doesn't use. The
    // patterns they flag work correctly without it (effects that sync state on open/close,
    // a modal keeping its last content while it animates out), so they warn rather than fail.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
  { ignores: ['.next/**', 'next-env.d.ts'] },
];
