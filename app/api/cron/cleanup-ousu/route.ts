import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Vercel Cron: 품절/미송 90일 지난 레코드 정리
 * 스케줄: 04:00 KST (19:00 UTC) 매일
 * vercel.json: { "crons": [{ "path": "/api/cron/cleanup-ousu", "schedule": "0 19 * * *" }] }
 *
 * 보호: Authorization: Bearer <CRON_SECRET>
 * Vercel 은 크론 실행 시 자동으로 이 헤더를 붙여줌
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const result = await prisma.orderItem.deleteMany({
    where: {
      OR: [
        { outOfStockAt: { lt: cutoff90 } },
        { unshippedAt:  { lt: cutoff90 } },
      ],
      cancelledAt: null,
      arrivedAt:   null,
    },
  });

  const ts = new Date().toISOString();
  console.log(`[cron cleanup-ousu] ${ts} — deleted ${result.count} items older than 90 days`);

  return NextResponse.json({ ok: true, deleted: result.count, cutoff: cutoff90.toISOString(), ts });
}
