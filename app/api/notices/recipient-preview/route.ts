import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasNoticeFaqAccess, isAdmin } from '@/lib/adminAccess';

// POST /api/notices/recipient-preview
// Body: { recipientType, recipientIds?, recipientCountries? }
// Returns: { count, ids } — ADMIN includes names, SUB_ADMIN IDs only
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const zones = (session?.user as any)?.adminZones;
  if (!session || !hasNoticeFaqAccess(role, zones))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminOnly = isAdmin(role);
  const { recipientType, recipientIds, recipientCountries } = await req.json();

  if (recipientType === 'all') {
    const count = await prisma.user.count({ where: { isActive: true, role: 'USER' } });
    return NextResponse.json({ count, ids: [] });
  }

  if (recipientType === 'selected') {
    const ids: string[] = Array.isArray(recipientIds) ? recipientIds : [];
    if (ids.length === 0) return NextResponse.json({ count: 0, ids: [] });

    const users = await prisma.user.findMany({
      where: { id: { in: ids }, isActive: true, role: 'USER' },
      select: { id: true, name: adminOnly, shopName: adminOnly },
    });
    return NextResponse.json({
      count: users.length,
      ids: users.map((u) => (adminOnly ? { id: u.id, name: (u as any).name, shopName: (u as any).shopName } : u.id)),
    });
  }

  if (recipientType === 'country') {
    const countries: string[] = Array.isArray(recipientCountries) ? recipientCountries : [];
    if (countries.length === 0) return NextResponse.json({ count: 0, ids: [] });

    const users = await prisma.user.findMany({
      where: { country: { in: countries }, isActive: true, role: 'USER' },
      select: { id: true, name: adminOnly, shopName: adminOnly },
    });
    return NextResponse.json({
      count: users.length,
      ids: users.map((u) => (adminOnly ? { id: u.id, name: (u as any).name, shopName: (u as any).shopName } : u.id)),
    });
  }

  return NextResponse.json({ error: 'recipientType 오류' }, { status: 400 });
}
