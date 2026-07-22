import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.noticeSeen.upsert({
    where: { userId_noticeId: { userId, noticeId: params.id } },
    create: { userId, noticeId: params.id },
    update: {},
  });
  return NextResponse.json({ ok: true });
}
