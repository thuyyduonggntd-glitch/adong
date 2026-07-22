import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { translateAndSaveProduct, translateAndSaveCategory } from '@/lib/translate';

const CONCURRENCY = 5;

async function runQueue<T extends { id: string }>(items: T[], task: (id: string) => Promise<void>) {
  let done = 0;
  let failed = 0;
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      try {
        await task(next.id);
        done++;
      } catch (err) {
        console.error('[translate-products] failed for', next.id, err);
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { total: items.length, done, failed };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { force } = await req.json().catch(() => ({ force: false }));

  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: force ? {} : { name_en: null }, select: { id: true } }),
    prisma.category.findMany({ where: force ? {} : { name_en: null }, select: { id: true } }),
  ]);

  const [productResult, categoryResult] = await Promise.all([
    runQueue(products, translateAndSaveProduct),
    runQueue(categories, translateAndSaveCategory),
  ]);

  return NextResponse.json({
    total: productResult.total + categoryResult.total,
    done: productResult.done + categoryResult.done,
    failed: productResult.failed + categoryResult.failed,
    products: productResult,
    categories: categoryResult,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [total, translated, catTotal, catTranslated] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { NOT: { name_en: null } } }),
    prisma.category.count(),
    prisma.category.count({ where: { NOT: { name_en: null } } }),
  ]);

  return NextResponse.json({
    total: total + catTotal,
    translated: translated + catTranslated,
    remaining: (total - translated) + (catTotal - catTranslated),
  });
}
