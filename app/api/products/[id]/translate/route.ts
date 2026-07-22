import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';
import { translateAndSaveProduct } from '@/lib/translate';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await translateAndSaveProduct(params.id);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Translate failed' }, { status: 500 });
  }

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  return NextResponse.json(product);
}
