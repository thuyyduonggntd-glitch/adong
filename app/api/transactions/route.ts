import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const isAdmin = (session.user as any)?.role === 'ADMIN';
  const selfId = (session.user as any)?.id;

  const targetId = isAdmin && userId ? userId : selfId;

  const transactions = await prisma.transaction.findMany({
    where: { userId: targetId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, type, amount, description, date } = await req.json();
  if (!userId || !type || !amount) {
    return NextResponse.json({ error: '필수 정보가 없습니다.' }, { status: 400 });
  }

  const tx = await prisma.transaction.create({
    data: {
      userId,
      type,
      amount: Number(amount),
      description: description || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  // depositAmount 업데이트 (입금 합계 동기화)
  const deposits = await prisma.transaction.aggregate({
    where: { userId, type: 'DEPOSIT' },
    _sum: { amount: true },
  });
  const withdrawals = await prisma.transaction.aggregate({
    where: { userId, type: 'WITHDRAWAL' },
    _sum: { amount: true },
  });
  const net = (deposits._sum.amount ?? 0) - (withdrawals._sum.amount ?? 0);
  await prisma.user.update({ where: { id: userId }, data: { depositAmount: net } });

  return NextResponse.json(tx);
}
