export function formatPrice(price: number): string {
  return price.toLocaleString('ko-KR') + '원';
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export const DEALER_GRADE_LABELS: Record<string, string> = {
  REGULAR: '일반회원',
  SILVER:  '실버 대리점',
  GOLD:    '골드 대리점',
  VIP:     'VIP 대리점',
};

export const DEALER_GRADE_ORDER = ['REGULAR', 'SILVER', 'GOLD', 'VIP'] as const;
export type DealerGrade = typeof DEALER_GRADE_ORDER[number];

export function calcFinalPrice(
  basePrice: number,
  isOnSale: boolean,
  saleType: string | null | undefined,
  saleValue: number | null | undefined,
): number {
  if (!isOnSale || !saleType || !saleValue) return basePrice;
  if (saleType === 'RATE')   return Math.round(basePrice * (1 - saleValue / 100));
  if (saleType === 'AMOUNT') return Math.max(0, basePrice - saleValue);
  return basePrice;
}

export function getSaleLabel(saleType: string | null, saleValue: number | null): string {
  if (!saleType || !saleValue) return 'SALE';
  if (saleType === 'RATE')   return `${saleValue}% 할인`;
  if (saleType === 'AMOUNT') return `${saleValue.toLocaleString()}원 할인`;
  return 'SALE';
}

export const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: '주문접수', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: '주문확인', color: 'bg-blue-100 text-blue-800' },
  SHIPPING:  { label: '배송중',   color: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: '배송완료', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '취소',     color: 'bg-red-100 text-red-800' },
};
