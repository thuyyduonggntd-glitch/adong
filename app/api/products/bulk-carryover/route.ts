import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasGoodsAccess } from '@/lib/adminAccess';
import { upsertBrandNotice } from '@/lib/notify';
import { buildAdminProductWhere } from '@/lib/productAdminFilter';

function resolveWhere(body: any) {
  if (body.all === true) return buildAdminProductWhere(body);
  if (Array.isArray(body.productIds) && body.productIds.length > 0) return { id: { in: body.productIds as string[] } };
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasGoodsAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const where = resolveWhere(body);
  if (!where) return NextResponse.json({ error: '상품을 선택해주세요.' }, { status: 400 });

  await prisma.product.updateMany({ where, data: { isCarryOver: true } });

  const products = await prisma.product.findMany({ where, select: { brand: true, name: true } });
  const groups = new Map<string, number>();
  for (const p of products) {
    const key = p.brand?.trim() || p.name;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  for (const [displayName, groupCount] of Array.from(groups.entries())) {
    await upsertBrandNotice(displayName, 'CARRYOVER', groupCount);
  }

  return NextResponse.json({ ok: true, count: products.length });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasGoodsAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const where = resolveWhere(body);
  if (!where) return NextResponse.json({ error: '상품을 선택해주세요.' }, { status: 400 });

  const { count } = await prisma.product.updateMany({ where, data: { isCarryOver: false } });

  return NextResponse.json({ ok: true, count });
}
