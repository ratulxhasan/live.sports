import { NextResponse } from 'next/server';

export function middleware(req) {
  const host = req.headers.get('host');
  if (host.endsWith('.vercel.app')) {
    return new Response('এই ঠিকানায় প্রবেশ নিষিদ্ধ ❌', { status: 403 });
  }
  return NextResponse.next();
}
