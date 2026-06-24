'use client';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';

/* ─── 보관중: 통합 아이템 ─── */
type UnifiedItem = {
  key: string;
  selId: string;
  source: 'order' | 'inbound';
  userId: string;
  userName: string;
  userEmail: string;
  arrivedAt: string;
  image: string;
  brand: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  price: number | null;
  orderId?: string;
  inboundItemId?: string;
};

type DateGroup = { date: string; items: UnifiedItem[] };
type UserGroup = { userId: string; userName: string; userEmail: string; dateGroups: DateGroup[]; totalItems: number };

/* ─── 배송완료: 주문기반 ─── */
type DeliveredOrderItem = {
  id: string; quantity: number; price: number; size: string; color: string;
  product: { name: string; brand: string | null; images: string[] };
};
type ShippingRecord = {
  id: string; orderId: string; userId: string;
  carrier: string | null; trackingNumber: string | null; createdAt: string;
  order: { id: string; status: string; totalAmount: number; items: DeliveredOrderItem[] };
  user: { id: string; name: string; email: string };
};

/* ─── 배송완료: 공급업체 ─── */
type ShippedSupplierItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  shippedAt: string;
  brand: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  image: string;
};

/* ─── 배송완료 그룹 타입 ─── */
type DeliveredUserGroup = {
  userId: string;
  userName: string;
  userEmail: string;
  orderDateGroups: { date: string; shippings: ShippingRecord[]; total: number }[];
  supplierDateGroups: { date: string; items: ShippedSupplierItem[] }[];
};

/* ─── 보관중 그룹 빌더 ─── */
function buildStoredUserGroups(items: UnifiedItem[]): UserGroup[] {
  const map = new Map<string, { name: string; email: string; dateMap: Map<string, UnifiedItem[]> }>();
  for (const it of items) {
    const date = it.arrivedAt.slice(0, 10);
    if (!map.has(it.userId)) map.set(it.userId, { name: it.userName, email: it.userEmail, dateMap: new Map() });
    const u = map.get(it.userId)!;
    if (!u.dateMap.has(date)) u.dateMap.set(date, []);
    u.dateMap.get(date)!.push(it);
  }
  return Array.from(map.entries()).map(([userId, { name, email, dateMap }]) => {
    const dateGroups = Array.from(dateMap.entries())
      .map(([date, its]) => ({ date, items: its }))
      .sort((a, b) => b.date.localeCompare(a.date));
    return { userId, userName: name, userEmail: email, dateGroups, totalItems: items.filter((i) => i.userId === userId).length };
  }).sort((a, b) => a.userName.localeCompare(b.userName, 'ko'));
}

/* ─── 배송완료 그룹 빌더 ─── */
function buildDeliveredUserGroups(shippings: ShippingRecord[], supplierItems: ShippedSupplierItem[]): DeliveredUserGroup[] {
  const userMap = new Map<string, DeliveredUserGroup>();

  for (const s of shippings) {
    const uid  = s.user.id;
    const date = s.createdAt.slice(0, 10);
    if (!userMap.has(uid)) userMap.set(uid, { userId: uid, userName: s.user.name, userEmail: s.user.email, orderDateGroups: [], supplierDateGroups: [] });
    const u = userMap.get(uid)!;
    let dg = u.orderDateGroups.find((d) => d.date === date);
    if (!dg) { dg = { date, shippings: [], total: 0 }; u.orderDateGroups.push(dg); }
    dg.shippings.push(s);
    dg.total += s.order.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  }

  for (const it of supplierItems) {
    const uid  = it.userId;
    const date = it.shippedAt.slice(0, 10);
    if (!userMap.has(uid)) userMap.set(uid, { userId: uid, userName: it.userName, userEmail: it.userEmail, orderDateGroups: [], supplierDateGroups: [] });
    const u = userMap.get(uid)!;
    let dg = u.supplierDateGroups.find((d) => d.date === date);
    if (!dg) { dg = { date, items: [] }; u.supplierDateGroups.push(dg); }
    dg.items.push(it);
  }

  return Array.from(userMap.values())
    .sort((a, b) => a.userName.localeCompare(b.userName, 'ko'));
}

/* ─── 메인 ─── */
export default function AdminShippingPage() {
  const [tab, setTab]                    = useState<'stored' | 'delivered'>('stored');
  const [storedItems, setStored]         = useState<UnifiedItem[]>([]);
  const [shippings, setShippings]        = useState<ShippingRecord[]>([]);
  const [supplierShipped, setSupShipped] = useState<ShippedSupplierItem[]>([]);
  const [loading, setLoading]            = useState(true);

  /* 보관중 선택 */
  const [selected, setSelected]    = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);

  /* 보관중 아코디언 */
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);

  /* 배송완료 아코디언 */
  const [openDelUser, setOpenDelUser] = useState<string | null>(null);
  const [openDelDate, setOpenDelDate] = useState<string | null>(null);

  /* 배송완료: 운송장 입력 폼 */
  const [delivForms, setDelivForms] = useState<Record<string, { carrier: string; trackingNumber: string }>>({});
  const [saving, setSaving]         = useState<string | null>(null);

  /* ─ 데이터 로드 ─ */
  const loadData = async () => {
    const [arrived, ships, inbounds] = await Promise.all([
      fetch('/api/orders/items?allArrived=1').then((r) => r.json()).catch(() => []),
      fetch('/api/shipping').then((r) => r.json()).catch(() => []),
      fetch('/api/inbound').then((r) => r.json()).catch(() => []),
    ]);

    /* 보관중: 주문 상품 — order.status가 SHIPPING/DELIVERED/CANCELLED 아닌 것 */
    const orderItems: UnifiedItem[] = (Array.isArray(arrived) ? arrived : [])
      .filter((it: any) => {
        const st = it.order?.status;
        return st !== 'SHIPPING' && st !== 'DELIVERED' && st !== 'CANCELLED';
      })
      .map((it: any) => ({
        key:          `o-${it.id}`,
        selId:        `o-${it.id}`,
        source:       'order' as const,
        userId:       it.order?.userId ?? '',
        userName:     it.order?.user?.name ?? '알 수 없음',
        userEmail:    it.order?.user?.email ?? '',
        arrivedAt:    it.arrivedAt,
        image:        it.product?.images?.[0] ?? '',
        brand:        it.product?.brand ?? '-',
        name:         it.product?.name  ?? '-',
        size:         it.size  ?? '-',
        color:        it.color ?? '-',
        quantity:     it.quantity,
        price:        it.price,
        orderId:      it.order?.id,
      }));

    /* 보관중: 공급업체 상품(shippedAt 없는 것) & 배송완료: 공급업체(shippedAt 있는 것) */
    const inboundPending: UnifiedItem[]         = [];
    const inboundShipped: ShippedSupplierItem[] = [];

    for (const ib of (Array.isArray(inbounds) ? inbounds : [])) {
      if (!ib.userId || !ib.user) continue;
      for (const item of (ib.items || [])) {
        const common = {
          userId:    ib.userId,
          userName:  ib.user.name,
          userEmail: ib.user.email,
          brand:     item.product?.brand ?? ib.brand,
          name:      item.product?.name  ?? item.name,
          size:      item.size  ?? '-',
          color:     item.color ?? '-',
          quantity:  item.quantity,
          image:     item.product?.images?.[0] ?? '',
        };
        if (!item.shippedAt) {
          inboundPending.push({
            key: `i-${item.id}`, selId: `i-${item.id}`, source: 'inbound' as const,
            arrivedAt: ib.arrivedAt, price: null, inboundItemId: item.id, ...common,
          });
        } else {
          inboundShipped.push({ id: item.id, shippedAt: item.shippedAt, ...common });
        }
      }
    }

    setStored([...orderItems, ...inboundPending]);
    setShippings(Array.isArray(ships) ? ships : []);
    setSupShipped(inboundShipped);
  };

  useEffect(() => { loadData().then(() => setLoading(false)); }, []); // eslint-disable-line

  const storedGroups    = useMemo(() => buildStoredUserGroups(storedItems),              [storedItems]);
  const deliveredGroups = useMemo(() => buildDeliveredUserGroups(shippings, supplierShipped), [shippings, supplierShipped]);

  /* ─ 선택 토글 ─ */
  const toggleItem = (selId: string) =>
    setSelected((s) => { const n = new Set(s); n.has(selId) ? n.delete(selId) : n.add(selId); return n; });

  const toggleDateItems = (items: UnifiedItem[]) => {
    const ids = items.map((i) => i.selId);
    const all = ids.every((id) => selected.has(id));
    setSelected((s) => { const n = new Set(s); all ? ids.forEach((id) => n.delete(id)) : ids.forEach((id) => n.add(id)); return n; });
  };

  const toggleUserItems = (g: UserGroup) => {
    const ids = g.dateGroups.flatMap((d) => d.items.map((i) => i.selId));
    const all = ids.every((id) => selected.has(id));
    setSelected((s) => { const n = new Set(s); all ? ids.forEach((id) => n.delete(id)) : ids.forEach((id) => n.add(id)); return n; });
  };

  /* ─ 배송 전환 ─ */
  const handleConvert = async () => {
    const selItems = storedItems.filter((it) => selected.has(it.selId));
    if (!selItems.length) return;
    if (!confirm(`선택한 ${selItems.length}건을 배송 전환하시겠습니까?`)) return;
    setConverting(true);

    const convertedUserIds = Array.from(new Set(selItems.map((it) => it.userId)));

    /* 주문 상품: 주문 ID별 배송 레코드 생성 */
    const orderItems  = selItems.filter((it) => it.source === 'order');
    const orderIds    = Array.from(new Set(orderItems.map((it) => it.orderId!)));
    await Promise.all(orderIds.map((orderId) =>
      fetch('/api/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) })
    ));

    /* 공급업체 상품: InboundItem.shippedAt 설정 */
    const inboundItemIds = selItems.filter((it) => it.source === 'inbound').map((it) => it.inboundItemId!);
    if (inboundItemIds.length > 0) {
      await fetch('/api/inbound', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: inboundItemIds }),
      });
    }

    setSelected(new Set());
    await loadData();
    setConverting(false);

    /* 배송완료 탭으로 자동 전환 + 해당 회원 펼치기 */
    setTab('delivered');
    if (convertedUserIds.length > 0) {
      setOpenDelUser(convertedUserIds[0]);
    }
  };

  /* ─ 운송장 저장 ─ */
  const handleSaveDelivery = async (key: string, shippingIds: string[]) => {
    const form = delivForms[key] || { carrier: '', trackingNumber: '' };
    setSaving(key);
    await Promise.all(shippingIds.map((id) =>
      fetch(`/api/shipping/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier: form.carrier || null, trackingNumber: form.trackingNumber || null }),
      })
    ));
    setShippings((prev) =>
      prev.map((s) => shippingIds.includes(s.id)
        ? { ...s, carrier: form.carrier || null, trackingNumber: form.trackingNumber || null }
        : s
      )
    );
    setSaving(null);
  };

  const handleOpenDelDate = (key: string, firstShipping?: ShippingRecord) => {
    if (openDelDate === key) { setOpenDelDate(null); return; }
    setOpenDelDate(key);
    if (firstShipping && !delivForms[key]) {
      setDelivForms((f) => ({
        ...f,
        [key]: { carrier: firstShipping.carrier || '', trackingNumber: firstShipping.trackingNumber || '' },
      }));
    }
  };

  if (loading) return <div className="text-center py-16 text-slate-400">로딩 중...</div>;

  /* ─────────── RENDER ─────────── */
  return (
    <div className="pb-24">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">배송 관리</h1>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {(['stored', 'delivered'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === t ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-400'}`}>
            {t === 'stored' ? '보관중' : '배송완료'}
            {t === 'stored'    && storedItems.length   > 0 && <span className="ml-1.5 text-xs opacity-80">{storedItems.length}</span>}
            {t === 'delivered' && shippings.length > 0 && <span className="ml-1.5 text-xs opacity-80">{shippings.length}</span>}
          </button>
        ))}
      </div>

      {/* ══════════ 보관중 ══════════ */}
      {tab === 'stored' && (
        storedGroups.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <div className="text-5xl mb-3">📦</div>
            <p className="font-medium">보관중인 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {storedGroups.map((userG) => {
              const allIds  = userG.dateGroups.flatMap((d) => d.items.map((i) => i.selId));
              const allSel  = allIds.length > 0 && allIds.every((id) => selected.has(id));
              const someSel = allIds.some((id) => selected.has(id));
              const isOpen  = openUser === userG.userId;

              return (
                <div key={userG.userId} className="card overflow-hidden">
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isOpen ? 'bg-primary-50' : 'bg-slate-50 hover:bg-slate-100'}`}
                    onClick={() => setOpenUser(isOpen ? null : userG.userId)}
                  >
                    <input type="checkbox" checked={allSel}
                      ref={(el) => { if (el) el.indeterminate = someSel && !allSel; }}
                      onChange={() => toggleUserItems(userG)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 accent-primary-600" />
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-sm ${isOpen ? 'text-primary-700' : 'text-slate-800'}`}>{userG.userName}</span>
                      <span className="text-xs text-slate-400 ml-2">{userG.userEmail}</span>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">{userG.dateGroups.length}개 날짜 · {userG.totalItems}종</span>
                    <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isOpen && (
                    <div className="divide-y divide-slate-100">
                      {userG.dateGroups.map((dateG) => {
                        const dk       = `${userG.userId}__${dateG.date}`;
                        const isDateOp = openDate === dk;
                        const dateIds  = dateG.items.map((i) => i.selId);
                        const dateSel  = dateIds.every((id) => selected.has(id));
                        const dateHalf = dateIds.some((id) => selected.has(id));
                        const orderCnt = dateG.items.filter((i) => i.source === 'order').length;
                        const supCnt   = dateG.items.filter((i) => i.source === 'inbound').length;
                        const totalQty = dateG.items.reduce((s, i) => s + i.quantity, 0);
                        const totalAmt = dateG.items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);

                        return (
                          <div key={dk}>
                            <div
                              className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${isDateOp ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                              onClick={() => setOpenDate(isDateOp ? null : dk)}
                            >
                              <input type="checkbox" checked={dateSel}
                                ref={(el) => { if (el) el.indeterminate = dateHalf && !dateSel; }}
                                onChange={() => toggleDateItems(dateG.items)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 accent-primary-600" />
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${isDateOp ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {dateG.date} 입고
                              </span>
                              <span className="text-xs text-slate-500">{dateG.items.length}종 · {totalQty}개</span>
                              {orderCnt > 0 && <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">주문 {orderCnt}</span>}
                              {supCnt   > 0 && <span className="text-xs bg-blue-50   text-blue-600   px-1.5 py-0.5 rounded-full">공급 {supCnt}</span>}
                              <span className="ml-auto text-sm font-bold text-primary-700 flex-shrink-0">{formatPrice(totalAmt)}</span>
                              <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isDateOp ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>

                            {isDateOp && (
                              <table className="w-full text-sm">
                                <thead className="bg-white border-b border-slate-100 text-xs text-slate-400 uppercase">
                                  <tr>
                                    <th className="px-4 py-2 w-8" />
                                    <th className="px-4 py-2 text-left">구분</th>
                                    <th className="px-4 py-2 text-left">브랜드</th>
                                    <th className="px-4 py-2 text-left">사진</th>
                                    <th className="px-4 py-2 text-left">상품명</th>
                                    <th className="px-4 py-2 text-center">사이즈</th>
                                    <th className="px-4 py-2 text-center">색상</th>
                                    <th className="px-4 py-2 text-center">수량</th>
                                    <th className="px-4 py-2 text-right">금액</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {dateG.items.map((it) => (
                                    <tr key={it.key} className={`transition-colors ${selected.has(it.selId) ? 'bg-primary-50/60' : 'hover:bg-slate-50'}`}>
                                      <td className="px-4 py-2.5">
                                        <input type="checkbox" checked={selected.has(it.selId)} onChange={() => toggleItem(it.selId)} className="w-4 h-4 accent-primary-600" />
                                      </td>
                                      <td className="px-4 py-2.5">
                                        {it.source === 'order'
                                          ? <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">주문</span>
                                          : <span className="text-xs font-semibold text-blue-600   bg-blue-50   px-1.5 py-0.5 rounded-full">공급업체</span>}
                                      </td>
                                      <td className="px-4 py-2.5 text-xs font-semibold text-primary-600">{it.brand}</td>
                                      <td className="px-4 py-2.5">
                                        <div className="relative w-9 h-9 rounded overflow-hidden bg-slate-100">
                                          <Image src={it.image || 'https://placehold.co/36x36'} alt={it.name} fill className="object-cover" />
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[140px] truncate">{it.name}</td>
                                      <td className="px-4 py-2.5 text-center text-xs text-slate-500">{it.size}</td>
                                      <td className="px-4 py-2.5 text-center text-xs text-slate-500">{it.color}</td>
                                      <td className="px-4 py-2.5 text-center font-semibold">{it.quantity}</td>
                                      <td className="px-4 py-2.5 text-right font-semibold text-primary-700">
                                        {it.price !== null ? formatPrice(it.price * it.quantity) : <span className="text-slate-300 text-xs">-</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ══════════ 배송완료 ══════════ */}
      {tab === 'delivered' && (
        deliveredGroups.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <div className="text-5xl mb-3">🚚</div>
            <p className="font-medium">배송 전환된 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveredGroups.map((userG) => {
              const isOpen   = openDelUser === userG.userId;
              const totalRec = userG.orderDateGroups.reduce((s, d) => s + d.shippings.length, 0);
              const supCount = userG.supplierDateGroups.reduce((s, d) => s + d.items.length, 0);

              return (
                <div key={userG.userId} className="card overflow-hidden">
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isOpen ? 'bg-primary-50' : 'bg-slate-50 hover:bg-slate-100'}`}
                    onClick={() => setOpenDelUser(isOpen ? null : userG.userId)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-sm ${isOpen ? 'text-primary-700' : 'text-slate-800'}`}>{userG.userName}</span>
                      <span className="text-xs text-slate-400 ml-2">{userG.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {totalRec > 0 && <span className="text-xs text-slate-500">주문 {totalRec}건</span>}
                      {supCount > 0 && <span className="text-xs text-blue-500">공급 {supCount}종</span>}
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isOpen && (
                    <div className="divide-y divide-slate-100">

                      {/* 주문 기반 배송 */}
                      {[...userG.orderDateGroups].sort((a, b) => b.date.localeCompare(a.date)).map((dateG) => {
                        const dk         = `ord-${userG.userId}__${dateG.date}`;
                        const isDateOpen = openDelDate === dk;
                        const firstShip  = dateG.shippings[0];
                        const hasInfo    = firstShip?.carrier || firstShip?.trackingNumber;
                        const formVals   = delivForms[dk] || { carrier: firstShip?.carrier || '', trackingNumber: firstShip?.trackingNumber || '' };
                        const allItems   = dateG.shippings.flatMap((s) => s.order.items);
                        const totalQty   = allItems.reduce((s, it) => s + it.quantity, 0);

                        return (
                          <div key={dk}>
                            <div
                              className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${isDateOpen ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                              onClick={() => handleOpenDelDate(dk, firstShip)}
                            >
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold flex-shrink-0">주문</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${isDateOpen ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {dateG.date}
                              </span>
                              <span className="text-xs text-slate-500">{allItems.length}종 · {totalQty}개</span>
                              {hasInfo && (
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                                  {[firstShip?.carrier, firstShip?.trackingNumber].filter(Boolean).join(' · ')}
                                </span>
                              )}
                              {!hasInfo && (
                                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">운송장 미입력</span>
                              )}
                              <span className="ml-auto text-sm font-bold text-primary-700 flex-shrink-0">{formatPrice(dateG.total)}</span>
                              <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isDateOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>

                            {isDateOpen && (
                              <div>
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
                                    <tr>
                                      <th className="px-4 py-2 text-left">브랜드</th>
                                      <th className="px-4 py-2 text-left">사진</th>
                                      <th className="px-4 py-2 text-left">상품명</th>
                                      <th className="px-4 py-2 text-center">사이즈</th>
                                      <th className="px-4 py-2 text-center">색상</th>
                                      <th className="px-4 py-2 text-center">수량</th>
                                      <th className="px-4 py-2 text-right">금액</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {dateG.shippings.flatMap((s) =>
                                      s.order.items.map((it) => (
                                        <tr key={`${s.id}-${it.id}`} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-4 py-2.5 text-xs font-semibold text-primary-600">{it.product.brand || '-'}</td>
                                          <td className="px-4 py-2.5">
                                            <div className="relative w-9 h-9 rounded overflow-hidden bg-slate-100">
                                              <Image src={it.product.images[0] || 'https://placehold.co/36x36'} alt={it.product.name} fill className="object-cover" />
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[140px] truncate">{it.product.name}</td>
                                          <td className="px-4 py-2.5 text-center text-xs text-slate-500">{it.size || '-'}</td>
                                          <td className="px-4 py-2.5 text-center text-xs text-slate-500">{it.color || '-'}</td>
                                          <td className="px-4 py-2.5 text-center font-semibold">{it.quantity}</td>
                                          <td className="px-4 py-2.5 text-right font-semibold text-primary-700">{formatPrice(it.price * it.quantity)}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>

                                {/* 운송장 입력 */}
                                <div className="px-5 py-4 bg-amber-50 border-t border-amber-100">
                                  <p className="text-xs font-semibold text-amber-700 mb-3">배송 정보 입력</p>
                                  <div className="flex items-end gap-3 flex-wrap">
                                    <div>
                                      <label className="block text-xs text-slate-500 mb-1">배송업체</label>
                                      <input className="input text-sm w-36" placeholder="CJ대한통운"
                                        value={formVals.carrier}
                                        onChange={(e) => setDelivForms((f) => ({ ...f, [dk]: { ...formVals, carrier: e.target.value } }))} />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-slate-500 mb-1">운송장 번호</label>
                                      <input className="input text-sm font-mono w-48" placeholder="1234567890"
                                        value={formVals.trackingNumber}
                                        onChange={(e) => setDelivForms((f) => ({ ...f, [dk]: { ...formVals, trackingNumber: e.target.value } }))} />
                                    </div>
                                    <button
                                      onClick={() => handleSaveDelivery(dk, dateG.shippings.map((s) => s.id))}
                                      disabled={saving === dk}
                                      className="btn-primary text-sm py-2 px-5 disabled:opacity-50">
                                      {saving === dk ? '저장 중...' : '저장'}
                                    </button>
                                    {hasInfo && (
                                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1.5 rounded font-medium">
                                        저장됨: {[firstShip?.carrier, firstShip?.trackingNumber].filter(Boolean).join(' · ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 공급업체 배송 전환 항목 */}
                      {[...userG.supplierDateGroups].sort((a, b) => b.date.localeCompare(a.date)).map((dateG) => {
                        const dk         = `sup-${userG.userId}__${dateG.date}`;
                        const isDateOpen = openDelDate === dk;
                        const totalQty   = dateG.items.reduce((s, it) => s + it.quantity, 0);

                        return (
                          <div key={dk}>
                            <div
                              className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${isDateOpen ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                              onClick={() => setOpenDelDate(isDateOpen ? null : dk)}
                            >
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold flex-shrink-0">공급업체</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${isDateOpen ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {dateG.date}
                              </span>
                              <span className="text-xs text-slate-500">{dateG.items.length}종 · {totalQty}개</span>
                              <svg className={`w-3.5 h-3.5 text-slate-400 ml-auto flex-shrink-0 transition-transform ${isDateOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>

                            {isDateOpen && (
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
                                  <tr>
                                    <th className="px-4 py-2 text-left">브랜드</th>
                                    <th className="px-4 py-2 text-left">사진</th>
                                    <th className="px-4 py-2 text-left">상품명</th>
                                    <th className="px-4 py-2 text-center">사이즈</th>
                                    <th className="px-4 py-2 text-center">색상</th>
                                    <th className="px-4 py-2 text-center">수량</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {dateG.items.map((it) => (
                                    <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-2.5 text-xs font-semibold text-primary-600">{it.brand}</td>
                                      <td className="px-4 py-2.5">
                                        <div className="relative w-9 h-9 rounded overflow-hidden bg-slate-100">
                                          <Image src={it.image || 'https://placehold.co/36x36'} alt={it.name} fill className="object-cover" />
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[140px] truncate">{it.name}</td>
                                      <td className="px-4 py-2.5 text-center text-xs text-slate-500">{it.size}</td>
                                      <td className="px-4 py-2.5 text-center text-xs text-slate-500">{it.color}</td>
                                      <td className="px-4 py-2.5 text-center font-semibold">{it.quantity}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* 배송 전환 플로팅 버튼 */}
      {tab === 'stored' && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white shadow-2xl border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <span className="text-sm font-bold text-slate-800">{selected.size}건 선택됨</span>
          <button onClick={handleConvert} disabled={converting}
            className="px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors whitespace-nowrap">
            {converting ? '처리중...' : '배송 전환'}
          </button>
          <button onClick={() => setSelected(new Set())}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            선택 해제
          </button>
        </div>
      )}
    </div>
  );
}
