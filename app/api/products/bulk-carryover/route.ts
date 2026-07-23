import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';
import { upsertBrandNotice } from '@/lib/notify';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { productIds } = await req.json();
  if (!Array.isArray(productIds) || productIds.length === 0)
    return NextResponse.json({ error: '상품을 선택해주세요.' }, { status: 400 });

  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data:  { isCarryOver: true },
  });

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { brand: true, name: true },
  });
  const groups = new Map<string, number>();
  for (const p of products) {
    const key = p.brand?.trim() || p.name;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  for (const [displayName, groupCount] of Array.from(groups.entries())) {
    await upsertBrandNotice(displayName, 'CARRYOVER', groupCount);
  }

  return NextResponse.json({ ok: true, count: productIds.length });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { productIds } = await req.json();
  if (!Array.isArray(productIds) || productIds.length === 0)
    return NextResponse.json({ error: '상품을 선택해주세요.' }, { status: 400 });

  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data:  { isCarryOver: false },
  });

  return NextResponse.json({ ok: true, count: productIds.length });
}
