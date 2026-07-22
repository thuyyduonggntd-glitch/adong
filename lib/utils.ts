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

export function getSaleLabel(saleType: string | null, saleValue: number | null, discountWord = '할인'): string {
  if (!saleType || !saleValue) return 'SALE';
  if (saleType === 'RATE')   return `${saleValue}% ${discountWord}`;
  if (saleType === 'AMOUNT') return `${saleValue.toLocaleString()}원 ${discountWord}`;
  return 'SALE';
}

/**
 * Transaction.description은 DB에 한국어 문장으로 고정 저장된다 (관리자 페이지가 그대로 표시/편집하므로 형식 변경 불가).
 * 회원 페이지에서만 알려진 패턴을 매칭해 번역한다. 매칭되지 않는 값(관리자가 직접 입력한 자유 텍스트 등)은 원문 그대로 반환.
 */
export function translateTransactionDesc(description: string | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!description) return '';
  if (description === '주문 상품 입고') return t('transactions.desc.orderArrival');
  if (description === '관리자 취소 (입고 취소)') return t('transactions.desc.adminCancelArrival');
  if (description === '입고 취소 (주문확인으로 되돌리기)') return t('transactions.desc.revertToConfirmed');
  const priceAdjMatch = description.match(/^가격 수정 조정 \(주문상품 #(.+)\)$/);
  if (priceAdjMatch) return t('transactions.desc.priceAdjustment', { id: priceAdjMatch[1] });
  return description;
}

export function isWithinTimeWindow(from: string | null | undefined, to: string | null | undefined): boolean {
  if (!from || !to) return true;
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const cur = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const start = fh * 60 + fm;
  const end   = th * 60 + tm;
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}

export const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: '주문접수', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: '주문확인', color: 'bg-blue-100 text-blue-800' },
  SHIPPING:  { label: '배송중',   color: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: '배송완료', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '취소',     color: 'bg-red-100 text-red-800' },
};
