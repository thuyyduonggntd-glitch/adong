'use client';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

type OrderItem = {
  id: string;
  product: { name: string; brand: string | null; images: string[] };
  arrivedAt: string | null;
  quantity: number;
  size: string;
  color: string;
};

type ShippingEntry = {
  id: string;
  trackingNumber: string | null;
  carrier: string | null;
  note: string | null;
  shippedAt: string | null;
  createdAt: string;
  order: { id: string; totalAmount: number; status: string; createdAt: string; items: OrderItem[] };
};

type Order = {
  id: string; totalAmount: number; status: string; createdAt: string; items: OrderItem[];
};

type Tab = 'shipping' | 'storage';

export default function ShippingPage() {
  const [shippings, setShippings]     = useState<ShippingEntry[]>([]);
  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<Tab>('shipping');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openStorageDate, setOpenStorageDate] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/shipping').then((r) => r.json()),
      fetch('/api/orders').then((r) => r.json()),
    ]).then(([ships, ords]) => {
      setShippings(Array.isArray(ships) ? ships : []);
      setOrders(Array.isArray(ords) ? ords : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-16 text-slate-400">로딩 중...</div>;

  // 보관중: CONFIRMED + 실제 입고된 아이템이 하나라도 있는 주문만
  const storageOrders = orders.filter(
    (o) => o.status === 'CONFIRMED' && o.items.some((i) => i.arrivedAt !== null)
  );

  // 배송현황: 배송 전환된 건 전체 (SHIPPING은 이전 데이터 호환)
  const shippingList = shippings.filter((s) =>
    s.order.status === 'DELIVERED' || s.order.status === 'SHIPPING'
  );

  // 선택한 날짜에 입고된 아이템 (전체 주문 기준)
  const itemsForDate = selectedDate
    ? orders.flatMap((o) =>
        o.items
          .filter((i) => i.arrivedAt?.slice(0, 10) === selectedDate)
          .map((i) => ({ ...i, orderId: o.id }))
      )
    : [];

  const handleDateClick = (arrivedAt: string | null | undefined) => {
    if (!arrivedAt) return;
    setSelectedDate(arrivedAt.slice(0, 10));
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-4">배송 내역</h2>

      {/* 탭 */}
      <div className="flex gap-2 mb-5">
        {([
          { id: 'shipping', label: '배송현황', count: shippingList.length },
          { id: 'storage',  label: '보관중',   count: storageOrders.length },
        ] as { id: Tab; label: string; count: number }[]).map(({ id, label, count }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === id
                ? 'bg-primary-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-400'
            }`}>
            {label}
            <span className={`ml-1.5 text-xs font-normal ${tab === id ? 'text-white/70' : 'text-slate-400'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* 배송현황 탭 */}
      {tab === 'shipping' && (
        shippingList.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🚚</div>
            <p>배송 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-400 uppercase">
                  <th className="px-4 py-3">발송일</th>
                  <th className="px-4 py-3">주문번호</th>
                  <th className="px-4 py-3">상품</th>
                  <th className="px-4 py-3">입고일</th>
                  <th className="px-4 py-3">택배사</th>
                  <th className="px-4 py-3">배송번호</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shippingList.map((s) => {
                  const productNames = s.order.items.map((i) => i.product.name).join(', ');
                  const arrivedAt    = s.order.items.find((i) => i.arrivedAt)?.arrivedAt;
                  return (
                    <tr key={s.id} className="text-slate-700 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {s.shippedAt ? formatDate(s.shippedAt) : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        #{s.order.id.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate">{productNames}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {arrivedAt ? (
                          <button onClick={() => handleDateClick(arrivedAt)}
                            className="text-green-600 font-medium underline decoration-dotted underline-offset-2 hover:text-green-700 transition-colors">
                            {formatDate(arrivedAt)}
                          </button>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{s.carrier || '-'}</td>
                      <td className="px-4 py-3">
                        {s.trackingNumber
                          ? <span className="font-mono text-xs text-primary-600 font-semibold">{s.trackingNumber}</span>
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge text-xs bg-green-100 text-green-800">배송완료</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.note || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 보관중 탭 */}
      {tab === 'storage' && (() => {
        // 입고된 아이템만 수집
        const arrivedItems = storageOrders.flatMap((o) =>
          o.items
            .filter((i) => i.arrivedAt !== null)
            .map((i) => ({ ...i, orderId: o.id }))
        );

        // 날짜별 그룹화 (내림차순)
        const byDate = new Map<string, typeof arrivedItems>();
        arrivedItems.forEach((item) => {
          const date = item.arrivedAt!.slice(0, 10);
          const list = byDate.get(date) ?? [];
          list.push(item);
          byDate.set(date, list);
        });
        const dateGroups = Array.from(byDate.entries()).sort(([a], [b]) => b.localeCompare(a));

        if (dateGroups.length === 0) return (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📦</div>
            <p>보관중인 상품이 없습니다.</p>
          </div>
        );

        return (
          <div className="space-y-2">
            {dateGroups.map(([date, items]) => {
              const isOpen = openStorageDate === date;
              const totalQty = items.reduce((s, i) => s + i.quantity, 0);
              return (
                <div key={date} className="card overflow-hidden">
                  <button
                    onClick={() => setOpenStorageDate(isOpen ? null : date)}
                    className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${isOpen ? 'bg-primary-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${isOpen ? 'text-primary-700' : 'text-slate-800'}`}>
                        {date}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOpen ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {items.length}건
                      </span>
                      <span className="text-xs text-slate-400">수량 {totalQty}개</span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                          {item.product.images?.[0] && (
                            <img
                              src={item.product.images[0]} alt=""
                              className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-100"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            {item.product.brand && (
                              <p className="text-xs text-primary-600 font-semibold mb-0.5">{item.product.brand}</p>
                            )}
                            <p className="text-sm font-medium text-slate-800 truncate">{item.product.name}</p>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">{item.size}</span>
                              <span className="text-xs text-slate-300">·</span>
                              <span className="text-xs text-slate-500">{item.color}</span>
                              <span className="text-xs text-slate-300">·</span>
                              <span className="text-xs font-semibold text-primary-600">{item.quantity}개</span>
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                            #{item.orderId.slice(-6).toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 입고 상품 모달 */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDate(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800">{formatDate(selectedDate)} 입고 상품</h3>
                <p className="text-xs text-slate-400 mt-0.5">총 {itemsForDate.length}개 품목</p>
              </div>
              <button onClick={() => setSelectedDate(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors text-lg">
                ×
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {itemsForDate.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">해당 날짜 입고 상품이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {itemsForDate.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                      {item.product.images?.[0] && (
                        <img src={item.product.images[0]} alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-100" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.product.name}</p>
                        {item.product.brand && (
                          <p className="text-xs text-slate-400">{item.product.brand}</p>
                        )}
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-slate-500">{item.size}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-500">{item.color}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs font-medium text-primary-600">{item.quantity}개</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                        #{(item as any).orderId.slice(-6).toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
