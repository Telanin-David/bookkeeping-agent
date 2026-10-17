import { NextResponse, type NextRequest } from 'next/server';

// The home page is for visitors. A device that was signed in last time goes straight to the
// app instead; if that session has since expired, the app sends it on to /login as usual.
export function proxy(req: NextRequest) {
  if (req.cookies.get('sb_signed_in')?.value === '1') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: '/' };
