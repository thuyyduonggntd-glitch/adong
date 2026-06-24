import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import WishlistGrid from './WishlistGrid';

export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const wishlist = await prisma.wishlist.findMany({
    where: { userId: (session.user as any).id },
    include: { product: { include: { category: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-4">관심 상품 ({wishlist.length})</h2>
      <WishlistGrid items={wishlist} />
    </div>
  );
}
