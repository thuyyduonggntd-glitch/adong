import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type, amount, description, date } = await req.json();
  const tx = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      ...(type        !== undefined ? { type }                          : {}),
      ...(amount      !== undefined ? { amount: Number(amount) }        : {}),
      ...(description !== undefined ? { description }                   : {}),
      ...(date        !== undefined ? { date: new Date(date) }          : {}),
    },
  });

  // depositAmount 재계산
  const deposits    = await prisma.transaction.aggregate({ where: { userId: tx.userId, type: 'DEPOSIT'    }, _sum: { amount: true } });
  const withdrawals = await prisma.transaction.aggregate({ where: { userId: tx.userId, type: 'WITHDRAWAL' }, _sum: { amount: true } });
  const net = (deposits._sum.amount ?? 0) - (withdrawals._sum.amount ?? 0);
  await prisma.user.update({ where: { id: tx.userId }, data: { depositAmount: net } });

  return NextResponse.json(tx);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.transaction.delete({ where: { id: params.id } });

  // depositAmount 재계산
  const deposits = await prisma.transaction.aggregate({
    where: { userId: tx.userId, type: 'DEPOSIT' },
    _sum: { amount: true },
  });
  const withdrawals = await prisma.transaction.aggregate({
    where: { userId: tx.userId, type: 'WITHDRAWAL' },
    _sum: { amount: true },
  });
  const net = (deposits._sum.amount ?? 0) - (withdrawals._sum.amount ?? 0);
  await prisma.user.update({ where: { id: tx.userId }, data: { depositAmount: net } });

  return NextResponse.json({ ok: true });
}
