import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasNoticeFaqAccess } from '@/lib/adminAccess';

// GET /api/notices/countries — 회원 국가 목록 + 국가별 회원 수
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const zones = (session?.user as any)?.adminZones;
  if (!session || !hasNoticeFaqAccess(role, zones))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.user.groupBy({
    by: ['country'],
    where: { isActive: true, role: 'USER', country: { not: null } },
    _count: { country: true },
    orderBy: { _count: { country: 'desc' } },
  });

  return NextResponse.json(
    rows
      .filter((r) => r.country)
      .map((r) => ({ country: r.country as string, count: r._count.country }))
  );
}
