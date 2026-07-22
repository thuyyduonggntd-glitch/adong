import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qna = await prisma.qnA.findUnique({
    where: { id: params.id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!qna) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(qna);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { answer, status } = await req.json();
  const qna = await prisma.qnA.update({
    where: { id: params.id },
    data: {
      ...(answer !== undefined ? { answer, answerSeen: false } : {}),
      ...(status ? { status } : {}),
      ...(answer ? { answeredAt: new Date() } : {}),
    },
  });
  return NextResponse.json(qna);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qna = await prisma.qnA.findUnique({ where: { id: params.id } });
  if (!qna) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = hasAdminAccess((session.user as any)?.role);
  const isOwner = qna.userId === (session.user as any)?.id;
  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.qnA.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
