import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrdersAccess } from '@/lib/adminAccess';

// GET /api/admin/order-batches
// Returns all order batches for the filter dropdown, newest first
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !hasOrdersAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 대기 중인 item이 1건이라도 있는 차수만 반환 (전부 입고/취소/품절·미송 된 차수는 숨김)
  const batches = await prisma.orderBatch.findMany({
    where: {
      items: {
        some: {
          arrivedAt:   null,
          cancelledAt: null,
          outOfStockAt: null,
          unshippedAt:  null,
        },
      },
    },
    select: { id: true, createdAt: true, itemCount: true, adminId: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  return NextResponse.json(batches);
}
