import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcFinalPrice } from '@/lib/utils';
import ProductCard from '@/components/shop/ProductCard';

async function getHomeData(grade: string) {
  const [products, brands] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, prices: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.brand.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const productsWithPrice = products.map((product) => {
    const gradePrice = product.prices.find((p) => p.grade === (grade as any));
    const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
    const finalPrice = calcFinalPrice(basePrice, product.isOnSale, (product as any).saleType, (product as any).saleValue);
    return { ...product, myGradePrice: basePrice, myFinalPrice: finalPrice };
  });

  return { products: productsWithPrice, brands };
}

const KEYWORDS = ['여름신상', '세일', '신생아', '베이비세트', '유아외투', '주니어'];

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const grade   = (session?.user as any)?.dealerGrade ?? 'REGULAR';
  const { products, brands } = await getHomeData(grade);

  return (
    <div>
      {/* 검색창 */}
      <section className="bg-gradient-to-br from-primary-50 to-white py-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">꿈비샵에 오신 것을 환영합니다</h1>
          <p className="text-slate-400 text-sm mb-6">아동복 전문 도매몰 · 신상품 매주 업데이트</p>
          <form action="/home/products" method="get" className="flex gap-2 mb-4">
            <input
              type="text"
              name="q"
              placeholder="상품명, 브랜드 검색..."
              className="input flex-1 text-base shadow-sm"
            />
            <button type="submit" className="btn-primary px-6 shadow-sm">검색</button>
          </form>
          <div className="flex flex-wrap justify-center gap-2">
            {KEYWORDS.map((kw) => (
              <a key={kw} href={`/home/products?q=${encodeURIComponent(kw)}`}
                className="px-3 py-1.5 rounded-full text-xs border border-slate-200 bg-white text-slate-600 hover:border-primary-400 hover:text-primary-600 transition-colors">
                {kw}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 브랜드 */}
      {brands.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/home/products?brand=${encodeURIComponent(brand.name)}`}
                className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow border border-slate-100"
              >
                <div className="relative w-full aspect-square overflow-hidden bg-slate-50">
                  <Image
                    src={brand.image ?? '/brand-default.svg'}
                    alt={brand.name}
                    fill
                    className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="py-1.5 px-2 text-center">
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-primary-600 transition-colors leading-tight block">
                    {brand.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 신상품 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-800">신상품</h2>
          <Link href="/home/products" className="text-primary-600 text-sm font-medium hover:underline">전체보기 →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product as any} />
          ))}
        </div>
      </section>
    </div>
  );
}
