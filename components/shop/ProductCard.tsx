'use client';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice, getSaleLabel } from '@/lib/utils';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { localizeProduct, localizeCategoryName } from '@/lib/productLocale';

interface Props {
  product: {
    id: string;
    name: string;
    images: string[];
    category: { name: string };
    isOnSale?: boolean;
    saleType?: string | null;
    saleValue?: number | null;
    myGradePrice?: number;
    myFinalPrice?: number;
    price?: number;
    updatedAt?: Date | string;
    [key: string]: any;
  };
  isWishlisted?: boolean;
  onWishlistToggle?: (productId: string) => void;
}

export default function ProductCard({ product: rawProduct, isWishlisted = false, onWishlistToggle }: Props) {
  const { t, i18n } = useTranslation();
  const product = localizeProduct(rawProduct, i18n.language);
  const categoryName = localizeCategoryName(rawProduct.category, i18n.language);
  const { data: session } = useSession();
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(isWishlisted);
  const [toggling, setToggling] = useState(false);

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!session) { router.push('/login'); return; }
    if (toggling) return;

    const next = !wishlisted;
    setToggling(true);
    try {
      await fetch('/api/wishlist', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      setWishlisted(next);
      onWishlistToggle?.(product.id);
    } finally {
      setToggling(false);
    }
  };

  const basePrice  = product.myGradePrice ?? product.price ?? 0;
  const finalPrice = product.myFinalPrice ?? basePrice;
  const hasDiscount = product.isOnSale && finalPrice < basePrice;

  return (
    <Link href={`/home/products/${product.id}`} className="group card overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-square bg-primary-50 overflow-hidden">
        <Image
          src={product.images[0] || 'https://placehold.co/400x400/EFF6FF/2563EB?text=상품'}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <button onClick={handleWishlist} disabled={toggling} className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm disabled:opacity-60" aria-label={t('nav.wishlistFull')}>
          <svg className={`w-5 h-5 transition-colors ${wishlisted ? 'fill-red-500 text-red-500' : 'fill-none text-slate-400'}`}
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        {session && product.isOnSale && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
            {getSaleLabel(product.saleType ?? null, product.saleValue ?? null, t('common.discount'))}
          </span>
        )}
        {product.category && (
          <span className="absolute bottom-2 left-2 badge bg-primary-100 text-primary-700 text-xs">
            {categoryName}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-slate-800 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {product.name}
        </h3>
        {!session ? (
          <p className="text-sm text-slate-400 font-medium mt-1">{t('product.loginToView')}</p>
        ) : hasDiscount ? (
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 line-through">{formatPrice(basePrice)}</span>
              <span className="text-xs text-slate-300">→</span>
              <span className="font-bold text-red-500">{formatPrice(finalPrice)}</span>
            </div>
            <span className="text-xs font-semibold text-red-400">
              {getSaleLabel(product.saleType ?? null, product.saleValue ?? null, t('common.discount'))}
            </span>
          </div>
        ) : (
          <p className="text-primary-700 font-bold mt-1">{formatPrice(finalPrice)}</p>
        )}
        {product.updatedAt && (
          <p className="text-xs text-slate-400 mt-1">
            {t('product.updated')} {new Date(product.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
          </p>
        )}
      </div>
    </Link>
  );
}
