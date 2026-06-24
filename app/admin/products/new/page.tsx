'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandCombobox } from '@/components/BrandCombobox';
import { DEALER_GRADE_LABELS, DEALER_GRADE_ORDER, calcFinalPrice } from '@/lib/utils';

const EMPTY_PRICES = DEALER_GRADE_ORDER.reduce((acc, g) => ({ ...acc, [g]: '' }), {} as Record<string, string>);

export default function NewProductPage() {
  const router = useRouter();
  const imgRef     = useRef<HTMLInputElement>(null);
  const sizeImgRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: '', description: '', stock: '',
    categoryId: '', brand: '', productNumber: '', material: '', gender: '공용',
    productType: '', season: '', remark: '',
    isOnSale: false,
    sizes: [] as string[], colors: [] as string[],
  });
  const [prices, setPrices]         = useState<Record<string, string>>(EMPTY_PRICES);
  // SALE 상태: 할인율과 할인금액 양쪽 표시, 마지막 편집 기준으로 저장
  const [saleType, setSaleType]     = useState<'RATE' | 'AMOUNT'>('RATE');
  const [saleRateStr, setSaleRateStr]     = useState('');
  const [saleAmountStr, setSaleAmountStr] = useState('');

  const [images, setImages]         = useState<string[]>([]);
  const [sizeImages, setSizeImages] = useState<string[]>([]);
  const [sizeInput, setSizeInput]   = useState('');
  const [colorInput, setColorInput] = useState('');
  const [loading, setLoading]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [variantStocks, setVariantStocks] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/products/categories').then((r) => r.json()).then(setCategories);
  }, []);

  // 색상/사이즈 변경 시 재고 그리드 동기화
  useEffect(() => {
    setVariantStocks((prev) => {
      if (form.colors.length === 0 || form.sizes.length === 0) return prev;
      const next: Record<string, string> = {};
      for (const color of form.colors) {
        for (const size of form.sizes) {
          const key = `${color}::${size}`;
          next[key] = prev[key] ?? '0';
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.colors.join(','), form.sizes.join(',')]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const regularPrice = Number(prices.REGULAR) || 0;

  const handleRateChange = (val: string) => {
    setSaleRateStr(val);
    setSaleType('RATE');
    if (val && regularPrice > 0) {
      const amt = Math.round(regularPrice * Number(val) / 100);
      setSaleAmountStr(String(amt));
    }
  };

  const handleAmountChange = (val: string) => {
    setSaleAmountStr(val);
    setSaleType('AMOUNT');
    if (val && regularPrice > 0) {
      const rate = Math.round(Number(val) / regularPrice * 100);
      setSaleRateStr(String(rate));
    }
  };

  const uploadFiles = async (files: FileList | null, target: 'main' | 'size') => {
    if (!files || !files.length) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const { urls } = await res.json();
    if (target === 'main') setImages((p) => [...p, ...urls]);
    else setSizeImages((p) => [...p, ...urls]);
    setUploading(false);
  };

  const addSize  = () => { if (sizeInput  && !form.sizes.includes(sizeInput))   { set('sizes',  [...form.sizes,  sizeInput]);  setSizeInput('');  } };
  const addColor = () => { if (colorInput && !form.colors.includes(colorInput)) { set('colors', [...form.colors, colorInput]); setColorInput(''); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const gradePrices = DEALER_GRADE_ORDER
      .filter((g) => prices[g] !== '')
      .map((g)  => ({ grade: g, price: Number(prices[g]) }));

    const saleValue = saleType === 'RATE' ? Number(saleRateStr) : Number(saleAmountStr);

    const variants = Object.entries(variantStocks).map(([key, stock]) => {
      const [color, size] = key.split('::');
      return { color, size, stock: Number(stock || 0) };
    });

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        stock:     Number(form.stock),
        isOnSale:  form.isOnSale,
        saleType:  form.isOnSale && saleValue ? saleType : null,
        saleValue: form.isOnSale && saleValue ? saleValue : null,
        images:    images.length ? images : ['https://placehold.co/400x400/EFF6FF/2563EB?text=상품'],
        sizeImages,
        prices:    gradePrices,
        variants,
      }),
    });
    if (res.ok) router.push('/admin/products');
    else { alert('상품 등록에 실패했습니다.'); setLoading(false); }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">상품 등록</h1>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 기본 정보 */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">기본 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">상품명 *</label>
              <input className="input text-sm" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">브랜드 (Maker)</label>
              <BrandCombobox value={form.brand} onChange={(v) => set('brand', v)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">제품번호</label>
              <input className="input text-sm" placeholder="예: DIGRN61CVX" value={form.productNumber} onChange={(e) => set('productNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">시즌</label>
              <input className="input text-sm" placeholder="예: 여름1차" value={form.season} onChange={(e) => set('season', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">재질</label>
              <input className="input text-sm" placeholder="예: 면" value={form.material} onChange={(e) => set('material', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">성별</label>
              <select className="input text-sm" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="공용">공용</option>
                <option value="남아">남아</option>
                <option value="여아">여아</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">종류</label>
              <input className="input text-sm" placeholder="예: 외투/조끼" value={form.productType} onChange={(e) => set('productType', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">카테고리 *</label>
              <select className="input text-sm" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
                <option value="">카테고리 선택</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">공지사항/설명</label>
            <textarea className="input text-sm min-h-20 resize-none" placeholder="색상은 모니터에 따라 차이날 수 있습니다." value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">비고 (품절·미송 등 내부 메모 — 회원에게 표시됨)</label>
            <input className="input text-sm" placeholder="예: 품절 / 미송 대기 중 / 재입고 예정" value={form.remark} onChange={(e) => set('remark', e.target.value)} maxLength={200} />
          </div>
        </div>

        {/* 등급별 가격 + SALE */}
        <div className="card p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">등급별 가격 / SALE</h2>

          {/* 등급별 가격 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-3">등급별 기본 가격</p>
            <div className="grid grid-cols-2 gap-3">
              {DEALER_GRADE_ORDER.map((grade) => {
                const base  = Number(prices[grade]);
                const final = base && form.isOnSale
                  ? calcFinalPrice(base, true, saleType, saleType === 'RATE' ? Number(saleRateStr) : Number(saleAmountStr))
                  : null;
                return (
                  <div key={grade}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {DEALER_GRADE_LABELS[grade]}
                      {final !== null && final !== base && (
                        <span className="ml-2 text-red-500 font-semibold">→ {final.toLocaleString()}원</span>
                      )}
                    </label>
                    <input
                      type="number" className="input text-sm" placeholder="가격 입력 (₩)"
                      value={prices[grade]}
                      onChange={(e) => {
                        const newPrices = { ...prices, [grade]: e.target.value };
                        setPrices(newPrices);
                        // REGULAR 가격 변경 시 SALE 금액 재계산
                        if (grade === 'REGULAR' && form.isOnSale) {
                          const rp = Number(e.target.value);
                          if (rp > 0 && saleType === 'RATE' && saleRateStr) {
                            setSaleAmountStr(String(Math.round(rp * Number(saleRateStr) / 100)));
                          } else if (rp > 0 && saleType === 'AMOUNT' && saleAmountStr) {
                            setSaleRateStr(String(Math.round(Number(saleAmountStr) / rp * 100)));
                          }
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* SALE */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isOnSale} onChange={(e) => set('isOnSale', e.target.checked)} className="w-4 h-4 accent-red-500" />
              <span className="text-sm font-semibold text-slate-700">SALE 적용</span>
            </label>

            {form.isOnSale && (
              <div className="pl-6 space-y-3">
                <div className="flex items-end gap-4 flex-wrap">
                  {/* 할인율 */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">할인율 (%)</label>
                    <input
                      type="number" min="1" max="99"
                      className={`input text-sm w-28 ${saleType === 'RATE' ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                      placeholder="30"
                      value={saleRateStr}
                      onChange={(e) => handleRateChange(e.target.value)}
                    />
                  </div>
                  <div className="text-slate-300 pb-2 text-lg">↔</div>
                  {/* 할인금액 */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">할인금액 (₩)</label>
                    <input
                      type="number" min="0"
                      className={`input text-sm w-32 ${saleType === 'AMOUNT' ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                      placeholder="3,000"
                      value={saleAmountStr}
                      onChange={(e) => handleAmountChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* 등급별 적용 결과 미리보기 */}
                {(saleRateStr || saleAmountStr) && (
                  <div className="bg-red-50 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-red-600 mb-2">SALE 적용 결과 미리보기</p>
                    {DEALER_GRADE_ORDER.map((grade) => {
                      const base = Number(prices[grade]);
                      if (!base) return null;
                      const sv = saleType === 'RATE' ? Number(saleRateStr) : Number(saleAmountStr);
                      const final = calcFinalPrice(base, true, saleType, sv);
                      const diff  = base - final;
                      return (
                        <div key={grade} className="flex items-center gap-2 text-xs">
                          <span className="w-24 text-slate-500">{DEALER_GRADE_LABELS[grade]}</span>
                          <span className="text-slate-400 line-through">{base.toLocaleString()}원</span>
                          <span className="font-bold text-red-600">{final.toLocaleString()}원</span>
                          <span className="text-slate-400">(-{diff.toLocaleString()}원)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-400">
                  저장 기준: {saleType === 'RATE' ? `할인율 ${saleRateStr || 0}%` : `할인금액 ${Number(saleAmountStr || 0).toLocaleString()}원`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 사이즈 / 색상 */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">사이즈 / 색상</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">사이즈</label>
            <div className="flex gap-2 mb-2">
              <input className="input text-sm flex-1" placeholder="S호" value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())} />
              <button type="button" onClick={addSize} className="btn-outline text-sm px-3">추가</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.sizes.map((s) => (
                <span key={s} className="badge bg-primary-100 text-primary-700 gap-1 text-xs">
                  {s}<button type="button" onClick={() => set('sizes', form.sizes.filter((x) => x !== s))} className="ml-1">×</button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">색상</label>
            <div className="flex gap-2 mb-2">
              <input className="input text-sm flex-1" placeholder="화이트" value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())} />
              <button type="button" onClick={addColor} className="btn-outline text-sm px-3">추가</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.colors.map((c) => (
                <span key={c} className="badge bg-slate-100 text-slate-600 text-xs">
                  {c}<button type="button" onClick={() => set('colors', form.colors.filter((x) => x !== c))} className="ml-1">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* 재고 그리드 */}
          {form.colors.length > 0 && form.sizes.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">재고 (색상 × 사이즈)</label>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-slate-200 px-3 py-2 bg-slate-50 text-slate-500 font-medium text-left min-w-24">색상 \ 사이즈</th>
                      {form.sizes.map((size) => (
                        <th key={size} className="border border-slate-200 px-3 py-2 bg-slate-50 text-slate-600 font-medium min-w-20 text-center">{size}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.colors.map((color) => (
                      <tr key={color}>
                        <td className="border border-slate-200 px-3 py-2 bg-slate-50 text-slate-600 font-medium whitespace-nowrap">{color}</td>
                        {form.sizes.map((size) => {
                          const key = `${color}::${size}`;
                          return (
                            <td key={size} className="border border-slate-200 p-1 text-center">
                              <input
                                type="number" min="0"
                                className="w-16 text-center text-sm focus:outline-none focus:bg-primary-50 rounded p-1"
                                value={variantStocks[key] ?? '0'}
                                onChange={(e) => setVariantStocks((prev) => ({ ...prev, [key]: e.target.value }))}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">색상과 사이즈를 모두 추가하면 재고 입력 표가 나타납니다.</p>
          )}
        </div>

        {/* 이미지 */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">이미지</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">상품 사진</label>
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files, 'main')} />
            <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading} className="btn-outline text-sm mb-3">{uploading ? '업로드 중...' : '사진 업로드'}</button>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xl">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">사이즈 상세 이미지</label>
            <input ref={sizeImgRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files, 'size')} />
            <button type="button" onClick={() => sizeImgRef.current?.click()} disabled={uploading} className="btn-outline text-sm mb-3">{uploading ? '업로드 중...' : '사이즈 상세 사진 업로드'}</button>
            {sizeImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sizeImages.map((img, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setSizeImages((p) => p.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xl">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading || uploading} className="btn-primary flex-1">{loading ? '등록 중...' : '상품 등록'}</button>
          <button type="button" onClick={() => router.back()} className="btn-outline">취소</button>
        </div>
      </form>
    </div>
  );
}
