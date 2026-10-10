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

  const batches = await prisma.orderBatch.findMany({
    select: { id: true, createdAt: true, itemCount: true, adminId: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  return NextResponse.json(batches);
}
