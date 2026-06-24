import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const wishlist = await prisma.wishlist.findMany({
    where: { userId: (session.user as any).id },
    include: { product: { include: { category: true } } },
  });
  return NextResponse.json(wishlist);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { productId } = await req.json();
  const item = await prisma.wishlist.upsert({
    where: { userId_productId: { userId: (session.user as any).id, productId } },
    update: {},
    create: { userId: (session.user as any).id, productId },
  });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { productId } = await req.json();
  await prisma.wishlist.delete({
    where: { userId_productId: { userId: (session.user as any).id, productId } },
  });
  return NextResponse.json({ ok: true });
}
