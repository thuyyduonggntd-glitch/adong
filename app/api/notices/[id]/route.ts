import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasNoticeFaqAccess } from '@/lib/adminAccess';
import { translateAndSaveNotice } from '@/lib/translate';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasNoticeFaqAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, content, isActive, scheduledAt, expiresAt } = await req.json();
  const data: any = {};
  if (title      !== undefined) data.title      = title.trim();
  if (content    !== undefined) data.content    = content.trim();
  if (isActive   !== undefined) data.isActive   = Boolean(isActive);
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (expiresAt   !== undefined) data.expiresAt  = expiresAt   ? new Date(expiresAt)   : null;

  try {
    const notice = await prisma.notice.update({ where: { id: params.id }, data });
    if (data.title !== undefined || data.content !== undefined) {
      translateAndSaveNotice(notice.id).catch((err) => console.error('[translate] notice update hook failed:', err));
    }
    return NextResponse.json(notice);
  } catch {
    return NextResponse.json({ error: '수정 실패' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasNoticeFaqAccess((session.user as any)?.role, (session.user as any)?.adminZones))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.notice.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
