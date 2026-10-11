'use client';
import { Fragment, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { formatPrice, formatDate } from '@/lib/utils';
import { printInboundRows, type InboundPrintRow } from '@/lib/printInbound';
import { printInvoiceItems, type PrintableItem } from '@/lib/printInvoice';
import EditPriceModal from '@/components/admin/EditPriceModal';
import BrandPriceModal, { type BrandModalRow } from '@/components/admin/BrandPriceModal';
import { resolveColorImage } from '@/lib/productImages';
import { colorCodeFor } from '@/lib/productColorCode';

type DailyRow = InboundPrintRow & { id: string; price: number | null };

/* ── 타입 ── */
type SaleProduct = {
  id: string; name: string; images: string[]; brand: string | null; colors: string[];
  colorImages?: { color: string; imageUrl: string }[];
  isOnSale: boolean; saleType: string | null; saleValue: number | null;
  productNumber?: string | null;
  colorCodes?: { color: string; code: string }[];
};
type AdminProduct = SaleProduct & { category: { name: string } };
/* 세일 스냅샷: OrderItem/InboundItem 자체에 저장된 "주문·입고 당시" 세일 상태 (실시간 product.isOnSale 아님) */
type SaleSnapshot = { isOnSale: boolean; saleType: string | null; saleValue: number | null };
type OrderItem = SaleSnapshot & {
  id: string; quantity: number; price: number; size: string; color: string;
  confirmedAt: string | null; arrivedAt: string | null; cancelledAt: string | null;
  outOfStockAt: string | null; unshippedAt: string | null;
  remark: string | null;
  cancelLocked: boolean;
  product: AdminProduct;
};
type Order = {
  id: string; userId: string; totalAmount: number; status: string; cancelLocked: boolean; createdAt: string; note: string | null;
  user: { id: string; name: string; email: string; phone: string | null };
  items: OrderItem[];
};
type ArrivedItem = SaleSnapshot & {
  id: string; quantity: number; size: string | null; color: string | null; arrivedAt: string; price: number;
  product: SaleProduct;
  order: { id: string; status: string; userId: string; createdAt: string; note: string | null; user: { name: string; email: string } };
};
type CancelledItem = SaleSnapshot & {
  id: string; quantity: number; size: string | null; color: string | null; cancelledAt: string; price: number;
  product: SaleProduct;
  order: { id: string; status: string; userId: string; createdAt: string; note: string | null; user: { name: string; email: string } };
};
type OutStockUnshippedItem = SaleSnapshot & {
  id: string; quantity: number; size: string | null; color: string | null; price: number;
  outOfStockAt: string | null; unshippedAt: string | null;
  remark: string | null;
  product: SaleProduct;
  order: { id: string; status: string; userId: string; createdAt: string; note: string | null; user: { name: string; email: string } };
};
type InboundProduct = {
  id: string; name: string; images: string[]; brand: string | null;
  sizes: string[]; colors: string[]; productNumber?: string | null;
  colorCodes?: { color: string; code: string }[];
};
type InboundRec = {
  id: string; brand: string; note: string | null; arrivedAt: string;
  user: { id: string; name: string; email: string } | null;
  items: Array<SaleSnapshot & {
    id: string; name: string; quantity: number;
    size: string | null; color: string | null; price: number | null;
    product: InboundProduct | null;
  }>;
};
type FlatRow = SaleSnapshot & {
  rowKey: string; itemId: string; orderId: string; userId: string; userName: string;
  brand: string; product: AdminProduct; size: string; color: string; quantity: number; price: number;
  orderDate: string; status: string; itemCancelLocked: boolean; orderCancelLocked: boolean;
  confirmedAt: string | null; arrivedAt: string | null; cancelledAt: string | null;
  outOfStockAt: string | null; unshippedAt: string | null;
  note: string | null; orderBatchId: string | null;
};

// ── 발주 차수 타입 ────────────────────────────────────────────────────────────
type OrderBatch = { id: string; createdAt: string; itemCount: number };

// ── 서버에서 받는 confirmed-items 타입 ─────────────────────────────────────────
type ConfirmedItem = {
  itemId: string; orderId: string; userName: string;
  brand: string; productId: string; productName: string;
  productNumber: string | null; colorCodes: { color: string; code: string }[];
  images: string[]; colorImages: { color: string; imageUrl: string }[];
  size: string; color: string; quantity: number; price: number;
  confirmedAt: string | null; orderBatchId: string | null;
  orderDate: string; note: string | null;
};

type ConfirmedSummaryRow = { brand: string; mall: string; distinctCount: number; totalQty: number };

function flattenOrders(orders: Order[]): FlatRow[] {
  return orders.flatMap((o) =>
    o.items.map((item) => ({
      rowKey: `${o.id}__${item.id}`,
      itemId: item.id, orderId: o.id, userId: o.userId, userName: o.user.name,
      brand: item.product.brand || item.product.category?.name || '',
      product: item.product, size: item.size, color: item.color,
      quantity: item.quantity, price: item.price,
      orderDate: o.createdAt, status: o.status,
      itemCancelLocked: item.cancelLocked, orderCancelLocked: o.cancelLocked,
      confirmedAt: item.confirmedAt, arrivedAt: item.arrivedAt, cancelledAt: item.cancelledAt,
      outOfStockAt: item.outOfStockAt, unshippedAt: item.unshippedAt,
      note: o.note, orderBatchId: (item as any).orderBatchId ?? null,
      isOnSale: item.isOnSale, saleType: item.saleType, saleValue: item.saleValue,
    }))
  );
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── 공통 상품 셀 ── */
/* isOnSale/saleType/saleValue: 실시간 product 상태가 아니라 "주문/입고 당시" 스냅샷을 받는다 */
function ProductCells({ product, brand, size, color, quantity, price, isOnSale, saleType, saleValue, onBrandClick, onEditPrice }: {
  product: SaleProduct; brand: string; size: string; color: string; quantity: number; price: number;
  isOnSale: boolean; saleType: string | null; saleValue: number | null;
  onBrandClick?: (brand: string) => void;
  onEditPrice?: () => void;
}) {
  const imgSrc = resolveColorImage(color, product.colorImages, product.images, '/no-image.svg');
  return (
    <>
      <td className="px-3 py-3">
        {onBrandClick ? (
          <button onClick={() => onBrandClick(brand)}
            className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded whitespace-nowrap hover:bg-primary-100 transition-colors">
            {brand}
          </button>
        ) : (
          <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded whitespace-nowrap">{brand}</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-primary-50">
          <Image src={imgSrc} alt={product.name} fill className="object-cover" />
        </div>
      </td>
      <td className="px-3 py-3 font-medium text-slate-800 max-w-[150px]">
        <span className="block truncate">{product.name}</span>
        {product.productNumber && (
          <span className="block text-xs text-slate-400 font-mono">
            {colorCodeFor(product.productNumber, product.colorCodes, color) ?? product.productNumber}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-slate-600">{size || '-'}</td>
      <td className="px-3 py-3 text-xs text-slate-600">{color || '-'}</td>
      <td className="px-3 py-3 text-center font-semibold">{quantity}</td>
      <td className="px-3 py-3 text-center">
        {isOnSale
          ? <span className="text-xs font-bold text-red-500 whitespace-nowrap">{saleType === 'RATE' ? `${saleValue}%` : saleValue ? `${saleValue.toLocaleString()}원` : ''}</span>
          : <span className="text-slate-300 text-xs">-</span>}
      </td>
      <td className="px-3 py-3 text-right font-semibold text-primary-700">{formatPrice(price)}</td>
      <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
        {formatPrice(price * quantity)}
      </td>
      {onEditPrice && (
        <td className="px-3 py-3 text-center">
          <button onClick={onEditPrice} className="text-xs text-primary-600 hover:underline whitespace-nowrap">수정</button>
        </td>
      )}
    </>
  );
}

function ProductHeaders({ hasEdit }: { hasEdit?: boolean }) {
  return (
    <>
      <th className="px-3 py-3 text-left">브랜드</th>
      <th className="px-3 py-3 text-left">사진</th>
      <th className="px-3 py-3 text-left">이름</th>
      <th className="px-3 py-3 text-left">사이즈</th>
      <th className="px-3 py-3 text-left">컬러</th>
      <th className="px-3 py-3 text-center">수량</th>
      <th className="px-3 py-3 text-center">세일율</th>
      <th className="px-3 py-3 text-right">단가</th>
      <th className="px-3 py-3 text-right">TOTAL</th>
      {hasEdit && <th className="px-3 py-3 text-center">관리</th>}
    </>
  );
}

/* ── 주문 테이블 (주문접수/주문확인용) ── */
function OrderTable({ rows, selected, onToggleRow, onToggleAll, actions }: {
  rows: FlatRow[];
  selected: Set<string>;
  onToggleRow: (itemId: string) => void;
  onToggleAll: () => void;
  actions: Array<{ label: string; color: string; onClick: () => void }>;
}) {
  const allSel   = rows.length > 0 && rows.every((r) => selected.has(r.itemId));
  const someSel  = rows.some((r) => selected.has(r.itemId));
  const selCount = rows.filter((r) => selected.has(r.itemId)).length;

  if (rows.length === 0) return <div className="text-center py-12 text-slate-400">해당 주문이 없습니다.</div>;

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const totalAmt = rows.reduce((s, r) => s + r.price * r.quantity, 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-sm text-slate-500">{selCount > 0 ? `이 탭 ${selCount}건 선택됨` : '항목을 선택하세요'}</span>
        {selCount > 0 && actions.map((a) => (
          <button key={a.label} onClick={a.onClick} className={`text-xs px-4 py-1.5 rounded-lg font-medium text-white ${a.color}`}>{a.label}</button>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-3 py-3">
                  <input type="checkbox" checked={allSel}
                    ref={(el) => { if (el) el.indeterminate = someSel && !allSel; }}
                    onChange={onToggleAll} className="w-4 h-4 accent-primary-600" />
                </th>
                <th className="px-3 py-3 text-left">아이디</th>
                <ProductHeaders />
                <th className="px-3 py-3 text-left">주문일</th>
                <th className="px-3 py-3 text-left">취소잠금</th>
                <th className="px-3 py-3 text-left">입고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => {
                const isSel    = selected.has(row.itemId);
                const isLocked = row.itemCancelLocked || row.orderCancelLocked;
                return (
                  <tr key={row.rowKey} className={`hover:bg-slate-50 transition-colors ${isSel ? 'bg-primary-50/40' : ''}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isSel} onChange={() => onToggleRow(row.itemId)} className="w-4 h-4 accent-primary-600" />
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {row.userName}
                      <span className="block text-slate-400 font-mono text-xs">#{row.orderId.slice(-6).toUpperCase()}</span>
                      {row.note && (
                        <span className="block mt-0.5 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] leading-tight max-w-[120px] break-words whitespace-normal">
                          {row.note}
                        </span>
                      )}
                    </td>
                    <ProductCells product={row.product} brand={row.brand} size={row.size} color={row.color} quantity={row.quantity} price={row.price}
                      isOnSale={row.isOnSale} saleType={row.saleType} saleValue={row.saleValue} />
                    <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(row.orderDate)}</td>
                    <td className="px-3 py-3">
                      {isLocked
                        ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">잠김</span>
                        : <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">허용</span>}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {row.arrivedAt
                        ? <span className="text-green-600 font-semibold">✓ 입고됨</span>
                        : row.outOfStockAt
                          ? <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold">품절</span>
                          : row.unshippedAt
                            ? <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-semibold">미송</span>
                            : <span className="text-slate-300">대기</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
              <tr>
                <td colSpan={8} className="px-3 py-2">합계</td>
                <td className="px-3 py-2 text-center">{totalQty}</td>
                <td />
                <td />
                <td className="px-3 py-2 text-right text-primary-700">{formatPrice(totalAmt)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── 큐 페이지네이션 (주문접수/주문확인 공용) ── */
function QueuePagination({ page, totalPages, onChange, totalCount, label }: {
  page: number; totalPages: number; onChange: (p: number) => void; totalCount: number; label: string;
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
      <span className="text-xs text-slate-400">{label} {totalCount}건</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
            className="px-2.5 py-1 rounded border border-slate-200 text-sm text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary-400">‹</button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-2.5 py-1 rounded border border-slate-200 text-sm text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary-400">›</button>
        </div>
      )}
    </div>
  );
}

/* ── 입고 행 타입 ── */
type InboundFormRow = {
  productId: string; name: string; brand: string;
  image: string; size: string; color: string; quantity: number;
  sizes: string[]; colors: string[];
};
const EMPTY_ROW: InboundFormRow = {
  productId: '', name: '', brand: '', image: '',
  size: '', color: '', quantity: 1,
  sizes: [], colors: [],
};
type ProductSuggestion = {
  id: string; name: string; brand: string | null; images: string[];
  isOnSale: boolean; sizes: string[]; colors: string[];
};

/* ── 상품 검색 자동완성 입력 ── */
function ProductSearchInput({ value, onSelect }: {
  value: string;
  onSelect: (p: ProductSuggestion, searchText: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&admin=1`);
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
      setOpen(true);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <input
          className="input text-sm flex-1"
          placeholder="상품명 검색..."
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {loading && <span className="text-xs text-slate-400 whitespace-nowrap">검색중</span>}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {suggestions.map((p) => (
            <button
              key={p.id} type="button"
              onMouseDown={() => { onSelect(p, p.name); setQuery(p.name); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-primary-50 transition-colors text-left"
            >
              <div className="relative w-8 h-8 rounded flex-shrink-0 overflow-hidden bg-slate-100">
                {p.images[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{p.name}</p>
                {p.brand && <p className="text-xs text-slate-400">{p.brand}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 회원 검색 자동완성 ── */
type UserSuggestion = { id: string; name: string; email: string };
function UserSearchInput({ selected, onSelect }: {
  selected: UserSuggestion | null;
  onSelect: (u: UserSuggestion | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
      setOpen(true);
    }, 300);
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-lg border border-primary-200">
        <span className="text-sm font-semibold text-primary-700">{selected.name}</span>
        <span className="text-xs text-primary-400">{selected.email}</span>
        <button type="button" onClick={() => { onSelect(null); setQuery(''); }} className="ml-auto text-slate-400 hover:text-red-500 text-base leading-none">×</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input
        className="input text-sm"
        placeholder="회원명 또는 이메일로 검색..."
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {suggestions.map((u) => (
            <button
              key={u.id} type="button"
              onMouseDown={() => { onSelect(u); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary-50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold flex-shrink-0">
                {u.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800">{u.name}</p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 공급업체 입고 섹션 ── */
function InboundSection({ inbounds, onDelete, showForm, onEditPrice, onBrandClick }: {
  inbounds: InboundRec[]; onDelete: (id: string) => void; showForm?: boolean;
  onEditPrice?: (item: { id: string; name: string; size: string | null; color: string | null; price: number | null }) => void;
  onBrandClick?: (brand: string) => void;
}) {
  const [form, setForm] = useState({ brand: '', note: '', arrivedAt: new Date().toISOString().slice(0, 10) });
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const [rows, setRows] = useState<InboundFormRow[]>([{ ...EMPTY_ROW }]);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const addRow    = () => setRows((r) => [...r, { ...EMPTY_ROW }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<InboundFormRow>) =>
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));

  const handleSelectProduct = (i: number, p: ProductSuggestion) => {
    updateRow(i, {
      productId: p.id,
      name: p.name,
      brand: p.brand || '',
      image: p.images?.[0] || '',
      sizes: p.sizes ?? [],
      colors: p.colors ?? [],
      size: '', color: '',
    });
    if (!form.brand && p.brand) setForm((f) => ({ ...f, brand: p.brand! }));
  };

  const handleImageUpload = async (i: number, file: File) => {
    setUploading(i);
    const fd = new FormData(); fd.append('files', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const { urls } = await res.json();
    updateRow(i, { image: urls[0] });
    setUploading(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    await fetch('/api/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        userId: selectedUser?.id || null,
        items: rows.map((r) => ({
          productId: r.productId || null,
          name: r.name,
          quantity: r.quantity,
          size: r.size || null,
          color: r.color || null,
        })),
      }),
    });
    window.location.reload(); setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {showForm && (
        <div className="mb-2">
          <button onClick={() => setFormOpen(!formOpen)} className="btn-primary text-sm">
            {formOpen ? '취소' : '+ 공급업체 입고 등록'}
          </button>
          {formOpen && (
            <form onSubmit={handleSubmit} className="card p-5 mt-3 space-y-5">
              {/* 입고 기본 정보 */}
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs text-slate-500 mb-1">브랜드</label><input className="input text-sm" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} required /></div>
                <div><label className="block text-xs text-slate-500 mb-1">입고일</label><input type="date" className="input text-sm" value={form.arrivedAt} onChange={(e) => setForm((f) => ({ ...f, arrivedAt: e.target.value }))} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">비고</label><input className="input text-sm" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></div>
              </div>
              {/* 회원 선택 */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">담당 회원 <span className="text-slate-300">(선택)</span></label>
                <UserSearchInput selected={selectedUser} onSelect={setSelectedUser} />
              </div>

              {/* 입고 항목 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-600">입고 항목</span>
                  <button type="button" onClick={addRow} className="text-xs text-primary-600 hover:underline">+ 행 추가</button>
                </div>
                <div className="space-y-3">
                  {rows.map((row, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative">
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(i)} className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
                      )}

                      {/* 1행: 상품 검색 + 이미지 */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1">
                          <label className="block text-xs text-slate-500 mb-1">상품 검색 (이미 등록된 상품)</label>
                          <ProductSearchInput
                            value={row.name}
                            onSelect={(p) => handleSelectProduct(i, p)}
                          />
                        </div>
                        {/* 이미지 미리보기 + 업로드 */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-1">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                            {row.image
                              ? <Image src={row.image} alt="" width={56} height={56} className="object-cover w-full h-full" />
                              : <span className="text-slate-300 text-xs">사진</span>}
                          </div>
                          <input
                            type="file" accept="image/*" className="hidden"
                            ref={(el) => { fileRefs.current[i] = el; }}
                            onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(i, e.target.files[0]); }}
                          />
                          <button
                            type="button"
                            onClick={() => fileRefs.current[i]?.click()}
                            disabled={uploading === i}
                            className="text-xs text-primary-600 hover:underline whitespace-nowrap"
                          >
                            {uploading === i ? '업로드중' : '사진 추가'}
                          </button>
                        </div>
                      </div>

                      {/* 2행: 상품명 */}
                      <div className="mb-2">
                        <label className="block text-xs text-slate-500 mb-1">상품명</label>
                        <input className="input text-sm" placeholder="상품명" value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} required />
                      </div>

                      {/* 3행: 사이즈 + 컬러 + 수량 */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">사이즈</label>
                          {row.sizes.length > 0
                            ? <select className="input text-sm" value={row.size} onChange={(e) => updateRow(i, { size: e.target.value })}>
                                <option value="">선택</option>
                                {row.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            : <input className="input text-sm" placeholder="사이즈" value={row.size} onChange={(e) => updateRow(i, { size: e.target.value })} />}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">컬러</label>
                          {row.colors.length > 0
                            ? <select className="input text-sm" value={row.color} onChange={(e) => updateRow(i, { color: e.target.value })}>
                                <option value="">선택</option>
                                {row.colors.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            : <input className="input text-sm" placeholder="컬러" value={row.color} onChange={(e) => updateRow(i, { color: e.target.value })} />}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">수량</label>
                          <input type="number" className="input text-sm" min={1} value={row.quantity} onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })} />
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary text-sm">
                {submitting ? '등록 중...' : '입고 등록'}
              </button>
            </form>
          )}
        </div>
      )}

      {inbounds.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">공급업체 입고 기록이 없습니다.</div>}
      {inbounds.map((ib) => (
        <div key={ib.id} className="card overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBrandClick ? (
                <button onClick={() => onBrandClick(ib.brand)}
                  className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded hover:bg-primary-100 transition-colors">
                  {ib.brand}
                </button>
              ) : (
                <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">{ib.brand}</span>
              )}
              <span className="text-xs text-slate-500">{formatDate(ib.arrivedAt)}</span>
              {ib.note && <span className="text-xs text-slate-400">· {ib.note}</span>}
              {ib.user && (
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {ib.user.name}
                </span>
              )}
            </div>
            <button onClick={() => onDelete(ib.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="text-xs text-slate-400 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left">이미지</th>
                  <th className="px-4 py-2 text-left">상품명</th>
                  <th className="px-4 py-2 text-left">사이즈</th>
                  <th className="px-4 py-2 text-left">컬러</th>
                  <th className="px-4 py-2 text-center">수량</th>
                  <th className="px-4 py-2 text-center">세일율</th>
                  <th className="px-4 py-2 text-right">금액</th>
                  {onEditPrice && <th className="px-4 py-2 text-center">관리</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ib.items.map((it) => {
                  const p = it.product;
                  return (
                    <tr key={it.id} className="text-slate-700 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        {p?.images?.[0]
                          ? <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-slate-100"><Image src={p.images[0]} alt={it.name} fill className="object-cover" /></div>
                          : <div className="w-9 h-9 rounded-lg bg-slate-100" />}
                      </td>
                      <td className="px-4 py-2.5 font-medium max-w-[180px]">
                        <span className="block truncate">{it.name}</span>
                        {p?.productNumber && (
                          <span className="block text-xs text-slate-400 font-mono">
                            {colorCodeFor(p.productNumber, p.colorCodes, it.color) ?? p.productNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{it.size || '-'}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{it.color || '-'}</td>
                      <td className="px-4 py-2.5 text-center font-semibold">{it.quantity}</td>
                      <td className="px-4 py-2.5 text-center">
                        {it.isOnSale
                          ? <span className="text-xs font-bold text-red-500 whitespace-nowrap">{it.saleType === 'RATE' ? `${it.saleValue}%` : it.saleValue ? `${it.saleValue.toLocaleString()}원` : ''}</span>
                          : <span className="text-slate-300 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-primary-700 whitespace-nowrap">
                        {it.price !== null ? formatPrice(it.price) : <span className="text-slate-300 font-normal">-</span>}
                      </td>
                      {onEditPrice && (
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => onEditPrice(it)} className="text-xs text-primary-600 hover:underline whitespace-nowrap">수정</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 전체선택 토글 헬퍼 ── */
function makeToggleAll(ids: string[], selected: Set<string>, setSelected: React.Dispatch<React.SetStateAction<Set<string>>>) {
  return () => {
    const allSel = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      allSel ? ids.forEach((id) => n.delete(id)) : ids.forEach((id) => n.add(id));
      return n;
    });
  };
}

/* ── 브랜드 1개의 아코디언 행 (헤더 + 펼치면 나오는 주문 상세 테이블) — 브랜드별/쇼핑몰별 뷰 공용 ── */
function BrandAccordionRow({ brand, items, isOpen, onToggle }: { brand: string; items: FlatRow[]; isOpen: boolean; onToggle: () => void }) {
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const totalQty = items.reduce((s, r) => s + r.quantity, 0);

  // 같은 상품(productId)+사이즈+컬러인 주문건을 한 줄로 통합, 수량은 합산
  const productGroups = useMemo(() => {
    const map = new Map<string, FlatRow[]>();
    items.forEach((r) => {
      const key = `${r.product.id}::${r.size}::${r.color}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([key, groupItems]) => ({
      key,
      product: groupItems[0].product,
      size: groupItems[0].size,
      color: groupItems[0].color,
      quantity: groupItems.reduce((s, r) => s + r.quantity, 0),
      items: groupItems,
    }));
  }, [items]);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${isOpen ? 'bg-primary-50' : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${isOpen ? 'text-primary-700' : 'text-slate-800'}`}>{brand}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOpen ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            상품 {productGroups.length}종 · 총 {totalQty}장
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">상품명</th>
                <th className="px-4 py-2.5 text-left">컬러</th>
                <th className="px-4 py-2.5 text-left">사이즈</th>
                <th className="px-4 py-2.5 text-center">수량</th>
                <th className="px-4 py-2.5 text-left">주문 건수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {productGroups.map((g) => {
                const isGroupOpen = openGroupKey === g.key;
                const noteCount = g.items.filter((i) => i.note).length;
                return (
                  <Fragment key={g.key}>
                    <tr
                      onClick={() => setOpenGroupKey(isGroupOpen ? null : g.key)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px]">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{g.product.name}</span>
                          {noteCount > 0 && (
                            <span
                              title={`요청사항 있는 주문 ${noteCount}건`}
                              className="flex-shrink-0 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full"
                            >
                              {noteCount}
                            </span>
                          )}
                        </span>
                        {g.product.productNumber && (
                          <span className="block text-xs text-slate-400 font-mono">
                            {colorCodeFor(g.product.productNumber, g.product.colorCodes, g.color) ?? g.product.productNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{g.color || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{g.size || '-'}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-slate-800">{g.quantity}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          {g.items.length}건
                          <svg
                            className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </td>
                    </tr>
                    {isGroupOpen && g.items.map((r) => (
                      <tr key={r.rowKey} className="bg-slate-50/60 text-xs text-slate-500">
                        <td className="px-4 py-2 pl-8" colSpan={3}>
                          {r.userName}
                          <span className="ml-1.5 text-slate-400 font-mono">#{r.orderId.slice(-6).toUpperCase()}</span>
                          {r.note && (
                            <span className="ml-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] leading-tight">
                              {r.note}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-slate-600">{r.quantity}</td>
                        <td className="px-4 py-2" />
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
              <tr>
                <td colSpan={3} className="px-4 py-2">합계</td>
                <td className="px-4 py-2 text-center">{totalQty}</td>
                <td className="px-4 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── 쇼핑몰별 신규접수 뷰 — 쇼핑몰은 라벨(클릭 불필요), 그 아래 브랜드 목록이 바로 보이고 브랜드를 누르면 주문 상세가 펼쳐짐 ── */
function MallOrderView({ rows, brandMallMap }: { rows: FlatRow[]; brandMallMap: Record<string, string> }) {
  const [openBrand, setOpenBrand] = useState<string | null>(null);
  const UNASSIGNED = '미분류';

  const mallGroups = useMemo(() => {
    const byBrand = new Map<string, FlatRow[]>();
    rows.forEach((r) => {
      const list = byBrand.get(r.brand) ?? [];
      list.push(r);
      byBrand.set(r.brand, list);
    });

    const byMall = new Map<string, Array<[string, FlatRow[]]>>();
    Array.from(byBrand.entries()).forEach(([brand, items]) => {
      const mall = brandMallMap[brand] || UNASSIGNED;
      const list = byMall.get(mall) ?? [];
      list.push([brand, items]);
      byMall.set(mall, list);
    });

    const entries = Array.from(byMall.entries()).map(
      ([mall, brands]) => [mall, brands.sort((a, b) => a[0].localeCompare(b[0], 'ko'))] as [string, Array<[string, FlatRow[]]>]
    );
    entries.sort(([a], [b]) => {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      return a.localeCompare(b, 'ko');
    });
    return entries;
  }, [rows, brandMallMap]);

  if (rows.length === 0)
    return <div className="text-center py-12 text-slate-400">신규 접수 주문이 없습니다.</div>;

  return (
    <div className="space-y-5">
      {mallGroups.map(([mall, brands]) => {
        const mallQty = brands.reduce((s, [, items]) => s + items.reduce((s2, r) => s2 + r.quantity, 0), 0);
        return (
          <div key={mall}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-sm font-bold text-slate-700">🏬 {mall}</span>
              <span className="text-xs text-slate-400">브랜드 {brands.length}개 · 총 수량 {mallQty}</span>
            </div>
            <div className="space-y-2">
              {brands.map(([brand, items]) => (
                <BrandAccordionRow
                  key={brand} brand={brand} items={items}
                  isOpen={openBrand === brand}
                  onToggle={() => setOpenBrand(openBrand === brand ? null : brand)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── OCR 줄별 매칭 헬퍼 ───────────────────────────────────────────────────────

/** 괄호 안 내용, 공백, 특수문자 제거 후 소문자 */
function normStr(s: string): string {
  return s.replace(/\([^)]*\)/g, '').replace(/[\s\-_·]/g, '').toLowerCase();
}

/** 문자 바이그램 유사도 (0~1) */
function bigramSim(a: string, b: string): number {
  if (!a || !b) return a === b ? 1 : 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const bg = (s: string) => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const ba = bg(a); const bb = bg(b);
  const inter = Array.from(ba).filter((g) => bb.has(g)).length;
  return ba.size + bb.size === 0 ? 0 : (2 * inter) / (ba.size + bb.size);
}

/** 영수증 한 줄 파싱: "상품명 / 컬러 / 사이즈  N장" */
function parseInvoiceLine(line: string): { name: string; color: string; size: string; qty: number } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const qtyM = trimmed.match(/(\d+)\s*장\s*$/);
  if (!qtyM) return null;
  const qty = parseInt(qtyM[1], 10);
  if (!qty) return null;
  const rest = trimmed.slice(0, trimmed.lastIndexOf(qtyM[0])).trim();
  const parts = rest.split(/\s*\/\s*/);
  if (parts.length < 3) return null;
  return { name: parts[0].trim(), color: parts[1].trim(), size: parts[2].trim(), qty };
}

type ItemGroup = {
  key: string;
  productName: string; color: string; size: string;
  items: ConfirmedItem[];
  totalQty: number;
};

type MatchLine = {
  lineText: string;
  name: string; color: string; size: string; requestedQty: number;
  groupKey: string | null;
  availableQty: number;
  selectedQty: number;
  status: 'ok' | 'partial' | 'notfound';
};

function buildGroups(items: ConfirmedItem[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const it of items) {
    const key = `${it.productId}::${it.color}::${it.size}`;
    if (!map.has(key)) map.set(key, { key, productName: it.productName, color: it.color, size: it.size, items: [], totalQty: 0 });
    const g = map.get(key)!;
    g.items.push(it);
    g.totalQty += it.quantity;
  }
  return Array.from(map.values());
}

function matchLineToGroup(parsed: { name: string; color: string; size: string }, groups: ItemGroup[]): ItemGroup | null {
  const nn = normStr(parsed.name);
  const nc = normStr(parsed.color);
  const ns = normStr(parsed.size);
  let best: { g: ItemGroup; score: number } | null = null;
  for (const g of groups) {
    const colorOk = normStr(g.color).includes(nc) || nc.includes(normStr(g.color));
    const sizeOk  = normStr(g.size).includes(ns)  || ns.includes(normStr(g.size));
    if (!colorOk || !sizeOk) continue;
    const nameSim = bigramSim(nn, normStr(g.productName));
    if (nameSim >= 0.45 && (!best || nameSim > best.score)) best = { g, score: nameSim };
  }
  return best?.g ?? null;
}

// ── InvoiceReceipt 이력 타입 ─────────────────────────────────────────────────
type InvoiceReceiptHistory = {
  id: string; brand: string; totalQty: number; checkedQty: number;
  receiptNumber: string | null; imageUrl: string | null; rawText: string | null;
  createdAt: string;
  items: Array<{
    id: string; orderItemId: string; confirmedAt: string | null;
    orderItem?: {
      id: string; size: string | null; color: string | null; quantity: number;
      product?: { id: string; name: string; brand: string | null; images: string[]; colorImages: { color: string; imageUrl: string }[] } | null;
      order?: { createdAt: string; user: { name: string } } | null;
    } | null;
  }>;
};

// ── 인쇄 정렬 방식 선택 ────────────────────────────────────────────────────────
function SortPickerDialog({ onConfirm, onCancel }: {
  onConfirm: (sortBy: 'product' | 'member') => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 mx-4 max-w-xs w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-slate-800 mb-4">정렬 방식을 선택하세요</p>
        <div className="flex gap-3">
          {([['product', '상품별', '상품·컬러·사이즈 기준'], ['member', '회원별', '아이디 기준']] as const).map(([v, label, desc]) => (
            <button key={v} onClick={() => onConfirm(v)}
              className="flex-1 py-4 border-2 border-slate-200 rounded-xl text-sm font-medium hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-center">
              <div className="font-semibold">{label}</div>
              <div className="text-xs text-slate-400 mt-1">{desc}</div>
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-4 w-full text-sm text-slate-400 hover:text-slate-600 py-2">취소</button>
      </div>
    </div>
  );
}

// ── 이미지 lightbox (영수증 대조 모달 내부용) ────────────────────────────────
type LightboxItem = {
  productId: string; productName: string; color: string; size: string;
  productNumber: string | null;
  images: string[]; colorImages: { color: string; imageUrl: string }[];
  initialIndex: number;
};

function InvoiceLightbox({ item, onClose }: { item: LightboxItem; onClose: () => void }) {
  // 현재 색상 이미지를 앞에, 나머지 이미지를 뒤에 배치
  const allImages = useMemo(() => {
    const colorImg = item.colorImages.find((ci) => ci.color === item.color)?.imageUrl;
    const rest     = item.images.filter((img) => img !== colorImg);
    return colorImg ? [colorImg, ...rest] : item.images.length > 0 ? item.images : ['/no-image.svg'];
  }, [item]);

  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => (i - 1 + allImages.length) % allImages.length);
  const next = () => setIdx((i) => (i + 1) % allImages.length);

  // 키보드 + 터치 스와이프
  const touchStartX = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    // stopPropagation: 라이트박스 backdrop 클릭이 invoice modal backdrop(z-50)으로 버블링되지 않도록
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
        touchStartX.current = null;
      }}>
      <div className="relative w-full max-w-lg mx-4 flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}>

        {/* 닫기 버튼 — 내용 박스 안 상단 우측 */}
        <button onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white text-3xl leading-none z-10 w-10 h-10 flex items-center justify-center">×</button>

        {/* 메인 이미지 */}
        <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={allImages[idx]} alt={item.productName} loading="lazy"
            className="w-full h-full object-contain" />
          {allImages.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 text-lg">‹</button>
              <button onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 text-lg">›</button>
            </>
          )}
          {allImages.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {allImages.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>

        {/* 상품 정보 */}
        <div className="bg-white/10 backdrop-blur-sm text-white rounded-xl px-4 py-3 w-full text-sm">
          <p className="font-semibold">{item.productName}</p>
          <p className="text-white/70 text-xs mt-0.5">{item.color} / {item.size}{item.productNumber ? ` · ${item.productNumber}` : ''}</p>
        </div>

        {/* 상품 페이지 */}
        <a href={`/home/products/${item.productId}`} target="_blank" rel="noopener noreferrer"
          className="w-full text-center py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-colors"
          onClick={(e) => e.stopPropagation()}>
          상품 페이지 열기 ↗
        </a>
      </div>
    </div>
  );
}

// ── 영수증 대조 모달 ──────────────────────────────────────────────────────────
function InvoiceModal({
  brand, batchFilter, onClose, onArrived,
}: {
  brand: string;
  batchFilter: string;
  batches: Array<OrderBatch & { label: string }>;
  onClose: () => void;
  onArrived: (itemIds: string[]) => Promise<void>;
}) {
  const [modalTab, setModalTab]   = useState<'대조' | '이력'>('대조');
  const [items, setItems]         = useState<ConfirmedItem[]>([]);
  const [history, setHistory]     = useState<InvoiceReceiptHistory[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [totalQtyInput, setTotalQtyInput] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [ocrText, setOcrText]             = useState('');
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [matchResults, setMatchResults]   = useState<MatchLine[] | null>(null);
  const [openGroups, setOpenGroups]       = useState<Set<string>>(new Set());
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState('');
  const [lightbox, setLightbox]           = useState<LightboxItem | null>(null);
  const [confirmClose, setConfirmClose]   = useState(false);
  const [printPending, setPrintPending]   = useState<'selected' | string | null>(null); // 'selected'=현재선택, receiptId=이력

  const isDirty = totalQtyInput !== '' || ocrText !== '' || selectedIds.size > 0 || receiptNumber !== '';

  // 현재 선택된 항목 → PrintableItem 변환
  const selectedPrintItems = useMemo((): PrintableItem[] =>
    items.filter((it) => selectedIds.has(it.itemId)).map((it) => ({
      itemId: it.itemId, productId: it.productId, brand: it.brand,
      productName: it.productName, color: it.color, size: it.size,
      quantity: it.quantity, images: it.images, colorImages: it.colorImages,
      userName: it.userName, orderDate: it.orderDate,
    })), [items, selectedIds]);

  // 이력 영수증 항목 → PrintableItem 변환
  const historyReceiptPrintItems = useCallback((r: InvoiceReceiptHistory): PrintableItem[] =>
    r.items.flatMap((hi) => {
      if (!hi.orderItem?.product) return [];
      return [{
        itemId: hi.orderItemId,
        productId: hi.orderItem.product.id,
        brand: hi.orderItem.product.brand ?? r.brand,
        productName: hi.orderItem.product.name,
        color: hi.orderItem.color ?? '',
        size: hi.orderItem.size ?? '',
        quantity: hi.orderItem.quantity,
        images: hi.orderItem.product.images,
        colorImages: hi.orderItem.product.colorImages,
        userName: hi.orderItem.order?.user.name ?? '',
        orderDate: hi.orderItem.order?.createdAt ?? '',
      }];
    }), []);

  const handlePrintConfirm = useCallback((sortBy: 'product' | 'member') => {
    if (!printPending) { setPrintPending(null); return; }
    if (printPending === 'selected') {
      printInvoiceItems({ title: `${brand} 입고 대조`, receiptNumber: receiptNumber || null, sortBy, items: selectedPrintItems });
    } else {
      const r = history.find((h) => h.id === printPending);
      if (r) printInvoiceItems({ title: `${brand} 영수증 대조 이력`, receiptNumber: r.receiptNumber, sortBy, items: historyReceiptPrintItems(r) });
    }
    setPrintPending(null);
  }, [printPending, brand, receiptNumber, selectedPrintItems, history, historyReceiptPrintItems]);

  const handleClose = useCallback(() => {
    if (isDirty) setConfirmClose(true);
    else onClose();
  }, [isDirty, onClose]);

  // Esc: 라이트박스 열려있으면 무시 (라이트박스가 직접 처리), 닫혀있으면 모달 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || lightbox) return;
      handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, handleClose]);

  useEffect(() => {
    setDataLoading(true);
    const params = new URLSearchParams({ mode: 'detail', brand, batch: batchFilter });
    Promise.all([
      fetch(`/api/admin/confirmed-items?${params}`).then((r) => r.json()),
      fetch(`/api/admin/invoice-receipts?brand=${encodeURIComponent(brand)}`).then((r) => r.json()),
    ]).then(([its, hist]) => {
      const sorted: ConfirmedItem[] = Array.isArray(its)
        ? [...its].sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''))
        : [];
      setItems(sorted);
      setHistory(Array.isArray(hist) ? hist : []);
      setDataLoading(false);
    });
  }, [brand, batchFilter]);

  const groups = useMemo(() => buildGroups(items), [items]);

  const totalQty    = parseInt(totalQtyInput, 10);
  const qtyValid    = !isNaN(totalQty) && totalQty > 0;
  const checkedQty  = items.filter((it) => selectedIds.has(it.itemId)).reduce((s, it) => s + it.quantity, 0);
  const qtyMismatch = qtyValid && checkedQty !== totalQty;

  const toggleItem = (itemId: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });

  const toggleGroup = (g: ItemGroup) => {
    const allSel = g.items.every((it) => selectedIds.has(it.itemId));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      g.items.forEach((it) => allSel ? n.delete(it.itemId) : n.add(it.itemId));
      return n;
    });
  };

  // 줄별 매칭: 각 줄을 파싱 → 그룹 찾기 → 오래된 순으로 qty만큼 선택
  const handleAutoMatch = () => {
    const lines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean);
    const newSelected = new Set<string>();
    const results: MatchLine[] = [];

    for (const line of lines) {
      const parsed = parseInvoiceLine(line);
      if (!parsed) continue; // 수량 없는 줄은 건너뜀

      const grp = matchLineToGroup(parsed, groups);
      if (!grp) {
        results.push({ lineText: line, name: parsed.name, color: parsed.color, size: parsed.size,
          requestedQty: parsed.qty, groupKey: null, availableQty: 0, selectedQty: 0, status: 'notfound' });
        continue;
      }

      // 이미 다른 줄에서 선택된 것 제외한 잔여 items
      const remaining = grp.items.filter((it) => !newSelected.has(it.itemId));
      const availableQty = remaining.reduce((s, it) => s + it.quantity, 0);

      let toSelect = parsed.qty;
      let selectedQty = 0;
      for (const it of remaining) {
        if (toSelect <= 0) break;
        newSelected.add(it.itemId);
        selectedQty += it.quantity;
        toSelect -= it.quantity;
      }

      results.push({
        lineText: line, name: parsed.name, color: parsed.color, size: parsed.size,
        requestedQty: parsed.qty, groupKey: grp.key, availableQty,
        selectedQty,
        status: selectedQty >= parsed.qty ? 'ok' : (selectedQty > 0 ? 'partial' : 'notfound'),
      });
    }

    setSelectedIds(newSelected);
    setMatchResults(results);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!qtyValid) { setSaveError('총 수량을 입력해주세요.'); return; }
    if (selectedIds.size === 0) { setSaveError('입고 처리할 항목을 선택해주세요.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/invoice-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand, totalQty, checkedQty,
          receiptNumber: receiptNumber.trim() || null,
          imageUrl: null,
          rawText: ocrText.trim() || null,
          arrivedItemIds: Array.from(selectedIds),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setSaveError(d.error || '저장에 실패했습니다.'); return; }
      await onArrived(Array.from(selectedIds));
    } finally { setSaving(false); }
  };

  const fmtDt = (s: string) => {
    const d = new Date(s);
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const openLightbox = (it: ConfirmedItem) => {
    setLightbox({
      productId: it.productId, productName: it.productName,
      color: it.color, size: it.size, productNumber: it.productNumber,
      images: it.images, colorImages: it.colorImages, initialIndex: 0,
    });
  };

  const thumbSrc = (it: ConfirmedItem) =>
    resolveColorImage(it.color, it.colorImages, it.images, '/no-image.svg');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={handleClose}>
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl sm:mx-4 shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">{brand} 영수증 대조</h2>
            <p className="text-xs text-slate-400 mt-0.5">확인 대기 {groups.length}종 · {items.reduce((s, it) => s + it.quantity, 0)}장</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 px-5 pt-3 flex-shrink-0 border-b border-slate-100">
          {(['대조', '이력'] as const).map((t) => (
            <button key={t} onClick={() => setModalTab(t)}
              className={`px-4 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                modalTab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {t}{t === '이력' && history.length > 0 && <span className="ml-1 text-xs text-slate-400">({history.length})</span>}
            </button>
          ))}
        </div>

        {/* 바디 */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {dataLoading ? (
            <div className="text-center py-16 text-slate-400 text-sm">로딩 중...</div>
          ) : modalTab === '대조' ? (
            <div className="p-5 space-y-4">

              {/* 폼 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">총 수량 <span className="text-red-500">*</span></label>
                  <input type="number" min="1" placeholder="영수증 총 장수"
                    value={totalQtyInput} onChange={(e) => setTotalQtyInput(e.target.value)}
                    className="input w-full text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">영수증 번호 <span className="text-slate-400">(선택)</span></label>
                  <input type="text" placeholder="중복 방지용"
                    value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)}
                    className="input w-full text-sm" />
                </div>
              </div>

              {/* OCR */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  영수증 텍스트 붙여넣기 <span className="text-slate-400">(선택 — 줄별 "상품명 / 컬러 / 사이즈  N장")</span>
                </label>
                <textarea rows={4}
                  placeholder={'5호-아이린 / 혼합 / 5호  5장\n1호-챨스(10EA) / Image_color / 1호(1~2세)호  3장'}
                  value={ocrText} onChange={(e) => { setOcrText(e.target.value); setMatchResults(null); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
                <button onClick={handleAutoMatch} disabled={!ocrText.trim()}
                  className="mt-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white font-medium disabled:opacity-40 hover:bg-primary-700 transition-colors">
                  자동 매칭
                </button>
              </div>

              {/* 매칭 결과표 */}
              {matchResults && matchResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 uppercase">매칭 결과</div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/60 text-slate-400">
                      <tr>
                        <th className="px-3 py-1.5 text-left">영수증 항목</th>
                        <th className="px-3 py-1.5 text-center">요청</th>
                        <th className="px-3 py-1.5 text-center">대기</th>
                        <th className="px-3 py-1.5 text-center">선택</th>
                        <th className="px-3 py-1.5 text-left">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {matchResults.map((r, i) => {
                        // 매칭된 그룹의 첫 번째 아이템으로 썸네일 찾기
                        const matchedGrp = r.groupKey ? groups.find((g) => g.key === r.groupKey) : null;
                        const matchedIt  = matchedGrp?.items[0];
                        const thumb      = matchedIt ? thumbSrc(matchedIt) : null;
                        return (
                        <tr key={i} className={r.status === 'notfound' ? 'bg-red-50/50' : r.status === 'partial' ? 'bg-orange-50/50' : ''}>
                          <td className="px-3 py-1.5 max-w-[200px]">
                            <div className="flex items-center gap-2">
                              {thumb && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" loading="lazy"
                                  onClick={() => matchedIt && openLightbox(matchedIt)}
                                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border border-slate-100" />
                              )}
                              <div className="min-w-0">
                                <button onClick={() => matchedIt && openLightbox(matchedIt)}
                                  className="block text-left truncate font-medium text-slate-700 hover:text-primary-600 transition-colors max-w-[120px]"
                                  disabled={!matchedIt}>{r.name}</button>
                                <span className="text-slate-400 text-[10px]">{r.color} / {r.size}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-center text-slate-600">{r.requestedQty}장</td>
                          <td className="px-3 py-1.5 text-center text-slate-500">{r.availableQty}장</td>
                          <td className="px-3 py-1.5 text-center font-semibold text-slate-800">{r.selectedQty}장</td>
                          <td className="px-3 py-1.5">
                            {r.status === 'ok'       && <span className="text-emerald-600">✓ 매칭</span>}
                            {r.status === 'partial'  && <span className="text-orange-500">⚠ 영수증 {r.requestedQty}장 / 대기 {r.availableQty}장</span>}
                            {r.status === 'notfound' && <span className="text-red-500">찾지 못함 — 직접 선택</span>}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 선택 수량 표시 + 인쇄 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 text-sm">
                <span className="text-slate-500">선택:</span>
                <span className={`font-bold ${qtyMismatch ? 'text-orange-600' : 'text-emerald-600'}`}>{checkedQty}장</span>
                {qtyValid && <span className="text-slate-400">/ 영수증 {totalQty}장</span>}
                {qtyMismatch && <span className="text-xs text-orange-500">수량이 다릅니다 ({checkedQty - totalQty > 0 ? '+' : ''}{checkedQty - totalQty}장)</span>}
                {selectedIds.size > 0 && (
                  <button onClick={() => setPrintPending('selected')}
                    className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 transition-colors">
                    인쇄
                  </button>
                )}
              </div>

              {/* 그룹별 항목 목록 */}
              {groups.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">확인 대기 중인 상품이 없습니다.</p>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
                  {groups.map((g) => {
                    const selInGroup  = g.items.filter((it) => selectedIds.has(it.itemId));
                    const selQty      = selInGroup.reduce((s, it) => s + it.quantity, 0);
                    const allSel      = g.items.every((it) => selectedIds.has(it.itemId));
                    const someSel     = selInGroup.length > 0 && !allSel;
                    const isGrpOpen   = openGroups.has(g.key);
                    const grpThumb    = thumbSrc(g.items[0]);
                    return (
                      <Fragment key={g.key}>
                        <div className={`flex items-center gap-2 px-3 py-2 ${selQty > 0 ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={allSel}
                            ref={(el) => { if (el) el.indeterminate = someSel; }}
                            onChange={() => toggleGroup(g)}
                            className="w-3.5 h-3.5 accent-emerald-600 flex-shrink-0" />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={grpThumb} alt="" loading="lazy"
                            onClick={() => openLightbox(g.items[0])}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border border-slate-100" />
                          <div className="flex-1 min-w-0">
                            <button onClick={() => openLightbox(g.items[0])}
                              className="text-xs font-semibold text-slate-800 truncate block text-left hover:text-primary-600 transition-colors max-w-full">
                              {g.productName}
                            </button>
                            <span className="text-xs text-slate-400">{g.color} / {g.size}</span>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">대기 {g.totalQty}장</span>
                          {selQty > 0 && <span className="text-xs font-bold text-emerald-600 flex-shrink-0">선택 {selQty}장</span>}
                          <button onClick={() => setOpenGroups((p) => { const n = new Set(p); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; })}
                            className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-1">
                            <svg className={`w-3.5 h-3.5 transition-transform ${isGrpOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        {isGrpOpen && g.items.map((it) => {
                          const checked = selectedIds.has(it.itemId);
                          const days    = waitDays(it.confirmedAt);
                          return (
                            <div key={it.itemId} onClick={() => toggleItem(it.itemId)}
                              className={`flex items-center gap-2 px-3 py-1.5 pl-8 text-xs cursor-pointer border-t border-slate-50 ${checked ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleItem(it.itemId)}
                                onClick={(e) => e.stopPropagation()} className="w-3 h-3 accent-emerald-600 flex-shrink-0" />
                              <span className="flex-1 text-slate-600">
                                {it.userName}
                                <span className="ml-1.5 text-slate-400 font-mono">#{it.orderId.slice(-6).toUpperCase()}</span>
                              </span>
                              <span className="text-slate-400">{it.confirmedAt ? fmtDt(it.confirmedAt) : '-'}</span>
                              {days > 7 && <span className="text-orange-500 font-medium">D+{days}</span>}
                              <span className="font-semibold text-slate-700">{it.quantity}장</span>
                            </div>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </div>
              )}

              {saveError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>}
            </div>
          ) : (
            /* ── 이력 탭 ── */
            <div className="p-5">
              {history.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">영수증 이력이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((r) => (
                    <div key={r.id} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <span className="text-sm font-semibold text-slate-800">{fmtDt(r.createdAt)}</span>
                          {r.receiptNumber && <span className="ml-2 text-xs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{r.receiptNumber}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right text-xs text-slate-500">
                            영수증 {r.totalQty}장 / 처리 {r.checkedQty}장
                            {r.totalQty !== r.checkedQty && <span className="ml-1 text-orange-500">({r.totalQty - r.checkedQty}장 미처리)</span>}
                          </div>
                          <button onClick={() => setPrintPending(r.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors flex-shrink-0">
                            인쇄
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">{r.items.length}건 입고 처리됨</p>
                      {r.rawText && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">OCR 텍스트 보기</summary>
                          <pre className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded whitespace-pre-wrap break-all max-h-24 overflow-y-auto">{r.rawText}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        {modalTab === '대조' && !dataLoading && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">취소</button>
            <button onClick={handleSave} disabled={saving || selectedIds.size === 0 || !qtyValid}
              className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg disabled:opacity-40 hover:bg-emerald-700 transition-colors">
              {saving ? '처리 중...' : `입고 처리 (${checkedQty}장)`}
            </button>
          </div>
        )}
      </div>

      {/* 인쇄 정렬 선택 */}
      {printPending && <SortPickerDialog onConfirm={handlePrintConfirm} onCancel={() => setPrintPending(null)} />}

      {/* 닫기 확인 다이얼로그 — 입력 데이터가 있을 때만 표시 */}
      {confirmClose && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/40 rounded-2xl"
          onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-xl p-6 mx-4 max-w-xs w-full shadow-2xl">
            <p className="text-sm font-semibold text-slate-800 mb-1">작성 중인 내용이 있습니다</p>
            <p className="text-sm text-slate-500 mb-5">입력한 내용이 사라집니다. 닫으시겠습니까?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmClose(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">계속 작성</button>
              <button onClick={onClose}
                className="px-4 py-2 text-sm font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 라이트박스 — 모달 위에 z-[60]으로 띄움, 모달 상태 유지 */}
      {lightbox && <InvoiceLightbox item={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

const TABS = ['주문접수', '주문확인', '일별입고', '전체입고', '품절/미송'] as const;
type Tab = typeof TABS[number];
const QUEUE_PAGE_SIZE = 50;

// ── 발주 차수 헬퍼 ─────────────────────────────────────────────────────────────
function batchLabel(batch: OrderBatch, idx: number, sameDayIdx: number): string {
  const dt  = new Date(batch.createdAt);
  const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  const mm  = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd  = String(kst.getUTCDate()).padStart(2, '0');
  const hh  = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${sameDayIdx + 1}차 (${hh}:${min}) · ${batch.itemCount}건`;
}

function annotateBatches(batches: OrderBatch[]): Array<OrderBatch & { label: string }> {
  // newest-first from API → number same-day batches ascending
  const sorted = [...batches].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dayCounters: Record<string, number> = {};
  const withLabel = sorted.map((b) => {
    const kst  = new Date(new Date(b.createdAt).getTime() + 9 * 60 * 60 * 1000);
    const day  = kst.toISOString().slice(0, 10);
    const sidx = dayCounters[day] ?? 0;
    dayCounters[day] = sidx + 1;
    return { ...b, label: batchLabel(b, sidx, sidx) };
  });
  return withLabel.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // newest-first for dropdown
}

function waitDays(confirmedAt: string | null): number {
  if (!confirmedAt) return 0;
  return Math.floor((Date.now() - new Date(confirmedAt).getTime()) / 86400000);
}

// ── PendingMallView — 주문접수 탭 쇼핑몰별 모드 (서버 데이터 기반) ──────────────
function PendingMallView({ onRefresh }: { onRefresh: () => void }) {
  const [summary, setSummary]           = useState<ConfirmedSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [openBrand, setOpenBrand]       = useState<string | null>(null);
  const [brandItems, setBrandItems]     = useState<Record<string, FlatRow[]>>({});
  const [brandLoading, setBrandLoading] = useState<Record<string, boolean>>({});

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const d = await fetch('/api/admin/pending-items?mode=summary').then((r) => r.json());
      setSummary(Array.isArray(d) ? d : []);
    } finally { setSummaryLoading(false); }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleBrandToggle = useCallback(async (brand: string) => {
    if (openBrand === brand) { setOpenBrand(null); return; }
    setOpenBrand(brand);
    if (!brandItems[brand]) {
      setBrandLoading((p) => ({ ...p, [brand]: true }));
      try {
        const d = await fetch(`/api/admin/pending-items?mode=detail&brand=${encodeURIComponent(brand)}`).then((r) => r.json());
        setBrandItems((p) => ({ ...p, [brand]: Array.isArray(d) ? d : [] }));
      } finally { setBrandLoading((p) => ({ ...p, [brand]: false })); }
    }
  }, [openBrand, brandItems]);

  const UNASSIGNED = '미분류';
  const mallGroups = useMemo(() => {
    const byMall = new Map<string, ConfirmedSummaryRow[]>();
    summary.forEach((row) => {
      const mall = row.mall || UNASSIGNED;
      const list = byMall.get(mall) ?? [];
      list.push(row);
      byMall.set(mall, list);
    });
    const entries = Array.from(byMall.entries()).sort(([a], [b]) => {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      return a.localeCompare(b, 'ko');
    });
    return entries;
  }, [summary]);

  if (summaryLoading)
    return <div className="text-center py-12 text-slate-400 text-sm">로딩 중...</div>;
  if (summary.length === 0)
    return <div className="text-center py-12 text-slate-400 text-sm">신규 접수 주문이 없습니다.</div>;

  return (
    <div className="space-y-5">
      {mallGroups.map(([mall, brands]) => {
        const mallQty = brands.reduce((s, b) => s + b.totalQty, 0);
        return (
          <div key={mall}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-sm font-bold text-slate-700">🏬 {mall}</span>
              <span className="text-xs text-slate-400">브랜드 {brands.length}개 · 총 수량 {mallQty}</span>
            </div>
            <div className="space-y-2">
              {brands.map((row) => (
                <div key={row.brand} className="card overflow-hidden">
                  <button
                    onClick={() => handleBrandToggle(row.brand)}
                    className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${openBrand === row.brand ? 'bg-primary-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${openBrand === row.brand ? 'text-primary-700' : 'text-slate-800'}`}>{row.brand}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${openBrand === row.brand ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        상품 {row.distinctCount}종 · 총 {row.totalQty}장
                      </span>
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openBrand === row.brand ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openBrand === row.brand && (
                    brandLoading[row.brand] ? (
                      <div className="text-center py-8 text-slate-400 text-sm border-t border-slate-100">로딩 중...</div>
                    ) : (brandItems[row.brand] ?? []).length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm border-t border-slate-100">상품이 없습니다.</div>
                    ) : (
                      <div className="border-t border-slate-100">
                        <BrandAccordionRow
                          brand={row.brand}
                          items={brandItems[row.brand] ?? []}
                          isOpen={true}
                          onToggle={() => {}}
                        />
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ConfirmedMallView — 주문확인 탭 쇼핑몰별 모드 (서버 데이터 기반) ─────────────
function ConfirmedMallView({
  batches,
  batchFilter,
  onBatchFilterChange,
  onRefresh,
  markAsArrived,  // (itemIds: string[]) => Promise<void>
}: {
  batches: Array<OrderBatch & { label: string }>;
  batchFilter: string;
  onBatchFilterChange: (v: string) => void;
  onRefresh: () => void;
  markAsArrived: (itemIds: string[]) => Promise<void>;
}) {
  const [summary, setSummary]           = useState<ConfirmedSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [openBrand, setOpenBrand]       = useState<string | null>(null);
  const [brandItems, setBrandItems]     = useState<Record<string, ConfirmedItem[]>>({});
  const [brandLoading, setBrandLoading] = useState<Record<string, boolean>>({});

  const fetchSummary = useCallback(async (batch: string) => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'summary', batch });
      const d = await fetch(`/api/admin/confirmed-items?${params}`).then((r) => r.json());
      setSummary(Array.isArray(d) ? d : []);
    } finally { setSummaryLoading(false); }
  }, []);

  useEffect(() => { fetchSummary(batchFilter); }, [batchFilter, fetchSummary]);

  const handleBrandToggle = useCallback(async (brand: string) => {
    if (openBrand === brand) { setOpenBrand(null); return; }
    setOpenBrand(brand);
    if (!brandItems[brand]) {
      setBrandLoading((p) => ({ ...p, [brand]: true }));
      try {
        const params = new URLSearchParams({ mode: 'detail', brand, batch: batchFilter });
        const d = await fetch(`/api/admin/confirmed-items?${params}`).then((r) => r.json());
        setBrandItems((p) => ({ ...p, [brand]: Array.isArray(d) ? d : [] }));
      } finally { setBrandLoading((p) => ({ ...p, [brand]: false })); }
    }
  }, [openBrand, brandItems, batchFilter]);

  // 브랜드 필터 바뀌면 열린 브랜드 데이터 초기화
  useEffect(() => { setBrandItems({}); setOpenBrand(null); }, [batchFilter]);

  // mall → brands grouping
  const UNASSIGNED = '미분류';
  const mallGroups = useMemo(() => {
    const byMall = new Map<string, ConfirmedSummaryRow[]>();
    summary.forEach((row) => {
      const mall = row.mall || UNASSIGNED;
      const list = byMall.get(mall) ?? [];
      list.push(row);
      byMall.set(mall, list);
    });
    const entries = Array.from(byMall.entries()).sort(([a], [b]) => {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      return a.localeCompare(b, 'ko');
    });
    return entries;
  }, [summary]);

  if (summaryLoading)
    return <div className="text-center py-12 text-slate-400 text-sm">로딩 중...</div>;
  if (summary.length === 0)
    return <div className="text-center py-12 text-slate-400 text-sm">확인 대기 중인 상품이 없습니다.</div>;

  return (
    <div className="space-y-5">
      {mallGroups.map(([mall, brands]) => {
        const mallQty = brands.reduce((s, b) => s + b.totalQty, 0);
        return (
          <div key={mall}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-sm font-bold text-slate-700">🏬 {mall}</span>
              <span className="text-xs text-slate-400">브랜드 {brands.length}개 · 총 수량 {mallQty}</span>
            </div>
            <div className="space-y-2">
              {brands.map((row) => (
                <ConfirmedBrandAccordion
                  key={row.brand}
                  summary={row}
                  isOpen={openBrand === row.brand}
                  items={brandItems[row.brand] ?? []}
                  loading={brandLoading[row.brand] ?? false}
                  batchFilter={batchFilter}
                  batches={batches}
                  onToggle={() => handleBrandToggle(row.brand)}
                  onArrived={async (itemIds) => {
                    await markAsArrived(itemIds);
                    // 캐시 무효화 + 요약 재로드
                    setBrandItems((p) => { const n = { ...p }; delete n[row.brand]; return n; });
                    fetchSummary(batchFilter);
                    onRefresh();
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ConfirmedBrandAccordion — 브랜드 1개 (주문확인 쇼핑몰별 모드용) ──────────────
function ConfirmedBrandAccordion({
  summary, isOpen, items, loading, batchFilter, batches, onToggle, onArrived,
}: {
  summary: ConfirmedSummaryRow;
  isOpen: boolean;
  items: ConfirmedItem[];
  loading: boolean;
  batchFilter: string;
  batches: Array<OrderBatch & { label: string }>;
  onToggle: () => void;
  onArrived: (itemIds: string[]) => Promise<void>;
}) {
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [copyDone, setCopyDone]         = useState(false);
  const [invoiceOpen, setInvoiceOpen]   = useState(false);

  // 같은 상품+컬러+사이즈 묶기
  const productGroups = useMemo(() => {
    const map = new Map<string, ConfirmedItem[]>();
    items.forEach((it) => {
      const key = `${it.productId}::${it.color}::${it.size}`;
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([key, grpItems]) => ({
      key,
      productId:     grpItems[0].productId,
      productName:   grpItems[0].productName,
      productNumber: grpItems[0].productNumber,
      colorCodes:    grpItems[0].colorCodes,
      images:        grpItems[0].images,
      size:          grpItems[0].size,
      color:         grpItems[0].color,
      quantity:      grpItems.reduce((s, it) => s + it.quantity, 0),
      items:         grpItems,
    }));
  }, [items]);

  const noteCount = items.filter((it) => it.note).length;

  const handleCopy = useCallback(async () => {
    // 서버에서 필터된 전체 데이터 재요청
    const params = new URLSearchParams({ mode: 'detail', brand: summary.brand, batch: batchFilter });
    const allItems: ConfirmedItem[] = await fetch(`/api/admin/confirmed-items?${params}`).then((r) => r.json());

    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const batchSuffix = batchFilter !== 'all'
      ? ` ${batches.find((b) => b.id === batchFilter)?.label.split(' ')[1] ?? ''}` : '';

    // 같은 상품+컬러+사이즈 합산
    const grouped = new Map<string, { name: string; color: string; size: string; qty: number }>();
    allItems.forEach((it) => {
      const key = `${it.productName}::${it.color}::${it.size}`;
      const cur = grouped.get(key) ?? { name: it.productName, color: it.color, size: it.size, qty: 0 };
      cur.qty += it.quantity;
      grouped.set(key, cur);
    });

    const lines = Array.from(grouped.values()).map((g) => `${g.name} / ${g.color} / ${g.size}  ${g.qty}장`);
    const totalQty = allItems.reduce((s, it) => s + it.quantity, 0);
    const msg = `[꿈비샵] ${mm}/${dd}${batchSuffix} 주문\n${lines.join('\n')}\n총 ${totalQty}장`;

    await navigator.clipboard.writeText(msg);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [summary.brand, batchFilter, batches]);

  return (
    <div className="card overflow-hidden">
      {/* 헤더 */}
      <div className={`flex items-center justify-between px-5 py-3.5 ${isOpen ? 'bg-primary-50 border-b border-primary-100' : 'hover:bg-slate-50'}`}>
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left">
          <span className={`text-sm font-bold ${isOpen ? 'text-primary-700' : 'text-slate-800'}`}>{summary.brand}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOpen ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            상품 {summary.distinctCount}종 · 총 {summary.totalQty}장
          </span>
          {noteCount > 0 && (
            <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
              {noteCount}
            </span>
          )}
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <button
            onClick={handleCopy}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${copyDone ? 'bg-green-500 text-white' : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'}`}
          >
            {copyDone ? '✓ 복사됨' : '카톡 메시지 복사'}
          </button>
          <button
            onClick={() => setInvoiceOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-700 text-white hover:bg-slate-800 transition-colors"
          >
            영수증 대조
          </button>
        </div>
      </div>

      {/* 상품 목록 */}
      {isOpen && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">로딩 중...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">상품이 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">상품명</th>
                  <th className="px-4 py-2.5 text-left">컬러</th>
                  <th className="px-4 py-2.5 text-left">사이즈</th>
                  <th className="px-4 py-2.5 text-center">수량</th>
                  <th className="px-4 py-2.5 text-left">주문 건수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {productGroups.map((g) => {
                  const isGrpOpen = openGroupKey === g.key;
                  return (
                    <Fragment key={g.key}>
                      <tr
                        onClick={() => setOpenGroupKey(isGrpOpen ? null : g.key)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px]">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate">{g.productName}</span>
                          </span>
                          {g.productNumber && (
                            <span className="block text-xs text-slate-400 font-mono">
                              {colorCodeFor(g.productNumber, g.colorCodes, g.color) ?? g.productNumber}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{g.color || '-'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{g.size || '-'}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-slate-800">{g.quantity}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            {g.items.length}건
                            <svg className={`w-3 h-3 text-slate-400 transition-transform ${isGrpOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </td>
                      </tr>
                      {isGrpOpen && g.items.map((it) => {
                        const days = waitDays(it.confirmedAt);
                        const batchLabel = it.confirmedAt
                          ? (batches.find((b) => b.id === it.orderBatchId)?.label ?? '이전')
                          : '이전';
                        return (
                          <tr key={it.itemId} className={`text-xs ${days > 7 ? 'bg-orange-50/60 text-orange-800' : 'bg-slate-50/60 text-slate-500'}`}>
                            <td className="px-4 py-2 pl-8" colSpan={3}>
                              {it.userName}
                              <span className="ml-1.5 text-slate-400 font-mono">#{it.orderId.slice(-6).toUpperCase()}</span>
                              <span className="ml-2 text-[10px] text-slate-400">{batchLabel}</span>
                              {it.note && (
                                <span className="ml-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                                  {it.note}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center font-medium">{it.quantity}</td>
                            <td className="px-4 py-2 text-slate-400">
                              {days > 0 && <span className={`font-semibold ${days > 7 ? 'text-orange-600' : 'text-slate-500'}`}>D+{days}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                <tr>
                  <td colSpan={3} className="px-4 py-2">합계</td>
                  <td className="px-4 py-2 text-center">{items.reduce((s, it) => s + it.quantity, 0)}</td>
                  <td className="px-4 py-2" />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* 영수증 대조 모달 */}
      {invoiceOpen && (
        <InvoiceModal
          brand={summary.brand}
          batchFilter={batchFilter}
          batches={batches}
          onClose={() => setInvoiceOpen(false)}
          onArrived={async (itemIds) => {
            setInvoiceOpen(false);
            await onArrived(itemIds);
          }}
        />
      )}
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function AdminOrdersPage() {
  const [tab, setTab]   = useState<Tab>('주문접수');

  // 탭 배지용 카운트 (orders-data에서 가져옴)
  const [pendingCount, setPendingCount]     = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);

  // 주문접수/확인 전체 뷰: 서버 페이지네이션
  const [pendingRows, setPendingRows]                   = useState<FlatRow[]>([]);
  const [pendingTotal, setPendingTotal]                 = useState(0);
  const [pendingListLoading, setPendingListLoading]     = useState(false);
  const [confirmedRows, setConfirmedRows]               = useState<FlatRow[]>([]);
  const [confirmedTotal, setConfirmedTotal]             = useState(0);
  const [confirmedListLoading, setConfirmedListLoading] = useState(false);

  // 전체입고: lazy load
  const [inboundHistoryLoaded, setInboundHistoryLoaded]     = useState(false);
  const [inboundHistoryLoading, setInboundHistoryLoading]   = useState(false);
  const [inboundAllArrivedItems, setInboundAllArrivedItems] = useState<ArrivedItem[]>([]);
  const [inboundAllInbounds, setInboundAllInbounds]         = useState<InboundRec[]>([]);
  // 더 오래된 데이터 로드를 위한 dateFrom 확장
  const [inboundFromDate, setInboundFromDate] = useState(() => {
    const d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });

  const [todayInbounds, setTodayInbounds]     = useState<InboundRec[]>([]);
  const [todayArrivedItems, setTodayArrivedItems]           = useState<ArrivedItem[]>([]);
  const [outStockUnshippedItems, setOutStockUnshippedItems] = useState<OutStockUnshippedItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [search, setSearch]         = useState('');
  const [pendingPage, setPendingPage]     = useState(1);
  const [confirmedPage, setConfirmedPage] = useState(1);
  const [dailyArrivedPage, setDailyArrivedPage] = useState(1);
  const [inboundAllPage, setInboundAllPage]     = useState(1);
  const [ousuPage, setOusuPage]                 = useState(1);
  const [inboundDateFilter, setInboundDateFilter]   = useState('');
  const [inboundBrandFilter, setInboundBrandFilter] = useState('');
  const [inboundIdFilter, setInboundIdFilter]       = useState('');
  const [cancelPolicy, setCancelPolicy] = useState({
    globalEnabled: false,
    timeLimit: null as number | null,
    cancelFrom: '' as string,
    cancelTo: '' as string,
  });
  const [pendingViewMode, setPendingViewMode]     = useState<'전체' | '쇼핑몰별'>('쇼핑몰별');
  const [confirmedViewMode, setConfirmedViewMode] = useState<'쇼핑몰별' | '전체'>('쇼핑몰별');
  const [confirmedBatchFilter, setConfirmedBatchFilter] = useState<string>('all');
  const [confirmedBatches, setConfirmedBatches]         = useState<Array<OrderBatch & { label: string }>>([]);
  const [brandMallMap, setBrandMallMap] = useState<Record<string, string>>({});

  // 리프레시 버전 — 증가하면 활성 뷰 재로드
  const [refreshVersion, setRefreshVersion] = useState(0);

  // 품절/미송 비고 모달
  const [remarkModal, setRemarkModal] = useState<{ action: 'outOfStock' | 'unshipped'; itemIds: string[] } | null>(null);
  const [remarkInput, setRemarkInput] = useState('');
  // 품절/미송 탭 인라인 비고 편집
  const [editItemRemark, setEditItemRemark] = useState<{ id: string; value: string } | null>(null);

  // ── 디바운스 검색 ──────────────────────────────────────────────────────────
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchMountedRef = useRef(false);
  useEffect(() => {
    clearTimeout(searchTimerRef.current!);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      if (searchMountedRef.current) { setPendingPage(1); setConfirmedPage(1); }
      searchMountedRef.current = true;
    }, 300);
    return () => clearTimeout(searchTimerRef.current!);
  }, [search]);

  // ── fetch 함수 ─────────────────────────────────────────────────────────────
  const fetchPendingList = useCallback(async (page: number, q: string) => {
    setPendingListLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'list', page: String(page) });
      if (q) params.set('search', q);
      const d = await fetch(`/api/admin/pending-items?${params}`).then((r) => r.json());
      setPendingRows(Array.isArray(d.rows) ? d.rows : []);
      setPendingTotal(d.total ?? 0);
    } finally { setPendingListLoading(false); }
  }, []);

  const fetchConfirmedList = useCallback(async (page: number, q: string) => {
    setConfirmedListLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'list', page: String(page) });
      if (q) params.set('search', q);
      const d = await fetch(`/api/admin/confirmed-items?${params}`).then((r) => r.json());
      setConfirmedRows(Array.isArray(d.rows) ? d.rows : []);
      setConfirmedTotal(d.total ?? 0);
    } finally { setConfirmedListLoading(false); }
  }, []);

  const fetchInboundHistory = useCallback(async (fromDate: string, brand: string) => {
    setInboundHistoryLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom: fromDate });
      if (brand) params.set('brand', brand);
      const d = await fetch(`/api/admin/inbound-history?${params}`).then((r) => r.json());
      setInboundAllArrivedItems(Array.isArray(d.arrivedItems) ? d.arrivedItems : []);
      setInboundAllInbounds(Array.isArray(d.inbounds) ? d.inbounds : []);
      setInboundHistoryLoaded(true);
    } finally { setInboundHistoryLoading(false); }
  }, []);

  // ── 초기 데이터 로드 ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/orders-data').then((r) => r.json()).then((d) => {
      setPendingCount(d.pendingCount ?? 0);
      setConfirmedCount(d.confirmedCount ?? 0);
      setTodayInbounds(d.todayInbounds);
      setTodayArrivedItems(d.todayArrivedItems);
      setCancelPolicy({ globalEnabled: d.cancelPolicy.globalEnabled ?? false, timeLimit: d.cancelPolicy.timeLimit ?? null, cancelFrom: d.cancelPolicy.cancelFrom ?? '', cancelTo: d.cancelPolicy.cancelTo ?? '' });
      setOutStockUnshippedItems(Array.isArray(d.outOfStockUnshippedItems) ? d.outOfStockUnshippedItems : []);
      setLoading(false);
    });
    fetch('/api/brands').then((r) => r.json()).then((d) => {
      if (!Array.isArray(d)) return;
      const map: Record<string, string> = {};
      d.forEach((b: any) => { if (b.mallLocation) map[b.name] = b.mallLocation; });
      setBrandMallMap(map);
    });
    fetch('/api/admin/order-batches').then((r) => r.json()).then((d) => {
      if (!Array.isArray(d)) return;
      setConfirmedBatches(annotateBatches(d));
    });
  }, []);

  // ── 전체 뷰 활성 시 서버에서 페이지 데이터 로드 ─────────────────────────
  useEffect(() => {
    if (loading || pendingViewMode !== '전체') return;
    fetchPendingList(pendingPage, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingViewMode, pendingPage, debouncedSearch, refreshVersion]);

  useEffect(() => {
    if (loading || confirmedViewMode !== '전체') return;
    fetchConfirmedList(confirmedPage, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, confirmedViewMode, confirmedPage, debouncedSearch, refreshVersion]);

  // 전체입고 탭 진입 시 최초 1회 로드
  useEffect(() => {
    if (loading || tab !== '전체입고' || inboundHistoryLoaded) return;
    fetchInboundHistory(inboundFromDate, inboundBrandFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tab, inboundHistoryLoaded]);

  const totalPendingPages   = Math.max(1, Math.ceil(pendingTotal   / QUEUE_PAGE_SIZE));
  const totalConfirmedPages = Math.max(1, Math.ceil(confirmedTotal / QUEUE_PAGE_SIZE));

  useEffect(() => { setInboundAllPage(1); }, [inboundDateFilter, inboundBrandFilter, inboundIdFilter]);

  // 전체입고 필터 변경 시 서버 재조회
  const inboundBrandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!inboundHistoryLoaded) return;
    clearTimeout(inboundBrandTimerRef.current!);
    inboundBrandTimerRef.current = setTimeout(() => {
      fetchInboundHistory(inboundFromDate, inboundBrandFilter);
    }, 300);
    return () => clearTimeout(inboundBrandTimerRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboundFromDate, inboundBrandFilter]);

  // 전체입고: lazy 데이터에 날짜 필터 적용 (브랜드는 이미 API에서 필터됨)
  const filteredInbounds = useMemo(() => {
    if (!inboundDateFilter) return inboundAllInbounds;
    return inboundAllInbounds.filter((ib) => {
      const d = new Date(ib.arrivedAt); d.setHours(0, 0, 0, 0);
      const f = new Date(inboundDateFilter); f.setHours(0, 0, 0, 0);
      return d.getTime() === f.getTime();
    });
  }, [inboundAllInbounds, inboundDateFilter]);

  const filteredAllArrived = useMemo(() => {
    if (!inboundDateFilter) return inboundAllArrivedItems;
    return inboundAllArrivedItems.filter((it) => {
      const start = new Date(inboundDateFilter); start.setHours(0, 0, 0, 0);
      const end   = new Date(inboundDateFilter); end.setHours(23, 59, 59, 999);
      const t     = new Date(it.arrivedAt).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }, [inboundAllArrivedItems, inboundDateFilter]);

  /* ── 일별입고 인쇄용 통합 행 (주문 입고 + 공급업체 입고) ── */
  const todayInboundRows: DailyRow[] = useMemo(() => [
    ...todayArrivedItems.map((it) => ({
      key: `o-${it.id}`, id: it.id, source: 'order' as const, userName: it.order.user.name,
      brand: it.product.brand || '-', name: it.product.name, size: it.size || '-', color: it.color || '-', quantity: it.quantity,
      image: it.product.images?.[0] ?? null, price: it.price,
    })),
    ...todayInbounds.flatMap((ib) => ib.items.map((item) => ({
      key: `s-${item.id}`, id: item.id, source: 'supplier' as const, userName: ib.user?.name ?? '-',
      brand: item.product?.brand || ib.brand, name: item.product?.name || item.name,
      size: item.size || '-', color: item.color || '-', quantity: item.quantity,
      image: item.product?.images?.[0] ?? null, price: item.price,
    }))),
  ], [todayArrivedItems, todayInbounds]);

  /* ── 일별입고 아이디·브랜드 필터 (주문 상품 입고 + 공급업체 입고 공통 적용, 인쇄 대상도 이 필터를 따름) ── */
  const [dailyIdFilter, setDailyIdFilter]       = useState('');
  const [dailyBrandFilter, setDailyBrandFilter] = useState('');

  const dailyIdOptions    = useMemo(() => Array.from(new Set(todayInboundRows.map((r) => r.userName))).sort(), [todayInboundRows]);
  const dailyBrandOptions = useMemo(() => Array.from(new Set(todayInboundRows.map((r) => r.brand))).sort(),    [todayInboundRows]);

  const filteredTodayArrivedItems = useMemo(() => todayArrivedItems.filter((it) =>
    (!dailyIdFilter || it.order.user.name === dailyIdFilter) &&
    (!dailyBrandFilter || (it.product.brand || '-') === dailyBrandFilter)
  ), [todayArrivedItems, dailyIdFilter, dailyBrandFilter]);
  const pagedTodayArrivedItems = useMemo(
    () => filteredTodayArrivedItems.slice((dailyArrivedPage - 1) * QUEUE_PAGE_SIZE, dailyArrivedPage * QUEUE_PAGE_SIZE),
    [filteredTodayArrivedItems, dailyArrivedPage]
  );
  useEffect(() => { setDailyArrivedPage(1); }, [dailyIdFilter, dailyBrandFilter]);
  useEffect(() => { setDailyArrivedPage((p) => Math.min(p, Math.max(1, Math.ceil(filteredTodayArrivedItems.length / QUEUE_PAGE_SIZE)))); }, [filteredTodayArrivedItems.length]);

  const filteredTodayInbounds = useMemo(() => todayInbounds
    .map((ib) => ({
      ...ib,
      items: ib.items.filter((item) => !dailyBrandFilter || (item.product?.brand || ib.brand) === dailyBrandFilter),
    }))
    .filter((ib) => (!dailyIdFilter || ib.user?.name === dailyIdFilter) && ib.items.length > 0),
  [todayInbounds, dailyIdFilter, dailyBrandFilter]);

  const filteredTodayInboundRows = useMemo(() => todayInboundRows.filter((r) =>
    (!dailyIdFilter || r.userName === dailyIdFilter) &&
    (!dailyBrandFilter || r.brand === dailyBrandFilter)
  ), [todayInboundRows, dailyIdFilter, dailyBrandFilter]);

  const handleDailyPrint = () => {
    if (filteredTodayInboundRows.length === 0) return;
    printInboundRows(filteredTodayInboundRows, `일별입고 - ${new Date().toLocaleDateString('ko-KR')}`);
  };

  const [dailyPrintPicker, setDailyPrintPicker] = useState(false);
  const handleDailyInvoicePrint = useCallback((sortBy: 'product' | 'member') => {
    setDailyPrintPicker(false);
    const today = new Date().toLocaleDateString('ko-KR');
    const printItems: PrintableItem[] = filteredTodayArrivedItems.map((it) => ({
      itemId: it.id, productId: it.product.id, brand: it.product.brand || '-',
      productName: it.product.name, color: it.color || '', size: it.size || '',
      quantity: it.quantity, images: it.product.images,
      colorImages: it.product.colorImages ?? [],
      userName: it.order.user.name, orderDate: it.order.createdAt,
    }));
    printInvoiceItems({ title: `오늘 입고 전체 (${today})`, sortBy, items: printItems, mallMap: brandMallMap });
  }, [filteredTodayArrivedItems, brandMallMap]);

  /* ── 입고 상품 금액/세일율 수정 (단건 + 브랜드 일괄) ── */
  const [editModal, setEditModal] = useState<{ source: 'order' | 'supplier'; id: string; title: string; price: number } | null>(null);
  const [brandModal, setBrandModal] = useState<{ brand: string; rows: BrandModalRow[] } | null>(null);

  const openBrandModal = (brand: string, rows: DailyRow[]) => {
    const brandRows: BrandModalRow[] = rows
      .filter((r) => r.brand === brand)
      .map((r) => ({ key: r.key, id: r.id, source: r.source, name: r.name, size: r.size, color: r.color, quantity: r.quantity, price: r.price ?? 0 }));
    setBrandModal({ brand, rows: brandRows });
  };

  const applyPriceUpdate = (source: 'order' | 'supplier', id: string, price: number) => {
    if (source === 'order') {
      setTodayArrivedItems((prev) => prev.map((it) => it.id === id ? { ...it, price } : it));
      setInboundAllArrivedItems((prev) => prev.map((it) => it.id === id ? { ...it, price } : it));
    } else {
      const patchInbounds = (list: InboundRec[]) => list.map((ib) => ({
        ...ib, items: ib.items.map((item) => item.id === id ? { ...item, price } : item),
      }));
      setTodayInbounds(patchInbounds);
      setInboundAllInbounds(patchInbounds);
    }
  };

  const handleSaveSinglePrice = async (newPrice: number) => {
    if (!editModal) return;
    const endpoint = editModal.source === 'order' ? '/api/orders/items/price' : '/api/inbound/items/price';
    const res = await fetch(endpoint, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ id: editModal.id, price: newPrice }] }),
    });
    if (res.ok) applyPriceUpdate(editModal.source, editModal.id, newPrice);
    else alert('금액 수정에 실패했습니다.');
    setEditModal(null);
  };

  const handleSaveBrandChanges = async (changes: { key: string; id: string; source: 'order' | 'supplier'; price: number }[]) => {
    const orderUpdates    = changes.filter((c) => c.source === 'order').map((c) => ({ id: c.id, price: c.price }));
    const supplierUpdates = changes.filter((c) => c.source === 'supplier').map((c) => ({ id: c.id, price: c.price }));

    const results = await Promise.all([
      orderUpdates.length > 0
        ? fetch('/api/orders/items/price', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: orderUpdates }) })
        : null,
      supplierUpdates.length > 0
        ? fetch('/api/inbound/items/price', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: supplierUpdates }) })
        : null,
    ]);
    if (results.some((r) => r && !r.ok)) alert('일부 항목 저장에 실패했습니다.');

    changes.forEach((c) => applyPriceUpdate(c.source, c.id, c.price));
    setBrandModal(null);
  };

  /* ── 선택 파생 상태 (탭별 소스 추적) ── */
  const selPending   = useMemo(() => pendingRows.filter((r) => selected.has(r.itemId)),            [pendingRows,            selected]);
  const selConfirmed = useMemo(() => confirmedRows.filter((r) => selected.has(r.itemId)),          [confirmedRows,          selected]);
  const selArrived   = useMemo(() => todayArrivedItems.filter((it) => selected.has(it.id)),        [todayArrivedItems,       selected]);
  const selOusu      = useMemo(() => outStockUnshippedItems.filter((it) => selected.has(it.id)),   [outStockUnshippedItems, selected]);
  const totalSelectedCount = selected.size;

  /* ── 탭별 선택 카운트 배지 ── */
  const selCountByTab = useMemo(() => ({
    '주문접수': selPending.length,
    '주문확인': selConfirmed.length,
    '일별입고': selArrived.length,
    '품절/미송': selOusu.length,
  }), [selPending, selConfirmed, selArrived, selOusu]);

  /* ── 플로팅 바 버튼 표시 조건 ──
     취소상품/품절미송 탭 → 주문확인·입고만 허용 (취소·품절·미송 불가) ── */
  const canConfirm  = selPending.length > 0 || selArrived.length > 0 || selOusu.length > 0;
  const canArrive   = selPending.length > 0 || selConfirmed.length > 0 || selOusu.length > 0;
  const canCancel   = selPending.length > 0 || selConfirmed.length > 0 || selArrived.length > 0;
  const canOusu     = selPending.length > 0 || selConfirmed.length > 0 || selArrived.length > 0;
  const canLock     = selPending.length > 0 || selConfirmed.length > 0;

  /* ── 전체 데이터 리프레시 ── */
  const refreshData = useCallback(async () => {
    const d = await fetch('/api/admin/orders-data').then((r) => r.json());
    setPendingCount(d.pendingCount ?? 0);
    setConfirmedCount(d.confirmedCount ?? 0);
    setTodayInbounds(d.todayInbounds);
    setTodayArrivedItems(d.todayArrivedItems);
    setOutStockUnshippedItems(Array.isArray(d.outOfStockUnshippedItems) ? d.outOfStockUnshippedItems : []);
    setSelected(new Set());
    setInboundHistoryLoaded(false); // 전체입고 다음 진입 시 재로드
    setRefreshVersion((v) => v + 1); // 활성 목록 재로드 트리거
  }, []);

  /* ── 토글 함수 ── */
  const toggleRow = useCallback((itemId: string) => {
    setSelected((s) => { const n = new Set(s); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });
  }, []);

  const ousuTotalPages = Math.max(1, Math.ceil(outStockUnshippedItems.length / QUEUE_PAGE_SIZE));
  const pagedOusu = useMemo(() => outStockUnshippedItems.slice((ousuPage - 1) * QUEUE_PAGE_SIZE, ousuPage * QUEUE_PAGE_SIZE), [outStockUnshippedItems, ousuPage]);
  useEffect(() => { setOusuPage((p) => Math.min(p, ousuTotalPages)); }, [ousuTotalPages]);

  // 안전을 위해 "전체 선택"은 현재 페이지에 보이는 건만 대상으로 한다 (안 본 페이지의 주문이 실수로 함께 처리되는 것을 방지)
  const toggleAllPending   = useCallback(() => makeToggleAll(pendingRows.map((r) => r.itemId),   selected, setSelected)(), [pendingRows,   selected]);
  const toggleAllConfirmed = useCallback(() => makeToggleAll(confirmedRows.map((r) => r.itemId), selected, setSelected)(), [confirmedRows, selected]);
  const toggleAllArrived   = useCallback(() => makeToggleAll(pagedTodayArrivedItems.map((it) => it.id),     selected, setSelected)(), [pagedTodayArrivedItems, selected]);
  const toggleAllOusu      = useCallback(() => makeToggleAll(pagedOusu.map((it) => it.id),                  selected, setSelected)(), [pagedOusu,               selected]);

  /* ── 통합 액션 함수 ── */

  // 주문확인: 선택한 아이템만 confirmedAt 설정 + arrived/ousu→confirmed 되돌리기
  const actionConfirm = async () => {
    const pendingItemIds = selPending.map((r) => r.itemId);
    const revertItemIds  = [...selArrived, ...selOusu].map((it) => it.id);
    if (!pendingItemIds.length && !revertItemIds.length) return;
    const label = `주문확인 처리 (접수 ${pendingItemIds.length}건 + 되돌리기 ${revertItemIds.length}건)`;
    if (!confirm(label + '\n진행하시겠습니까?')) return;

    if (pendingItemIds.length)
      await fetch('/api/orders/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: pendingItemIds, action: 'confirm' }) });
    if (revertItemIds.length)
      await fetch('/api/orders/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: revertItemIds, action: 'revertToConfirmed' }) });

    await refreshData();
  };

  // 입고: 모든 소스에서 arrivedAt 설정
  const actionArrive = async () => {
    const itemIds = [
      ...selPending.map((r) => r.itemId),
      ...selConfirmed.map((r) => r.itemId),
      ...selOusu.map((it) => it.id),
    ];
    if (!itemIds.length) return;
    if (!confirm(`${itemIds.length}건을 입고 처리하시겠습니까?`)) return;
    await fetch('/api/orders/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds }) });
    await refreshData();
  };

  // 품절: 모달 열기
  const actionOutOfStock = () => {
    const itemIds = [
      ...selPending.map((r) => r.itemId),
      ...selConfirmed.map((r) => r.itemId),
      ...selArrived.map((it) => it.id),
    ];
    if (!itemIds.length) return;
    setRemarkInput('');
    setRemarkModal({ action: 'outOfStock', itemIds });
  };

  // 미송: 모달 열기
  const actionUnshipped = () => {
    const itemIds = [
      ...selPending.map((r) => r.itemId),
      ...selConfirmed.map((r) => r.itemId),
      ...selArrived.map((it) => it.id),
    ];
    if (!itemIds.length) return;
    setRemarkInput('');
    setRemarkModal({ action: 'unshipped', itemIds });
  };

  // 모달 확인 → 처리
  const confirmRemarkModal = async () => {
    if (!remarkModal) return;
    const res = await fetch('/api/orders/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: remarkModal.itemIds, action: remarkModal.action, remark: remarkInput.trim() || null }),
    });
    setRemarkModal(null);
    setRemarkInput('');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || '처리에 실패했습니다.');
      return;
    }
    await refreshData();
    setTab('품절/미송');
  };

  // 품절/미송 탭 인라인 비고 저장
  const saveItemRemark = async (itemId: string, value: string) => {
    await fetch('/api/orders/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: [itemId], action: 'updateRemark', remark: value.trim() || null }),
    });
    setOutStockUnshippedItems((prev) => prev.map((it) => it.id === itemId ? { ...it, remark: value.trim() || null } : it));
    setEditItemRemark(null);
  };

  // 취소 (관리자 강제): 접수·확인·입고에서만 (품절미송→취소 불가)
  const actionAdminCancel = async () => {
    const itemIds = [
      ...selPending.map((r) => r.itemId),
      ...selConfirmed.map((r) => r.itemId),
      ...selArrived.map((it) => it.id),
    ];
    if (!itemIds.length) return;
    if (!confirm(`${itemIds.length}건을 강제 취소하시겠습니까?\n입고된 상품은 출금이 자동 취소됩니다.`)) return;
    await fetch('/api/orders/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds, action: 'adminCancel' }) });
    await refreshData();
  };

  // 취소잠금 (주문접수/확인에서만)
  const setCancelLock = async (lock: boolean) => {
    const itemIds = [...selPending, ...selConfirmed].map((r) => r.itemId);
    if (!itemIds.length) return;
    await fetch('/api/orders/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds, cancelLocked: lock }) });
    const patcher = (rows: FlatRow[]) => rows.map((r) => itemIds.includes(r.itemId) ? { ...r, itemCancelLocked: lock } : r);
    setPendingRows(patcher);
    setConfirmedRows(patcher);
    setSelected((s) => { const n = new Set(s); itemIds.forEach((id) => n.delete(id)); return n; });
  };

  // 탭별 인라인 액션 (OrderTable에 넘기는 용)
  const markAsArrived    = actionArrive;
  const markAsOutOfStock = actionOutOfStock;
  const markAsUnshipped  = actionUnshipped;
  const confirmSelected  = actionConfirm;

  // 쇼핑몰별 뷰에서 특정 아이템 ID들을 직접 입고 처리 (invoice modal 포함)
  const markAsArrivedById = useCallback(async (itemIds: string[]) => {
    if (!itemIds.length) return;
    await fetch('/api/orders/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds }) });
    await refreshData();
  }, [refreshData]);

  const handleDeleteInbound = async (id: string) => {
    await fetch(`/api/inbound/${id}`, { method: 'DELETE' });
    setTodayInbounds((p) => p.filter((i) => i.id !== id));
    setInboundAllInbounds((p) => p.filter((i) => i.id !== id));
  };

  const handlePolicyUpdate = async () => {
    await fetch('/api/cancel-policy', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cancelPolicy) });
    alert('취소 정책 저장 완료');
  };

  /* 합계 (주문 시 저장된 price 기준, 필터 적용된 항목만) */
  const arrivedTotal = filteredTodayArrivedItems.reduce((s, it) => s + it.price * it.quantity, 0);

  /* 일별입고/품절미송 전체선택 체크 */
  const allArrivedSel  = pagedTodayArrivedItems.length > 0 && pagedTodayArrivedItems.every((it) => selected.has(it.id));
  const someArrivedSel = pagedTodayArrivedItems.some((it) => selected.has(it.id));
  const allOusuSel     = pagedOusu.length > 0 && pagedOusu.every((it) => selected.has(it.id));
  const someOusuSel    = pagedOusu.some((it) => selected.has(it.id));

  return (
    <div className="pb-24">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">주문 관리</h1>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => {
          const selCnt = selCountByTab[t as keyof typeof selCountByTab] ?? 0;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t}
              {t === '주문접수'  && pendingCount   > 0 && <span className="ml-1.5 text-xs bg-primary-600 text-white rounded-full px-1.5 py-0.5">{pendingCount}</span>}
              {t === '주문확인'  && confirmedCount > 0 && <span className="ml-1.5 text-xs bg-green-600 text-white rounded-full px-1.5 py-0.5">{confirmedCount}</span>}
              {t === '일별입고'  && todayArrivedItems.length > 0 && <span className="ml-1.5 text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5">{todayArrivedItems.length}</span>}
              {t === '품절/미송' && outStockUnshippedItems.length > 0 && <span className="ml-1.5 text-xs bg-orange-500 text-white rounded-full px-1.5 py-0.5">{outStockUnshippedItems.length}</span>}
              {selCnt > 0 && <span className="ml-1 text-xs bg-yellow-400 text-slate-800 rounded-full px-1.5 py-0.5 font-bold">{selCnt}✓</span>}
            </button>
          );
        })}
      </div>

      {/* ── 취소 정책 설정 카드 (탭 공통) ── */}
      <div className="card px-5 py-4 mb-6 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-semibold text-slate-700">주문 취소 정책</span>
        </div>
        <label className="cursor-pointer flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cancelPolicy.globalEnabled}
            onChange={(e) => setCancelPolicy((p) => ({ ...p, globalEnabled: e.target.checked }))}
            className="w-4 h-4 accent-primary-600" />
          <span className={cancelPolicy.globalEnabled ? 'text-primary-700 font-medium' : 'text-slate-400'}>
            회원 취소 허용
          </span>
        </label>
        {cancelPolicy.globalEnabled && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 text-xs font-medium">취소 가능 시간</span>
            <input type="time" className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white w-28"
              value={cancelPolicy.cancelFrom}
              onChange={(e) => setCancelPolicy((p) => ({ ...p, cancelFrom: e.target.value }))} />
            <span className="text-slate-400">~</span>
            <input type="time" className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white w-28"
              value={cancelPolicy.cancelTo}
              onChange={(e) => setCancelPolicy((p) => ({ ...p, cancelTo: e.target.value }))} />
            <span className="text-xs text-slate-400">(한국시간 기준)</span>
          </div>
        )}
        <button onClick={handlePolicyUpdate}
          className="px-4 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
          저장
        </button>
        {cancelPolicy.globalEnabled && (cancelPolicy.cancelFrom || cancelPolicy.cancelTo) && (
          <span className="text-xs text-slate-400 ml-auto">
            현재 회원에게 표시: <span className="font-semibold text-slate-600">{cancelPolicy.cancelFrom} ~ {cancelPolicy.cancelTo}</span>
          </span>
        )}
      </div>

      {loading ? <div className="text-center py-16 text-slate-400">로딩 중...</div> : (
        <>
          {/* ── 주문접수 ── */}
          {tab === '주문접수' && (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {pendingViewMode === '전체' && (
                  <input className="input max-w-xs text-sm" placeholder="아이디, 브랜드, 상품명..." value={search} onChange={(e) => setSearch(e.target.value)} />
                )}
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                  {(['쇼핑몰별', '전체'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPendingViewMode(mode)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pendingViewMode === mode ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {mode} 보기
                    </button>
                  ))}
                </div>
              </div>
              {pendingViewMode === '쇼핑몰별' ? (
                <PendingMallView onRefresh={refreshData} />
              ) : (
                <>
                  <QueuePagination page={pendingPage} totalPages={totalPendingPages} onChange={setPendingPage}
                    totalCount={pendingTotal} label="전체 미처리:" />
                  {pendingListLoading ? (
                    <div className="text-center py-12 text-slate-400 text-sm">로딩 중...</div>
                  ) : (
                    <OrderTable
                      rows={pendingRows} selected={selected} onToggleRow={toggleRow} onToggleAll={toggleAllPending}
                      actions={[
                        { label: '주문 확인으로 변경', color: 'bg-green-600', onClick: confirmSelected },
                        { label: '취소불가 잠금', color: 'bg-red-500', onClick: () => setCancelLock(true) },
                        { label: '취소 허용', color: 'bg-slate-500', onClick: () => setCancelLock(false) },
                      ]}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── 주문확인 ── */}
          {tab === '주문확인' && (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                  {(['쇼핑몰별', '전체'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setConfirmedViewMode(mode)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${confirmedViewMode === mode ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {mode} 보기
                    </button>
                  ))}
                </div>
                {confirmedViewMode === '쇼핑몰별' ? (
                  <>
                    <select
                      value={confirmedBatchFilter}
                      onChange={(e) => setConfirmedBatchFilter(e.target.value)}
                      className="input text-sm w-64"
                    >
                      <option value="all">전체 대기</option>
                      {confirmedBatches.map((b) => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400">브랜드별로 발주 현황을 확인하세요.</p>
                  </>
                ) : (
                  <>
                    <input className="input max-w-xs text-sm" placeholder="아이디, 브랜드, 상품명..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <p className="text-xs text-slate-400">입고 처리된 항목은 자동으로 일별입고로 이동됩니다.</p>
                  </>
                )}
              </div>
              {confirmedViewMode === '쇼핑몰별' ? (
                <ConfirmedMallView
                  batches={confirmedBatches}
                  batchFilter={confirmedBatchFilter}
                  onBatchFilterChange={setConfirmedBatchFilter}
                  onRefresh={refreshData}
                  markAsArrived={markAsArrivedById}
                />
              ) : (
                <>
                  <QueuePagination page={confirmedPage} totalPages={totalConfirmedPages} onChange={setConfirmedPage}
                    totalCount={confirmedTotal} label="전체 확인대기:" />
                  {confirmedListLoading ? (
                    <div className="text-center py-12 text-slate-400 text-sm">로딩 중...</div>
                  ) : (
                    <OrderTable
                      rows={confirmedRows} selected={selected} onToggleRow={toggleRow} onToggleAll={toggleAllConfirmed}
                      actions={[
                        { label: '✓ 입고 처리', color: 'bg-emerald-600', onClick: markAsArrived },
                        { label: '품절 처리', color: 'bg-orange-500', onClick: markAsOutOfStock },
                        { label: '미송 처리', color: 'bg-purple-600', onClick: markAsUnshipped },
                        { label: '취소불가 잠금', color: 'bg-red-500', onClick: () => setCancelLock(true) },
                        { label: '취소 허용', color: 'bg-slate-500', onClick: () => setCancelLock(false) },
                      ]}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── 일별입고 ── */}
          {tab === '일별입고' && (
            <div className="space-y-6">
              <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                오늘 ({new Date().toLocaleDateString('ko-KR')}) 입고 내역
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select className="input text-sm w-40" value={dailyIdFilter} onChange={(e) => setDailyIdFilter(e.target.value)}>
                  <option value="">아이디 전체</option>
                  {dailyIdOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <select className="input text-sm w-40" value={dailyBrandFilter} onChange={(e) => setDailyBrandFilter(e.target.value)}>
                  <option value="">브랜드 전체</option>
                  {dailyBrandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                {(dailyIdFilter || dailyBrandFilter) && (
                  <button onClick={() => { setDailyIdFilter(''); setDailyBrandFilter(''); }} className="text-xs text-slate-500 hover:text-slate-700">초기화</button>
                )}
                <span className="text-xs text-slate-400">{filteredTodayInboundRows.length}건 표시 중</span>
                <div className="flex gap-2 ml-auto">
                  <button onClick={handleDailyPrint} className="text-xs px-3 py-1.5 rounded-lg bg-slate-500 text-white font-medium hover:bg-slate-600 transition-colors">
                    🖨 기존 인쇄
                  </button>
                  <button onClick={() => setDailyPrintPicker(true)} disabled={filteredTodayArrivedItems.length === 0}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-40">
                    오늘 입고 전체 인쇄
                  </button>
                </div>
              </div>

              {filteredTodayArrivedItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">주문 상품 입고 ({filteredTodayArrivedItems.length}건)</h3>
                  <QueuePagination page={dailyArrivedPage}
                    totalPages={Math.max(1, Math.ceil(filteredTodayArrivedItems.length / QUEUE_PAGE_SIZE))}
                    onChange={setDailyArrivedPage} totalCount={filteredTodayArrivedItems.length} label="전체:" />
                  <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-max">
                        <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
                          <tr>
                            <th className="px-3 py-3">
                              <input type="checkbox" checked={allArrivedSel}
                                ref={(el) => { if (el) el.indeterminate = someArrivedSel && !allArrivedSel; }}
                                onChange={toggleAllArrived} className="w-4 h-4 accent-primary-600" />
                            </th>
                            <th className="px-3 py-3 text-left">아이디</th>
                            <ProductHeaders hasEdit />
                            <th className="px-3 py-3 text-left">주문일</th>
                            <th className="px-3 py-3 text-left">입고시간</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {pagedTodayArrivedItems.map((it) => (
                            <tr key={it.id} className={`hover:bg-slate-50 transition-colors ${selected.has(it.id) ? 'bg-primary-50/40' : ''}`}>
                              <td className="px-3 py-3">
                                <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleRow(it.id)} className="w-4 h-4 accent-primary-600" />
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
                              <ProductCells product={it.product} brand={it.product.brand || '-'} size={it.size || '-'} color={it.color || '-'} quantity={it.quantity} price={it.price}
                                isOnSale={it.isOnSale} saleType={it.saleType} saleValue={it.saleValue}
                                onBrandClick={(brand) => openBrandModal(brand, todayInboundRows)}
                                onEditPrice={() => setEditModal({ source: 'order', id: it.id, title: `${it.product.name} (${it.size || '-'} / ${it.color || '-'})`, price: it.price })} />
                              <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(it.order.createdAt)}</td>
                              <td className="px-3 py-3 text-xs text-emerald-600 font-medium whitespace-nowrap">
                                {new Date(it.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                          <tr>
                            <td colSpan={7} className="px-3 py-2">합계</td>
                            <td className="px-3 py-2 text-center">{filteredTodayArrivedItems.reduce((s, r) => s + r.quantity, 0)}</td>
                            <td />
                            <td />
                            <td className="px-3 py-2 text-right text-primary-700">{formatPrice(arrivedTotal)}</td>
                            <td colSpan={3} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">공급업체 입고</h3>
                <InboundSection inbounds={filteredTodayInbounds} onDelete={handleDeleteInbound} showForm
                  onBrandClick={(brand) => openBrandModal(brand, todayInboundRows)}
                  onEditPrice={(item) => setEditModal({ source: 'supplier', id: item.id, title: `${item.name} (${item.size || '-'} / ${item.color || '-'})`, price: item.price ?? 0 })} />
              </div>
            </div>
          )}

          {/* ── 전체입고 ── */}
          {tab === '전체입고' && (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <input type="date" className="input text-sm w-44" value={inboundDateFilter} onChange={(e) => setInboundDateFilter(e.target.value)} />
                <input className="input text-sm max-w-xs" placeholder="브랜드 검색..." value={inboundBrandFilter} onChange={(e) => setInboundBrandFilter(e.target.value)} />
                {(inboundDateFilter || inboundBrandFilter) && (
                  <button onClick={() => { setInboundDateFilter(''); setInboundBrandFilter(''); }} className="text-xs text-slate-500 hover:text-slate-700">초기화</button>
                )}
                <span className="text-xs text-slate-400">
                  {inboundFromDate} ~ 오늘
                </span>
                <button
                  onClick={() => {
                    const prev = new Date(inboundFromDate);
                    prev.setDate(prev.getDate() - 90);
                    setInboundFromDate(prev.toISOString().split('T')[0]);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  이전 90일 더 보기
                </button>
              </div>

              {inboundHistoryLoading ? (
                <div className="text-center py-16 text-slate-400 text-sm">로딩 중...</div>
              ) : (() => {
                const supplierRows = filteredInbounds.flatMap((ib) =>
                  ib.items.map((item) => ({
                    key: `s-${item.id}`,
                    id: item.id,
                    source: 'supplier' as const,
                    userName: ib.user?.name ?? '-',
                    identifier: ib.note ? `${ib.brand} · ${ib.note}` : ib.brand,
                    brand: item.product?.brand || ib.brand,
                    image: item.product?.images?.[0] ?? null,
                    name: item.product?.name || item.name,
                    productNumber: colorCodeFor(item.product?.productNumber, item.product?.colorCodes, item.color) ?? item.product?.productNumber ?? null,
                    isOnSale: item.isOnSale,
                    saleType: item.saleType,
                    saleValue: item.saleValue,
                    size: item.size || '-',
                    color: item.color || '-',
                    quantity: item.quantity,
                    price: item.price,
                    arrivedAt: ib.arrivedAt,
                  }))
                );
                const orderRows = filteredAllArrived.map((it) => ({
                  key: `o-${it.id}`,
                  id: it.id,
                  source: 'order' as const,
                  userName: it.order.user.name,
                  identifier: `#${it.order.id.slice(-6).toUpperCase()}`,
                  brand: it.product.brand || '-',
                  image: it.product.images?.[0] ?? null,
                  name: it.product.name,
                  productNumber: colorCodeFor(it.product.productNumber, it.product.colorCodes, it.color) ?? it.product.productNumber ?? null,
                  isOnSale: it.isOnSale,
                  saleType: it.saleType,
                  saleValue: it.saleValue,
                  size: it.size || '-',
                  color: it.color || '-',
                  quantity: it.quantity,
                  price: it.price,
                  arrivedAt: it.arrivedAt,
                }));
                const allRowsRaw = [...orderRows, ...supplierRows].sort(
                  (a, b) => new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime()
                );
                const inboundUserNames = Array.from(new Set(allRowsRaw.map((r) => r.userName))).sort();
                const allRows = inboundIdFilter ? allRowsRaw.filter((r) => r.userName === inboundIdFilter) : allRowsRaw;
                const totalQty = allRows.reduce((s, r) => s + r.quantity, 0);
                const totalAmt = allRows.reduce((s, r) => s + (r.price ?? 0) * r.quantity, 0);
                const inboundAllTotalPages = Math.max(1, Math.ceil(allRows.length / QUEUE_PAGE_SIZE));
                const pagedAllRows = allRows.slice((inboundAllPage - 1) * QUEUE_PAGE_SIZE, inboundAllPage * QUEUE_PAGE_SIZE);

                const handleInboundPrint = () => {
                  if (allRows.length === 0) return;
                  printInboundRows(allRows, `전체입고${inboundDateFilter ? ` - ${inboundDateFilter}` : ''}`);
                };

                if (allRowsRaw.length === 0) return (
                  <div className="text-center py-12 text-slate-400 text-sm">해당 날짜의 입고 내역이 없습니다.</div>
                );

                return (
                  <div className="card overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap p-3 border-b border-slate-100 bg-slate-50">
                      <select className="input text-sm w-40" value={inboundIdFilter} onChange={(e) => setInboundIdFilter(e.target.value)}>
                        <option value="">아이디 전체</option>
                        {inboundUserNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span className="text-xs text-slate-400 ml-auto">{allRows.length}건 표시 중</span>
                      <button onClick={handleInboundPrint} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 transition-colors">
                        🖨 인쇄
                      </button>
                    </div>
                    {inboundAllTotalPages > 1 && (
                      <div className="px-3 py-2 border-b border-slate-100">
                        <QueuePagination page={inboundAllPage} totalPages={inboundAllTotalPages} onChange={setInboundAllPage} totalCount={allRows.length} label="전체:" />
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-max">
                        <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
                          <tr>
                            <th className="px-3 py-3 text-left">구분</th>
                            <th className="px-3 py-3 text-left">회원</th>
                            <th className="px-3 py-3 text-left">브랜드</th>
                            <th className="px-3 py-3 text-left">사진</th>
                            <th className="px-3 py-3 text-left">상품명</th>
                            <th className="px-3 py-3 text-left">사이즈</th>
                            <th className="px-3 py-3 text-left">색상</th>
                            <th className="px-3 py-3 text-center">수량</th>
                            <th className="px-3 py-3 text-center">세일율</th>
                            <th className="px-3 py-3 text-right">금액</th>
                            <th className="px-3 py-3 text-left">입고시간</th>
                            <th className="px-3 py-3 text-center">관리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {pagedAllRows.map((row) => (
                            <tr key={row.key} className={`transition-colors ${row.source === 'order' ? 'hover:bg-emerald-50/20' : 'hover:bg-blue-50/20'}`}>
                              <td className="px-3 py-3">
                                {row.source === 'order'
                                  ? <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">주문</span>
                                  : <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">공급업체</span>}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                                {row.userName}
                                <span className="block text-slate-400 font-mono">{row.identifier}</span>
                              </td>
                              <td className="px-3 py-3">
                                <button onClick={() => openBrandModal(row.brand, allRowsRaw)}
                                  className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded whitespace-nowrap hover:bg-primary-100 transition-colors">
                                  {row.brand}
                                </button>
                              </td>
                              <td className="px-3 py-3">
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100">
                                  <Image src={row.image || '/no-image.svg'} alt={row.name} fill className="object-cover" />
                                </div>
                              </td>
                              <td className="px-3 py-3 font-medium text-slate-800 max-w-[160px]">
                                <span className="block truncate">{row.name}</span>
                                {row.productNumber && <span className="block text-xs text-slate-400 font-mono">{row.productNumber}</span>}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500">{row.size}</td>
                              <td className="px-3 py-3 text-xs text-slate-500">{row.color}</td>
                              <td className="px-3 py-3 text-center font-semibold">{row.quantity}</td>
                              <td className="px-3 py-3 text-center">
                                {row.isOnSale
                                  ? <span className="text-xs font-bold text-red-500 whitespace-nowrap">{row.saleType === 'RATE' ? `${row.saleValue}%` : row.saleValue ? `${row.saleValue.toLocaleString()}원` : ''}</span>
                                  : <span className="text-slate-300 text-xs">-</span>}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-primary-700 whitespace-nowrap">
                                {row.price !== null ? formatPrice(row.price * row.quantity) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-3 py-3 text-xs font-medium whitespace-nowrap" style={{ color: row.source === 'order' ? '#059669' : '#2563eb' }}>
                                {new Date(row.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => setEditModal({ source: row.source, id: row.id, title: `${row.name} (${row.size} / ${row.color})`, price: row.price ?? 0 })}
                                  className="text-xs text-primary-600 hover:underline whitespace-nowrap">
                                  수정
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                          <tr>
                            <td colSpan={7} className="px-3 py-2">합계 ({allRows.length}건)</td>
                            <td className="px-3 py-2 text-center">{totalQty}</td>
                            <td />
                            <td className="px-3 py-2 text-right text-primary-700">{formatPrice(totalAmt)}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── 품절/미송 ── */}
          {tab === '품절/미송' && (
            <div>
              {outStockUnshippedItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">품절 또는 미송 처리된 상품이 없습니다.</div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="p-3 border-b border-slate-100">
                    <QueuePagination page={ousuPage} totalPages={ousuTotalPages} onChange={setOusuPage}
                      totalCount={outStockUnshippedItems.length} label="전체:" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                      <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
                        <tr>
                          <th className="px-3 py-3">
                            <input type="checkbox" checked={allOusuSel}
                              ref={(el) => { if (el) el.indeterminate = someOusuSel && !allOusuSel; }}
                              onChange={toggleAllOusu} className="w-4 h-4 accent-primary-600" />
                          </th>
                          <th className="px-3 py-3 text-left">구분</th>
                          <th className="px-3 py-3 text-left">아이디</th>
                          <ProductHeaders />
                          <th className="px-3 py-3 text-left">주문일</th>
                          <th className="px-3 py-3 text-left">처리일시</th>
                          <th className="px-3 py-3 text-left">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {pagedOusu.map((it) => {
                          const isOutOfStock = !!it.outOfStockAt;
                          return (
                            <tr key={it.id} className={`transition-colors ${isOutOfStock ? 'hover:bg-orange-50/20' : 'hover:bg-purple-50/20'} ${selected.has(it.id) ? 'bg-primary-50/40' : isOutOfStock ? 'bg-orange-50/30' : 'bg-purple-50/30'}`}>
                              <td className="px-3 py-3">
                                <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleRow(it.id)} className="w-4 h-4 accent-primary-600" />
                              </td>
                              <td className="px-3 py-3">
                                {isOutOfStock
                                  ? <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-full">품절</span>
                                  : <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded-full">미송</span>}
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
                              <ProductCells product={it.product} brand={it.product.brand || '-'} size={it.size || '-'} color={it.color || '-'} quantity={it.quantity} price={it.price}
                                isOnSale={it.isOnSale} saleType={it.saleType} saleValue={it.saleValue} />
                              <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(it.order.createdAt)}</td>
                              <td className="px-3 py-3 text-xs whitespace-nowrap">
                                {isOutOfStock
                                  ? <span className="text-orange-500">{formatDateTime(it.outOfStockAt!)}</span>
                                  : <span className="text-purple-500">{formatDateTime(it.unshippedAt!)}</span>}
                              </td>
                              <td className="px-3 py-3 min-w-[150px]">
                                {editItemRemark?.id === it.id ? (
                                  <input
                                    autoFocus
                                    className="input text-xs w-full py-1 px-2"
                                    value={editItemRemark.value}
                                    onChange={(e) => setEditItemRemark({ id: it.id, value: e.target.value })}
                                    onBlur={() => saveItemRemark(it.id, editItemRemark.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveItemRemark(it.id, editItemRemark.value);
                                      if (e.key === 'Escape') setEditItemRemark(null);
                                    }}
                                    maxLength={200}
                                  />
                                ) : (
                                  <button
                                    onClick={() => setEditItemRemark({ id: it.id, value: it.remark || '' })}
                                    className="text-left w-full group"
                                    title="클릭하여 비고 편집"
                                  >
                                    {it.remark ? (
                                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium block truncate max-w-[180px]">{it.remark}</span>
                                    ) : (
                                      <span className="text-xs text-slate-300 group-hover:text-slate-400">+ 비고</span>
                                    )}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                        <tr>
                          <td colSpan={9} className="px-3 py-2">합계</td>
                          <td className="px-3 py-2 text-center">{outStockUnshippedItems.reduce((s, r) => s + r.quantity, 0)}</td>
                          <td colSpan={5} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </>
      )}

      {/* ── 플로팅 액션바 (전역 선택 시 표시) ── */}
      {totalSelectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white shadow-2xl border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-2 flex-wrap max-w-3xl">
          <span className="text-sm font-bold text-slate-800 mr-1">총 {totalSelectedCount}건 선택</span>
          <span className="text-xs text-slate-400 mr-2">
            {[
              selPending.length   > 0 && `접수 ${selPending.length}건`,
              selConfirmed.length > 0 && `확인 ${selConfirmed.length}건`,
              selArrived.length   > 0 && `입고 ${selArrived.length}건`,
              selOusu.length      > 0 && `품절/미송 ${selOusu.length}건`,
            ].filter(Boolean).join(' · ')}
          </span>

          {canConfirm && (
            <button onClick={actionConfirm} className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium whitespace-nowrap hover:bg-green-700 transition-colors">
              주문확인
            </button>
          )}
          {canArrive && (
            <button onClick={actionArrive} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium whitespace-nowrap hover:bg-emerald-700 transition-colors">
              ✓ 입고
            </button>
          )}
          {canCancel && (
            <button onClick={actionAdminCancel} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium whitespace-nowrap hover:bg-red-700 transition-colors">
              취소(관리자)
            </button>
          )}
          {canOusu && (
            <>
              <button onClick={actionOutOfStock} className="text-xs px-3 py-1.5 rounded-lg bg-orange-500 text-white font-medium whitespace-nowrap hover:bg-orange-600 transition-colors">
                품절
              </button>
              <button onClick={actionUnshipped} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white font-medium whitespace-nowrap hover:bg-purple-700 transition-colors">
                미송
              </button>
            </>
          )}
          {canLock && (
            <>
              <button onClick={() => setCancelLock(true)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-white font-medium whitespace-nowrap hover:bg-slate-800 transition-colors">
                취소불가 잠금
              </button>
              <button onClick={() => setCancelLock(false)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-400 text-white font-medium whitespace-nowrap hover:bg-slate-500 transition-colors">
                취소 허용
              </button>
            </>
          )}
          <button onClick={() => setSelected(new Set())} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors ml-1">
            선택 해제
          </button>
        </div>
      )}

      {/* ── 품절/미송 비고 모달 ── */}
      {remarkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800">
              {remarkModal.action === 'outOfStock' ? '품절' : '미송'} 처리
              <span className="ml-2 text-sm font-normal text-slate-500">({remarkModal.itemIds.length}건)</span>
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">비고 (선택)</label>
              <input
                autoFocus
                className="input text-sm w-full"
                placeholder="예: 봄신상 미입고, 색상 단종 등"
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmRemarkModal(); }}
                maxLength={200}
              />
              <p className="text-xs text-slate-400 mt-1">비고를 비워두면 저장 안 됩니다.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRemarkModal(null)} className="btn-outline text-sm">취소</button>
              <button
                onClick={confirmRemarkModal}
                className={`text-sm px-4 py-2 rounded-xl text-white font-medium ${remarkModal.action === 'outOfStock' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}
              >
                {remarkModal.action === 'outOfStock' ? '품절' : '미송'} 처리 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 입고 상품 금액 단건 수정 모달 ── */}
      {editModal && (
        <EditPriceModal
          title={editModal.title}
          initialPrice={editModal.price}
          onSave={handleSaveSinglePrice}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* ── 브랜드별 입고 상품 금액 일괄 수정 모달 ── */}
      {brandModal && (
        <BrandPriceModal
          brand={brandModal.brand}
          rows={brandModal.rows}
          onSave={handleSaveBrandChanges}
          onClose={() => setBrandModal(null)}
        />
      )}

      {/* ── 일별입고 인쇄 정렬 선택 ── */}
      {dailyPrintPicker && (
        <SortPickerDialog onConfirm={handleDailyInvoicePrint} onCancel={() => setDailyPrintPicker(false)} />
      )}
    </div>
  );
}
