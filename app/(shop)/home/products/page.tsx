import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ProductCard from '@/components/shop/ProductCard';
import SortSelect from '@/components/shop/SortSelect';
import Link from 'next/link';
import Image from 'next/image';
import { calcFinalPrice } from '@/lib/utils';

interface Props {
  searchParams: { category?: string; q?: string; sort?: string; brand?: string; season?: string; productType?: string; isNew?: string; isOnSale?: string };
}

export default async function ProductsPage({ searchParams }: Props) {
  const { category, q, sort, brand, season, productType, isNew, isOnSale } = searchParams;

  const session = await getServerSession(authOptions);
  const grade   = (session?.user as any)?.dealerGrade ?? 'REGULAR';

  const [products, categories, seasons, productTypes, dbBrands] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        ...(category  ? { category: { slug: category } } : {}),
        ...(q         ? { OR: [
          { name:  { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ]} : {}),
        ...(brand     ? { brand: { contains: brand, mode: 'insensitive' } } : {}),
        ...(season      ? { season:      { contains: season,      mode: 'insensitive' } } : {}),
        ...(productType ? { productType: { contains: productType, mode: 'insensitive' } } : {}),
        ...(isOnSale === '1' ? { isOnSale: true } : {}),
        ...(isNew    === '1' ? { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } : {}),
      },
      include: { category: true, prices: true },
      orderBy:
        sort === 'price_asc'  ? { price: 'asc' }  :
        sort === 'price_desc' ? { price: 'desc' } :
        { createdAt: 'desc' },
    }),
    prisma.category.findMany(),
    prisma.product.findMany({
      where: {
        isActive: true, season: { not: null },
        ...(brand ? { brand: { contains: brand, mode: 'insensitive' } } : {}),
      },
      select: { season: true },
      distinct: ['season'],
      orderBy: { season: 'asc' },
    }),
    prisma.product.findMany({
      where: {
        isActive: true, productType: { not: null },
        ...(brand ? { brand: { contains: brand, mode: 'insensitive' } } : {}),
      },
      select: { productType: true },
      distinct: ['productType'],
      orderBy: { productType: 'asc' },
    }),
    prisma.brand.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const currentCategory  = categories.find((c) => c.slug === category);
  const uniqueSeasons    = seasons.map((s) => s.season).filter(Boolean) as string[];
  const uniqueProductTypes = productTypes.map((p) => p.productType).filter(Boolean) as string[];

  const pageTitle =
    isNew === '1'     ? '신상품' :
    isOnSale === '1'  ? '세일 상품' :
    brand             ? `${brand} 브랜드` :
    season            ? `${season} 시즌` :
    currentCategory   ? currentCategory.name :
    q                 ? `"${q}" 검색 결과` : '전체 상품';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">{pageTitle}</h1>
        <p className="text-slate-500 text-sm mt-1">{products.length}개 상품</p>
      </div>

      {/* 검색 + 정렬 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <form className="flex-1 flex gap-2">
          {category    && <input type="hidden" name="category"    value={category} />}
          {brand       && <input type="hidden" name="brand"       value={brand} />}
          {season      && <input type="hidden" name="season"      value={season} />}
          {productType && <input type="hidden" name="productType" value={productType} />}
          {isNew       && <input type="hidden" name="isNew"       value={isNew} />}
          {isOnSale    && <input type="hidden" name="isOnSale"    value={isOnSale} />}
          <input type="text" name="q" defaultValue={q} placeholder="상품명, 브랜드 검색..." className="input flex-1" />
          <button type="submit" className="btn-primary px-4">검색</button>
        </form>
        <SortSelect defaultValue={sort} />
      </div>

      {/* 브랜드 필터 */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">브랜드 검색</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/home/products"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!brand && !isNew && !isOnSale && !category && !season ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 text-slate-600 hover:border-primary-400'}`}>
            전체
          </Link>
          {dbBrands.map((b) => (
            <Link key={b.id} href={`/home/products?brand=${encodeURIComponent(b.name)}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${brand === b.name ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-primary-400 bg-white'}`}>
              <span className="relative w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-slate-100">
                <Image src={b.image ?? '/brand-default.svg'} alt={b.name} fill className="object-cover" />
              </span>
              {b.name}
            </Link>
          ))}
        </div>
      </div>

      {/* 브랜드 선택 시: 종류별·시즌별 필터 */}
      {brand && (
        <div className="mb-5 pl-3 border-l-2 border-primary-200 space-y-3">
          {/* 종류별 검색 */}
          {uniqueProductTypes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">종류별 검색</p>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={`/home/products?brand=${encodeURIComponent(brand)}${season ? `&season=${encodeURIComponent(season)}` : ''}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!productType ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-violet-700 hover:border-violet-400'}`}>
                  전체
                </Link>
                {uniqueProductTypes.map((pt) => (
                  <Link key={pt} href={`/home/products?brand=${encodeURIComponent(brand)}&productType=${encodeURIComponent(pt)}${season ? `&season=${encodeURIComponent(season)}` : ''}`}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${productType === pt ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-violet-700 hover:border-violet-400'}`}>
                    {pt}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 시즌별 검색 */}
          {uniqueSeasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">시즌별 검색</p>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={`/home/products?brand=${encodeURIComponent(brand)}${productType ? `&productType=${encodeURIComponent(productType)}` : ''}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!season ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-amber-700 hover:border-amber-400'}`}>
                  전체
                </Link>
                {uniqueSeasons.map((s) => (
                  <Link key={s} href={`/home/products?brand=${encodeURIComponent(brand)}&season=${encodeURIComponent(s)}${productType ? `&productType=${encodeURIComponent(productType)}` : ''}`}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${season === s ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-amber-700 hover:border-amber-400'}`}>
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-6">
        {/* 카테고리 사이드바 */}
        <aside className="hidden md:block w-44 flex-shrink-0">
          <h3 className="font-semibold text-slate-700 mb-3 text-xs uppercase tracking-wide">카테고리</h3>
          <div className="space-y-1">
            <Link href="/home/products"
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${!category && !isNew && !isOnSale ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-primary-50'}`}>
              전체
            </Link>
            <Link href="/home/products?isNew=1"
              className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isNew === '1' ? 'bg-primary-600 text-white' : 'text-primary-600 hover:bg-primary-50'}`}>
              ✨ 신상품
            </Link>
            <Link href="/home/products?isOnSale=1"
              className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isOnSale === '1' ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'}`}>
              🔥 세일
            </Link>
            <div className="my-1 border-t border-slate-100" />
            {categories.map((cat) => (
              <Link key={cat.id} href={`/home/products?category=${cat.slug}`}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${category === cat.slug ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-primary-50'}`}>
                {cat.name}
              </Link>
            ))}
          </div>
        </aside>

        {/* 상품 그리드 */}
        <div className="flex-1">
          {products.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <div className="text-5xl mb-4">😢</div>
              <p>해당 상품이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => {
                const gradePrice = (product as any).prices?.find((p: any) => p.grade === grade);
                const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
                const finalPrice = calcFinalPrice(basePrice, product.isOnSale, (product as any).saleType, (product as any).saleValue);
                return (
                  <ProductCard key={product.id} product={{ ...product, myGradePrice: basePrice, myFinalPrice: finalPrice } as any} />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
