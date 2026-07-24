import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { translateAndSaveFaq } from '@/lib/translate';

// FAQ 관리는 총괄관리자(ADMIN)만 — 부관리자(SUB_ADMIN)는 접근 불가
const isFullAdmin = (role?: string | null) => role === 'ADMIN';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category, question, answer, order, isActive } = await req.json();
  const data: any = {};
  if (category !== undefined) data.category = category.trim();
  if (question !== undefined) data.question = question.trim();
  if (answer   !== undefined) data.answer   = answer.trim();
  if (order    !== undefined) data.order    = Number(order) || 0;
  if (isActive !== undefined) data.isActive = Boolean(isActive);

  try {
    const faq = await prisma.faq.update({ where: { id: params.id }, data });
    if (data.question !== undefined || data.answer !== undefined) {
      translateAndSaveFaq(faq.id).catch((err) => console.error('[translate] faq update hook failed:', err));
    }
    return NextResponse.json(faq);
  } catch {
    return NextResponse.json({ error: '수정 실패' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.faq.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
