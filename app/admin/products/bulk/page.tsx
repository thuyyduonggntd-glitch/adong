'use client';
import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

/* ───── Types ───── */
type LocalImage = { blobUrl: string; blob: Blob; filename: string; colorName: string };

type ParsedProduct = {
  productNumber: string;
  name: string;
  brand: string;
  categoryName: string;
  colors: string[];
  sizes: string[];
  price: number;
  prices: { grade: string; price: number }[];
  season: string;
  material: string;
  gender: string;
  productType: string;
  description: string;
  remark: string;
  localImages: LocalImage[];
  imageCount: number;
  isDuplicate: boolean;
  existingId?: string;
  action: 'create' | 'update' | 'skip';
};

type Step = 'upload' | 'parsing' | 'preview' | 'importing' | 'done';
type Progress = { phase: string; pct: number; current: number; total: number };
type Results  = { created: number; updated: number; skipped: number; errors: string[] };

/* ───── Excel template download ───── */
async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const headers = ['상품코드','상품명','브랜드','카테고리','색상(쉼표구분)','사이즈(쉼표구분)',
                   '일반가','SILVER가','GOLD가','VIP가','시즌','재질','성별','종류','설명','비고'];
  const sample  = ['A001','상품명예시','브랜드명','아동복','레드,블루','S,M,L',
                   '10000','9500','9000','8500','여름1차','면','공용','티셔츠','색상 주의',''];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '상품목록');
  XLSX.writeFile(wb, '상품일괄등록_템플릿.xlsx');
}

/* ───── Excel parser ───── */
async function parseExcel(file: File): Promise<Omit<ParsedProduct, 'localImages'|'imageCount'|'isDuplicate'|'existingId'|'action'>[]> {
  const XLSX = await import('xlsx');
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h: any) => String(h ?? '').trim());
  const col = (name: string) => header.indexOf(name);

  return rows.slice(1)
    .filter(row => row.some(c => c !== undefined && c !== ''))
    .map(row => {
      const g = (name: string) => String(row[col(name)] ?? '').trim();
      return {
        productNumber: g('상품코드'),
        name:          g('상품명'),
        brand:         g('브랜드'),
        categoryName:  g('카테고리'),
        colors:        g('색상(쉼표구분)').split(',').map(s => s.trim()).filter(Boolean),
        sizes:         g('사이즈(쉼표구분)').split(',').map(s => s.trim()).filter(Boolean),
        price:         Number(row[col('일반가')] || 0),
        prices:        [
          { grade: 'REGULAR', price: Number(row[col('일반가')]   || 0) },
          { grade: 'SILVER',  price: Number(row[col('SILVER가')] || 0) },
          { grade: 'GOLD',    price: Number(row[col('GOLD가')]   || 0) },
          { grade: 'VIP',     price: Number(row[col('VIP가')]    || 0) },
        ].filter(p => p.price > 0),
        season:      g('시즌'),
        material:    g('재질'),
        gender:      g('성별') || '공용',
        productType: g('종류'),
        description: g('설명'),
        remark:      g('비고'),
      };
    })
    .filter(p => p.productNumber);
}

/* ───── ZIP parser ───── */
async function parseZip(file: File): Promise<Map<string, LocalImage[]>> {
  const JSZip = (await import('jszip')).default;
  const zip   = await JSZip.loadAsync(file);
  const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
  const result = new Map<string, LocalImage[]>();

  const entries: { path: string; entry: any }[] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && IMAGE_EXT.test(path)) entries.push({ path, entry });
  });

  const BATCH = 50;
  for (let i = 0; i < entries.length; i += BATCH) {
    await Promise.all(entries.slice(i, i + BATCH).map(async ({ path, entry }) => {
      const parts     = path.split('/').filter(Boolean);
      if (parts.length < 2) return;
      const code      = parts[0];
      const colorName = parts.length >= 3 ? parts[1] : '';
      const filename  = parts[parts.length - 1];
      const blob      = await entry.async('blob') as Blob;
      const blobUrl   = URL.createObjectURL(blob);
      if (!result.has(code)) result.set(code, []);
      result.get(code)!.push({ blobUrl, blob, filename, colorName });
    }));
  }

  // sort: colorName asc, then filename asc
  result.forEach((imgs, code) => {
    imgs.sort((a, b) => a.colorName !== b.colorName
      ? a.colorName.localeCompare(b.colorName)
      : a.filename.localeCompare(b.filename));
    result.set(code, imgs);
  });
  return result;
}

/* ───── Attach images to products ───── */
function attachImages(products: ParsedProduct[], imageMap: Map<string, LocalImage[]>): ParsedProduct[] {
  return products.map(p => {
    const imgs = imageMap.get(p.productNumber) || [];
    if (!imgs.length) return { ...p, localImages: [], imageCount: 0 };

    const byColor = new Map<string, LocalImage[]>();
    imgs.forEach(img => {
      const key = img.colorName || '__all__';
      if (!byColor.has(key)) byColor.set(key, []);
      byColor.get(key)!.push(img);
    });

    const ordered: LocalImage[] = [];
    const used = new Set<string>();

    const colorKeys = p.colors.length > 0 ? p.colors : [...byColor.keys()];
    colorKeys.forEach(c => {
      const group = byColor.get(c) || byColor.get('__all__') || [];
      if (group.length > 0 && !used.has(group[0].blobUrl)) {
        ordered.push(group[0]);
        used.add(group[0].blobUrl);
      }
    });
    imgs.forEach(img => { if (!used.has(img.blobUrl)) { ordered.push(img); used.add(img.blobUrl); } });

    return { ...p, localImages: ordered, imageCount: ordered.length };
  });
}

/* ═══════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════ */
const PAGE_SIZE = 50;

export default function BulkImportPage() {
  const [step, setStep]           = useState<Step>('upload');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile]     = useState<File | null>(null);
  const [parseError, setParseError] = useState('');
  const [products, setProducts]   = useState<ParsedProduct[]>([]);
  const [page, setPage]           = useState(0);
  const [progress, setProgress]   = useState<Progress>({ phase: '', pct: 0, current: 0, total: 0 });
  const [results, setResults]     = useState<Results | null>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const zipRef   = useRef<HTMLInputElement>(null);

  /* ── update a single product field ── */
  const updateProduct = useCallback((absIdx: number, field: string, value: any) => {
    setProducts(prev => {
      const next = [...prev];
      next[absIdx] = { ...next[absIdx], [field]: value };
      return next;
    });
  }, []);

  /* ── bulk action for all duplicates ── */
  const setAllDuplicates = (action: 'update' | 'skip') => {
    setProducts(prev => prev.map(p => p.isDuplicate ? { ...p, action } : p));
  };

  /* ── PARSE ── */
  const handleParse = async () => {
    if (!excelFile) return;
    setStep('parsing');
    setParseError('');
    try {
      const raw = await parseExcel(excelFile);
      let parsed: ParsedProduct[] = raw.map(p => ({
        ...p, localImages: [], imageCount: 0, isDuplicate: false, action: 'create',
      }));

      if (zipFile) {
        const imgMap = await parseZip(zipFile);
        parsed = attachImages(parsed, imgMap);
      }

      const codes = parsed.map(p => p.productNumber).filter(Boolean);
      if (codes.length > 0) {
        const res = await fetch('/api/products/bulk/check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codes }),
        });
        const { existing } = await res.json();
        const exMap = new Map<string, any>(existing.map((e: any) => [e.productNumber, e]));
        parsed = parsed.map(p => {
          const ex = exMap.get(p.productNumber);
          return ex ? { ...p, isDuplicate: true, existingId: ex.id, action: 'update' as const } : p;
        });
      }

      setProducts(parsed);
      setPage(0);
      setStep('preview');
    } catch (e: any) {
      setParseError(e.message || '파싱 오류');
      setStep('upload');
    }
  };

  /* ── IMPORT ── */
  const handleImport = async () => {
    setStep('importing');
    const toImport = products.filter(p => p.action !== 'skip');

    /* Phase 1: upload images */
    const blobMap = new Map<string, string>();
    const allImgs: LocalImage[] = [];
    const seen = new Set<string>();
    toImport.forEach(p => p.localImages.forEach(img => {
      if (!seen.has(img.blobUrl)) { seen.add(img.blobUrl); allImgs.push(img); }
    }));

    setProgress({ phase: '이미지 업로드 중', pct: 0, current: 0, total: allImgs.length });
    const IMG_BATCH = 20;
    for (let i = 0; i < allImgs.length; i += IMG_BATCH) {
      const batch = allImgs.slice(i, i + IMG_BATCH);
      const fd = new FormData();
      batch.forEach(img => fd.append('files', img.blob, img.filename));
      const res  = await fetch('/api/upload', { method: 'POST', body: fd });
      const { urls } = await res.json();
      batch.forEach((img, idx) => { if (urls[idx]) blobMap.set(img.blobUrl, urls[idx]); });
      setProgress({ phase: '이미지 업로드 중', pct: Math.round((i + batch.length) / Math.max(1, allImgs.length) * 50), current: i + batch.length, total: allImgs.length });
    }

    /* Phase 2: create/update products */
    const PROD_BATCH = 50;
    let created = 0, updated = 0, skipped = products.filter(p => p.action === 'skip').length;
    const errors: string[] = [];

    setProgress({ phase: '상품 등록 중', pct: 50, current: 0, total: toImport.length });
    for (let i = 0; i < toImport.length; i += PROD_BATCH) {
      const batch = toImport.slice(i, i + PROD_BATCH).map(p => ({
        ...p,
        images: p.localImages.map(img => blobMap.get(img.blobUrl) || '').filter(Boolean),
        localImages: undefined,
      }));
      const res = await fetch('/api/products/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: batch }),
      });
      const r = await res.json();
      created += r.created || 0;
      updated += r.updated || 0;
      skipped += r.skipped || 0;
      errors.push(...(r.errors || []));
      setProgress({ phase: '상품 등록 중', pct: 50 + Math.round((i + batch.length) / toImport.length * 50), current: i + batch.length, total: toImport.length });
    }

    setResults({ created, updated, skipped, errors });
    setStep('done');
  };

  /* ═══ Step: upload ═══ */
  if (step === 'upload') return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/products" className="text-slate-400 hover:text-slate-600 text-sm">← 상품 목록</Link>
        <h1 className="text-2xl font-bold text-slate-800">상품 일괄 등록</h1>
      </div>

      {/* 이용 안내 */}
      <div className="card p-5 mb-6 bg-blue-50 border-blue-200 space-y-2">
        <p className="text-sm font-bold text-blue-700">이용 방법</p>
        <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
          <li>아래에서 Excel 템플릿을 다운로드하고 상품 정보를 입력합니다.</li>
          <li>이미지는 <code className="bg-blue-100 px-1 rounded">상품코드/색상명/01.jpg</code> 폴더 구조로 ZIP으로 압축합니다.</li>
          <li>Excel 파일과 ZIP 파일을 업로드 후 파싱합니다.</li>
          <li>미리보기에서 확인·수정 후 등록합니다.</li>
        </ol>
        <div className="pt-1">
          <p className="text-xs text-blue-600 font-semibold mb-1">ZIP 폴더 구조 예시:</p>
          <pre className="text-xs bg-blue-100 rounded p-2 text-blue-800 leading-relaxed">
{`images.zip
└── A001/           ← 상품코드
      ├── 레드/      ← 색상명 (Excel과 동일)
      │     ├── 01.jpg  ← 대표 이미지
      │     └── 02.jpg  ← 상세 이미지
      └── 블루/
            └── 01.jpg`}
          </pre>
        </div>
        <button onClick={downloadTemplate} className="btn-outline text-xs mt-1">Excel 템플릿 다운로드</button>
      </div>

      <div className="space-y-4">
        {/* Excel */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">① Excel 파일 <span className="text-red-500">*</span></p>
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => excelRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setExcelFile(f); }}
          >
            {excelFile ? (
              <p className="text-sm font-medium text-primary-700">{excelFile.name} ({(excelFile.size / 1024).toFixed(0)} KB)</p>
            ) : (
              <>
                <p className="text-slate-400 mb-1">클릭하거나 파일을 드래그</p>
                <p className="text-xs text-slate-300">.xlsx, .xls</p>
              </>
            )}
          </div>
          <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { if (e.target.files?.[0]) setExcelFile(e.target.files[0]); }} />
        </div>

        {/* ZIP */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">② 이미지 ZIP 파일 <span className="text-xs text-slate-400 font-normal">(선택)</span></p>
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => zipRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setZipFile(f); }}
          >
            {zipFile ? (
              <p className="text-sm font-medium text-primary-700">{zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(1)} MB)</p>
            ) : (
              <>
                <p className="text-slate-400 mb-1">클릭하거나 파일을 드래그</p>
                <p className="text-xs text-slate-300">.zip</p>
              </>
            )}
          </div>
          <input ref={zipRef} type="file" accept=".zip" className="hidden"
            onChange={e => { if (e.target.files?.[0]) setZipFile(e.target.files[0]); }} />
        </div>
      </div>

      {parseError && <p className="text-red-600 text-sm mt-3">{parseError}</p>}

      <button
        onClick={handleParse}
        disabled={!excelFile}
        className="w-full btn-primary mt-6 disabled:opacity-50"
      >
        파일 파싱 시작
      </button>
    </div>
  );

  /* ═══ Step: parsing ═══ */
  if (step === 'parsing') return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      <p className="text-slate-500">파일 분석 중... ZIP 파일이 크면 시간이 걸릴 수 있습니다.</p>
    </div>
  );

  /* ═══ Step: preview ═══ */
  if (step === 'preview') {
    const total    = products.length;
    const newCount = products.filter(p => !p.isDuplicate).length;
    const dupCount = products.filter(p => p.isDuplicate && p.action !== 'skip').length;
    const skipCount = products.filter(p => p.action === 'skip').length;
    const pageProducts = products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
      <div className="max-w-full">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setStep('upload')} className="text-slate-400 hover:text-slate-600 text-sm">← 다시 업로드</button>
          <h1 className="text-xl font-bold text-slate-800">미리보기</h1>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: '전체 상품', val: total, color: 'text-slate-700' },
            { label: '신규 등록', val: newCount, color: 'text-green-600' },
            { label: '업데이트', val: dupCount, color: 'text-amber-600' },
            { label: '건너뛰기', val: skipCount, color: 'text-slate-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{val}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* 중복 일괄 처리 */}
        {products.some(p => p.isDuplicate) && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-xs font-semibold text-amber-700">중복 상품 일괄 처리:</span>
            <button onClick={() => setAllDuplicates('update')} className="text-xs btn-outline py-1 px-3 border-amber-400 text-amber-700 hover:bg-amber-100">모두 업데이트</button>
            <button onClick={() => setAllDuplicates('skip')} className="text-xs btn-outline py-1 px-3 border-slate-300 text-slate-500 hover:bg-slate-100">모두 건너뛰기</button>
          </div>
        )}

        {/* 테이블 */}
        <div className="card overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2.5 text-left w-20">상태</th>
                <th className="px-3 py-2.5 text-left w-24">이미지</th>
                <th className="px-3 py-2.5 text-left w-28">상품코드</th>
                <th className="px-3 py-2.5 text-left min-w-40">상품명</th>
                <th className="px-3 py-2.5 text-left w-28">브랜드</th>
                <th className="px-3 py-2.5 text-left w-24">카테고리</th>
                <th className="px-3 py-2.5 text-left w-36">색상</th>
                <th className="px-3 py-2.5 text-left w-36">사이즈</th>
                <th className="px-3 py-2.5 text-right w-24">일반가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageProducts.map((p, relIdx) => {
                const absIdx = page * PAGE_SIZE + relIdx;
                return (
                  <tr key={p.productNumber + relIdx} className={`hover:bg-slate-50 ${p.isDuplicate && p.action !== 'skip' ? 'bg-amber-50/40' : p.action === 'skip' ? 'opacity-40' : ''}`}>
                    {/* 상태 */}
                    <td className="px-3 py-2">
                      {p.isDuplicate ? (
                        <select
                          value={p.action}
                          onChange={e => updateProduct(absIdx, 'action', e.target.value)}
                          className="text-xs border border-slate-200 rounded px-1 py-0.5"
                        >
                          <option value="update">업데이트</option>
                          <option value="skip">건너뛰기</option>
                        </select>
                      ) : (
                        <span className="text-green-600 font-medium">신규</span>
                      )}
                    </td>
                    {/* 이미지 */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {p.localImages[0] ? (
                          <img src={p.localImages[0].blobUrl} alt="" className="w-8 h-8 object-cover rounded border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-300 text-xs">없음</div>
                        )}
                        {p.imageCount > 1 && <span className="text-slate-400">+{p.imageCount - 1}</span>}
                      </div>
                    </td>
                    {/* 상품코드 */}
                    <td className="px-3 py-2 font-mono text-slate-600">{p.productNumber}</td>
                    {/* 상품명 (editable) */}
                    <td className="px-3 py-2">
                      <input
                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-primary-300 focus:rounded px-1 outline-none"
                        value={p.name}
                        onChange={e => updateProduct(absIdx, 'name', e.target.value)}
                      />
                    </td>
                    {/* 브랜드 (editable) */}
                    <td className="px-3 py-2">
                      <input
                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-primary-300 focus:rounded px-1 outline-none"
                        value={p.brand}
                        onChange={e => updateProduct(absIdx, 'brand', e.target.value)}
                      />
                    </td>
                    {/* 카테고리 (editable) */}
                    <td className="px-3 py-2">
                      <input
                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-primary-300 focus:rounded px-1 outline-none"
                        value={p.categoryName}
                        onChange={e => updateProduct(absIdx, 'categoryName', e.target.value)}
                      />
                    </td>
                    {/* 색상 */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {p.colors.map(c => <span key={c} className="badge bg-slate-100 text-slate-600 text-xs py-0">{c}</span>)}
                      </div>
                    </td>
                    {/* 사이즈 */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {p.sizes.map(s => <span key={s} className="badge bg-primary-50 text-primary-700 text-xs py-0">{s}</span>)}
                      </div>
                    </td>
                    {/* 가격 (editable) */}
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-20 text-xs text-right border-0 bg-transparent focus:bg-white focus:border focus:border-primary-300 focus:rounded px-1 outline-none"
                        value={p.price}
                        onChange={e => updateProduct(absIdx, 'price', Number(e.target.value))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <button onClick={() => setPage(0)} disabled={page === 0} className="btn-outline text-xs px-2 py-1 disabled:opacity-40">«</button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-outline text-xs px-2 py-1 disabled:opacity-40">‹</button>
            <span className="text-sm text-slate-500">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="btn-outline text-xs px-2 py-1 disabled:opacity-40">›</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} className="btn-outline text-xs px-2 py-1 disabled:opacity-40">»</button>
            <span className="text-xs text-slate-400">총 {total}개 상품</span>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={products.filter(p => p.action !== 'skip').length === 0}
          className="w-full btn-primary disabled:opacity-50"
        >
          등록 시작 ({products.filter(p => p.action !== 'skip').length}개)
        </button>
      </div>
    );
  }

  /* ═══ Step: importing ═══ */
  if (step === 'importing') return (
    <div className="max-w-xl mx-auto py-24">
      <div className="card p-8 text-center space-y-5">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <div>
          <p className="font-semibold text-slate-700">{progress.phase}</p>
          {progress.total > 0 && (
            <p className="text-sm text-slate-400 mt-1">{progress.current} / {progress.total}</p>
          )}
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">{progress.pct}% 완료</p>
      </div>
    </div>
  );

  /* ═══ Step: done ═══ */
  if (step === 'done' && results) return (
    <div className="max-w-xl mx-auto py-16">
      <div className="card p-8 space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-slate-800">등록 완료</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600">{results.created}</p>
            <p className="text-xs text-green-600 mt-0.5">신규 등록</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-amber-600">{results.updated}</p>
            <p className="text-xs text-amber-600 mt-0.5">업데이트</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-slate-400">{results.skipped}</p>
            <p className="text-xs text-slate-400 mt-0.5">건너뜀</p>
          </div>
        </div>
        {results.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-600 mb-2">오류 ({results.errors.length}건)</p>
            <ul className="text-xs text-red-500 space-y-1 max-h-40 overflow-y-auto">
              {results.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
        <div className="flex gap-3">
          <Link href="/admin/products" className="flex-1 btn-primary text-center">상품 목록으로</Link>
          <button onClick={() => { setStep('upload'); setProducts([]); setResults(null); setExcelFile(null); setZipFile(null); }} className="flex-1 btn-outline">
            추가 등록
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}
