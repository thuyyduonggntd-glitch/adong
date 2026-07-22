import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const favorites = await prisma.favoriteBrand.findMany({
    where: { userId: (session.user as any).id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(favorites);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { brandName } = await req.json();
  if (!brandName?.trim()) return NextResponse.json({ error: '브랜드명 필요' }, { status: 400 });
  const item = await prisma.favoriteBrand.upsert({
    where: { userId_brandName: { userId: (session.user as any).id, brandName: brandName.trim() } },
    update: {},
    create: { userId: (session.user as any).id, brandName: brandName.trim() },
  });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { brandName } = await req.json();
  await prisma.favoriteBrand.delete({
    where: { userId_brandName: { userId: (session.user as any).id, brandName: brandName.trim() } },
  });
  return NextResponse.json({ ok: true });
}
