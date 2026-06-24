import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { productIds, saleType, saleValue } = await req.json();
  if (!Array.isArray(productIds) || productIds.length === 0)
    return NextResponse.json({ error: '상품을 선택해주세요.' }, { status: 400 });

  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data:  { isOnSale: true, saleType, saleValue: Number(saleValue) },
  });

  return NextResponse.json({ ok: true, count: productIds.length });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { productIds } = await req.json();
  if (!Array.isArray(productIds) || productIds.length === 0)
    return NextResponse.json({ error: '상품을 선택해주세요.' }, { status: 400 });

  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data:  { isOnSale: false, saleType: null, saleValue: null },
  });

  return NextResponse.json({ ok: true, count: productIds.length });
}
