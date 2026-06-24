'use client';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice, getSaleLabel } from '@/lib/utils';
import { useState } from 'react';

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
  };
  isWishlisted?: boolean;
  onWishlistToggle?: (productId: string) => void;
}

export default function ProductCard({ product, isWishlisted = false, onWishlistToggle }: Props) {
  const [wishlisted, setWishlisted] = useState(isWishlisted);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    setWishlisted(!wishlisted);
    onWishlistToggle?.(product.id);
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
        <button onClick={handleWishlist} className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm" aria-label="관심상품">
          <svg className={`w-5 h-5 transition-colors ${wishlisted ? 'fill-red-500 text-red-500' : 'fill-none text-slate-400'}`}
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        {product.isOnSale && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
            {getSaleLabel(product.saleType ?? null, product.saleValue ?? null)}
          </span>
        )}
        <span className="absolute bottom-2 left-2 badge bg-primary-100 text-primary-700 text-xs">
          {product.category.name}
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-slate-800 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {product.name}
        </h3>
        {hasDiscount ? (
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 line-through">{formatPrice(basePrice)}</span>
              <span className="text-xs text-slate-300">→</span>
              <span className="font-bold text-red-500">{formatPrice(finalPrice)}</span>
            </div>
            <span className="text-xs font-semibold text-red-400">
              {getSaleLabel(product.saleType ?? null, product.saleValue ?? null)}
            </span>
          </div>
        ) : (
          <p className="text-primary-700 font-bold mt-1">{formatPrice(finalPrice)}</p>
        )}
      </div>
    </Link>
  );
}
