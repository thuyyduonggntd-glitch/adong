import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPrice, formatDate } from '@/lib/utils';
import Image from 'next/image';
import { redirect } from 'next/navigation';

export default async function CancelledPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const cancelledItems = await prisma.orderItem.findMany({
    where: {
      order: { userId: (session.user as any).id },
      cancelledAt: { not: null, gte: cutoff90 },
    },
    include: {
      product: { select: { name: true, images: true, brand: true } },
      order:   { select: { id: true, createdAt: true, status: true } },
    },
    orderBy: { cancelledAt: 'desc' },
  });

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-4">취소 내역</h2>

      {cancelledItems.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">✅</div>
          <p>취소된 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cancelledItems.map((item) => (
            <div key={item.id} className="card p-4 border-red-100 flex items-start gap-4">
              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                <Image
                  src={item.product.images[0] || 'https://placehold.co/56x56'}
                  alt={item.product.name}
                  fill
                  className="object-cover grayscale"
                />
              </div>
              <div className="flex-1 min-w-0">
                {item.product.brand && (
                  <p className="text-xs text-primary-600 font-semibold mb-0.5">{item.product.brand}</p>
                )}
                <p className="text-sm font-medium text-slate-700 line-through truncate">{item.product.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.size} / {item.color} / {item.quantity}개
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  주문 #{item.order.id.slice(-8).toUpperCase()} · {formatDate(item.order.createdAt)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-slate-400 line-through">{formatPrice(item.price * item.quantity)}</p>
                <span className="badge bg-red-100 text-red-600 text-xs mt-1">취소됨</span>
                {item.cancelledAt && (
                  <p className="text-xs text-slate-400 mt-1">{formatDate(item.cancelledAt)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
