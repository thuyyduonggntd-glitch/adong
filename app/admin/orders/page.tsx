'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { formatPrice, formatDate } from '@/lib/utils';

/* ── 타입 ── */
type SaleProduct = {
  id: string; name: string; images: string[]; brand: string | null; colors: string[];
  isOnSale: boolean; saleType: string | null; saleValue: number | null;
};
type AdminProduct = SaleProduct & { category: { name: string } };
type OrderItem = {
  id: string; quantity: number; price: number; size: string; color: string;
  arrivedAt: string | null; cancelledAt: string | null;
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
type ArrivedItem = {
  id: string; quantity: number; size: string | null; color: string | null; arrivedAt: string; price: number;
  product: SaleProduct;
  order: { id: string; status: string; userId: string; createdAt: string; note: string | null; user: { name: string; email: string } };
};
type CancelledItem = {
  id: string; quantity: number; size: string | null; color: string | null; cancelledAt: string; price: number;
  product: SaleProduct;
  order: { id: string; status: string; userId: string; createdAt: string; note: string | null; user: { name: string; email: string } };
};
type OutStockUnshippedItem = {
  id: string; quantity: number; size: string | null; color: string | null; price: number;
  outOfStockAt: string | null; unshippedAt: string | null;
  remark: string | null;
  product: SaleProduct;
  order: { id: string; status: string; userId: string; createdAt: string; note: string | null; user: { name: string; email: string } };
};
type InboundProduct = {
  id: string; name: string; images: string[]; brand: string | null;
  isOnSale: boolean; saleType: string | null; saleValue: number | null;
  sizes: string[]; colors: string[];
};
type InboundRec = {
  id: string; brand: string; note: string | null; arrivedAt: string;
  user: { id: string; name: string; email: string } | null;
  items: Array<{
    id: string; name: string; quantity: number;
    size: string | null; color: string | null;
    product: InboundProduct | null;
  }>;
};
type FlatRow = {
  rowKey: string; itemId: string; orderId: string; userId: string; userName: string;
  brand: string; product: AdminProduct; size: string; color: string; quantity: number; price: number;
  orderDate: string; status: string; itemCancelLocked: boolean; orderCancelLocked: boolean;
  arrivedAt: string | null; cancelledAt: string | null;
  outOfStockAt: string | null; unshippedAt: string | null;
  note: string | null;
};

function flattenOrders(orders: Order[]): FlatRow[] {
  return orders.flatMap((o) =>
    o.items.map((item) => ({
      rowKey: `${o.id}__${item.id}`,
      itemId: item.id, orderId: o.id, userId: o.userId, userName: o.user.name,
      brand: item.product.brand || item.product.category.name,
      product: item.product, size: item.size, color: item.color,
      quantity: item.quantity, price: item.price,
      orderDate: o.createdAt, status: o.status,
      itemCancelLocked: item.cancelLocked, orderCancelLocked: o.cancelLocked,
      arrivedAt: item.arrivedAt, cancelledAt: item.cancelledAt,
      outOfStockAt: item.outOfStockAt, unshippedAt: item.unshippedAt,
      note: o.note,
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
function ProductCells({ product, brand, size, color, quantity, price }: {
  product: SaleProduct; brand: string; size: string; color: string; quantity: number; price: number;
}) {
  const colorIdx = product.colors?.indexOf(color) ?? -1;
  const imgSrc = (colorIdx >= 0 && product.images[colorIdx]) ? product.images[colorIdx] : (product.images[0] || 'https://placehold.co/40x40/EFF6FF/2563EB?text=상품');
  return (
    <>
      <td className="px-3 py-3">
        <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded whitespace-nowrap">{brand}</span>
      </td>
      <td className="px-3 py-3">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-primary-50">
          <Image src={imgSrc} alt={product.name} fill className="object-cover" />
        </div>
      </td>
      <td className="px-3 py-3 font-medium text-slate-800 max-w-[150px]">
        <span className="block truncate">{product.name}</span>
        {product.isOnSale && (
          <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
            SALE {product.saleType === 'RATE' ? `${product.saleValue}%` : product.saleValue ? `${product.saleValue.toLocaleString()}원` : ''}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-slate-600">{size || '-'}</td>
      <td className="px-3 py-3 text-xs text-slate-600">{color || '-'}</td>
      <td className="px-3 py-3 text-center font-semibold">{quantity}</td>
      <td className="px-3 py-3 text-right font-semibold text-primary-700">{formatPrice(price)}</td>
      <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
        {formatPrice(price * quantity)}
      </td>
    </>
  );
}

function ProductHeaders() {
  return (
    <>
      <th className="px-3 py-3 text-left">브랜드</th>
      <th className="px-3 py-3 text-left">사진</th>
      <th className="px-3 py-3 text-left">이름</th>
      <th className="px-3 py-3 text-left">사이즈</th>
      <th className="px-3 py-3 text-left">컬러</th>
      <th className="px-3 py-3 text-center">수량</th>
      <th className="px-3 py-3 text-right">단가</th>
      <th className="px-3 py-3 text-right">TOTAL</th>
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
                    <ProductCells product={row.product} brand={row.brand} size={row.size} color={row.color} quantity={row.quantity} price={row.price} />
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
function InboundSection({ inbounds, onDelete, showForm }: { inbounds: InboundRec[]; onDelete: (id: string) => void; showForm?: boolean }) {
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
              <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">{ib.brand}</span>
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
                  <th className="px-4 py-2 text-center">SALE</th>
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
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{it.size || '-'}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{it.color || '-'}</td>
                      <td className="px-4 py-2.5 text-center font-semibold">{it.quantity}</td>
                      <td className="px-4 py-2.5 text-center">
                        {p?.isOnSale
                          ? <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">SALE</span>
                          : <span className="text-slate-300 text-xs">-</span>}
                      </td>
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

/* ── 브랜드별 신규접수 뷰 (아코디언) ── */
function BrandOrderView({ rows }: { rows: FlatRow[] }) {
  const [openBrand, setOpenBrand] = useState<string | null>(null);

  const brandGroups = useMemo(() => {
    const map = new Map<string, FlatRow[]>();
    rows.forEach((r) => {
      const list = map.get(r.brand) ?? [];
      list.push(r);
      map.set(r.brand, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'ko'));
  }, [rows]);

  if (rows.length === 0)
    return <div className="text-center py-12 text-slate-400">신규 접수 주문이 없습니다.</div>;

  return (
    <div className="space-y-2">
      {brandGroups.map(([brand, items]) => {
        const totalQty = items.reduce((s, r) => s + r.quantity, 0);
        const isOpen = openBrand === brand;
        return (
          <div key={brand} className="card overflow-hidden">
            <button
              onClick={() => setOpenBrand(isOpen ? null : brand)}
              className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${isOpen ? 'bg-primary-50' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${isOpen ? 'text-primary-700' : 'text-slate-800'}`}>{brand}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOpen ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  상품 {items.length}종
                </span>
                <span className="text-xs text-slate-400">총 수량 {totalQty}</span>
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
                      <th className="px-4 py-2.5 text-left">아이디</th>
                      <th className="px-4 py-2.5 text-left">상품명</th>
                      <th className="px-4 py-2.5 text-left">사이즈</th>
                      <th className="px-4 py-2.5 text-left">컬러</th>
                      <th className="px-4 py-2.5 text-center">수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((r) => (
                      <tr key={r.rowKey} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                          {r.userName}
                          <span className="block text-slate-400 font-mono">#{r.orderId.slice(-6).toUpperCase()}</span>
                          {r.note && (
                            <span className="block mt-0.5 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] leading-tight max-w-[120px] break-words whitespace-normal">
                              {r.note}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px]">
                          <span className="block truncate">{r.product.name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{r.size || '-'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{r.color || '-'}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-slate-800">{r.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                    <tr>
                      <td colSpan={4} className="px-4 py-2">합계</td>
                      <td className="px-4 py-2 text-center">{totalQty}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TABS = ['주문접수', '주문확인', '일별입고', '전체입고', '취소 상품', '품절/미송'] as const;
type Tab = typeof TABS[number];

/* ── 메인 페이지 ── */
export default function AdminOrdersPage() {
  const [tab, setTab]   = useState<Tab>('주문접수');
  const [pendingOrders, setPendingOrders]     = useState<Order[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<Order[]>([]);
  const [todayInbounds, setTodayInbounds]     = useState<InboundRec[]>([]);
  const [allInbounds, setAllInbounds]         = useState<InboundRec[]>([]);
  const [todayArrivedItems, setTodayArrivedItems]           = useState<ArrivedItem[]>([]);
  const [allArrivedOrderItems, setAllArrivedOrderItems]     = useState<ArrivedItem[]>([]);
  const [cancelledItems, setCancelledItems]                 = useState<CancelledItem[]>([]);
  const [outStockUnshippedItems, setOutStockUnshippedItems] = useState<OutStockUnshippedItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<Set<string>>(new Set()); // itemId 기반, 탭 전환 시 유지
  const [search, setSearch]         = useState('');
  const [inboundDateFilter, setInboundDateFilter]   = useState('');
  const [inboundBrandFilter, setInboundBrandFilter] = useState('');
  const [cancelPolicy, setCancelPolicy] = useState({
    globalEnabled: false,
    timeLimit: null as number | null,
    cancelFrom: '' as string,
    cancelTo: '' as string,
  });
  const [pendingViewMode, setPendingViewMode] = useState<'전체' | '브랜드별'>('브랜드별');

  // 품절/미송 비고 모달
  const [remarkModal, setRemarkModal] = useState<{ action: 'outOfStock' | 'unshipped'; itemIds: string[] } | null>(null);
  const [remarkInput, setRemarkInput] = useState('');
  // 품절/미송 탭 인라인 비고 편집
  const [editItemRemark, setEditItemRemark] = useState<{ id: string; value: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/orders?admin=1&status=PENDING').then((r) => r.json()),
      fetch('/api/orders?admin=1&status=CONFIRMED').then((r) => r.json()),
      fetch('/api/inbound?today=1').then((r) => r.json()),
      fetch('/api/inbound').then((r) => r.json()),
      fetch('/api/orders/items?arrivedToday=1').then((r) => r.json()),
      fetch('/api/cancel-policy').then((r) => r.json()),
      fetch('/api/orders/items?cancelled=1').then((r) => r.json()),
      fetch('/api/orders/items?outOfStockOrUnshipped=1').then((r) => r.json()),
      fetch('/api/orders/items?allArrived=1').then((r) => r.json()),
    ]).then(([p, c, ti, ai, arrived, pol, cancelled, ousu, allArrived]) => {
      setPendingOrders(p); setConfirmedOrders(c);
      setTodayInbounds(ti); setAllInbounds(ai);
      setTodayArrivedItems(arrived);
      setCancelPolicy({ globalEnabled: pol.globalEnabled ?? false, timeLimit: pol.timeLimit ?? null, cancelFrom: pol.cancelFrom ?? '', cancelTo: pol.cancelTo ?? '' });
      setCancelledItems(Array.isArray(cancelled) ? cancelled : []);
      setOutStockUnshippedItems(Array.isArray(ousu) ? ousu : []);
      setAllArrivedOrderItems(Array.isArray(allArrived) ? allArrived : []);
      setLoading(false);
    });
  }, []);

  const pendingRows   = useMemo(() => flattenOrders(pendingOrders).filter((r) => !r.cancelledAt), [pendingOrders]);
  const confirmedRows = useMemo(() => flattenOrders(confirmedOrders).filter((r) => !r.arrivedAt && !r.cancelledAt && !r.outOfStockAt && !r.unshippedAt), [confirmedOrders]);

  const filterRows = useCallback((rows: FlatRow[]) => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.userName.toLowerCase().includes(q) ||
      r.product.name.toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredPending   = useMemo(() => filterRows(pendingRows),   [pendingRows,   filterRows]);
  const filteredConfirmed = useMemo(() => filterRows(confirmedRows), [confirmedRows, filterRows]);

  const filteredInbounds = useMemo(() => {
    if (!inboundDateFilter && !inboundBrandFilter) return [];
    const brandQ = inboundBrandFilter.toLowerCase();
    return allInbounds.filter((ib) => {
      if (inboundBrandFilter && !ib.brand.toLowerCase().includes(brandQ)) return false;
      if (!inboundDateFilter) return true;
      const d = new Date(ib.arrivedAt); d.setHours(0, 0, 0, 0);
      const f = new Date(inboundDateFilter); f.setHours(0, 0, 0, 0);
      return d.getTime() === f.getTime();
    });
  }, [allInbounds, inboundDateFilter, inboundBrandFilter]);

  const filteredAllArrived = useMemo(() => {
    if (!inboundDateFilter && !inboundBrandFilter) return [];
    const brandQ = inboundBrandFilter.toLowerCase();
    return allArrivedOrderItems.filter((it) => {
      if (inboundBrandFilter && !(it.product.brand || '').toLowerCase().includes(brandQ)) return false;
      if (!inboundDateFilter) return true;
      const start = new Date(inboundDateFilter); start.setHours(0, 0, 0, 0);
      const end   = new Date(inboundDateFilter); end.setHours(23, 59, 59, 999);
      const t = new Date(it.arrivedAt).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }, [allArrivedOrderItems, inboundDateFilter, inboundBrandFilter]);

  /* ── 선택 파생 상태 (탭별 소스 추적) ── */
  const selPending   = useMemo(() => pendingRows.filter((r) => selected.has(r.itemId)),            [pendingRows,            selected]);
  const selConfirmed = useMemo(() => confirmedRows.filter((r) => selected.has(r.itemId)),          [confirmedRows,          selected]);
  const selArrived   = useMemo(() => todayArrivedItems.filter((it) => selected.has(it.id)),        [todayArrivedItems,       selected]);
  const selCancelled = useMemo(() => cancelledItems.filter((it) => selected.has(it.id)),           [cancelledItems,         selected]);
  const selOusu      = useMemo(() => outStockUnshippedItems.filter((it) => selected.has(it.id)),   [outStockUnshippedItems, selected]);
  const totalSelectedCount = selected.size;

  /* ── 탭별 선택 카운트 배지 ── */
  const selCountByTab = useMemo(() => ({
    '주문접수': selPending.length,
    '주문확인': selConfirmed.length,
    '일별입고': selArrived.length,
    '취소 상품': selCancelled.length,
    '품절/미송': selOusu.length,
  }), [selPending, selConfirmed, selArrived, selCancelled, selOusu]);

  /* ── 플로팅 바 버튼 표시 조건 ──
     취소상품/품절미송 탭 → 주문확인·입고만 허용 (취소·품절·미송 불가) ── */
  const canConfirm  = selPending.length > 0 || selArrived.length > 0 || selCancelled.length > 0 || selOusu.length > 0;
  const canArrive   = selPending.length > 0 || selConfirmed.length > 0 || selCancelled.length > 0 || selOusu.length > 0;
  const canCancel   = selPending.length > 0 || selConfirmed.length > 0 || selArrived.length > 0;
  const canOusu     = selPending.length > 0 || selConfirmed.length > 0 || selArrived.length > 0;
  const canLock     = selPending.length > 0 || selConfirmed.length > 0;

  /* ── 전체 데이터 리프레시 ── */
  const refreshData = useCallback(async () => {
    const [p, c, ti, ai, arrived, cancelled, ousu, allArrived] = await Promise.all([
      fetch('/api/orders?admin=1&status=PENDING').then((r) => r.json()),
      fetch('/api/orders?admin=1&status=CONFIRMED').then((r) => r.json()),
      fetch('/api/inbound?today=1').then((r) => r.json()),
      fetch('/api/inbound').then((r) => r.json()),
      fetch('/api/orders/items?arrivedToday=1').then((r) => r.json()),
      fetch('/api/orders/items?cancelled=1').then((r) => r.json()),
      fetch('/api/orders/items?outOfStockOrUnshipped=1').then((r) => r.json()),
      fetch('/api/orders/items?allArrived=1').then((r) => r.json()),
    ]);
    setPendingOrders(p); setConfirmedOrders(c);
    setTodayInbounds(ti); setAllInbounds(ai);
    setTodayArrivedItems(arrived);
    setCancelledItems(Array.isArray(cancelled) ? cancelled : []);
    setOutStockUnshippedItems(Array.isArray(ousu) ? ousu : []);
    setAllArrivedOrderItems(Array.isArray(allArrived) ? allArrived : []);
    setSelected(new Set());
  }, []);

  /* ── 토글 함수 ── */
  const toggleRow = useCallback((itemId: string) => {
    setSelected((s) => { const n = new Set(s); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });
  }, []);

  const toggleAllPending   = useCallback(() => makeToggleAll(filteredPending.map((r) => r.itemId),         selected, setSelected)(), [filteredPending,         selected]);
  const toggleAllConfirmed = useCallback(() => makeToggleAll(filteredConfirmed.map((r) => r.itemId),       selected, setSelected)(), [filteredConfirmed,       selected]);
  const toggleAllArrived   = useCallback(() => makeToggleAll(todayArrivedItems.map((it) => it.id),         selected, setSelected)(), [todayArrivedItems,       selected]);
  const toggleAllCancelled = useCallback(() => makeToggleAll(cancelledItems.map((it) => it.id),            selected, setSelected)(), [cancelledItems,          selected]);
  const toggleAllOusu      = useCallback(() => makeToggleAll(outStockUnshippedItems.map((it) => it.id),    selected, setSelected)(), [outStockUnshippedItems,  selected]);

  /* ── 통합 액션 함수 ── */

  // 주문확인: pending→confirmed + arrived/cancelled/ousu→confirmed 되돌리기
  const actionConfirm = async () => {
    const pendingOrderIds = Array.from(new Set(selPending.map((r) => r.orderId)));
    const revertItemIds   = [...selArrived, ...selCancelled, ...selOusu].map((it) => it.id);
    if (!pendingOrderIds.length && !revertItemIds.length) return;
    const label = `주문확인 처리 (접수 ${selPending.length}건 + 되돌리기 ${revertItemIds.length}건)`;
    if (!confirm(label + '\n진행하시겠습니까?')) return;

    if (pendingOrderIds.length)
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: pendingOrderIds, status: 'CONFIRMED' }) });
    if (revertItemIds.length)
      await fetch('/api/orders/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: revertItemIds, action: 'revertToConfirmed' }) });

    await refreshData();
  };

  // 입고: 모든 소스에서 arrivedAt 설정
  const actionArrive = async () => {
    const itemIds = [
      ...selPending.map((r) => r.itemId),
      ...selConfirmed.map((r) => r.itemId),
      ...selCancelled.map((it) => it.id),
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
    const updater = (o: Order[]) => o.map((ord) => ({ ...ord, items: ord.items.map((it) => itemIds.includes(it.id) ? { ...it, cancelLocked: lock } : it) }));
    setPendingOrders(updater); setConfirmedOrders(updater);
    setSelected((s) => { const n = new Set(s); itemIds.forEach((id) => n.delete(id)); return n; });
  };

  // 탭별 인라인 액션 (OrderTable에 넘기는 용)
  const markAsArrived    = actionArrive;
  const markAsOutOfStock = actionOutOfStock;
  const markAsUnshipped  = actionUnshipped;
  const confirmSelected  = actionConfirm;

  const handleDeleteInbound = async (id: string) => {
    await fetch(`/api/inbound/${id}`, { method: 'DELETE' });
    setTodayInbounds((p) => p.filter((i) => i.id !== id));
    setAllInbounds((p) => p.filter((i) => i.id !== id));
  };

  const handlePolicyUpdate = async () => {
    await fetch('/api/cancel-policy', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cancelPolicy) });
    alert('취소 정책 저장 완료');
  };

  /* 합계 (주문 시 저장된 price 기준) */
  const arrivedTotal   = todayArrivedItems.reduce((s, it) => s + it.price * it.quantity, 0);
  const cancelledTotal = cancelledItems.reduce((s, it) => s + it.price * it.quantity, 0);

  /* 일별입고/취소/품절미송 전체선택 체크 */
  const allArrivedSel = todayArrivedItems.length > 0 && todayArrivedItems.every((it) => selected.has(it.id));
  const someArrivedSel = todayArrivedItems.some((it) => selected.has(it.id));
  const allCancelledSel = cancelledItems.length > 0 && cancelledItems.every((it) => selected.has(it.id));
  const someCancelledSel = cancelledItems.some((it) => selected.has(it.id));
  const allOusuSel = outStockUnshippedItems.length > 0 && outStockUnshippedItems.every((it) => selected.has(it.id));
  const someOusuSel = outStockUnshippedItems.some((it) => selected.has(it.id));

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
              {t === '주문접수'  && pendingRows.length    > 0 && <span className="ml-1.5 text-xs bg-primary-600 text-white rounded-full px-1.5 py-0.5">{pendingRows.length}</span>}
              {t === '주문확인'  && confirmedRows.length  > 0 && <span className="ml-1.5 text-xs bg-green-600 text-white rounded-full px-1.5 py-0.5">{confirmedRows.length}</span>}
              {t === '취소 상품' && cancelledItems.length > 0 && <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">{cancelledItems.length}</span>}
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
                <input className="input max-w-xs text-sm" placeholder="아이디, 브랜드, 상품명..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                  {(['브랜드별', '전체'] as const).map((mode) => (
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
              {pendingViewMode === '브랜드별' ? (
                <BrandOrderView rows={filteredPending} />
              ) : (
                <OrderTable
                  rows={filteredPending} selected={selected} onToggleRow={toggleRow} onToggleAll={toggleAllPending}
                  actions={[
                    { label: '주문 확인으로 변경', color: 'bg-green-600', onClick: confirmSelected },
                    { label: '취소불가 잠금', color: 'bg-red-500', onClick: () => setCancelLock(true) },
                    { label: '취소 허용', color: 'bg-slate-500', onClick: () => setCancelLock(false) },
                  ]}
                />
              )}
            </div>
          )}

          {/* ── 주문확인 ── */}
          {tab === '주문확인' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <input className="input max-w-xs text-sm" placeholder="아이디, 브랜드, 상품명..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <p className="text-xs text-slate-400">입고 처리된 항목은 자동으로 일별입고로 이동됩니다.</p>
              </div>
              <OrderTable
                rows={filteredConfirmed} selected={selected} onToggleRow={toggleRow} onToggleAll={toggleAllConfirmed}
                actions={[
                  { label: '✓ 입고 처리', color: 'bg-emerald-600', onClick: markAsArrived },
                  { label: '품절 처리', color: 'bg-orange-500', onClick: markAsOutOfStock },
                  { label: '미송 처리', color: 'bg-purple-600', onClick: markAsUnshipped },
                  { label: '취소불가 잠금', color: 'bg-red-500', onClick: () => setCancelLock(true) },
                  { label: '취소 허용', color: 'bg-slate-500', onClick: () => setCancelLock(false) },
                ]}
              />
            </div>
          )}

          {/* ── 일별입고 ── */}
          {tab === '일별입고' && (
            <div className="space-y-6">
              <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                오늘 ({new Date().toLocaleDateString('ko-KR')}) 입고 내역
              </div>
              {todayArrivedItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">주문 상품 입고 ({todayArrivedItems.length}건)</h3>
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
                          {todayArrivedItems.map((it) => (
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
                              <ProductCells product={it.product} brand={it.product.brand || '-'} size={it.size || '-'} color={it.color || '-'} quantity={it.quantity} price={it.price} />
                              <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(it.order.createdAt)}</td>
                              <td className="px-3 py-3 text-xs text-emerald-600 font-medium whitespace-nowrap">
                                {new Date(it.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                          <tr>
                            <td colSpan={8} className="px-3 py-2">합계</td>
                            <td className="px-3 py-2 text-center">{todayArrivedItems.reduce((s, r) => s + r.quantity, 0)}</td>
                            <td colSpan={2} />
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
                <InboundSection inbounds={todayInbounds} onDelete={handleDeleteInbound} showForm />
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
              </div>

              {!inboundDateFilter && !inboundBrandFilter ? (
                <div className="text-center py-20 text-slate-400">
                  <div className="text-5xl mb-3">📅</div>
                  <p className="text-sm">날짜 또는 브랜드를 입력하면 입고 내역을 확인할 수 있습니다.</p>
                </div>
              ) : (() => {
                const supplierRows = filteredInbounds.flatMap((ib) =>
                  ib.items.map((item) => ({
                    key: `s-${item.id}`,
                    source: 'supplier' as const,
                    userName: ib.user?.name ?? '-',
                    identifier: ib.note ? `${ib.brand} · ${ib.note}` : ib.brand,
                    brand: item.product?.brand || ib.brand,
                    image: item.product?.images?.[0] ?? null,
                    name: item.product?.name || item.name,
                    size: item.size || '-',
                    color: item.color || '-',
                    quantity: item.quantity,
                    price: null as number | null,
                    arrivedAt: ib.arrivedAt,
                  }))
                );
                const orderRows = filteredAllArrived.map((it) => ({
                  key: `o-${it.id}`,
                  source: 'order' as const,
                  userName: it.order.user.name,
                  identifier: `#${it.order.id.slice(-6).toUpperCase()}`,
                  brand: it.product.brand || '-',
                  image: it.product.images?.[0] ?? null,
                  name: it.product.name,
                  size: it.size || '-',
                  color: it.color || '-',
                  quantity: it.quantity,
                  price: it.price,
                  arrivedAt: it.arrivedAt,
                }));
                const allRows = [...orderRows, ...supplierRows].sort(
                  (a, b) => new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime()
                );
                const totalQty = allRows.reduce((s, r) => s + r.quantity, 0);
                const totalAmt = allRows.reduce((s, r) => s + (r.price ?? 0) * r.quantity, 0);

                if (allRows.length === 0) return (
                  <div className="text-center py-12 text-slate-400 text-sm">해당 날짜의 입고 내역이 없습니다.</div>
                );

                return (
                  <div className="card overflow-hidden">
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
                            <th className="px-3 py-3 text-right">금액</th>
                            <th className="px-3 py-3 text-left">입고시간</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {allRows.map((row) => (
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
                                <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded whitespace-nowrap">{row.brand}</span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100">
                                  <Image src={row.image || 'https://placehold.co/40x40/EFF6FF/2563EB?text=상품'} alt={row.name} fill className="object-cover" />
                                </div>
                              </td>
                              <td className="px-3 py-3 font-medium text-slate-800 max-w-[160px]">
                                <span className="block truncate">{row.name}</span>
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500">{row.size}</td>
                              <td className="px-3 py-3 text-xs text-slate-500">{row.color}</td>
                              <td className="px-3 py-3 text-center font-semibold">{row.quantity}</td>
                              <td className="px-3 py-3 text-right font-semibold text-primary-700 whitespace-nowrap">
                                {row.price !== null ? formatPrice(row.price * row.quantity) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-3 py-3 text-xs font-medium whitespace-nowrap" style={{ color: row.source === 'order' ? '#059669' : '#2563eb' }}>
                                {new Date(row.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                          <tr>
                            <td colSpan={7} className="px-3 py-2">합계 ({allRows.length}건)</td>
                            <td className="px-3 py-2 text-center">{totalQty}</td>
                            <td className="px-3 py-2 text-right text-primary-700">{formatPrice(totalAmt)}</td>
                            <td />
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
                          <ProductHeaders hasEdit />
                          <th className="px-3 py-3 text-left">주문일</th>
                          <th className="px-3 py-3 text-left">처리일시</th>
                          <th className="px-3 py-3 text-left">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {outStockUnshippedItems.map((it) => {
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
                              <ProductCells product={it.product} brand={it.product.brand || '-'} size={it.size || '-'} color={it.color || '-'} quantity={it.quantity} price={it.price} />
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
                          <td colSpan={4} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 취소 상품 ── */}
          {tab === '취소 상품' && (
            <div>
              {cancelledItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">취소된 상품이 없습니다.</div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                      <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase">
                        <tr>
                          <th className="px-3 py-3">
                            <input type="checkbox" checked={allCancelledSel}
                              ref={(el) => { if (el) el.indeterminate = someCancelledSel && !allCancelledSel; }}
                              onChange={toggleAllCancelled} className="w-4 h-4 accent-primary-600" />
                          </th>
                          <th className="px-3 py-3 text-left">아이디</th>
                          <ProductHeaders hasEdit />
                          <th className="px-3 py-3 text-left">주문일</th>
                          <th className="px-3 py-3 text-left">취소일시</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {cancelledItems.map((it) => (
                          <tr key={it.id} className={`opacity-80 hover:bg-red-50/30 transition-colors ${selected.has(it.id) ? 'bg-primary-50/40 opacity-100' : ''}`}>
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
                            <ProductCells product={it.product} brand={it.product.brand || '-'} size={it.size || '-'} color={it.color || '-'} quantity={it.quantity} price={it.price} />
                            <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(it.order.createdAt)}</td>
                            <td className="px-3 py-3 text-xs text-red-400 whitespace-nowrap">{formatDateTime(it.cancelledAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                        <tr>
                          <td colSpan={8} className="px-3 py-2">합계</td>
                          <td className="px-3 py-2 text-center">{cancelledItems.reduce((s, r) => s + r.quantity, 0)}</td>
                          <td colSpan={2} />
                          <td className="px-3 py-2 text-right text-slate-400 line-through">{formatPrice(cancelledTotal)}</td>
                          <td colSpan={3} />
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
              selCancelled.length > 0 && `취소 ${selCancelled.length}건`,
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
    </div>
  );
}
