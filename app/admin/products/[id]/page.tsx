'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BrandCombobox } from '@/components/BrandCombobox';
import { DEALER_GRADE_LABELS, DEALER_GRADE_ORDER, calcFinalPrice } from '@/lib/utils';
import { CATEGORY_GROUPS } from '@/lib/categoryGroups';

const EMPTY_PRICES = DEALER_GRADE_ORDER.reduce((acc, g) => ({ ...acc, [g]: '' }), {} as Record<string, string>);
const MAX_MAIN_IMAGES = 10;

function uploadFilesXHR(files: File[], onProgress: (pct: number) => void): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).urls); }
        catch { reject(new Error('업로드 응답 처리 실패')); }
      } else {
        reject(new Error(`업로드 실패 (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('업로드 중 네트워크 오류'));
    xhr.send(fd);
  });
}

const MAIN_CATEGORY_GROUPS = [
  { key: 'clothing' as const, label: '👗 의류', slugs: CATEGORY_GROUPS.find((g) => g.key === 'clothing')!.slugs as readonly string[] },
  { key: 'item'     as const, label: '👟 아이템', slugs: CATEGORY_GROUPS.find((g) => g.key === 'item')!.slugs as readonly string[] },
];
const SIZE_CATEGORY_SLUGS = CATEGORY_GROUPS.find((g) => g.key === 'size')!.slugs as readonly string[];

const TRANS_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ภาษาไทย' },
  { code: 'ru', label: 'Русский' },
  { code: 'mn', label: 'Монгол' },
  { code: 'es', label: 'Español' },
] as const;
type TransLang = typeof TRANS_LANGS[number]['code'];
type TransFields = { name: string; description: string; gender: string; season: string; colors: string };
const EMPTY_TRANS: TransFields = { name: '', description: '', gender: '', season: '', colors: '' };

function buildTranslationsFromProduct(product: any): Record<TransLang, TransFields> {
  return TRANS_LANGS.reduce((acc, l) => ({
    ...acc,
    [l.code]: {
      name:        product[`name_${l.code}`] || '',
      description: product[`description_${l.code}`] || '',
      gender:      product[`gender_${l.code}`] || '',
      season:      product[`season_${l.code}`] || '',
      colors:      (product[`colors_${l.code}`] || []).join(', '),
    },
  }), {} as Record<TransLang, TransFields>);
}

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const imgRef      = useRef<HTMLInputElement>(null);
  const sizeImgRef  = useRef<HTMLInputElement>(null);
  const colorImgRef = useRef<HTMLInputElement>(null);
  const pendingColorRef = useRef<string>('');

  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [categoryGroup, setCategoryGroup] = useState<'clothing' | 'item' | ''>('');
  const [form, setForm] = useState({
    name: '', description: '',
    categoryId: '', sizeCategoryId: '', brand: '', productNumber: '', gender: '공용',
    season: '', remark: '',
    isOnSale: false,
    isCarryOver: false,
    sizes: [] as string[], colors: [] as string[], isActive: true,
  });
  const [prices, setPrices]               = useState<Record<string, string>>(EMPTY_PRICES);
  const [saleType, setSaleType]           = useState<'RATE' | 'AMOUNT'>('RATE');
  const [saleRateStr, setSaleRateStr]     = useState('');
  const [saleAmountStr, setSaleAmountStr] = useState('');
  const [images, setImages]         = useState<string[]>([]);
  const [sizeImages, setSizeImages] = useState<string[]>([]);
  const [colorImages, setColorImages] = useState<Record<string, string>>({});
  const [colorPicker, setColorPicker] = useState<string | null>(null);
  const [sizeInput, setSizeInput]   = useState('');
  const [colorInput, setColorInput] = useState('');
  const [loading, setLoading]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fetching, setFetching]     = useState(true);
  const [variantOutOfStock, setVariantOutOfStock] = useState<Record<string, boolean>>({});
  const [sizeExtraPrices, setSizeExtraPrices]   = useState<Record<string, string>>({});

  const [translations, setTranslations] = useState<Record<TransLang, TransFields>>(
    () => TRANS_LANGS.reduce((acc, l) => ({ ...acc, [l.code]: EMPTY_TRANS }), {} as Record<TransLang, TransFields>)
  );
  const [activeTransLang, setActiveTransLang] = useState<TransLang>('en');
  const [retranslating, setRetranslating]     = useState(false);
  const [translatedAt, setTranslatedAt]       = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products/categories').then((r) => r.json()),
      fetch(`/api/products/${id}`).then((r) => r.json()),
    ]).then(([cats, product]) => {
      setCategories(cats);
      const currentGroup = MAIN_CATEGORY_GROUPS.find((g) => g.slugs.includes(product.category?.slug))?.key ?? '';
      setCategoryGroup(currentGroup);
      setForm({
        name:          product.name || '',
        description:   product.description || '',
        categoryId:    product.categoryId || '',
        sizeCategoryId: product.sizeCategoryId || '',
        brand:         product.brand || '',
        productNumber: product.productNumber || '',
        gender:        product.gender || '공용',
        season:        product.season || '',
        isOnSale:      product.isOnSale || false,
        isCarryOver:   product.isCarryOver || false,
        sizes:         product.sizes || [],
        colors:        product.colors || [],
        isActive:      product.isActive !== false,
        remark:        product.remark || '',
      });

      // 등급별 가격 복원
      const priceMap = { ...EMPTY_PRICES };
      (product.prices || []).forEach((p: { grade: string; price: number }) => {
        priceMap[p.grade] = String(p.price);
      });
      setPrices(priceMap);

      // SALE 상태 복원
      if (product.isOnSale && product.saleType && product.saleValue) {
        const regPrice = (product.prices || []).find((p: any) => p.grade === 'REGULAR')?.price ?? 0;
        if (product.saleType === 'RATE') {
          setSaleType('RATE');
          setSaleRateStr(String(product.saleValue));
          if (regPrice > 0) setSaleAmountStr(String(Math.round(regPrice * product.saleValue / 100)));
        } else {
          setSaleType('AMOUNT');
          setSaleAmountStr(String(product.saleValue));
          if (regPrice > 0) setSaleRateStr(String(Math.round(product.saleValue / regPrice * 100)));
        }
      }

      setImages(product.images || []);
      setSizeImages(product.sizeImages || []);
      setColorImages(
        Object.fromEntries((product.colorImages || []).map((c: { color: string; imageUrl: string }) => [c.color, c.imageUrl]))
      );

      // 기존 사이즈별 추가 가격 복원
      if (product.sizeExtraPrices) {
        const ep: Record<string, string> = {};
        Object.entries(product.sizeExtraPrices as Record<string, number>).forEach(([k, v]) => {
          ep[k] = String(v);
        });
        setSizeExtraPrices(ep);
      }

      // 기존 variants 불러오기
      const variantMap: Record<string, boolean> = {};
      (product.variants || []).forEach((v: { color: string; size: string; isOutOfStock: boolean }) => {
        variantMap[`${v.color}::${v.size}`] = Boolean(v.isOutOfStock);
      });
      setVariantOutOfStock(variantMap);

      setTranslations(buildTranslationsFromProduct(product));
      setTranslatedAt(product.translatedAt || null);

      setFetching(false);
    });
  }, [id]);

  const setTrans = (lang: TransLang, key: keyof TransFields, value: string) =>
    setTranslations((prev) => ({ ...prev, [lang]: { ...prev[lang], [key]: value } }));

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const regularPrice = Number(prices.REGULAR) || 0;

  const activeGroupSlugs = categoryGroup ? MAIN_CATEGORY_GROUPS.find((g) => g.key === categoryGroup)!.slugs : [];
  const subCategories  = activeGroupSlugs.map((slug) => categories.find((c) => c.slug === slug)).filter(Boolean) as { id: string; name: string; slug: string }[];
  const sizeCategories = SIZE_CATEGORY_SLUGS.map((slug) => categories.find((c) => c.slug === slug)).filter(Boolean) as { id: string; name: string; slug: string }[];

  // 색상/사이즈 변경 시 품절 그리드 동기화
  useEffect(() => {
    setVariantOutOfStock((prev) => {
      if (form.colors.length === 0 || form.sizes.length === 0) return prev;
      const next: Record<string, boolean> = {};
      for (const color of form.colors) {
        for (const size of form.sizes) {
          const key = `${color}::${size}`;
          next[key] = prev[key] ?? false;
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.colors.join(','), form.sizes.join(',')]);

  const handleRateChange = (val: string) => {
    setSaleRateStr(val);
    setSaleType('RATE');
    if (val && regularPrice > 0) {
      setSaleAmountStr(String(Math.round(regularPrice * Number(val) / 100)));
    }
  };

  const handleAmountChange = (val: string) => {
    setSaleAmountStr(val);
    setSaleType('AMOUNT');
    if (val && regularPrice > 0) {
      setSaleRateStr(String(Math.round(Number(val) / regularPrice * 100)));
    }
  };

  const uploadFiles = async (files: FileList | null, target: 'main' | 'size') => {
    if (!files || !files.length) return;
    let fileList = Array.from(files);

    if (target === 'main') {
      const remaining = MAX_MAIN_IMAGES - images.length;
      if (remaining <= 0) { alert(`상품 사진은 최대 ${MAX_MAIN_IMAGES}장까지 업로드할 수 있습니다.`); return; }
      if (fileList.length > remaining) {
        alert(`상품 사진은 최대 ${MAX_MAIN_IMAGES}장까지 업로드할 수 있어 앞의 ${remaining}장만 업로드합니다.`);
        fileList = fileList.slice(0, remaining);
      }
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const urls = await uploadFilesXHR(fileList, setUploadProgress);
      if (target === 'main') setImages((p) => [...p, ...urls]);
      else setSizeImages((p) => [...p, ...urls]);
    } catch (e: any) {
      alert(e.message || '업로드 실패');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const addSize = () => {
    if (sizeInput && !form.sizes.includes(sizeInput)) {
      set('sizes', [...form.sizes, sizeInput]);
      setSizeInput('');
    }
  };
  const removeSize = (s: string) => {
    set('sizes', form.sizes.filter((x) => x !== s));
    setSizeExtraPrices((prev) => { const next = { ...prev }; delete next[s]; return next; });
  };
  const addColor = () => { if (colorInput && !form.colors.includes(colorInput)) { set('colors', [...form.colors, colorInput]); setColorInput(''); } };
  const removeColor = (c: string) => {
    set('colors', form.colors.filter((x) => x !== c));
    setColorImages((prev) => { const next = { ...prev }; delete next[c]; return next; });
  };

  const uploadColorImage = async (file: File, color: string) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const urls = await uploadFilesXHR([file], setUploadProgress);
      if (urls[0]) setColorImages((prev) => ({ ...prev, [color]: urls[0] }));
    } catch (e: any) {
      alert(e.message || '업로드 실패');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const gradePrices = DEALER_GRADE_ORDER
      .filter((g) => prices[g] !== '')
      .map((g)  => ({ grade: g, price: Number(prices[g]) }));

    const saleValue = saleType === 'RATE' ? Number(saleRateStr) : Number(saleAmountStr);
    // 이월상품도 SALE과 동일한 할인율/할인금액 입력을 공유 — 값이 있으면 SALE 체크 여부와 무관하게 할인 적용
    const effectiveIsOnSale = form.isOnSale || (form.isCarryOver && Boolean(saleValue));

    const variants = Object.entries(variantOutOfStock).map(([key, isOutOfStock]) => {
      const [color, size] = key.split('::');
      return { color, size, isOutOfStock };
    });

    const extraPricesObj = Object.fromEntries(
      Object.entries(sizeExtraPrices)
        .filter(([, v]) => v !== '' && Number(v) > 0)
        .map(([k, v]) => [k, Number(v)])
    );

    const translationFields = TRANS_LANGS.reduce((acc, l) => {
      const t = translations[l.code];
      acc[`name_${l.code}`]        = t.name || null;
      acc[`description_${l.code}`] = t.description || null;
      acc[`gender_${l.code}`]      = t.gender || null;
      acc[`season_${l.code}`]      = t.season || null;
      acc[`colors_${l.code}`]      = t.colors.split(',').map((s) => s.trim()).filter(Boolean);
      return acc;
    }, {} as Record<string, any>);

    const res = await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        isOnSale:        effectiveIsOnSale,
        isCarryOver:     form.isCarryOver,
        saleType:        effectiveIsOnSale && saleValue ? saleType : null,
        saleValue:       effectiveIsOnSale && saleValue ? saleValue : null,
        images:          images.length ? images : ['https://placehold.co/400x400/EFF6FF/2563EB?text=상품'],
        sizeImages,
        prices:          gradePrices,
        variants,
        colorImages:     Object.entries(colorImages).map(([color, imageUrl]) => ({ color, imageUrl })),
        sizeExtraPrices: Object.keys(extraPricesObj).length ? extraPricesObj : null,
        ...translationFields,
      }),
    });
    if (res.ok) router.push('/admin/products');
    else {
      const errData = await res.json().catch(() => ({}));
      alert(`상품 수정에 실패했습니다.\n${errData?.error || res.status}`);
      setLoading(false);
    }
  };

  const handleRetranslate = async () => {
    setRetranslating(true);
    try {
      const res = await fetch(`/api/products/${id}/translate`, { method: 'POST' });
      if (res.ok) {
        const product = await res.json();
        setTranslations(buildTranslationsFromProduct(product));
        setTranslatedAt(product.translatedAt || null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`재번역에 실패했습니다.\n${err?.error || res.status}`);
      }
    } finally {
      setRetranslating(false);
    }
  };

  if (fetching) return <div className="text-center py-16 text-slate-400">로딩 중...</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">상품 수정</h1>
        <button type="button" onClick={() => router.push('/admin/products')} className="btn-outline text-sm">← 목록으로</button>
      </div>
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
              <input className="input text-sm" value={form.productNumber} onChange={(e) => set('productNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">시즌</label>
              <input className="input text-sm" placeholder="예: 여름1차" value={form.season} onChange={(e) => set('season', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">카테고리 대분류 *</label>
              <select className="input text-sm" value={categoryGroup}
                onChange={(e) => { setCategoryGroup(e.target.value as 'clothing' | 'item' | ''); set('categoryId', ''); }} required>
                <option value="">대분류 선택</option>
                {MAIN_CATEGORY_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">카테고리 소분류 *</label>
              <select className="input text-sm" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}
                required disabled={!categoryGroup}>
                <option value="">{categoryGroup ? '소분류 선택' : '대분류를 먼저 선택하세요'}</option>
                {subCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">사이즈 카테고리</label>
              <select className="input text-sm" value={form.sizeCategoryId} onChange={(e) => set('sizeCategoryId', e.target.value)}>
                <option value="">선택 안 함</option>
                {sizeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">공지사항/설명</label>
            <textarea className="input text-sm min-h-20 resize-none" value={form.description} onChange={(e) => set('description', e.target.value)} />
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
                const final = base && (form.isOnSale || form.isCarryOver)
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
                        if (grade === 'REGULAR' && (form.isOnSale || form.isCarryOver)) {
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isCarryOver} onChange={(e) => set('isCarryOver', e.target.checked)} className="w-4 h-4 accent-amber-500" />
              <span className="text-sm font-semibold text-slate-700">이월상품</span>
            </label>

            {(form.isOnSale || form.isCarryOver) && (
              <div className="pl-6 space-y-3">
                <div className="flex items-end gap-4 flex-wrap">
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

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-green-500" />
              <span className="text-sm text-slate-700">판매중</span>
            </label>
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
                <span key={s} className="badge bg-primary-100 text-primary-700 text-xs gap-1">
                  {s}<button type="button" onClick={() => removeSize(s)} className="ml-1">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* 사이즈별 추가 가격 */}
          {form.sizes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">사이즈별 추가 가격 <span className="font-normal text-slate-400">(비어있으면 추가 없음)</span></label>
              <div className="grid grid-cols-2 gap-2">
                {form.sizes.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 w-12 flex-shrink-0">{s}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">+</span>
                      <input
                        type="number" min="0" step="100"
                        className="input text-sm pl-5"
                        placeholder="0"
                        value={sizeExtraPrices[s] ?? ''}
                        onChange={(e) => setSizeExtraPrices((prev) => ({ ...prev, [s]: e.target.value }))}
                      />
                    </div>
                    <span className="text-xs text-slate-400">원</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">색상</label>
            <div className="flex gap-2 mb-2">
              <input className="input text-sm flex-1" placeholder="화이트" value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())} />
              <button type="button" onClick={addColor} className="btn-outline text-sm px-3">추가</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.colors.map((c) => (
                <span key={c} className="badge bg-slate-100 text-slate-600 text-xs">
                  {c}<button type="button" onClick={() => removeColor(c)} className="ml-1">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* 색상별 대표 이미지 */}
          {form.colors.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">색상별 대표 이미지 <span className="font-normal text-slate-400">(색상당 1장, 색상 선택 시 대표로 표시됩니다 — 새로 업로드하거나 아래 상품이미지 중에서 선택할 수 있습니다)</span></label>
              <input ref={colorImgRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && pendingColorRef.current) uploadColorImage(f, pendingColorRef.current);
                  e.target.value = '';
                }} />
              <div className="flex flex-wrap gap-3">
                {form.colors.map((c) => (
                  <div key={c} className="relative flex flex-col items-center gap-1">
                    <button type="button"
                      onClick={() => setColorPicker((p) => (p === c ? null : c))}
                      disabled={uploading}
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-dashed border-slate-300 hover:border-primary-400 flex items-center justify-center text-slate-300 text-xs group">
                      {colorImages[c] ? (
                        <>
                          <img src={colorImages[c]} alt="" className="w-full h-full object-cover" />
                          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs">변경</span>
                        </>
                      ) : '선택'}
                    </button>
                    <span className="text-xs text-slate-500 max-w-16 truncate" title={c}>{c}</span>

                    {colorPicker === c && (
                      <div className="absolute top-full left-0 z-10 mt-1 p-2.5 bg-white border border-slate-200 rounded-lg shadow-lg w-56">
                        <p className="text-xs font-medium text-slate-500 mb-1.5">상품이미지에서 선택</p>
                        {images.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {images.map((img, i) => (
                              <button key={i} type="button"
                                onClick={() => { setColorImages((prev) => ({ ...prev, [c]: img })); setColorPicker(null); }}
                                className="w-10 h-10 rounded overflow-hidden border border-slate-200 hover:border-primary-400">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 mb-2">업로드된 상품이미지가 없습니다.</p>
                        )}
                        <button type="button"
                          onClick={() => { pendingColorRef.current = c; colorImgRef.current?.click(); setColorPicker(null); }}
                          className="text-xs text-primary-600 hover:underline">새 파일 업로드</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 품절 그리드 */}
          {form.colors.length > 0 && form.sizes.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">판매 상태 (색상 × 사이즈) <span className="font-normal text-slate-400">— 누르면 품절로 표시</span></label>
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
                          const isOut = variantOutOfStock[key] ?? false;
                          return (
                            <td key={size} className="border border-slate-200 p-1 text-center">
                              <button
                                type="button"
                                onClick={() => setVariantOutOfStock((prev) => ({ ...prev, [key]: !isOut }))}
                                className={`w-16 text-xs font-medium rounded py-1 transition-colors ${isOut ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                              >
                                {isOut ? '품절' : '판매중'}
                              </button>
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
            <p className="text-xs text-slate-400">색상과 사이즈를 모두 추가하면 판매 상태 표가 나타납니다.</p>
          )}
        </div>

        {/* 번역 관리 */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-slate-700">🌐 번역 관리</h2>
            <div className="flex items-center gap-2">
              {translatedAt && <span className="text-xs text-slate-400">마지막 번역: {new Date(translatedAt).toLocaleString('ko-KR')}</span>}
              <button type="button" onClick={handleRetranslate} disabled={retranslating}
                className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">
                {retranslating ? '재번역 중...' : '자동 재번역'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {TRANS_LANGS.map((l) => (
              <button key={l.code} type="button" onClick={() => setActiveTransLang(l.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTransLang === l.code ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {l.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">상품명</label>
              <input className="input text-sm" value={translations[activeTransLang].name}
                onChange={(e) => setTrans(activeTransLang, 'name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">성별</label>
              <input className="input text-sm" value={translations[activeTransLang].gender}
                onChange={(e) => setTrans(activeTransLang, 'gender', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">시즌/컬렉션</label>
              <input className="input text-sm" value={translations[activeTransLang].season}
                onChange={(e) => setTrans(activeTransLang, 'season', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">색상 (쉼표로 구분)</label>
              <input className="input text-sm" value={translations[activeTransLang].colors}
                onChange={(e) => setTrans(activeTransLang, 'colors', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">설명</label>
              <textarea className="input text-sm min-h-20 resize-none" value={translations[activeTransLang].description}
                onChange={(e) => setTrans(activeTransLang, 'description', e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-slate-400">저장을 누르면 이 탭에 입력된 내용이 함께 저장됩니다. 상품명/색상 등 한국어 원본을 수정하면 저장 시 자동으로 다시 번역되어 이 내용을 덮어씁니다.</p>
        </div>

        {/* 이미지 */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">이미지</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">상품 사진</label>
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files, 'main')} />
            <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading || images.length >= MAX_MAIN_IMAGES} className="btn-outline text-sm mb-3">{uploading ? `업로드 중... ${uploadProgress}%` : `사진 추가 (${images.length}/${MAX_MAIN_IMAGES})`}</button>
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
            <button type="button" onClick={() => sizeImgRef.current?.click()} disabled={uploading} className="btn-outline text-sm mb-3">{uploading ? `업로드 중... ${uploadProgress}%` : '사이즈 이미지 추가'}</button>
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
          <button type="submit" disabled={loading || uploading} className="btn-primary flex-1">{loading ? '저장 중...' : '수정 완료'}</button>
          <button type="button" onClick={() => router.push('/admin/products')} className="btn-outline">취소</button>
        </div>
      </form>
    </div>
  );
}
