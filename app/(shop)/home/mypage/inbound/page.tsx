'use client';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';

type OrderArrivedItem = {
  id: string; quantity: number; price: number; size: string | null; color: string | null; arrivedAt: string;
  product: { id: string; name: string; images: string[]; brand: string | null };
  order: { id: string; status: string };
  _source: 'order';
};

type SupplierInboundItem = {
  id: string; quantity: number; size: string | null; color: string | null; arrivedAt: string;
  name: string; brand: string; note: string | null;
  product: { id: string; name: string; images: string[]; brand: string | null } | null;
  _source: 'supplier';
};

type UnifiedItem = OrderArrivedItem | SupplierInboundItem;

function groupByDate(items: UnifiedItem[]): Array<{ date: string; label: string; items: UnifiedItem[] }> {
  const map = new Map<string, UnifiedItem[]>();
  for (const it of items) {
    const key = it.arrivedAt.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, its]) => ({
      date,
      label: new Date(date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      items: its,
    }));
}

export default function InboundPage() {
  const [items, setItems]       = useState<UnifiedItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [openDate, setOpenDate] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/orders/items?allArrived=1').then((r) => r.json()),
      fetch('/api/inbound').then((r) => r.json()),
    ]).then(([orderItems, inbounds]) => {
      const orderMapped: OrderArrivedItem[] = Array.isArray(orderItems)
        ? orderItems.map((it: any) => ({ ...it, _source: 'order' as const }))
        : [];

      const supplierMapped: SupplierInboundItem[] = Array.isArray(inbounds)
        ? inbounds.flatMap((ib: any) =>
            ib.items.map((item: any) => ({
              id: item.id,
              quantity: item.quantity,
              size: item.size,
              color: item.color,
              arrivedAt: ib.arrivedAt,
              name: item.name,
              brand: ib.brand,
              note: ib.note,
              product: item.product ?? null,
              _source: 'supplier' as const,
            }))
          )
        : [];

      const merged = [...orderMapped, ...supplierMapped];
      setItems(merged);
      setLoading(false);

      if (merged.length > 0) {
        const newest = merged.reduce((a, b) => a.arrivedAt > b.arrivedAt ? a : b).arrivedAt.slice(0, 10);
        setOpenDate(newest);
      }
    });
  }, []);

  const filtered = useMemo(() => {
    if (!dateFilter) return items;
    const d    = new Date(dateFilter); d.setHours(0, 0, 0, 0);
    const dEnd = new Date(dateFilter); dEnd.setHours(23, 59, 59, 999);
    return items.filter((it) => {
      const t = new Date(it.arrivedAt).getTime();
      return t >= d.getTime() && t <= dEnd.getTime();
    });
  }, [items, dateFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  if (loading) return <div className="text-center py-16 text-slate-400">로딩 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-lg font-bold text-slate-800">보관중 (전체 입고 내역)</h2>
        <div className="flex items-center gap-2">
          <input type="date" className="input text-sm w-44" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          {dateFilter && <button onClick={() => setDateFilter('')} className="text-xs text-slate-500 hover:text-slate-700">초기화</button>}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📦</div>
          <p>입고 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(({ date, label, items: dayItems }) => {
            const isOpen   = openDate === date;
            const totalQty = dayItems.reduce((s, i) => s + i.quantity, 0);
            const totalAmt = dayItems.reduce((s, i) => {
              if (i._source === 'order') return s + (i as OrderArrivedItem).price * i.quantity;
              return s;
            }, 0);

            return (
              <div key={date} className="card overflow-hidden">
                <button
                  onClick={() => setOpenDate(isOpen ? null : date)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="flex-1 font-semibold text-slate-800 text-sm">{label}</span>
                  <span className="text-xs text-slate-500">{dayItems.length}종 · {totalQty}개</span>
                  {totalAmt > 0 && <span className="text-sm font-bold text-primary-700 whitespace-nowrap">{formatPrice(totalAmt)}</span>}
                  <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                      <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">사진</th>
                          <th className="px-4 py-2 text-left">브랜드</th>
                          <th className="px-4 py-2 text-left">상품명</th>
                          <th className="px-4 py-2 text-left">사이즈</th>
                          <th className="px-4 py-2 text-left">색상</th>
                          <th className="px-4 py-2 text-center">수량</th>
                          <th className="px-4 py-2 text-right">금액</th>
                          <th className="px-4 py-2 text-left">입고 시간</th>
                          <th className="px-4 py-2 text-left">구분</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {dayItems.map((it) => {
                          if (it._source === 'order') {
                            const oi = it as OrderArrivedItem;
                            return (
                              <tr key={oi.id} className="hover:bg-emerald-50/20">
                                <td className="px-4 py-3">
                                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-emerald-50">
                                    <Image src={oi.product.images[0] || 'https://placehold.co/44x44'} alt={oi.product.name} fill className="object-cover" />
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {oi.product.brand
                                    ? <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{oi.product.brand}</span>
                                    : <span className="text-slate-300 text-xs">-</span>}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px]">
                                  <span className="block truncate">{oi.product.name}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{oi.size || '-'}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{oi.color || '-'}</td>
                                <td className="px-4 py-3 text-center font-semibold">{oi.quantity}</td>
                                <td className="px-4 py-3 text-right font-semibold text-primary-700">{formatPrice(oi.price * oi.quantity)}</td>
                                <td className="px-4 py-3 text-xs text-emerald-600 font-medium">
                                  {new Date(oi.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400 font-mono">#{oi.order.id.slice(-6).toUpperCase()}</td>
                              </tr>
                            );
                          } else {
                            const si = it as SupplierInboundItem;
                            const img = si.product?.images?.[0] || 'https://placehold.co/44x44';
                            const name = si.product?.name || si.name;
                            const brand = si.product?.brand || si.brand;
                            return (
                              <tr key={si.id} className="hover:bg-blue-50/20">
                                <td className="px-4 py-3">
                                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-blue-50">
                                    <Image src={img} alt={name} fill className="object-cover" />
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {brand
                                    ? <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{brand}</span>
                                    : <span className="text-slate-300 text-xs">-</span>}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px]">
                                  <span className="block truncate">{name}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{si.size || '-'}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{si.color || '-'}</td>
                                <td className="px-4 py-3 text-center font-semibold">{si.quantity}</td>
                                <td className="px-4 py-3 text-right text-slate-300 text-xs">-</td>
                                <td className="px-4 py-3 text-xs text-blue-500 font-medium">
                                  {new Date(si.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">공급업체</span>
                                </td>
                              </tr>
                            );
                          }
                        })}
                      </tbody>
                      <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                        <tr>
                          <td colSpan={5} className="px-4 py-2">소계</td>
                          <td className="px-4 py-2 text-center">{totalQty}</td>
                          <td className="px-4 py-2 text-right text-primary-700">{totalAmt > 0 ? formatPrice(totalAmt) : '-'}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
