'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';
import Pagination from '@/components/ui/Pagination';
import { resolveColorImage } from '@/lib/productImages';

const PAGE_SIZE = 40;

type SaleProduct = {
  id: string; name: string; images: string[]; brand: string | null; colors: string[];
  colorImages?: { color: string; imageUrl: string }[];
  productNumber?: string | null;
};
/* 세일 스냅샷: OrderItem 자체에 저장된 "주문 당시" 세일 상태 (실시간 product.isOnSale 아님) */
type CancelledItem = {
  id: string; quantity: number; size: string | null; color: string | null; cancelledAt: string; price: number;
  confirmedAt: string | null;
  cancelledByAdmin: boolean;
  isOnSale: boolean; saleType: string | null; saleValue: number | null;
  product: SaleProduct;
  order: { id: string; status: string; userId: string; createdAt: string; note: string | null; user: { name: string; email: string } };
};

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function getKstMidnightUtc() {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  nowKst.setUTCHours(0, 0, 0, 0);
  return new Date(nowKst.getTime() - 9 * 60 * 60 * 1000);
}

/* ── 취소 테이블 ── */
function CancelTable({
  items, selected, todayMidnight, onToggle, onToggleAll, onRevert, onArrive, emptyText,
}: {
  items: CancelledItem[];
  selected: Set<string>;
  todayMidnight: Date;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onRevert: (ids: string[]) => void;
  onArrive: (ids: string[]) => void;
  emptyText: string;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pagedItems = useMemo(() => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [items, page]);
  useEffect(() => { setPage((p) => Math.min(p, totalPages)); }, [totalPages]);

  if (items.length === 0) {
    return <p className="text-center py-8 text-slate-400 text-sm">{emptyText}</p>;
  }

  // 헤더 체크박스는 현재 페이지 기준 (안전을 위해 "전체 선택"은 페이지 단위로만 동작)
  const allSel  = pagedItems.length > 0 && pagedItems.every((it) => selected.has(it.id));
  const someSel = pagedItems.some((it) => selected.has(it.id));
  // 일괄처리 대상은 여러 페이지에 걸쳐 직접 체크한 항목을 모두 포함
  const selIds  = items.filter((it) => selected.has(it.id)).map((it) => it.id);
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const totalAmt = items.reduce((s, it) => s + it.price * it.quantity, 0);

  return (
    <div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} summary={`총 ${items.length}건`} />
      {selIds.length > 0 && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-sm text-slate-500">{selIds.length}건 선택됨</span>
          <button onClick={() => onRevert(selIds)} className="text-xs px-4 py-1.5 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 transition-colors">
            주문확인으로 되돌리기
          </button>
          <button onClick={() => onArrive(selIds)} className="text-xs px-4 py-1.5 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
            ✓ 입고 처리
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-3 py-3">
                  <input type="checkbox" checked={allSel}
                    ref={(el) => { if (el) el.indeterminate = someSel && !allSel; }}
                    onChange={() => onToggleAll(pagedItems.map((it) => it.id))}
                    className="w-4 h-4 accent-primary-600" />
                </th>
                <th className="px-3 py-3 text-left">아이디</th>
                <th className="px-3 py-3 text-left">상태</th>
                <th className="px-3 py-3 text-left">브랜드</th>
                <th className="px-3 py-3 text-left">사진</th>
                <th className="px-3 py-3 text-left">상품명</th>
                <th className="px-3 py-3 text-left">사이즈</th>
                <th className="px-3 py-3 text-left">색상</th>
                <th className="px-3 py-3 text-center">수량</th>
                <th className="px-3 py-3 text-center">세일율</th>
                <th className="px-3 py-3 text-right">단가</th>
                <th className="px-3 py-3 text-right">합계</th>
                <th className="px-3 py-3 text-left">주문일</th>
                <th className="px-3 py-3 text-left">취소일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedItems.map((it) => {
                const imgSrc = resolveColorImage(it.color, it.product.colorImages, it.product.images, 'https://placehold.co/40x40/EFF6FF/2563EB?text=상품');
                const isSel   = selected.has(it.id);
                const isToday = new Date(it.cancelledAt).getTime() >= todayMidnight.getTime();
                const wasConfirmed = !!it.confirmedAt;
                return (
                  <tr key={it.id} className={`transition-colors ${isSel ? 'bg-primary-50/40' : isToday ? 'bg-red-50/20' : 'opacity-70 hover:bg-slate-50'}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isSel} onChange={() => onToggle(it.id)} className="w-4 h-4 accent-primary-600" />
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {it.order.user.name}
                      <span className="block text-slate-400 font-mono">#{it.order.id.slice(-6).toUpperCase()}</span>
                      {it.order.note && (
                        <span className="block mt-0.5 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] leading-tight max-w-[120px] break-words whitespace-normal">
                          {it.order.note}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {wasConfirmed
                        ? <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded whitespace-nowrap">확인 취소</span>
                        : <span className="text-xs font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded whitespace-nowrap">접수 취소</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded whitespace-nowrap">
                        {it.product.brand || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-primary-50">
                        <Image src={imgSrc} alt={it.product.name} fill className="object-cover" />
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800 max-w-[150px]">
                      <span className="block truncate">{it.product.name}</span>
                      {it.product.productNumber && <span className="block text-xs text-slate-400 font-mono">{it.product.productNumber}</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">{it.size || '-'}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{it.color || '-'}</td>
                    <td className="px-3 py-3 text-center font-semibold">{it.quantity}</td>
                    <td className="px-3 py-3 text-center">
                      {it.isOnSale
                        ? <span className="text-xs font-bold text-red-500 whitespace-nowrap">{it.saleType === 'RATE' ? `${it.saleValue}%` : it.saleValue ? `${it.saleValue.toLocaleString()}원` : ''}</span>
                        : <span className="text-slate-300 text-xs">-</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-primary-700">{formatPrice(it.price)}</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-400 line-through whitespace-nowrap">
                      {formatPrice(it.price * it.quantity)}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(it.order.createdAt)}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      <span className={`font-medium ${isToday ? 'text-red-500' : 'text-slate-400'}`}>
                        {formatDateTime(it.cancelledAt)}
                      </span>
                      {isToday && (
                        <span className="ml-1 text-[10px] bg-red-100 text-red-500 px-1 py-0.5 rounded">오늘</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
              <tr>
                <td colSpan={8} className="px-3 py-2">합계 ({items.length}건)</td>
                <td className="px-3 py-2 text-center">{totalQty}</td>
                <td />
                <td />
                <td className="px-3 py-2 text-right text-slate-400 line-through">{formatPrice(totalAmt)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="mt-3">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

export default function AdminCancelledPage() {
  const [items, setItems] = useState<CancelledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'오늘' | '전체'>('오늘');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const midnightRef = useRef(getKstMidnightUtc());

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/orders/items?cancelled=1');
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const todayMidnight = midnightRef.current;

  const visibleItems = useMemo(() => {
    if (view === '오늘') {
      return items.filter((it) => new Date(it.cancelledAt).getTime() >= todayMidnight.getTime());
    }
    return items;
  }, [items, view, todayMidnight]);

  const adminCancelled = useMemo(() => visibleItems.filter((it) => it.cancelledByAdmin),  [visibleItems]);
  const userCancelled  = useMemo(() => visibleItems.filter((it) => !it.cancelledByAdmin), [visibleItems]);

  const todayCount = useMemo(
    () => items.filter((it) => new Date(it.cancelledAt).getTime() >= todayMidnight.getTime()).length,
    [items, todayMidnight]
  );

  const toggleRow = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = (ids: string[]) => {
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      allSelected ? ids.forEach((id) => n.delete(id)) : ids.forEach((id) => n.add(id));
      return n;
    });
  };

  const actionRevert = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`${ids.length}건을 주문확인으로 되돌리시겠습니까?`)) return;
    await fetch('/api/orders/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: ids, action: 'revertToConfirmed' }),
    });
    setSelected(new Set());
    await fetchData();
  };

  const actionArrive = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`${ids.length}건을 입고 처리하시겠습니까?`)) return;
    await fetch('/api/orders/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: ids }),
    });
    setSelected(new Set());
    await fetchData();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">취소 상품</h1>

      {/* 오늘 / 전체 토글 */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {(['오늘', '전체'] as const).map((v) => (
          <button key={v} onClick={() => { setView(v); setSelected(new Set()); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${view === v ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {v}
            {v === '오늘' && todayCount > 0 && (
              <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">{todayCount}</span>
            )}
            {v === '전체' && items.length > 0 && (
              <span className="ml-1.5 text-xs bg-slate-400 text-white rounded-full px-1.5 py-0.5">{items.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : visibleItems.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">✅</div>
          <p>{view === '오늘' ? '오늘 취소된 상품이 없습니다.' : '취소된 상품이 없습니다. (90일 기준)'}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── 어드민 취소 섹션 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-bold text-slate-700">어드민 취소</h2>
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{adminCancelled.length}건</span>
            </div>
            <CancelTable
              items={adminCancelled}
              selected={selected}
              todayMidnight={todayMidnight}
              onToggle={toggleRow}
              onToggleAll={toggleAll}
              onRevert={actionRevert}
              onArrive={actionArrive}
              emptyText="어드민이 취소한 상품이 없습니다."
            />
          </section>

          {/* ── 회원 취소 섹션 ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-bold text-slate-700">회원 취소</h2>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{userCancelled.length}건</span>
            </div>
            <CancelTable
              items={userCancelled}
              selected={selected}
              todayMidnight={todayMidnight}
              onToggle={toggleRow}
              onToggleAll={toggleAll}
              onRevert={actionRevert}
              onArrive={actionArrive}
              emptyText="회원이 취소한 상품이 없습니다."
            />
          </section>
        </div>
      )}
    </div>
  );
}
