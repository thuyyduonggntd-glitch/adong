'use client';
import { useEffect, useState, useMemo } from 'react';
import { formatPrice } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';

type Product = {
  id: string; name: string; images: string[]; colors: string[]; brand: string | null; productNumber?: string | null;
  isOnSale: boolean; saleType: string | null; saleValue: number | null;
};
type OrderItem = {
  id: string; quantity: number; price: number; size: string; color: string;
  arrivedAt: string | null; cancelledAt: string | null; cancelLocked: boolean;
  outOfStockAt: string | null; unshippedAt: string | null;
  remark: string | null;
  product: Product;
};
type Order = {
  id: string; totalAmount: number; status: string; note: string | null;
  cancelLocked: boolean; createdAt: string; items: OrderItem[];
};
type OutStockItem = {
  id: string; quantity: number; price: number; size: string; color: string;
  outOfStockAt: string | null; unshippedAt: string | null;
  remark: string | null;
  product: Product;
  order: { id: string; createdAt: string };
};

const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:   { label: '접수',   color: 'bg-orange-100 text-orange-700', icon: '●' },
  CONFIRMED: { label: '확인',   color: 'bg-green-100 text-green-700',   icon: '✓' },
  SHIPPING:  { label: '배송중', color: 'bg-blue-100 text-blue-700',     icon: '🚚' },
  DELIVERED: { label: '완료',   color: 'bg-slate-100 text-slate-500',   icon: '✔' },
  CANCELLED: { label: '취소',   color: 'bg-red-100 text-red-500',       icon: '✕' },
};

type FlatItem = OrderItem & { orderId: string; orderCreatedAt: string; orderStatus: string };
type PageTab = 'orders' | 'ousu';

/* ── 소계 행 ── */
function SubtotalRow({ items, leadingCols, trailingColSpan = 2 }: {
  items: Array<{ quantity: number; price: number }>;
  leadingCols: number; // 브랜드 앞에 오는 열 수 (체크박스=1, 구분=1, 없음=0)
  trailingColSpan?: number; // 주문일 이후 열 수 (기본 2, 비고 열 있으면 3)
}) {
  const count    = items.length;
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const totalAmt = items.reduce((s, it) => s + it.price * it.quantity, 0);
  // 열 구조: [leadingCols] 브랜드 사진 이름 사이즈 컬러 | 수량 | SALE 단가 | Total | 주문일 extra
  return (
    <tr className="bg-slate-100 border-t-2 border-slate-200">
      <td colSpan={leadingCols + 5} className="px-4 py-2.5 text-xs text-slate-500">
        소계 <span className="font-bold text-slate-700">{count}건</span>
      </td>
      <td className="px-3 py-2.5 text-center text-sm font-bold text-slate-700">{totalQty}개</td>
      <td colSpan={2} />
      <td className="px-3 py-2.5 text-right text-sm font-bold text-primary-700 whitespace-nowrap">{formatPrice(totalAmt)}</td>
      <td colSpan={trailingColSpan} />
    </tr>
  );
}

/* ── 공통 thead ── */
function ColHeaders({ hasCheckbox, extraLabel }: { hasCheckbox?: boolean; extraLabel?: string }) {
  return (
    <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
      {hasCheckbox && <th className="px-3 py-3 w-10" />}
      <th className="px-3 py-3 text-left">브랜드</th>
      <th className="px-3 py-3 text-left w-14">사진</th>
      <th className="px-3 py-3 text-left">이름</th>
      <th className="px-3 py-3 text-center w-20">사이즈</th>
      <th className="px-3 py-3 text-center w-20">컬러</th>
      <th className="px-3 py-3 text-center w-14">수량</th>
      <th className="px-3 py-3 text-center w-16">SALE</th>
      <th className="px-3 py-3 text-right">단가</th>
      <th className="px-3 py-3 text-right w-28">Total</th>
      <th className="px-3 py-3 text-left w-36">주문일</th>
      {extraLabel && <th className="px-3 py-3 text-center w-20">{extraLabel}</th>}
    </tr>
  );
}

/* ── 공통 상품 셀 ── */
function ProductCells({ product, size, color, quantity, price, orderCreatedAt, extra }: {
  product: Product; size: string; color: string; quantity: number; price: number;
  orderCreatedAt: string; extra?: React.ReactNode;
}) {
  const beforeSalePrice = product.isOnSale && product.saleType && product.saleValue
    ? product.saleType === 'RATE'
      ? Math.round(price / (1 - product.saleValue / 100))
      : price + product.saleValue
    : null;
  const total = price * quantity;
  const colorIdx = product.colors?.indexOf(color) ?? -1;
  const imgSrc = (colorIdx >= 0 && product.images[colorIdx]) ? product.images[colorIdx] : (product.images[0] || 'https://placehold.co/48x48');

  return (
    <>
      {/* 브랜드 */}
      <td className="px-3 py-3">
        {product.brand
          ? <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded whitespace-nowrap">{product.brand}</span>
          : <span className="text-slate-300 text-xs">-</span>}
      </td>
      {/* 사진 */}
      <td className="px-3 py-3">
        <Link href={`/home/products/${product.id}`}>
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-primary-50 flex-shrink-0">
            <Image src={imgSrc} alt={product.name} fill className="object-cover" />
          </div>
        </Link>
      </td>
      {/* 이름 */}
      <td className="px-3 py-3">
        <p className="font-medium text-slate-800 truncate max-w-[180px]">{product.name}</p>
        {product.productNumber && (
          <span className="text-xs text-slate-400 font-mono">{product.productNumber}</span>
        )}
      </td>
      {/* 사이즈 */}
      <td className="px-3 py-3 text-center text-xs text-slate-500">{size}</td>
      {/* 컬러 */}
      <td className="px-3 py-3 text-center text-xs text-slate-500">{color}</td>
      {/* 수량 */}
      <td className="px-3 py-3 text-center font-semibold text-slate-700">{quantity}</td>
      {/* SALE */}
      <td className="px-3 py-3 text-center">
        {product.isOnSale && product.saleValue ? (
          <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
            {product.saleType === 'RATE' ? `-${product.saleValue}%` : `-${formatPrice(product.saleValue)}`}
          </span>
        ) : (
          <span className="text-slate-200 text-xs">-</span>
        )}
      </td>
      {/* 단가 */}
      <td className="px-3 py-3 text-right">
        {beforeSalePrice ? (
          <div>
            <p className="text-xs text-slate-400 line-through">{formatPrice(beforeSalePrice)}</p>
            <p className="text-sm font-bold text-red-600">{formatPrice(price)}</p>
          </div>
        ) : (
          <p className="text-sm font-semibold text-primary-700">{formatPrice(price)}</p>
        )}
      </td>
      {/* Total */}
      <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
        {formatPrice(total)}
      </td>
      {/* 주문일 */}
      <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">
        {new Date(orderCreatedAt).toLocaleString('ko-KR', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        })}
      </td>
      {/* 추가 열 (상태/구분/시간 등) */}
      {extra !== undefined && <td className="px-3 py-3 text-center">{extra}</td>}
    </>
  );
}

type CancelPolicy = { globalEnabled: boolean; cancelFrom: string | null; cancelTo: string | null };

function isWithinCancelWindow(cancelFrom: string | null, cancelTo: string | null): boolean {
  if (!cancelFrom || !cancelTo) return true;
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const cur = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const [fh, fm] = cancelFrom.split(':').map(Number);
  const [th, tm] = cancelTo.split(':').map(Number);
  const from = fh * 60 + fm;
  const to   = th * 60 + tm;
  return from <= to ? cur >= from && cur <= to : cur >= from || cur <= to;
}

export default function OrdersPage() {
  const [orders, setOrders]          = useState<Order[]>([]);
  const [ousuItems, setOusuItems]    = useState<OutStockItem[]>([]);
  const [selectedItems, setSelected] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling]  = useState(false);
  const [loading, setLoading]        = useState(true);
  const [errMsg, setErrMsg]          = useState('');
  const [tab, setTab]                = useState<PageTab>('orders');
  const [cancelPolicy, setCancelPolicy] = useState<CancelPolicy>({ globalEnabled: false, cancelFrom: null, cancelTo: null });
  const [now, setNow] = useState(() => new Date());

  const loadData = () => Promise.all([
    fetch('/api/orders').then((r) => r.json()),
    fetch('/api/orders/items?outOfStockOrUnshipped=1').then((r) => r.json()),
    fetch('/api/cancel-policy').then((r) => r.json()),
  ]).then(([o, ousu, pol]) => {
    setOrders(Array.isArray(o) ? o : []);
    setOusuItems(Array.isArray(ousu) ? ousu : []);
    setCancelPolicy({ globalEnabled: pol.globalEnabled ?? false, cancelFrom: pol.cancelFrom ?? null, cancelTo: pol.cancelTo ?? null });
  }).catch(() => {});

  useEffect(() => {
    loadData().then(() => setLoading(false));
    // 1분마다 전체 데이터 갱신 (어드민 품절/미송 처리 반영)
    const timer = setInterval(() => {
      setNow(new Date());
      loadData();
    }, 60_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (newTab: PageTab) => {
    setTab(newTab);
    // 탭 전환 시 데이터 재조회 (어드민 처리 즉시 반영)
    loadData();
  };

  // 취소 가능 여부 (정책 + 현재 시간)
  const canCancelNow = useMemo(() => {
    if (!cancelPolicy.globalEnabled) return false;
    return isWithinCancelWindow(cancelPolicy.cancelFrom, cancelPolicy.cancelTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelPolicy, now]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const isCheckable = (item: OrderItem) =>
    canCancelNow && !item.cancelledAt && !item.arrivedAt && !item.outOfStockAt && !item.unshippedAt && !item.cancelLocked;

  const activeFlat = useMemo<FlatItem[]>(() =>
    orders.flatMap((o) =>
      o.items
        .filter((it) => !it.cancelledAt && !it.arrivedAt && !it.outOfStockAt && !it.unshippedAt)
        .map((it) => ({ ...it, orderId: o.id, orderCreatedAt: o.createdAt, orderStatus: o.status }))
    ), [orders]);

  const arrivedFlat = useMemo<FlatItem[]>(() =>
    orders.flatMap((o) =>
      o.items
        .filter((it) => !it.cancelledAt && it.arrivedAt && new Date(it.arrivedAt) >= today)
        .map((it) => ({ ...it, orderId: o.id, orderCreatedAt: o.createdAt, orderStatus: o.status }))
    ), [orders, today]);

  const todayOusuFlat = useMemo<FlatItem[]>(() =>
    orders.flatMap((o) =>
      o.items
        .filter((it) => {
          const oos = it.outOfStockAt ? new Date(it.outOfStockAt) >= today : false;
          const uns = it.unshippedAt  ? new Date(it.unshippedAt)  >= today : false;
          return oos || uns;
        })
        .map((it) => ({ ...it, orderId: o.id, orderCreatedAt: o.createdAt, orderStatus: o.status }))
    ), [orders, today]);

  const checkableIds = useMemo(() => activeFlat.filter(isCheckable).map((it) => it.id), [activeFlat, canCancelNow]);
  const allChecked   = checkableIds.length > 0 && checkableIds.every((id) => selectedItems.has(id));
  const someChecked  = checkableIds.some((id) => selectedItems.has(id));

  const toggleAll = () => {
    if (allChecked) {
      setSelected((prev) => { const n = new Set(prev); checkableIds.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); checkableIds.forEach((id) => n.add(id)); return n; });
    }
  };
  const toggleItem = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleCancelSelected = async () => {
    const itemIds = Array.from(selectedItems);
    if (!itemIds.length) return;
    if (!confirm(`선택한 상품 ${itemIds.length}건을 취소하시겠습니까?`)) return;
    setCancelling(true); setErrMsg('');
    const res = await fetch('/api/orders/items', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds, action: 'cancel' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setErrMsg(err.error || '취소에 실패했습니다.');
      setCancelling(false); return;
    }
    const now = new Date().toISOString();
    setOrders((prev) => prev.map((o) => ({
      ...o, items: o.items.map((it) => selectedItems.has(it.id) ? { ...it, cancelledAt: now } : it),
    })));
    setSelected(new Set()); setCancelling(false);
  };

  const selCount = selectedItems.size;

  if (loading) return <div className="text-center py-16 text-slate-400">로딩 중...</div>;

  const hasAny = activeFlat.length > 0 || arrivedFlat.length > 0 || todayOusuFlat.length > 0 || ousuItems.length > 0;
  if (!hasAny) {
    return (
      <div className="text-center py-16 text-slate-400">
        <div className="text-5xl mb-3">📦</div><p>주문 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => switchTab('orders')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'orders' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-400'}`}>
          주문내역
        </button>
        <button onClick={() => switchTab('ousu')}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'ousu' ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-300'}`}>
          품절/미송
          {ousuItems.length > 0 && (
            <span className={`ml-1.5 text-xs font-normal ${tab === 'ousu' ? 'text-white/80' : 'text-slate-400'}`}>{ousuItems.length}</span>
          )}
        </button>
      </div>

      {/* ── 주문내역 탭 ── */}
      {tab === 'orders' && (
        <div className="space-y-6">

          {/* 취소 가능 시간 안내 배너 */}
          {cancelPolicy.globalEnabled && (cancelPolicy.cancelFrom || cancelPolicy.cancelTo) && (
            canCancelNow ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">주문 취소 가능 시간입니다</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    취소 가능 시간: <span className="font-semibold">{cancelPolicy.cancelFrom} ~ {cancelPolicy.cancelTo}</span>
                    <span className="ml-2 text-emerald-500">(한국시간 기준)</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-amber-700">현재 주문 취소 불가 시간입니다</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    취소 가능 시간: <span className="font-semibold">{cancelPolicy.cancelFrom} ~ {cancelPolicy.cancelTo}</span>
                    <span className="ml-2 text-amber-500">(한국시간 기준)</span>
                  </p>
                </div>
              </div>
            )
          )}
          {!cancelPolicy.globalEnabled && (
            <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <p className="text-sm font-medium text-red-600">현재 주문 취소가 비활성화 상태입니다.</p>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-slate-400">
              {canCancelNow ? '🔒 잠금 표시가 없는 상품은 체크 후 취소 가능합니다' : '취소 가능 시간에만 주문을 취소할 수 있습니다'}
            </p>
            <div className="flex items-center gap-3">
              {errMsg && <span className="text-xs text-red-500">{errMsg}</span>}
              {selCount > 0 && (
                <button onClick={handleCancelSelected} disabled={cancelling}
                  className="text-sm px-4 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {cancelling ? '처리중...' : `선택 취소 (${selCount}건)`}
                </button>
              )}
            </div>
          </div>

          {/* 주문 중 */}
          {activeFlat.length > 0 && (
            <section>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-3 w-10">
                          {checkableIds.length > 0 && (
                            <input type="checkbox" checked={allChecked}
                              ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                              onChange={toggleAll} className="w-4 h-4 accent-red-500 cursor-pointer" title="전체선택" />
                          )}
                        </th>
                        <th className="px-3 py-3 text-left">브랜드</th>
                        <th className="px-3 py-3 text-left w-14">사진</th>
                        <th className="px-3 py-3 text-left">이름</th>
                        <th className="px-3 py-3 text-center w-20">사이즈</th>
                        <th className="px-3 py-3 text-center w-20">컬러</th>
                        <th className="px-3 py-3 text-center w-14">수량</th>
                        <th className="px-3 py-3 text-center w-16">SALE</th>
                        <th className="px-3 py-3 text-right">단가</th>
                        <th className="px-3 py-3 text-right w-28">Total</th>
                        <th className="px-3 py-3 text-left w-36">주문일</th>
                        <th className="px-3 py-3 text-center w-20">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {activeFlat.map((item) => {
                        const checkable  = isCheckable(item);
                        const isSelected = selectedItems.has(item.id);
                        const st         = STATUS_LABEL[item.orderStatus] || STATUS_LABEL.PENDING;
                        return (
                          <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-red-50/40' : ''}`}>
                            <td className="px-3 py-3 text-center">
                              {checkable ? (
                                <input type="checkbox" checked={isSelected} onChange={() => toggleItem(item.id)} className="w-4 h-4 accent-red-500 cursor-pointer" />
                              ) : item.cancelLocked ? (
                                <span title="취소 잠금됨" className="text-slate-300 text-base leading-none select-none">🔒</span>
                              ) : !canCancelNow && !item.cancelledAt && !item.arrivedAt && !item.outOfStockAt && !item.unshippedAt ? (
                                <span title={`취소 가능 시간: ${cancelPolicy.cancelFrom ?? ''} ~ ${cancelPolicy.cancelTo ?? ''}`}
                                  className="text-[10px] text-slate-400 leading-tight block whitespace-nowrap">취소불가</span>
                              ) : (
                                <span className="text-slate-200 text-xs">—</span>
                              )}
                            </td>
                            <ProductCells
                              product={item.product} size={item.size} color={item.color}
                              quantity={item.quantity} price={item.price}
                              orderCreatedAt={item.orderCreatedAt}
                              extra={<span className={`badge text-xs ${st.color}`}>{st.icon} {st.label}</span>}
                            />
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><SubtotalRow items={activeFlat} leadingCols={1} /></tfoot>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* 오늘 입고됨 */}
          {arrivedFlat.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-emerald-700">오늘 입고됨</h3>
                <span className="text-xs text-slate-400">상품이 입고되었습니다. 배송이 곧 시작됩니다.</span>
              </div>
              <div className="card overflow-hidden border-l-4 border-emerald-400">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead><ColHeaders extraLabel="입고시간" /></thead>
                    <tbody className="divide-y divide-emerald-50">
                      {arrivedFlat.map((item) => (
                        <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                          <ProductCells
                            product={item.product} size={item.size} color={item.color}
                            quantity={item.quantity} price={item.price}
                            orderCreatedAt={item.orderCreatedAt}
                            extra={
                              <span className="text-xs text-emerald-600 font-medium">
                                {item.arrivedAt ? new Date(item.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </span>
                            }
                          />
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><SubtotalRow items={arrivedFlat} leadingCols={0} /></tfoot>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* 오늘 품절/미송 */}
          {todayOusuFlat.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-orange-600">오늘 품절/미송 안내</h3>
                <span className="text-xs text-slate-400">아래 상품은 품절 또는 미송 처리되었습니다.</span>
              </div>
              <div className="card overflow-hidden border-l-4 border-orange-400">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead><ColHeaders extraLabel="구분" /></thead>
                    <tbody className="divide-y divide-orange-50">
                      {todayOusuFlat.map((item) => (
                        <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                          <ProductCells
                            product={item.product} size={item.size} color={item.color}
                            quantity={item.quantity} price={item.price}
                            orderCreatedAt={item.orderCreatedAt}
                            extra={
                              <div className="flex flex-col gap-1 items-center">
                                {item.outOfStockAt
                                  ? <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full whitespace-nowrap">품절</span>
                                  : <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full whitespace-nowrap">미송</span>}
                                {item.remark && (
                                  <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded max-w-[120px] truncate">{item.remark}</span>
                                )}
                              </div>
                            }
                          />
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><SubtotalRow items={todayOusuFlat} leadingCols={0} /></tfoot>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeFlat.length === 0 && arrivedFlat.length === 0 && todayOusuFlat.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📦</div>
              <p>진행 중인 주문이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* ── 품절/미송 탭 ── */}
      {tab === 'ousu' && (
        <div>
          {ousuItems.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📋</div>
              <p>품절/미송 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-3 text-center w-16">구분</th>
                      <th className="px-3 py-3 text-left">브랜드</th>
                      <th className="px-3 py-3 text-left w-14">사진</th>
                      <th className="px-3 py-3 text-left">이름</th>
                      <th className="px-3 py-3 text-center w-20">사이즈</th>
                      <th className="px-3 py-3 text-center w-20">컬러</th>
                      <th className="px-3 py-3 text-center w-14">수량</th>
                      <th className="px-3 py-3 text-center w-16">SALE</th>
                      <th className="px-3 py-3 text-right">단가</th>
                      <th className="px-3 py-3 text-right w-28">Total</th>
                      <th className="px-3 py-3 text-left w-36">주문일</th>
                      <th className="px-3 py-3 text-center w-32">처리일시</th>
                      <th className="px-3 py-3 text-left">비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ousuItems.map((item) => {
                      const isOos = !!item.outOfStockAt;
                      const processedAt = isOos ? item.outOfStockAt! : item.unshippedAt!;
                      return (
                        <tr key={item.id} className={`transition-colors ${isOos ? 'hover:bg-orange-50/20' : 'hover:bg-purple-50/20'}`}>
                          <td className="px-3 py-3 text-center">
                            {isOos
                              ? <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-full">품절</span>
                              : <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded-full">미송</span>}
                          </td>
                          <ProductCells
                            product={item.product} size={item.size} color={item.color}
                            quantity={item.quantity} price={item.price}
                            orderCreatedAt={item.order.createdAt}
                            extra={
                              <span className={`text-xs font-medium whitespace-nowrap ${isOos ? 'text-orange-500' : 'text-purple-500'}`}>
                                {new Date(processedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            }
                          />
                          <td className="px-3 py-3">
                            {item.remark ? (
                              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded font-medium max-w-[160px] block">{item.remark}</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><SubtotalRow items={ousuItems.map(it => ({ ...it, product: it.product }))} leadingCols={1} trailingColSpan={3} /></tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
