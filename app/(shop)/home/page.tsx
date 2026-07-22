import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice } from '@/lib/utils';
import ProductCard from '@/components/shop/ProductCard';
import BrandSection from './BrandSection';
import T from '@/components/i18n/T';
import HomeSearchForm from '@/components/shop/HomeSearchForm';

async function getTopBrands() {
  const rows = await prisma.$queryRaw<Array<{ brand: string; cnt: bigint }>>`
    SELECT p.brand, COUNT(oi.id) AS cnt
    FROM "OrderItem" oi
    JOIN "Product" p ON oi."productId" = p.id
    WHERE p.brand IS NOT NULL AND p.brand <> ''
    GROUP BY p.brand
    ORDER BY cnt DESC
    LIMIT 10
  `;
  const topNames = rows.map((r) => r.brand);
  if (topNames.length === 0) return prisma.brand.findMany({ take: 10, orderBy: { name: 'asc' } });
  const details = await prisma.brand.findMany({ where: { name: { in: topNames } } });
  return topNames.map((n) => details.find((b) => b.name === n)).filter((b): b is NonNullable<typeof b> => b != null);
}

async function getHomeData(grade: string) {
  const [products, topBrands, allBrands] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, prices: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    getTopBrands(),
    prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, image: true } }),
  ]);

  const productsWithPrice = products.map((product) => {
    const gradePrice = product.prices.find((p) => p.grade === (grade as any));
    const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
    const finalPrice = calcFinalPrice(basePrice, product.isOnSale, (product as any).saleType, (product as any).saleValue);
    return { ...product, myGradePrice: basePrice, myFinalPrice: finalPrice };
  });

  return { products: productsWithPrice, topBrands, allBrands };
}


export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const grade   = (session?.user as any)?.dealerGrade ?? 'REGULAR';
  const userId  = (session?.user as any)?.id as string | undefined;
  const { products, topBrands, allBrands } = await getHomeData(grade);
  const wishlistIds = userId
    ? new Set((await prisma.wishlist.findMany({ where: { userId }, select: { productId: true } })).map((w) => w.productId))
    : new Set<string>();

  return (
    <div>
      {/* 검색창 */}
      <section className="bg-gradient-to-br from-primary-50 to-white py-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2"><T k="home.welcome" /></h1>
          <p className="text-slate-400 text-sm mb-6"><T k="home.subtitle" /></p>
          <HomeSearchForm />
        </div>
      </section>

      {/* 브랜드 섹션 (TOP 10 + A-Z 필터) */}
      {(topBrands.length > 0 || allBrands.length > 0) && (
        <BrandSection topBrands={topBrands} allBrands={allBrands} />
      )}

      {/* 신상품 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-800"><T k="home.newArrivals" /></h2>
          <Link href="/home/products" className="text-primary-600 text-sm font-medium hover:underline"><T k="home.viewAll" /></Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product as any} isWishlisted={wishlistIds.has(product.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}
