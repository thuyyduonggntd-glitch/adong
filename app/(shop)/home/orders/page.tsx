'use client';
import { useEffect, useState, useMemo } from 'react';
import { formatPrice, formatDate, isWithinTimeWindow, getSaleLabel } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 40;

/* ════════════════════════════════════════
   공통 타입
════════════════════════════════════════ */
type Product = {
  id: string; name: string; images: string[]; colors: string[]; brand: string | null;
  productNumber?: string | null;
  sizeExtraPrices?: Record<string, number> | null;
};
/* 세일 스냅샷: OrderItem/InboundItem 자체에 저장된 "주문·입고 당시" 세일 상태 (실시간 product.isOnSale 아님) */
type SaleSnapshot = { isOnSale: boolean; saleType: string | null; saleValue: number | null };
type OrderItem = SaleSnapshot & {
  id: string; quantity: number; price: number; size: string; color: string;
  arrivedAt: string | null; cancelledAt: string | null; cancelLocked: boolean;
  outOfStockAt: string | null; unshippedAt: string | null; remark: string | null;
  deliveryRequestedAt: string | null;
  product: Product;
};
type Order = {
  id: string; totalAmount: number; status: string; note: string | null;
  cancelLocked: boolean; createdAt: string; items: OrderItem[];
};
type OutStockItem = SaleSnapshot & {
  id: string; quantity: number; price: number; size: string; color: string;
  outOfStockAt: string | null; unshippedAt: string | null; remark: string | null;
  product: Product;
  order: { id: string; createdAt: string };
};
type CancelledItem = SaleSnapshot & {
  id: string; quantity: number; price: number; size: string | null; color: string | null;
  cancelledAt: string;
  product: { id: string; name: string; images: string[]; brand: string | null; productNumber?: string | null };
  order: { id: string; createdAt: string };
};
type InboundOrderItem = SaleSnapshot & {
  id: string; quantity: number; price: number; size: string | null; color: string | null;
  arrivedAt: string; deliveryRequestedAt: string | null;
  product: { id: string; name: string; images: string[]; brand: string | null; productNumber?: string | null };
  order: { id: string; status: string };
  _source: 'order';
};
type SupplierItem = SaleSnapshot & {
  id: string; quantity: number; size: string | null; color: string | null;
  arrivedAt: string; deliveryRequestedAt: string | null;
  name: string; brand: string; note: string | null;
  product: { id: string; name: string; images: string[]; brand: string | null; productNumber?: string | null } | null;
  _source: 'supplier';
};
type UnifiedItem = InboundOrderItem | SupplierItem;
type CancelPolicy = { globalEnabled: boolean; cancelFrom: string | null; cancelTo: string | null };
type DeliveryPolicy = { enabled: boolean; fromTime: string | null; toTime: string | null };
type ShippingEntry = {
  id: string;
  trackingNumber: string | null;
  carrier: string | null;
  note: string | null;
  shippedAt: string | null;
  createdAt: string;
  order: { id: string; totalAmount: number; status: string; createdAt: string; items: OrderItem[] };
};

type MainTab = 'orders' | 'cancelled' | 'inbound' | 'shipping';

/* ════════════════════════════════════════
   주문내역 헬퍼
════════════════════════════════════════ */
function getStatusLabel(t: (key: string) => string): Record<string, { label: string; color: string; icon: string }> {
  return {
    PENDING:   { label: t('orders.status.PENDING'),   color: 'bg-orange-100 text-orange-700', icon: '●' },
    CONFIRMED: { label: t('orders.status.CONFIRMED'), color: 'bg-green-100 text-green-700',   icon: '✓' },
    SHIPPING:  { label: t('orders.status.SHIPPING'),  color: 'bg-blue-100 text-blue-700',     icon: '🚚' },
    DELIVERED: { label: t('orders.status.DELIVERED'), color: 'bg-slate-100 text-slate-500',   icon: '✔' },
    CANCELLED: { label: t('orders.status.CANCELLED'), color: 'bg-red-100 text-red-500',       icon: '✕' },
  };
}
type FlatItem = OrderItem & { orderId: string; orderCreatedAt: string; orderStatus: string };

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

function SubtotalRow({ items, leadingCols, trailingColSpan = 2 }: {
  items: Array<{ quantity: number; price: number }>;
  leadingCols: number; trailingColSpan?: number;
}) {
  const { t } = useTranslation();
  const count    = items.length;
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const totalAmt = items.reduce((s, it) => s + it.price * it.quantity, 0);
  return (
    <tr className="bg-slate-100 border-t-2 border-slate-200">
      <td colSpan={leadingCols + 5} className="px-4 py-2.5 text-xs text-slate-500">
        {t('orders.subtotal')} <span className="font-bold text-slate-700">{t('orders.caseCount', { count })}</span>
      </td>
      <td className="px-3 py-2.5 text-center text-sm font-bold text-slate-700">{t('orders.unitCount', { count: totalQty })}</td>
      <td colSpan={2} />
      <td className="px-3 py-2.5 text-right text-sm font-bold text-primary-700 whitespace-nowrap">{formatPrice(totalAmt)}</td>
      <td colSpan={trailingColSpan} />
    </tr>
  );
}

/* isOnSale/saleType/saleValue: 실시간 product 상태가 아니라 "주문 당시" 스냅샷을 받는다 */
function ProductCells({ product, size, color, quantity, price, orderCreatedAt, isOnSale, saleType, saleValue, extra }: {
  product: Product; size: string; color: string; quantity: number; price: number;
  orderCreatedAt: string; isOnSale: boolean; saleType: string | null; saleValue: number | null;
  extra?: React.ReactNode;
}) {
  const sizeSurcharge    = (product.sizeExtraPrices?.[size] ?? 0);
  const priceNoSurcharge = price - sizeSurcharge;
  const beforeSalePrice  = isOnSale && saleType && saleValue
    ? saleType === 'RATE'
      ? Math.round(priceNoSurcharge / (1 - saleValue / 100)) + sizeSurcharge
      : priceNoSurcharge + saleValue + sizeSurcharge
    : null;
  const total    = price * quantity;
  const colorIdx = product.colors?.indexOf(color) ?? -1;
  const imgSrc   = (colorIdx >= 0 && product.images[colorIdx]) ? product.images[colorIdx] : (product.images[0] || 'https://placehold.co/48x48');
  return (
    <>
      <td className="px-3 py-3">
        {product.brand
          ? <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded whitespace-nowrap">{product.brand}</span>
          : <span className="text-slate-300 text-xs">-</span>}
      </td>
      <td className="px-3 py-3">
        <Link href={`/home/products/${product.id}`}>
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-primary-50 flex-shrink-0">
            <Image src={imgSrc} alt={product.name} fill className="object-cover" />
          </div>
        </Link>
      </td>
      <td className="px-3 py-3">
        <p className="font-medium text-slate-800 truncate max-w-[180px]">{product.name}</p>
        {product.productNumber && <span className="text-xs text-slate-400 font-mono">{product.productNumber}</span>}
      </td>
      <td className="px-3 py-3 text-center text-xs text-slate-500">{size}</td>
      <td className="px-3 py-3 text-center text-xs text-slate-500">{color}</td>
      <td className="px-3 py-3 text-center font-semibold text-slate-700">{quantity}</td>
      <td className="px-3 py-3 text-center">
        {isOnSale && saleValue
          ? <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              {saleType === 'RATE' ? `-${saleValue}%` : `-${formatPrice(saleValue)}`}
            </span>
          : <span className="text-slate-200 text-xs">-</span>}
      </td>
      <td className="px-3 py-3 text-right">
        {beforeSalePrice
          ? <div><p className="text-xs text-slate-400 line-through">{formatPrice(beforeSalePrice)}</p><p className="text-sm font-bold text-red-600">{formatPrice(price)}</p></div>
          : <p className="text-sm font-semibold text-primary-700">{formatPrice(price)}</p>}
      </td>
      <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatPrice(total)}</td>
      <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">
        {new Date(orderCreatedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </td>
      {extra !== undefined && <td className="px-3 py-3 text-center">{extra}</td>}
    </>
  );
}

/* ════════════════════════════════════════
   입고내역 헬퍼
════════════════════════════════════════ */
function groupInboundByDate(items: UnifiedItem[]): Array<{ date: string; label: string; items: UnifiedItem[] }> {
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

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function OrdersManagementPage() {
  const { t } = useTranslation();
  const { status } = useSession();
  const router = useRouter();
  const STATUS_LABEL = getStatusLabel(t);
  const [mainTab, setMainTab] = useState<MainTab>('orders');

  /* ── 주문내역 상태 ── */
  const [orders, setOrders]          = useState<Order[]>([]);
  const [ousuItems, setOusuItems]    = useState<OutStockItem[]>([]);
  const [cancelPolicy, setCancelPolicy] = useState<CancelPolicy>({ globalEnabled: false, cancelFrom: null, cancelTo: null });
  const [selectedItems, setSelected] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling]  = useState(false);
  const [errMsg, setErrMsg]          = useState('');
  const [ordersSubTab, setOrdersSubTab] = useState<'orders' | 'ousu'>('orders');
  const [now, setNow] = useState(() => new Date());
  const [deliveryPolicy, setDeliveryPolicy] = useState<DeliveryPolicy>({ enabled: false, fromTime: null, toTime: null });

  /* ── 취소내역 상태 ── */
  const [cancelledItems, setCancelledItems] = useState<CancelledItem[]>([]);
  const [cancelledPage, setCancelledPage] = useState(1);

  /* ── 입고내역 상태 ── */
  const [inboundItems, setInboundItems] = useState<UnifiedItem[]>([]);
  const [openDate, setOpenDate]         = useState<string | null>(null);
  const [requesting, setRequesting]     = useState<string | null>(null);
  const [inboundDateFilter, setInboundDateFilter] = useState('');
  const [inboundPage, setInboundPage] = useState(1);

  /* ── 배송내역 상태 ── */
  const [shippings, setShippings]         = useState<ShippingEntry[]>([]);
  const [shippingSubTab, setShippingSubTab] = useState<'status' | 'storage'>('status');
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);
  const [openStorageDate, setOpenStorageDate] = useState<string | null>(null);
  const [storageRequesting, setStorageRequesting] = useState<string | null>(null);
  const [shippingPage, setShippingPage] = useState(1);

  /* ── 공통 ── */
  const [loading, setLoading] = useState(true);

  /* ── 데이터 로드 ── */
  const loadOrders = () => Promise.all([
    fetch('/api/orders').then((r) => r.json()),
    fetch('/api/orders/items?outOfStockOrUnshipped=1').then((r) => r.json()),
    fetch('/api/cancel-policy').then((r) => r.json()),
    fetch('/api/delivery-policy').then((r) => r.json()),
  ]).then(([o, ousu, pol, delivPol]) => {
    setOrders(Array.isArray(o) ? o : []);
    setOusuItems(Array.isArray(ousu) ? ousu : []);
    setCancelPolicy({ globalEnabled: pol.globalEnabled ?? false, cancelFrom: pol.cancelFrom ?? null, cancelTo: pol.cancelTo ?? null });
    setDeliveryPolicy({ enabled: delivPol.enabled ?? false, fromTime: delivPol.fromTime ?? null, toTime: delivPol.toTime ?? null });
  }).catch(() => {});

  const loadCancelled = () =>
    fetch('/api/orders/items?cancelled=1').then((r) => r.json())
      .then((data) => setCancelledItems(Array.isArray(data) ? data : []))
      .catch(() => {});

  const loadInbound = () => Promise.all([
    fetch('/api/orders/items?allArrived=1').then((r) => r.json()),
    fetch('/api/inbound').then((r) => r.json()),
  ]).then(([orderItems, inbounds]) => {
    const orderMapped: InboundOrderItem[] = Array.isArray(orderItems)
      ? orderItems.map((it: any) => ({ ...it, deliveryRequestedAt: it.deliveryRequestedAt ?? null, _source: 'order' as const }))
      : [];
    const supplierMapped: SupplierItem[] = Array.isArray(inbounds)
      ? inbounds.flatMap((ib: any) =>
          ib.items.map((item: any) => ({
            id: item.id, quantity: item.quantity, size: item.size, color: item.color,
            arrivedAt: ib.arrivedAt, deliveryRequestedAt: item.deliveryRequestedAt ?? null,
            name: item.name, brand: ib.brand, note: ib.note,
            product: item.product ?? null, _source: 'supplier' as const,
          }))
        )
      : [];
    const merged = [...orderMapped, ...supplierMapped];
    setInboundItems(merged);
    if (merged.length > 0 && !openDate) {
      const newest = merged.reduce((a, b) => a.arrivedAt > b.arrivedAt ? a : b).arrivedAt.slice(0, 10);
      setOpenDate(newest);
    }
  }).catch(() => {});

  const loadShipping = () =>
    fetch('/api/shipping').then((r) => r.json())
      .then((data) => setShippings(Array.isArray(data) ? data : []))
      .catch(() => {});

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login?callbackUrl=/home/orders'); return; }
    if (status !== 'authenticated') return;

    Promise.all([loadOrders(), loadCancelled(), loadInbound(), loadShipping()]).then(() => setLoading(false));
    const timer = setInterval(() => { setNow(new Date()); loadOrders(); }, 60_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const switchMain = (tab: MainTab) => {
    setMainTab(tab);
    if (tab === 'orders')    loadOrders();
    if (tab === 'cancelled') loadCancelled();
    if (tab === 'inbound')   loadInbound();
    if (tab === 'shipping')  loadShipping();
  };

  /* ── 주문내역 계산 ── */
  const canCancelNow = useMemo(() => {
    if (!cancelPolicy.globalEnabled) return false;
    return isWithinCancelWindow(cancelPolicy.cancelFrom, cancelPolicy.cancelTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelPolicy, now]);

  const canRequestDeliveryNow = useMemo(() => {
    if (!deliveryPolicy.enabled) return true;
    return isWithinTimeWindow(deliveryPolicy.fromTime, deliveryPolicy.toTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryPolicy, now]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const isCheckable = (item: OrderItem) =>
    canCancelNow && !item.cancelledAt && !item.arrivedAt && !item.outOfStockAt && !item.unshippedAt && !item.cancelLocked;

  const activeFlat = useMemo<FlatItem[]>(() =>
    orders.flatMap((o) => o.items.filter((it) => !it.cancelledAt && !it.arrivedAt && !it.outOfStockAt && !it.unshippedAt)
      .map((it) => ({ ...it, orderId: o.id, orderCreatedAt: o.createdAt, orderStatus: o.status }))),
    [orders]);

  const arrivedFlat = useMemo<FlatItem[]>(() =>
    orders.flatMap((o) => o.items.filter((it) => !it.cancelledAt && it.arrivedAt && new Date(it.arrivedAt) >= today)
      .map((it) => ({ ...it, orderId: o.id, orderCreatedAt: o.createdAt, orderStatus: o.status }))),
    [orders, today]);

  const todayOusuFlat = useMemo<FlatItem[]>(() =>
    orders.flatMap((o) => o.items.filter((it) => {
      const oos = it.outOfStockAt ? new Date(it.outOfStockAt) >= today : false;
      const uns = it.unshippedAt  ? new Date(it.unshippedAt)  >= today : false;
      return oos || uns;
    }).map((it) => ({ ...it, orderId: o.id, orderCreatedAt: o.createdAt, orderStatus: o.status }))),
    [orders, today]);

  const checkableIds = useMemo(() => activeFlat.filter(isCheckable).map((it) => it.id), [activeFlat, canCancelNow]);
  const allChecked   = checkableIds.length > 0 && checkableIds.every((id) => selectedItems.has(id));
  const someChecked  = checkableIds.some((id) => selectedItems.has(id));

  const toggleAll  = () => {
    if (allChecked) setSelected((p) => { const n = new Set(p); checkableIds.forEach((id) => n.delete(id)); return n; });
    else            setSelected((p) => { const n = new Set(p); checkableIds.forEach((id) => n.add(id));    return n; });
  };
  const toggleItem = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleCancelSelected = async () => {
    const itemIds = Array.from(selectedItems);
    if (!itemIds.length) return;
    if (!confirm(t('orders.confirmCancel', { count: itemIds.length }))) return;
    setCancelling(true); setErrMsg('');
    const res = await fetch('/api/orders/items', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds, action: 'cancel' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setErrMsg(err.error || t('orders.err.cancelFailed'));
      setCancelling(false); return;
    }
    const nowStr = new Date().toISOString();
    setOrders((prev) => prev.map((o) => ({ ...o, items: o.items.map((it) => selectedItems.has(it.id) ? { ...it, cancelledAt: nowStr } : it) })));
    setSelected(new Set()); setCancelling(false);
  };

  /* ── 배송내역(보관중) 배송 요청 ── */
  const handleStorageDeliveryRequest = async (date: string, itemIds: string[], request: boolean) => {
    setStorageRequesting(date);
    const action = request ? 'requestDelivery' : 'cancelDeliveryRequest';
    await fetch('/api/orders/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds, action }),
    });
    const idSet = new Set(itemIds);
    setOrders((prev) => prev.map((o) => ({
      ...o,
      items: o.items.map((it) =>
        idSet.has(it.id) ? { ...it, deliveryRequestedAt: request ? new Date().toISOString() : null } : it
      ),
    })));
    setStorageRequesting(null);
  };

  /* ── 입고내역 배송 요청 ── */
  const handleDeliveryRequest = async (date: string, dayItems: UnifiedItem[], request: boolean) => {
    setRequesting(date);
    const action         = request ? 'requestDelivery' : 'cancelDeliveryRequest';
    const orderItemIds   = dayItems.filter((it) => it._source === 'order').map((it) => it.id);
    const inboundItemIds = dayItems.filter((it) => it._source === 'supplier').map((it) => it.id);
    await Promise.all([
      ...(orderItemIds.length   > 0 ? [fetch('/api/orders/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: orderItemIds,   action }) })] : []),
      ...(inboundItemIds.length > 0 ? [fetch('/api/inbound',      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: inboundItemIds, action }) })] : []),
    ]);
    const daySet = new Set(dayItems.map((d) => `${d._source}:${d.id}`));
    setInboundItems((prev) => prev.map((it) =>
      daySet.has(`${it._source}:${it.id}`) ? { ...it, deliveryRequestedAt: request ? new Date().toISOString() : null } as UnifiedItem : it
    ));
    setRequesting(null);
  };

  /* ── 입고내역 그룹 ── */
  const filteredInbound = useMemo(() => {
    if (!inboundDateFilter) return inboundItems;
    const d    = new Date(inboundDateFilter); d.setHours(0, 0, 0, 0);
    const dEnd = new Date(inboundDateFilter); dEnd.setHours(23, 59, 59, 999);
    return inboundItems.filter((it) => { const t = new Date(it.arrivedAt).getTime(); return t >= d.getTime() && t <= dEnd.getTime(); });
  }, [inboundItems, inboundDateFilter]);
  const inboundGroups = useMemo(() => groupInboundByDate(filteredInbound), [filteredInbound]);
  const inboundTotalPages = Math.max(1, Math.ceil(inboundGroups.length / PAGE_SIZE));
  const pagedInboundGroups = useMemo(() => inboundGroups.slice((inboundPage - 1) * PAGE_SIZE, inboundPage * PAGE_SIZE), [inboundGroups, inboundPage]);
  useEffect(() => { setInboundPage(1); }, [inboundDateFilter]);
  useEffect(() => { setInboundPage((p) => Math.min(p, inboundTotalPages)); }, [inboundTotalPages]);

  const cancelledTotalPages = Math.max(1, Math.ceil(cancelledItems.length / PAGE_SIZE));
  const pagedCancelledItems = useMemo(() => cancelledItems.slice((cancelledPage - 1) * PAGE_SIZE, cancelledPage * PAGE_SIZE), [cancelledItems, cancelledPage]);
  useEffect(() => { setCancelledPage((p) => Math.min(p, cancelledTotalPages)); }, [cancelledTotalPages]);

  /* ── 배송내역 계산 ── */
  const storageOrders = orders.filter(
    (o) => o.status === 'CONFIRMED' && o.items.some((i) => i.arrivedAt !== null)
  );

  const shippingList = shippings.filter((s) =>
    s.order.status === 'DELIVERED' || s.order.status === 'SHIPPING'
  );
  const shippingTotalPages = Math.max(1, Math.ceil(shippingList.length / PAGE_SIZE));
  const pagedShippingList = useMemo(() => shippingList.slice((shippingPage - 1) * PAGE_SIZE, shippingPage * PAGE_SIZE), [shippingList, shippingPage]);
  useEffect(() => { setShippingPage((p) => Math.min(p, shippingTotalPages)); }, [shippingTotalPages]);

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

  if (loading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-400">{t('orders.loading')}</div>;

  /* ════ RENDER ════ */
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('orders.title')}</h1>

      {/* 메인 탭 */}
      <div className="flex gap-2 mb-6">
        {([
          { id: 'orders',    label: t('orders.tab.orders') },
          { id: 'cancelled', label: t('orders.tab.cancelled') },
          { id: 'inbound',   label: t('orders.tab.inbound') },
          { id: 'shipping',  label: t('orders.tab.shipping') },
        ] as { id: MainTab; label: string }[]).map(({ id, label }) => (
          <button key={id} onClick={() => switchMain(id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mainTab === id ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-400'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ════════════ 주문내역 탭 ════════════ */}
      {mainTab === 'orders' && (
        <div className="space-y-5">
          {/* 서브 탭 */}
          <div className="flex gap-2">
            <button onClick={() => setOrdersSubTab('orders')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${ordersSubTab === 'orders' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-400'}`}>
              {t('orders.subtab.orders')}
            </button>
            <button onClick={() => setOrdersSubTab('ousu')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${ordersSubTab === 'ousu' ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-300'}`}>
              {t('orders.subtab.ousu')}
              {ousuItems.length > 0 && (
                <span className={`ml-1.5 text-xs font-normal ${ordersSubTab === 'ousu' ? 'text-white/80' : 'text-slate-400'}`}>{ousuItems.length}</span>
              )}
            </button>
          </div>

          {/* 주문내역 서브탭 */}
          {ordersSubTab === 'orders' && (
            <div className="space-y-6">
              {/* 취소 정책 배너 */}
              {cancelPolicy.globalEnabled && (cancelPolicy.cancelFrom || cancelPolicy.cancelTo) && (
                canCancelNow ? (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{t('orders.cancelBanner.okTitle')}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">{t('orders.cancelBanner.window', { from: cancelPolicy.cancelFrom, to: cancelPolicy.cancelTo })}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-amber-700">{t('orders.cancelBanner.closedTitle')}</p>
                      <p className="text-xs text-amber-600 mt-0.5">{t('orders.cancelBanner.window', { from: cancelPolicy.cancelFrom, to: cancelPolicy.cancelTo })}</p>
                    </div>
                  </div>
                )
              )}
              {!cancelPolicy.globalEnabled && (
                <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <p className="text-sm font-medium text-red-600">{t('orders.cancelBanner.disabled')}</p>
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-slate-400">
                  {canCancelNow ? t('orders.cancelHint.canCancel') : t('orders.cancelHint.cannotCancel')}
                </p>
                <div className="flex items-center gap-3">
                  {errMsg && <span className="text-xs text-red-500">{errMsg}</span>}
                  {selectedItems.size > 0 && (
                    <button onClick={handleCancelSelected} disabled={cancelling}
                      className="text-sm px-4 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                      {cancelling ? t('orders.processing') : t('orders.cancelSelected', { count: selectedItems.size })}
                    </button>
                  )}
                </div>
              </div>

              {/* 주문 중 */}
              {activeFlat.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                      <thead>
                        <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                          <th className="px-3 py-3 w-10">
                            {checkableIds.length > 0 && (
                              <input type="checkbox" checked={allChecked}
                                ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                onChange={toggleAll} className="w-4 h-4 accent-red-500 cursor-pointer" />
                            )}
                          </th>
                          <th className="px-3 py-3 text-left">{t('orders.col.brand')}</th>
                          <th className="px-3 py-3 text-left w-14">{t('orders.col.photo')}</th>
                          <th className="px-3 py-3 text-left">{t('orders.col.name')}</th>
                          <th className="px-3 py-3 text-center w-20">{t('orders.col.size')}</th>
                          <th className="px-3 py-3 text-center w-20">{t('orders.col.color')}</th>
                          <th className="px-3 py-3 text-center w-14">{t('orders.col.qty')}</th>
                          <th className="px-3 py-3 text-center w-16">{t('orders.col.sale')}</th>
                          <th className="px-3 py-3 text-right">{t('orders.col.unitPrice')}</th>
                          <th className="px-3 py-3 text-right w-28">{t('orders.col.total')}</th>
                          <th className="px-3 py-3 text-left w-36">{t('orders.col.orderDate')}</th>
                          <th className="px-3 py-3 text-center w-20">{t('orders.col.status')}</th>
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
                                  <span title={t('orders.lockedTitle')} className="text-slate-300 text-base leading-none select-none">🔒</span>
                                ) : !canCancelNow && !item.cancelledAt && !item.arrivedAt && !item.outOfStockAt && !item.unshippedAt ? (
                                  <span className="text-[10px] text-slate-400 leading-tight block whitespace-nowrap">{t('orders.cannotCancelBadge')}</span>
                                ) : (
                                  <span className="text-slate-200 text-xs">—</span>
                                )}
                              </td>
                              <ProductCells product={item.product} size={item.size} color={item.color}
                                quantity={item.quantity} price={item.price} orderCreatedAt={item.orderCreatedAt}
                                isOnSale={item.isOnSale} saleType={item.saleType} saleValue={item.saleValue}
                                extra={<span className={`badge text-xs ${st.color}`}>{st.icon} {st.label}</span>} />
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot><SubtotalRow items={activeFlat} leadingCols={1} /></tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 오늘 입고됨 */}
              {arrivedFlat.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-bold text-emerald-700">{t('orders.arrivedToday.title')}</h3>
                    <span className="text-xs text-slate-400">{t('orders.arrivedToday.desc')}</span>
                  </div>
                  <div className="card overflow-hidden border-l-4 border-emerald-400">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-max">
                        <thead>
                          <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                            <th className="px-3 py-3 text-left">{t('orders.col.brand')}</th>
                            <th className="px-3 py-3 text-left w-14">{t('orders.col.photo')}</th>
                            <th className="px-3 py-3 text-left">{t('orders.col.name')}</th>
                            <th className="px-3 py-3 text-center w-20">{t('orders.col.size')}</th>
                            <th className="px-3 py-3 text-center w-20">{t('orders.col.color')}</th>
                            <th className="px-3 py-3 text-center w-14">{t('orders.col.qty')}</th>
                            <th className="px-3 py-3 text-center w-16">{t('orders.col.sale')}</th>
                            <th className="px-3 py-3 text-right">{t('orders.col.unitPrice')}</th>
                            <th className="px-3 py-3 text-right w-28">{t('orders.col.total')}</th>
                            <th className="px-3 py-3 text-left w-36">{t('orders.col.orderDate')}</th>
                            <th className="px-3 py-3 text-center w-20">{t('orders.col.arrivedTime')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-50">
                          {arrivedFlat.map((item) => (
                            <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                              <ProductCells product={item.product} size={item.size} color={item.color}
                                quantity={item.quantity} price={item.price} orderCreatedAt={item.orderCreatedAt}
                                isOnSale={item.isOnSale} saleType={item.saleType} saleValue={item.saleValue}
                                extra={<span className="text-xs text-emerald-600 font-medium">
                                  {item.arrivedAt ? new Date(item.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </span>} />
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><SubtotalRow items={arrivedFlat} leadingCols={0} /></tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 오늘 품절/미송 */}
              {todayOusuFlat.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-bold text-orange-600">{t('orders.oosToday.title')}</h3>
                  </div>
                  <div className="card overflow-hidden border-l-4 border-orange-400">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-max">
                        <thead>
                          <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                            <th className="px-3 py-3 text-left">{t('orders.col.brand')}</th>
                            <th className="px-3 py-3 text-left w-14">{t('orders.col.photo')}</th>
                            <th className="px-3 py-3 text-left">{t('orders.col.name')}</th>
                            <th className="px-3 py-3 text-center w-20">{t('orders.col.size')}</th>
                            <th className="px-3 py-3 text-center w-20">{t('orders.col.color')}</th>
                            <th className="px-3 py-3 text-center w-14">{t('orders.col.qty')}</th>
                            <th className="px-3 py-3 text-center w-16">{t('orders.col.sale')}</th>
                            <th className="px-3 py-3 text-right">{t('orders.col.unitPrice')}</th>
                            <th className="px-3 py-3 text-right w-28">{t('orders.col.total')}</th>
                            <th className="px-3 py-3 text-left w-36">{t('orders.col.orderDate')}</th>
                            <th className="px-3 py-3 text-center w-20">{t('orders.col.type')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-50">
                          {todayOusuFlat.map((item) => (
                            <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                              <ProductCells product={item.product} size={item.size} color={item.color}
                                quantity={item.quantity} price={item.price} orderCreatedAt={item.orderCreatedAt}
                                isOnSale={item.isOnSale} saleType={item.saleType} saleValue={item.saleValue}
                                extra={item.outOfStockAt
                                  ? <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{t('orders.badge.outOfStock')}</span>
                                  : <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">{t('orders.badge.unshipped')}</span>} />
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><SubtotalRow items={todayOusuFlat} leadingCols={0} /></tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeFlat.length === 0 && arrivedFlat.length === 0 && todayOusuFlat.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <div className="text-5xl mb-3">📦</div>
                  <p>{t('orders.empty.activeOrders')}</p>
                </div>
              )}
            </div>
          )}

          {/* 품절/미송 서브탭 */}
          {ordersSubTab === 'ousu' && (
            ousuItems.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">📋</div>
                <p>{t('orders.empty.ousu')}</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-3 text-center w-16">{t('orders.col.type')}</th>
                        <th className="px-3 py-3 text-left">{t('orders.col.brand')}</th>
                        <th className="px-3 py-3 text-left w-14">{t('orders.col.photo')}</th>
                        <th className="px-3 py-3 text-left">{t('orders.col.name')}</th>
                        <th className="px-3 py-3 text-center w-20">{t('orders.col.size')}</th>
                        <th className="px-3 py-3 text-center w-20">{t('orders.col.color')}</th>
                        <th className="px-3 py-3 text-center w-14">{t('orders.col.qty')}</th>
                        <th className="px-3 py-3 text-center w-16">{t('orders.col.sale')}</th>
                        <th className="px-3 py-3 text-right">{t('orders.col.unitPrice')}</th>
                        <th className="px-3 py-3 text-right w-28">{t('orders.col.total')}</th>
                        <th className="px-3 py-3 text-left w-36">{t('orders.col.orderDate')}</th>
                        <th className="px-3 py-3 text-center w-32">{t('orders.col.processedAt')}</th>
                        <th className="px-3 py-3 text-left">{t('orders.col.remark')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {ousuItems.map((item) => {
                        const isOos       = !!item.outOfStockAt;
                        const processedAt = isOos ? item.outOfStockAt! : item.unshippedAt!;
                        return (
                          <tr key={item.id} className={`transition-colors ${isOos ? 'hover:bg-orange-50/20' : 'hover:bg-purple-50/20'}`}>
                            <td className="px-3 py-3 text-center">
                              {isOos
                                ? <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-full">{t('orders.badge.outOfStock')}</span>
                                : <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded-full">{t('orders.badge.unshipped')}</span>}
                            </td>
                            <ProductCells product={item.product} size={item.size} color={item.color}
                              quantity={item.quantity} price={item.price} orderCreatedAt={item.order.createdAt}
                              isOnSale={item.isOnSale} saleType={item.saleType} saleValue={item.saleValue}
                              extra={<span className={`text-xs font-medium whitespace-nowrap ${isOos ? 'text-orange-500' : 'text-purple-500'}`}>
                                {new Date(processedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>} />
                            <td className="px-3 py-3">
                              {item.remark
                                ? <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded font-medium max-w-[160px] block">{item.remark}</span>
                                : <span className="text-xs text-slate-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><SubtotalRow items={ousuItems} leadingCols={1} trailingColSpan={3} /></tfoot>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ════════════ 취소내역 탭 ════════════ */}
      {mainTab === 'cancelled' && (
        cancelledItems.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">✅</div>
            <p>{t('orders.empty.cancelled')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Pagination page={cancelledPage} totalPages={cancelledTotalPages} onChange={setCancelledPage}
              summary={t('orders.totalCount', { count: cancelledItems.length })} />
            {pagedCancelledItems.map((item) => (
              <div key={item.id} className="card p-4 border-red-100 flex items-start gap-4">
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                  <Image src={item.product.images[0] || 'https://placehold.co/56x56'} alt={item.product.name} fill className="object-cover grayscale" />
                </div>
                <div className="flex-1 min-w-0">
                  {item.product.brand && <p className="text-xs text-primary-600 font-semibold mb-0.5">{item.product.brand}</p>}
                  <p className="text-sm font-medium text-slate-700 line-through truncate">{item.product.name}</p>
                  {item.product.productNumber && <span className="text-xs text-slate-400 font-mono">{item.product.productNumber}</span>}
                  {item.isOnSale && (
                    <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded ml-1 inline-block whitespace-nowrap">
                      {getSaleLabel(item.saleType, item.saleValue)}
                    </span>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">{item.size} / {item.color} / {t('orders.unitCount', { count: item.quantity })}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t('orders.orderRef', { id: item.order.id.slice(-8).toUpperCase(), date: formatDate(item.order.createdAt) })}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-400 line-through">{formatPrice(item.price * item.quantity)}</p>
                  <span className="badge bg-red-100 text-red-600 text-xs mt-1">{t('orders.badge.cancelled')}</span>
                  {item.cancelledAt && <p className="text-xs text-slate-400 mt-1">{formatDate(item.cancelledAt)}</p>}
                </div>
              </div>
            ))}
            <Pagination page={cancelledPage} totalPages={cancelledTotalPages} onChange={setCancelledPage} />
          </div>
        )
      )}

      {/* ════════════ 입고내역 탭 ════════════ */}
      {mainTab === 'inbound' && (
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <p className="text-sm text-slate-500">{t('orders.inbound.subtitle')}</p>
            <div className="flex items-center gap-2">
              <input type="date" className="input text-sm w-44" value={inboundDateFilter} onChange={(e) => setInboundDateFilter(e.target.value)} />
              {inboundDateFilter && <button onClick={() => setInboundDateFilter('')} className="text-xs text-slate-500 hover:text-slate-700">{t('orders.reset')}</button>}
            </div>
          </div>

          {deliveryPolicy.enabled && !canRequestDeliveryNow && (
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-700">
                {t('orders.deliveryBanner.notNow', { from: deliveryPolicy.fromTime, to: deliveryPolicy.toTime })}
              </p>
            </div>
          )}

          {inboundGroups.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📦</div>
              <p>{t('orders.empty.inbound')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Pagination page={inboundPage} totalPages={inboundTotalPages} onChange={setInboundPage}
                summary={t('orders.totalCount', { count: inboundGroups.length })} />
              {pagedInboundGroups.map(({ date, label, items: dayItems }) => {
                const isOpen      = openDate === date;
                const totalQty    = dayItems.reduce((s, i) => s + i.quantity, 0);
                const totalAmt    = dayItems.reduce((s, i) => i._source === 'order' ? s + (i as InboundOrderItem).price * i.quantity : s, 0);
                const actionableItems = dayItems.filter((it) => !(it._source === 'order' && (it as InboundOrderItem).order.status === 'DELIVERED'));
                const isRequested = actionableItems.some((it) => !!it.deliveryRequestedAt);

                return (
                  <div key={date} className="card overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                      <button onClick={() => setOpenDate(isOpen ? null : date)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                        <span className="font-semibold text-slate-800 text-sm flex-shrink-0">{label}</span>
                        <span className="text-xs text-slate-500 flex-shrink-0">{t('orders.inbound.summary', { count: dayItems.length, qty: totalQty })}</span>
                        {isRequested && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{t('orders.badge.deliveryRequested')}</span>}
                      </button>
                      {totalAmt > 0 && <span className="text-sm font-bold text-primary-700 whitespace-nowrap flex-shrink-0">{formatPrice(totalAmt)}</span>}
                      {actionableItems.length > 0 && (
                        isRequested ? (
                          <button onClick={() => handleDeliveryRequest(date, actionableItems, false)} disabled={requesting === date}
                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                            {requesting === date ? t('orders.processing') : t('orders.button.cancelRequest')}
                          </button>
                        ) : (
                          <button onClick={() => handleDeliveryRequest(date, actionableItems, true)} disabled={requesting === date || !canRequestDeliveryNow}
                            title={!canRequestDeliveryNow ? t('orders.deliveryWindow', { from: deliveryPolicy.fromTime, to: deliveryPolicy.toTime }) : undefined}
                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
                            {requesting === date ? t('orders.processing') : t('orders.button.requestDelivery')}
                          </button>
                        )
                      )}
                      <button onClick={() => setOpenDate(isOpen ? null : date)} className="flex-shrink-0">
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-slate-100 overflow-x-auto">
                        <table className="w-full text-sm min-w-max">
                          <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
                            <tr>
                              <th className="px-4 py-2 text-left">{t('orders.col.photo')}</th>
                              <th className="px-4 py-2 text-left">{t('orders.col.brand')}</th>
                              <th className="px-4 py-2 text-left">{t('orders.col.productName')}</th>
                              <th className="px-4 py-2 text-left">{t('orders.col.size')}</th>
                              <th className="px-4 py-2 text-left">{t('orders.col.color2')}</th>
                              <th className="px-4 py-2 text-center">{t('orders.col.qty')}</th>
                              <th className="px-4 py-2 text-center">{t('orders.col.sale')}</th>
                              <th className="px-4 py-2 text-right">{t('orders.col.amount')}</th>
                              <th className="px-4 py-2 text-left">{t('orders.col.arrivedTime2')}</th>
                              <th className="px-4 py-2 text-left">{t('orders.col.type')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {dayItems.map((it) => {
                              if (it._source === 'order') {
                                const oi = it as InboundOrderItem;
                                const delivered = oi.order.status === 'DELIVERED';
                                return (
                                  <tr key={oi.id} className={`transition-colors ${delivered ? 'bg-green-50/40' : oi.deliveryRequestedAt ? 'bg-amber-50/40' : 'hover:bg-emerald-50/20'}`}>
                                    <td className="px-4 py-3"><div className="relative w-11 h-11 rounded-lg overflow-hidden bg-emerald-50"><Image src={oi.product.images[0] || 'https://placehold.co/44x44'} alt={oi.product.name} fill className="object-cover" /></div></td>
                                    <td className="px-4 py-3">{oi.product.brand ? <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{oi.product.brand}</span> : <span className="text-slate-300 text-xs">-</span>}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px]">
                                      <span className="block truncate">{oi.product.name}</span>
                                      {oi.product.productNumber && <span className="block text-xs text-slate-400 font-mono">{oi.product.productNumber}</span>}
                                      {delivered
                                        ? <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold mt-0.5 inline-block">{t('orders.badge.delivered')}</span>
                                        : oi.deliveryRequestedAt && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold mt-0.5 inline-block">{t('orders.badge.deliveryRequested')}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{oi.size || '-'}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{oi.color || '-'}</td>
                                    <td className="px-4 py-3 text-center font-semibold">{oi.quantity}</td>
                                    <td className="px-4 py-3 text-center">
                                      {oi.isOnSale
                                        ? <span className="text-xs font-bold text-red-500 whitespace-nowrap">{oi.saleType === 'RATE' ? `${oi.saleValue}%` : oi.saleValue ? `${oi.saleValue.toLocaleString()}원` : ''}</span>
                                        : <span className="text-slate-300 text-xs">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-primary-700">{formatPrice(oi.price * oi.quantity)}</td>
                                    <td className="px-4 py-3 text-xs text-emerald-600 font-medium">{new Date(oi.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">#{oi.order.id.slice(-6).toUpperCase()}</td>
                                  </tr>
                                );
                              } else {
                                const si    = it as SupplierItem;
                                const img   = si.product?.images?.[0] || 'https://placehold.co/44x44';
                                const name  = si.product?.name || si.name;
                                const brand = si.product?.brand || si.brand;
                                const productNumber = si.product?.productNumber;
                                return (
                                  <tr key={si.id} className={`transition-colors ${si.deliveryRequestedAt ? 'bg-amber-50/40' : 'hover:bg-blue-50/20'}`}>
                                    <td className="px-4 py-3"><div className="relative w-11 h-11 rounded-lg overflow-hidden bg-blue-50"><Image src={img} alt={name} fill className="object-cover" /></div></td>
                                    <td className="px-4 py-3">{brand ? <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{brand}</span> : <span className="text-slate-300 text-xs">-</span>}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px]">
                                      <span className="block truncate">{name}</span>
                                      {productNumber && <span className="block text-xs text-slate-400 font-mono">{productNumber}</span>}
                                      {si.deliveryRequestedAt && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold mt-0.5 inline-block">{t('orders.badge.deliveryRequested')}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{si.size || '-'}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{si.color || '-'}</td>
                                    <td className="px-4 py-3 text-center font-semibold">{si.quantity}</td>
                                    <td className="px-4 py-3 text-center">
                                      {si.isOnSale
                                        ? <span className="text-xs font-bold text-red-500 whitespace-nowrap">{si.saleType === 'RATE' ? `${si.saleValue}%` : si.saleValue ? `${si.saleValue.toLocaleString()}원` : ''}</span>
                                        : <span className="text-slate-300 text-xs">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-300 text-xs">-</td>
                                    <td className="px-4 py-3 text-xs text-blue-500 font-medium">{new Date(si.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="px-4 py-3"><span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{t('orders.badge.supplier')}</span></td>
                                  </tr>
                                );
                              }
                            })}
                          </tbody>
                          <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                            <tr>
                              <td colSpan={5} className="px-4 py-2">{t('orders.subtotal')}</td>
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
              <Pagination page={inboundPage} totalPages={inboundTotalPages} onChange={setInboundPage} />
            </div>
          )}
        </div>
      )}

      {/* ════════════ 배송내역 탭 ════════════ */}
      {mainTab === 'shipping' && (
        <div>
          {/* 서브 탭 */}
          <div className="flex gap-2 mb-5">
            {([
              { id: 'status',  label: t('orders.shipping.subtab.status'), count: shippingList.length },
              { id: 'storage', label: t('orders.shipping.subtab.storage'), count: storageOrders.length },
            ] as { id: 'status' | 'storage'; label: string; count: number }[]).map(({ id, label, count }) => (
              <button key={id} onClick={() => setShippingSubTab(id)}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  shippingSubTab === id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-400'
                }`}>
                {label}
                <span className={`ml-1.5 text-xs font-normal ${shippingSubTab === id ? 'text-white/70' : 'text-slate-400'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* 배송현황 서브탭 */}
          {shippingSubTab === 'status' && (
            shippingList.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">🚚</div>
                <p>{t('orders.empty.shipping')}</p>
              </div>
            ) : (
              <div>
                <Pagination page={shippingPage} totalPages={shippingTotalPages} onChange={setShippingPage}
                  summary={t('orders.totalCount', { count: shippingList.length })} />
                <div className="card overflow-x-auto mt-2">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-left text-xs text-slate-400 uppercase">
                      <th className="px-4 py-3">{t('orders.col.shipDate')}</th>
                      <th className="px-4 py-3">{t('orders.col.orderNo')}</th>
                      <th className="px-4 py-3">{t('orders.col.product')}</th>
                      <th className="px-4 py-3">{t('orders.col.arrivalDate')}</th>
                      <th className="px-4 py-3">{t('orders.col.carrier')}</th>
                      <th className="px-4 py-3">{t('orders.col.trackingNo')}</th>
                      <th className="px-4 py-3">{t('orders.col.status')}</th>
                      <th className="px-4 py-3">{t('orders.col.remark')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pagedShippingList.map((s) => {
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
                            <span className="badge text-xs bg-green-100 text-green-800">{t('orders.badge.delivered')}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{s.note || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <Pagination page={shippingPage} totalPages={shippingTotalPages} onChange={setShippingPage} />
              </div>
            )
          )}

          {/* 보관중 서브탭 */}
          {shippingSubTab === 'storage' && deliveryPolicy.enabled && !canRequestDeliveryNow && (
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-700">
                {t('orders.deliveryBanner.notNow', { from: deliveryPolicy.fromTime, to: deliveryPolicy.toTime })}
              </p>
            </div>
          )}
          {shippingSubTab === 'storage' && (() => {
            const arrivedItems = storageOrders.flatMap((o) =>
              o.items
                .filter((i) => i.arrivedAt !== null)
                .map((i) => ({ ...i, orderId: o.id }))
            );

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
                <p>{t('orders.empty.storage')}</p>
              </div>
            );

            return (
              <div className="space-y-2">
                {dateGroups.map(([date, items]) => {
                  const isOpen      = openStorageDate === date;
                  const totalQty    = items.reduce((s, i) => s + i.quantity, 0);
                  const isRequested = items.some((i) => !!i.deliveryRequestedAt);
                  const groupIds    = items.map((i) => i.id);

                  return (
                    <div key={date} className="card overflow-hidden">
                      {/* 날짜 그룹 헤더 */}
                      <div className={`flex items-center gap-3 px-5 py-4 transition-colors ${isOpen ? 'bg-primary-50' : 'hover:bg-slate-50'}`}>
                        {/* 아코디언 토글 영역 */}
                        <button
                          onClick={() => setOpenStorageDate(isOpen ? null : date)}
                          className="flex-1 flex items-center gap-3 text-left min-w-0"
                        >
                          <span className={`text-sm font-bold flex-shrink-0 ${isOpen ? 'text-primary-700' : 'text-slate-800'}`}>
                            {date}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isOpen ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {t('orders.storage.summary', { count: items.length })}
                          </span>
                          <span className="text-xs text-slate-400 flex-shrink-0">{t('orders.storage.qty', { count: totalQty })}</span>
                          {isRequested && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                              {t('orders.badge.deliveryRequested')}
                            </span>
                          )}
                        </button>

                        {/* 배송 요청 / 취소 버튼 */}
                        {isRequested ? (
                          <button
                            onClick={() => handleStorageDeliveryRequest(date, groupIds, false)}
                            disabled={storageRequesting === date}
                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                          >
                            {storageRequesting === date ? t('orders.processing') : t('orders.button.cancelRequest')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStorageDeliveryRequest(date, groupIds, true)}
                            disabled={storageRequesting === date || !canRequestDeliveryNow}
                            title={!canRequestDeliveryNow ? t('orders.deliveryWindow', { from: deliveryPolicy.fromTime, to: deliveryPolicy.toTime }) : undefined}
                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                          >
                            {storageRequesting === date ? t('orders.processing') : t('orders.button.requestDelivery')}
                          </button>
                        )}

                        {/* 아코디언 화살표 */}
                        <button onClick={() => setOpenStorageDate(isOpen ? null : date)} className="flex-shrink-0">
                          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* 아이템 목록 */}
                      {isOpen && (
                        <div className="border-t border-slate-100 divide-y divide-slate-50">
                          {items.map((item) => (
                            <div key={item.id} className={`flex items-center gap-3 px-5 py-3 transition-colors ${item.deliveryRequestedAt ? 'bg-amber-50/40' : 'hover:bg-slate-50'}`}>
                              {item.product.images?.[0] && (
                                <Image src={item.product.images[0]} alt="" width={44} height={44}
                                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-100" />
                              )}
                              <div className="flex-1 min-w-0">
                                {item.product.brand && (
                                  <p className="text-xs text-primary-600 font-semibold mb-0.5">{item.product.brand}</p>
                                )}
                                <p className="text-sm font-medium text-slate-800 truncate">{item.product.name}</p>
                                {item.product.productNumber && <span className="text-xs text-slate-400 font-mono">{item.product.productNumber}</span>}
                                {item.isOnSale && (
                                  <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded ml-1 inline-block whitespace-nowrap">
                                    {getSaleLabel(item.saleType, item.saleValue)}
                                  </span>
                                )}
                                <div className="flex gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs text-slate-500">{item.size}</span>
                                  <span className="text-xs text-slate-300">·</span>
                                  <span className="text-xs text-slate-500">{item.color}</span>
                                  <span className="text-xs text-slate-300">·</span>
                                  <span className="text-xs font-semibold text-primary-600">{t('orders.unitCount', { count: item.quantity })}</span>
                                  {item.deliveryRequestedAt && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">{t('orders.badge.deliveryRequested')}</span>
                                  )}
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
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800">{t('orders.modal.arrivedItemsTitle', { date: formatDate(selectedDate) })}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{t('orders.modal.totalItems', { count: itemsForDate.length })}</p>
                  </div>
                  <button onClick={() => setSelectedDate(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors text-lg">
                    ×
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-4">
                  {itemsForDate.length === 0 ? (
                    <p className="text-center text-slate-400 py-8 text-sm">{t('orders.modal.emptyForDate')}</p>
                  ) : (
                    <div className="space-y-3">
                      {itemsForDate.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                          {item.product.images?.[0] && (
                            <Image src={item.product.images[0]} alt="" width={48} height={48}
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{item.product.name}</p>
                            {item.product.productNumber && <span className="text-xs text-slate-400 font-mono">{item.product.productNumber}</span>}
                            {item.isOnSale && (
                              <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded ml-1 inline-block whitespace-nowrap">
                                {getSaleLabel(item.saleType, item.saleValue)}
                              </span>
                            )}
                            {item.product.brand && (
                              <p className="text-xs text-slate-400">{item.product.brand}</p>
                            )}
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs text-slate-500">{item.size}</span>
                              <span className="text-xs text-slate-300">·</span>
                              <span className="text-xs text-slate-500">{item.color}</span>
                              <span className="text-xs text-slate-300">·</span>
                              <span className="text-xs font-medium text-primary-600">{t('orders.unitCount', { count: item.quantity })}</span>
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
      )}
    </div>
  );
}
