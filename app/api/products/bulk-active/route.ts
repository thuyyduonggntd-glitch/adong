import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { productIds, isActive } = await req.json();
  if (!Array.isArray(productIds) || productIds.length === 0)
    return NextResponse.json({ error: '상품을 선택해주세요.' }, { status: 400 });

  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data:  { isActive: Boolean(isActive) },
  });

  return NextResponse.json({ ok: true, count: productIds.length });
}
