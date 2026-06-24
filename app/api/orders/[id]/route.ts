import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function isWithinCancelWindow(cancelFrom: string | null, cancelTo: string | null): boolean {
  if (!cancelFrom || !cancelTo) return true;
  const now = new Date();
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const cur = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const [fh, fm] = cancelFrom.split(':').map(Number);
  const [th, tm] = cancelTo.split(':').map(Number);
  const from = fh * 60 + fm;
  const to   = th * 60 + tm;
  return from <= to ? cur >= from && cur <= to : cur >= from || cur <= to;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = (session.user as any)?.role === 'ADMIN';
  const body = await req.json();
  const { status, action, cancelLocked } = body;

  // 어드민: 상태 직접 변경
  if (isAdmin && status) {
    const order = await prisma.order.update({ where: { id: params.id }, data: { status } });
    return NextResponse.json(order);
  }

  // 어드민: 취소잠금 설정
  if (isAdmin && cancelLocked !== undefined) {
    const order = await prisma.order.update({ where: { id: params.id }, data: { cancelLocked } });
    return NextResponse.json(order);
  }

  // 사용자: 취소 요청
  if (action === 'cancel') {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: true } } },
    });
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (order.userId !== (session.user as any).id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) return NextResponse.json({ error: '취소할 수 없는 상태입니다.' }, { status: 400 });

    // 취소 정책 확인
    const policy = await prisma.cancelPolicy.findFirst();
    if (!policy?.globalEnabled) return NextResponse.json({ error: '현재 주문 취소가 비활성화 상태입니다.' }, { status: 403 });

    // 주문 취소 잠금 확인
    if (order.cancelLocked) return NextResponse.json({ error: '이 주문은 취소가 제한되어 있습니다.' }, { status: 403 });

    // 상품별 취소 잠금 확인
    const lockedProduct = order.items.find((i) => i.product.cancelLocked);
    if (lockedProduct) return NextResponse.json({ error: `${lockedProduct.product.name} 상품은 취소가 제한되어 있습니다.` }, { status: 403 });

    // 경과 시간 제한 확인
    if (policy.timeLimit) {
      const elapsed = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
      if (elapsed > policy.timeLimit) return NextResponse.json({ error: `주문 후 ${policy.timeLimit}시간이 지나 취소할 수 없습니다.` }, { status: 403 });
    }

    // 취소 가능 시간대 확인 (서울 기준)
    if (policy.cancelFrom && policy.cancelTo) {
      if (!isWithinCancelWindow(policy.cancelFrom, policy.cancelTo)) {
        return NextResponse.json({
          error: `취소 가능 시간은 ${policy.cancelFrom} ~ ${policy.cancelTo} (서울 기준)입니다.`,
        }, { status: 403 });
      }
    }

    const updated = await prisma.order.update({ where: { id: params.id }, data: { status: 'CANCELLED' } });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Bad request' }, { status: 400 });
}
