'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { formatPrice, getSaleLabel, DEALER_GRADE_ORDER } from '@/lib/utils';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 50;

type GradePrice = { grade: string; price: number };
type Product = {
  id: string; name: string; price: number; isActive: boolean;
  images: string[]; brand: string | null; productNumber: string | null; season: string | null;
  isOnSale: boolean; saleType: string | null; saleValue: number | null; isCarryOver: boolean;
  gender: string | null;
  remark: string | null;
  category: { name: string }; sizes: string[]; colors: string[];
  prices: GradePrice[];
};

export default function AdminProductsPage() {
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [editRemark, setEditRemark] = useState<{ id: string; value: string } | null>(null);

  // 일괄 SALE 모달
  const [bulkModal, setBulkModal]   = useState(false);
  const [bulkType, setBulkType]     = useState<'RATE' | 'AMOUNT'>('RATE');
  const [bulkValue, setBulkValue]   = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetch('/api/products?admin=1').then((r) => r.json()).then((d) => { setProducts(d); setLoading(false); });
  }, []);

  const [translateStatus, setTranslateStatus] = useState<{ total: number; translated: number } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateResult, setTranslateResult] = useState('');

  const loadTranslateStatus = () => {
    fetch('/api/admin/translate-products').then((r) => r.json()).then((d) => setTranslateStatus(d)).catch(() => {});
  };

  useEffect(() => { loadTranslateStatus(); }, []);

  const runBatchTranslate = async () => {
    setTranslating(true);
    setTranslateResult('');
    try {
      const res = await fetch('/api/admin/translate-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      const d = await res.json();
      setTranslateResult(`완료: ${d.done}개 번역됨, ${d.failed}개 실패 (전체 대상 ${d.total}개)`);
      loadTranslateStatus();
    } catch {
      setTranslateResult('번역 요청 중 오류가 발생했습니다.');
    }
    setTranslating(false);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !isActive }) });
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, isActive: !isActive } : p));
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('이 상품을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const saveRemark = async (id: string, remark: string) => {
    await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remark: remark.trim() || null }),
    });
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, remark: remark.trim() || null } : p));
    setEditRemark(null);
  };

  const brands = useMemo(() => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[], [products]);

  const filtered = useMemo(() => products.filter((p) => {
    const q = search.toLowerCase();
    const matchQ = !search || p.name.toLowerCase().includes(q) || (p.brand?.toLowerCase().includes(q) ?? false) || (p.productNumber?.toLowerCase().includes(q) ?? false);
    const matchB = !brandFilter || p.brand === brandFilter;
    return matchQ && matchB;
  }), [products, search, brandFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => { setPage(1); }, [search, brandFilter]);
  useEffect(() => { setPage((p) => Math.min(p, totalPages)); }, [totalPages]);

  // 안전을 위해 "전체 선택"은 현재 페이지에 보이는 항목만 대상으로 한다.
  const allSelected = paged.length > 0 && paged.every((p) => selected.has(p.id));

  const toggleAll = () => {
    if (allSelected) setSelected((prev) => { const next = new Set(prev); paged.forEach((p) => next.delete(p.id)); return next; });
    else setSelected((prev) => { const next = new Set(prev); paged.forEach((p) => next.add(p.id)); return next; });
  };

  const handleBulkSale = async () => {
    if (!bulkValue || Number(bulkValue) <= 0) { alert('할인 값을 입력해주세요.'); return; }
    setBulkLoading(true);
    const productIds = Array.from(selected);
    await fetch('/api/products/bulk-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, saleType: bulkType, saleValue: Number(bulkValue) }),
    });
    setProducts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, isOnSale: true, saleType: bulkType, saleValue: Number(bulkValue) } : p));
    setBulkModal(false); setBulkValue(''); setSelected(new Set());
    setBulkLoading(false);
  };

  const handleBulkRemoveSale = async () => {
    if (!confirm(`선택된 ${selected.size}개 상품의 SALE을 해제하시겠습니까?`)) return;
    const productIds = Array.from(selected);
    await fetch('/api/products/bulk-sale', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    });
    setProducts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, isOnSale: false, saleType: null, saleValue: null } : p));
    setSelected(new Set());
  };

  const handleBulkCarryOver = async () => {
    if (!confirm(`선택된 ${selected.size}개 상품을 이월상품으로 적용하시겠습니까?`)) return;
    const productIds = Array.from(selected);
    await fetch('/api/products/bulk-carryover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    });
    setProducts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, isCarryOver: true } : p));
    setSelected(new Set());
  };

  const handleBulkRemoveCarryOver = async () => {
    if (!confirm(`선택된 ${selected.size}개 상품의 이월상품을 해제하시겠습니까?`)) return;
    const productIds = Array.from(selected);
    await fetch('/api/products/bulk-carryover', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    });
    setProducts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, isCarryOver: false } : p));
    setSelected(new Set());
  };

  const handleBulkSetActive = async (isActive: boolean) => {
    const productIds = Array.from(selected);
    if (!confirm(`선택된 ${productIds.length}개 상품을 ${isActive ? '판매중으로 전환' : '숨김 처리'}하시겠습니까?`)) return;
    await fetch('/api/products/bulk-active', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, isActive }),
    });
    setProducts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, isActive } : p));
    setSelected(new Set());
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">상품 관리</h1>
        <Link href="/admin/products/bulk" className="btn-outline text-sm">일괄 등록</Link>
        <Link href="/admin/products/new" className="btn-primary">+ 상품 등록</Link>
      </div>

      {/* 자동 번역 상태 + 일괄 번역 */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex-wrap">
        <span className="text-sm text-slate-600">
          🌐 번역 완료 {translateStatus ? `${translateStatus.translated} / ${translateStatus.total}` : '-'}
        </span>
        <button onClick={runBatchTranslate} disabled={translating}
          className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
          {translating ? '번역 중...' : '미번역 상품/카테고리 일괄 번역'}
        </button>
        {translateResult && <span className="text-xs text-slate-500">{translateResult}</span>}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input className="input max-w-xs text-sm" placeholder="상품명, 브랜드, 제품번호 검색..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input text-sm w-auto" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="">전체 브랜드</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* 일괄 SALE 액션 바 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary-50 border border-primary-200 rounded-xl">
          <span className="text-sm font-medium text-primary-800">{selected.size}개 선택됨</span>
          <button onClick={() => setBulkModal(true)} className="text-sm bg-red-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-600">SALE 적용</button>
          <button onClick={handleBulkRemoveSale} className="text-sm border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-medium hover:bg-slate-100">SALE 해제</button>
          <button onClick={handleBulkCarryOver} className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600">이월 적용</button>
          <button onClick={handleBulkRemoveCarryOver} className="text-sm border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-medium hover:bg-slate-100">이월 해제</button>
          <button onClick={() => handleBulkSetActive(false)} className="text-sm bg-slate-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-slate-600">일괄 숨김</button>
          <button onClick={() => handleBulkSetActive(true)} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700">일괄 판매중으로</button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-slate-600 ml-auto">선택 해제</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-xs text-slate-400">{filtered.length}개 상품</p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-xs text-slate-400 uppercase">
                    <th className="px-3 py-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-primary-600 cursor-pointer" />
                    </th>
                    <th className="px-3 py-3">관리</th>
                    <th className="px-3 py-3 text-center">상태</th>
                    <th className="px-3 py-3">사진</th>
                    <th className="px-3 py-3">브랜드</th>
                    <th className="px-3 py-3">상품명</th>
                    <th className="px-3 py-3">제품번호</th>
                    <th className="px-3 py-3">시즌</th>
                    <th className="px-3 py-3">성별</th>
                    <th className="px-3 py-3">등급별 가격</th>
                    <th className="px-3 py-3">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((product) => (
                    <tr key={product.id} className={`text-slate-700 hover:bg-slate-50 ${selected.has(product.id) ? 'bg-primary-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelect(product.id)} className="w-4 h-4 accent-primary-600 cursor-pointer" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Link href={`/admin/products/${product.id}`} className="text-xs text-primary-600 hover:underline whitespace-nowrap">수정</Link>
                          <button onClick={() => deleteProduct(product.id)} className="text-xs text-red-400 hover:underline whitespace-nowrap">삭제</button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleActive(product.id, product.isActive)}
                          className={`badge text-xs ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {product.isActive ? '판매중' : '숨김'}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-primary-50 flex-shrink-0">
                          <img src={product.images[0] || 'https://placehold.co/48x48'} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded">{product.brand || '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800 max-w-[140px] truncate" title={product.name}>{product.name}</p>
                        {product.isOnSale && (
                          <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                            SALE {getSaleLabel(product.saleType, product.saleValue)}
                          </span>
                        )}
                        {product.isCarryOver && (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-1">
                            이월
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">{product.productNumber || '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{product.season || '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{product.gender || '-'}</td>
                      <td className="px-3 py-2">
                        {product.prices.length > 0 ? (
                          <div className="space-y-0.5">
                            {DEALER_GRADE_ORDER.map((g) => {
                              const gp = product.prices.find((p) => p.grade === g);
                              if (!gp) return null;
                              return (
                                <div key={g} className="flex gap-1 items-center text-xs">
                                  <span className="text-slate-400 w-10 shrink-0">{g === 'REGULAR' ? '일반' : g === 'SILVER' ? '실버' : g === 'GOLD' ? '골드' : 'VIP'}</span>
                                  <span className="font-medium text-slate-700">{gp.price.toLocaleString()}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">미설정</span>
                        )}
                      </td>
                      <td className="px-3 py-2 min-w-[140px]">
                        {editRemark?.id === product.id ? (
                          <input
                            autoFocus
                            className="input text-xs w-full py-1 px-2"
                            value={editRemark.value}
                            onChange={(e) => setEditRemark({ id: product.id, value: e.target.value })}
                            onBlur={() => saveRemark(product.id, editRemark.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRemark(product.id, editRemark.value);
                              if (e.key === 'Escape') setEditRemark(null);
                            }}
                            maxLength={100}
                          />
                        ) : (
                          <button
                            onClick={() => setEditRemark({ id: product.id, value: product.remark || '' })}
                            className="text-left w-full group"
                            title="클릭하여 비고 편집"
                          >
                            {product.remark ? (
                              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium max-w-[140px] block truncate">
                                {product.remark}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300 group-hover:text-slate-400">+ 비고 입력</span>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} className="text-center py-12 text-slate-400">상품이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}

      {/* 일괄 SALE 모달 */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800">일괄 SALE 적용</h3>
            <p className="text-sm text-slate-500">선택된 <strong>{selected.size}개</strong> 상품에 동일 할인 정책을 적용합니다.</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">할인 방식</label>
              <select className="input text-sm w-full" value={bulkType} onChange={(e) => setBulkType(e.target.value as any)}>
                <option value="RATE">할인율 (%)</option>
                <option value="AMOUNT">할인 금액 (₩)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{bulkType === 'RATE' ? '할인율 (%)' : '할인 금액 (₩)'}</label>
              <input type="number" className="input text-sm w-full" placeholder={bulkType === 'RATE' ? '30' : '1000'}
                value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleBulkSale} disabled={bulkLoading} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {bulkLoading ? '적용 중...' : 'SALE 적용'}
              </button>
              <button onClick={() => { setBulkModal(false); setBulkValue(''); }} className="btn-outline text-sm px-4">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
