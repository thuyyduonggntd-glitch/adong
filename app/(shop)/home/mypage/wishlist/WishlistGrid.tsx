'use client';
import ProductCard from '@/components/shop/ProductCard';
import Link from 'next/link';
import { useState } from 'react';

interface Props {
  items: Array<{
    id: string;
    productId: string;
    product: { id: string; name: string; price: number; images: string[]; category: { name: string }; isOnSale: boolean; saleType: string | null; saleValue: number | null; myGradePrice?: number; myFinalPrice?: number };
  }>;
}

export default function WishlistGrid({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);

  const handleRemove = async (productId: string) => {
    await fetch('/api/wishlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  if (items.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <div className="text-5xl mb-3">❤️</div>
      <p className="mb-4">관심 상품이 없습니다.</p>
      <Link href="/home/products" className="btn-primary text-sm">상품 둘러보기</Link>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <ProductCard
          key={item.id}
          product={item.product}
          isWishlisted
          onWishlistToggle={handleRemove}
        />
      ))}
    </div>
  );
}
