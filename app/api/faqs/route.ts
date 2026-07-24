import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { translateAndSaveFaq } from '@/lib/translate';

// FAQ 관리는 총괄관리자(ADMIN)만 — 부관리자(SUB_ADMIN)는 접근 불가
const isFullAdmin = (role?: string | null) => role === 'ADMIN';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');

  if (active === '1') {
    // 공개 FAQ 조회 — 로그인 여부와 무관하게 노출중인 항목을 카테고리/순서대로 반환
    const faqs = await prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
    return NextResponse.json(faqs);
  }

  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const faqs = await prisma.faq.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] });
  return NextResponse.json(faqs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category, question, answer, order } = await req.json();
  if (!category?.trim() || !question?.trim() || !answer?.trim())
    return NextResponse.json({ error: '카테고리/질문/답변을 입력해주세요.' }, { status: 400 });

  const faq = await prisma.faq.create({
    data: {
      category: category.trim(),
      question: question.trim(),
      answer: answer.trim(),
      order: Number(order) || 0,
    },
  });
  translateAndSaveFaq(faq.id).catch((err) => console.error('[translate] faq create hook failed:', err));
  return NextResponse.json(faq);
}
