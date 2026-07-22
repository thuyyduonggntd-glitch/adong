import Link from 'next/link';
import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice } from '@/lib/utils';
import ProductCard from '@/components/shop/ProductCard';
import BrandSection from './BrandSection';
import T from '@/components/i18n/T';
import HomeSearchForm from '@/components/shop/HomeSearchForm';

async function getTopBrandsUncached() {
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

// 브랜드/주문 집계는 요청마다 바뀌지 않으므로 60초 캐싱 — DB 왕복을 줄여 응답 속도를 높인다.
const getTopBrands = unstable_cache(getTopBrandsUncached, ['home-top-brands'], { revalidate: 60 });
const getAllBrands = unstable_cache(
  () => prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, image: true } }),
  ['home-all-brands'],
  { revalidate: 60 }
);

// 홈 화면 카드에 실제로 쓰이는 필드만 select — description/material/sizeImages 등
// 번역 텍스트를 포함한 무거운 컬럼들을 응답에서 제외해 전송량을 줄인다.
const HOME_PRODUCT_SELECT = {
  id: true, name: true,
  name_en: true, name_vi: true, name_th: true, name_ru: true, name_mn: true, name_es: true,
  images: true, price: true, isOnSale: true, saleType: true, saleValue: true, updatedAt: true,
  category: {
    select: {
      name: true,
      name_en: true, name_vi: true, name_th: true, name_ru: true, name_mn: true, name_es: true,
    },
  },
  prices: { select: { grade: true, price: true } },
} as const;

/* 브랜드 섹션은 세션과 무관 — 캐싱된 쿼리라 거의 즉시 렌더링되고, 나머지와 별도로 스트리밍된다. */
async function HomeBrandSection() {
  const [topBrands, allBrands] = await Promise.all([getTopBrands(), getAllBrands()]);
  if (topBrands.length === 0 && allBrands.length === 0) return null;
  return <BrandSection topBrands={topBrands} allBrands={allBrands} />;
}

/* 개인화(등급별 가격·찜 여부)가 필요한 부분만 별도 Suspense 경계로 분리해
   세션 조회가 느려도 위쪽(검색창·브랜드 섹션)은 먼저 스트리밍되도록 한다. */
async function HomeProductGrid() {
  const [session, products] = await Promise.all([
    getServerSession(authOptions),
    prisma.product.findMany({
      where: { isActive: true },
      select: HOME_PRODUCT_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);
  const grade  = (session?.user as any)?.dealerGrade ?? 'REGULAR';
  const userId = (session?.user as any)?.id as string | undefined;

  const productsWithPrice = products.map((product) => {
    const gradePrice = product.prices.find((p) => p.grade === (grade as any));
    const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
    const finalPrice = calcFinalPrice(basePrice, product.isOnSale, (product as any).saleType, (product as any).saleValue);
    return { ...product, myGradePrice: basePrice, myFinalPrice: finalPrice };
  });

  const wishlistIds = userId
    ? new Set((await prisma.wishlist.findMany({ where: { userId }, select: { productId: true } })).map((w) => w.productId))
    : new Set<string>();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {productsWithPrice.map((product) => (
        <ProductCard key={product.id} product={product as any} isWishlisted={wishlistIds.has(product.id)} />
      ))}
    </div>
  );
}

function BrandSectionSkeleton() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="h-5 w-40 bg-slate-100 rounded mb-4" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square bg-slate-100 rounded-xl" />
        ))}
      </div>
    </section>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-square bg-slate-100 rounded-xl" />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* 검색창 (정적, 데이터 의존 없음) */}
      <section className="bg-gradient-to-br from-primary-50 to-white py-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2"><T k="home.welcome" /></h1>
          <p className="text-slate-400 text-sm mb-6"><T k="home.subtitle" /></p>
          <HomeSearchForm />
        </div>
      </section>

      {/* 브랜드 섹션 (TOP 10 + A-Z 필터) — 세션과 무관, 캐싱됨 */}
      <Suspense fallback={<BrandSectionSkeleton />}>
        <HomeBrandSection />
      </Suspense>

      {/* 신상품 — 등급별 가격/찜 여부만 별도 스트리밍 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-800"><T k="home.newArrivals" /></h2>
          <Link href="/home/products" className="text-primary-600 text-sm font-medium hover:underline"><T k="home.viewAll" /></Link>
        </div>
        <Suspense fallback={<ProductGridSkeleton />}>
          <HomeProductGrid />
        </Suspense>
      </section>
    </div>
  );
}
