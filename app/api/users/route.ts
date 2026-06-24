import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q');
  const users = await prisma.user.findMany({
    where: q ? {
      OR: [
        { name:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    } : undefined,
    select: {
      id: true, name: true, email: true, phone: true, role: true, isActive: true,
      dealerGrade: true,
      shopName: true, businessNumber: true, address: true,
      shippingName: true, shippingPhone: true,
      depositAmount: true, createdAt: true,
      _count: { select: { orders: true } },
      orders: {
        where: { status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] } },
        select: { totalAmount: true },
      },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });

  const result = users.map((u) => ({
    ...u,
    totalSales: u.orders.reduce((sum, o) => sum + o.totalAmount, 0),
    orders: undefined,
  }));

  return NextResponse.json(result);
}
