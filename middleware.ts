import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { canAccessAdminPath } from '@/lib/adminAccess';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role as string | undefined;

  if (!token || (role !== 'ADMIN' && role !== 'SUB_ADMIN')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (!canAccessAdminPath(role, pathname)) {
    return NextResponse.redirect(new URL('/admin/orders', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
