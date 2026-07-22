import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ProductCard from '@/components/shop/ProductCard';
import SortSelect from '@/components/shop/SortSelect';
import BrandFilterAZ from '@/components/shop/BrandFilterAZ';
import ProductsPageHeader from '@/components/shop/ProductsPageHeader';
import ProductsSearchInput from '@/components/shop/ProductsSearchInput';
import CategoryGroupSidebar from '@/components/shop/CategoryGroupSidebar';
import Link from 'next/link';
import { calcFinalPrice } from '@/lib/utils';
import T from '@/components/i18n/T';
import { buildProductSearchWhere } from '@/lib/productSearch';

// 카테고리/브랜드 목록은 자주 바뀌지 않으므로 60초 캐싱해 매 요청 DB 왕복을 줄인다.
const getCachedCategories = unstable_cache(
  () => prisma.category.findMany(),
  ['products-page-categories'],
  { revalidate: 60 }
);
const getCachedBrands = unstable_cache(
  () => prisma.brand.findMany({ orderBy: { name: 'asc' } }),
  ['products-page-brands'],
  { revalidate: 60 }
);
const getCachedSeasons = unstable_cache(
  (brandFilter: string | undefined) => prisma.product.findMany({
    where: {
      isActive: true, season: { not: null },
      ...(brandFilter ? { brand: { contains: brandFilter, mode: 'insensitive' } } : {}),
    },
    select: { season: true },
    distinct: ['season'],
    orderBy: { season: 'asc' },
  }),
  ['products-page-seasons'],
  { revalidate: 60 }
);
const getCachedProductTypes = unstable_cache(
  (brandFilter: string | undefined) => prisma.product.findMany({
    where: {
      isActive: true, productType: { not: null },
      ...(brandFilter ? { brand: { contains: brandFilter, mode: 'insensitive' } } : {}),
    },
    select: { productType: true },
    distinct: ['productType'],
    orderBy: { productType: 'asc' },
  }),
  ['products-page-productTypes'],
  { revalidate: 60 }
);

const PAGE_SIZE = 24;

// 상품 그리드에 실제로 쓰이는 필드만 select — 대량 카탈로그에서 응답 크기를 줄인다.
const PRODUCTS_LIST_SELECT = {
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

interface Props {
  searchParams: {
    category?: string; q?: string; sort?: string; brand?: string;
    season?: string; productType?: string; isNew?: string; isOnSale?: string;
    isCarryOver?: string; page?: string;
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const { category, q, sort, brand, season, productType, isNew, isOnSale, isCarryOver } = searchParams;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const orderBy =
    sort === 'price_asc'  ? { price: 'asc'  as const } :
    sort === 'price_desc' ? { price: 'desc' as const } :
    sort === 'popular'    ? { orderItems: { _count: 'desc' as const } } :
    { createdAt: 'desc' as const };

  const productConditions: any[] = [{ isActive: true }];
  if (category) productConditions.push({ OR: [{ category: { slug: category } }, { sizeCategory: { slug: category } }] });
  if (q)        productConditions.push(buildProductSearchWhere(q));
  if (brand)    productConditions.push({ brand: { contains: brand, mode: 'insensitive' } });
  if (season)   productConditions.push({ season: { contains: season, mode: 'insensitive' } });
  if (productType) productConditions.push({ productType: { contains: productType, mode: 'insensitive' } });
  if (isOnSale === '1')    productConditions.push({ isOnSale: true });
  if (isCarryOver === '1') productConditions.push({ isCarryOver: true });
  if (isNew === '1')       productConditions.push({ createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });

  const [session, products, totalCount, categories, seasons, productTypes, dbBrands] = await Promise.all([
    getServerSession(authOptions),
    prisma.product.findMany({
      where: { AND: productConditions },
      select: PRODUCTS_LIST_SELECT,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where: { AND: productConditions } }),
    getCachedCategories(),
    getCachedSeasons(brand),
    getCachedProductTypes(brand),
    getCachedBrands(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const grade  = (session?.user as any)?.dealerGrade ?? 'REGULAR';
  const userId = (session?.user as any)?.id as string | undefined;

  const wishlistIds = userId
    ? new Set((await prisma.wishlist.findMany({ where: { userId }, select: { productId: true } })).map((w) => w.productId))
    : new Set<string>();

  const currentCategory    = categories.find((c) => c.slug === category);
  const uniqueSeasons      = seasons.map((s) => s.season).filter(Boolean) as string[];
  const uniqueProductTypes = productTypes.map((p) => p.productType).filter(Boolean) as string[];

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    if (category)    params.set('category', category);
    if (q)            params.set('q', q);
    if (sort)         params.set('sort', sort);
    if (brand)        params.set('brand', brand);
    if (season)       params.set('season', season);
    if (productType)  params.set('productType', productType);
    if (isNew)        params.set('isNew', isNew);
    if (isOnSale)     params.set('isOnSale', isOnSale);
    if (isCarryOver)  params.set('isCarryOver', isCarryOver);
    if (p > 1)        params.set('page', String(p));
    const qs = params.toString();
    return `/home/products${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ProductsPageHeader
        isNew={isNew} isOnSale={isOnSale} isCarryOver={isCarryOver} sort={sort}
        brand={brand} season={season} category={currentCategory} q={q}
        count={totalCount}
      />

      {/* 검색 + 정렬 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <form className="flex-1 flex gap-2">
          {category    && <input type="hidden" name="category"    value={category} />}
          {brand       && <input type="hidden" name="brand"       value={brand} />}
          {season      && <input type="hidden" name="season"      value={season} />}
          {productType && <input type="hidden" name="productType" value={productType} />}
          {isNew       && <input type="hidden" name="isNew"       value={isNew} />}
          {isOnSale    && <input type="hidden" name="isOnSale"    value={isOnSale} />}
          {isCarryOver && <input type="hidden" name="isCarryOver" value={isCarryOver} />}
          <ProductsSearchInput defaultValue={q} />
        </form>
        <SortSelect defaultValue={sort} />
      </div>

      {/* 브랜드 필터 A-Z */}
      <div className="mb-4">
        <BrandFilterAZ brands={dbBrands} activeBrand={brand} />
      </div>

      {/* 브랜드 선택 시: 종류별·시즌별 필터 */}
      {brand && (
        <div className="mb-5 pl-3 border-l-2 border-primary-200 space-y-3">
          {uniqueProductTypes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2"><T k="products.typeFilter" /></p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/home/products?brand=${encodeURIComponent(brand)}${season ? `&season=${encodeURIComponent(season)}` : ''}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!productType ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-violet-700 hover:border-violet-400'}`}>
                  <T k="products.all" />
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

          {uniqueSeasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2"><T k="products.seasonFilter" /></p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/home/products?brand=${encodeURIComponent(brand)}${productType ? `&productType=${encodeURIComponent(productType)}` : ''}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!season ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-amber-700 hover:border-amber-400'}`}>
                  <T k="products.all" />
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
          <h3 className="font-semibold text-slate-700 mb-3 text-xs uppercase tracking-wide"><T k="products.category" /></h3>
          <div className="space-y-1">
            <Link href="/home/products"
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${!category && !isNew && !isOnSale && !isCarryOver && sort !== 'popular' ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-primary-50'}`}>
              <T k="products.all" />
            </Link>
            <Link href="/home/products?isNew=1"
              className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isNew === '1' ? 'bg-primary-600 text-white' : 'text-primary-600 hover:bg-primary-50'}`}>
              ✨ <T k="nav.new" />
            </Link>
            <Link href="/home/products?isOnSale=1"
              className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isOnSale === '1' ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'}`}>
              🔥 <T k="nav.sale" />
            </Link>
            <Link href="/home/products?isCarryOver=1"
              className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isCarryOver === '1' ? 'bg-slate-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              📦 <T k="nav.carryover" />
            </Link>
            <Link href="/home/products?sort=popular"
              className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${sort === 'popular' ? 'bg-slate-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <T k="nav.popular" />
            </Link>
            <div className="my-1 border-t border-slate-100" />
            <CategoryGroupSidebar categories={categories} activeCategory={category} activeSeason={season} />
          </div>
        </aside>

        {/* 상품 그리드 */}
        <div className="flex-1">
          {products.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <div className="text-5xl mb-4">😢</div>
              <p><T k="products.empty" /></p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => {
                const gradePrice = (product as any).prices?.find((p: any) => p.grade === grade);
                const basePrice  = gradePrice ? Number(gradePrice.price) : Number(product.price);
                const finalPrice = calcFinalPrice(basePrice, product.isOnSale, (product as any).saleType, (product as any).saleValue);
                return (
                  <ProductCard key={product.id} product={{ ...product, myGradePrice: basePrice, myFinalPrice: finalPrice } as any}
                    isWishlisted={wishlistIds.has(product.id)} />
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Link href={buildPageHref(Math.max(1, page - 1))}
                aria-disabled={page === 1}
                className={`px-3 py-1.5 rounded-lg text-sm border ${page === 1 ? 'pointer-events-none text-slate-300 border-slate-100' : 'text-slate-600 border-slate-200 hover:border-primary-400 hover:text-primary-600'}`}>
                ‹
              </Link>
              <span className="text-sm text-slate-500 px-2">{page} / {totalPages}</span>
              <Link href={buildPageHref(Math.min(totalPages, page + 1))}
                aria-disabled={page === totalPages}
                className={`px-3 py-1.5 rounded-lg text-sm border ${page === totalPages ? 'pointer-events-none text-slate-300 border-slate-100' : 'text-slate-600 border-slate-200 hover:border-primary-400 hover:text-primary-600'}`}>
                ›
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
