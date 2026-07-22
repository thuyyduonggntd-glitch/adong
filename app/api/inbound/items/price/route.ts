import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/** 공급업체 입고 항목의 단가 수정 — 회원 거래와 무관한 내부 매입 기록이라 거래 조정 없이 값만 갱신 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { updates } = await req.json();
  if (!Array.isArray(updates) || updates.length === 0)
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 });

  const results = [];
  for (const { id, price } of updates) {
    if (!id || typeof price !== 'number' || price < 0) continue;
    await prisma.inboundItem.update({ where: { id }, data: { price } });
    results.push({ id, price });
  }

  return NextResponse.json({ ok: true, updated: results });
}
