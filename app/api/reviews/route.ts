import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { productId, rating, content } = await req.json();
  if (!productId || !rating || !content) return NextResponse.json({ error: '필수 정보가 없습니다.' }, { status: 400 });

  const review = await prisma.review.create({
    data: { userId: (session.user as any).id, productId, rating: Number(rating), content },
  });
  return NextResponse.json(review);
}
