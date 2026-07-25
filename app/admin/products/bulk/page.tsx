'use client';
import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

/* ───── Types ───── */
type ImgFile = { file: File; blobUrl: string; filename: string };
type ColorRow = { color: string; code: string; sizes: string[] };
type ColorImageGroup = { color: string; code: string; images: ImgFile[] };

type ParsedProduct = {
  productNumber: string;
  name: string;
  brand: string;
  categoryGroup: string;
  categoryName: string;
  sizeCategoryName: string;
  colorRows: ColorRow[];
  colors: string[];
  sizes: string[];
  price: number;
  prices: { grade: string; price: number }[];
  saleRate: number;
  salePrice: number;
  season: string;
  gender: string;
  description: string;
  remark: string;
  productImages: ImgFile[];
  colorImages: ColorImageGroup[];
  imageCount: number;
  imageWarnings: string[];
  isDuplicate: boolean;
  existingId?: string;
  action: 'create' | 'update' | 'skip';
};

type Step = 'upload' | 'parsing' | 'preview' | 'importing' | 'done';
type Progress = { phase: string; pct: number; current: number; total: number };
type Results  = { created: number; updated: number; skipped: number; errors: string[] };
type ImageIssues = { unmatchedFiles: string[]; unmatchedProductCodes: string[] };

/* ───── Excel template download ───── */
async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const headers = ['상품코드','상품명','브랜드','카테고리 분류','카테고리','카테고리 사이즈','색상','색상코드','사이즈',
                   '일반가','SILVER가','GOLD가','VIP가','세일률(%)','세일가','시즌','성별','설명','비고'];
  const sample1 = ['A001','상품명예시','브랜드명','의류','아동복','키즈','레드','','S,M,L',
                   '10000','9500','9000','8500','10','9000','여름1차','공용','색상 주의',''];
  const sample2 = ['A001','','','','','','블루','','M,L',
                   '','','','','','','','','',''];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample1, sample2]);
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '상품목록');
  XLSX.writeFile(wb, '상품일괄등록_템플릿.xlsx');
}

/* "S,M,L" → ['S','M','L'] */
function parseSizes(cell: string): string[] {
  return cell.split(',').map(s => s.trim()).filter(Boolean);
}

/* 색상코드가 비어있으면 상품 안에서 색상이 나온 순서대로 001,002...를 자동 배정 (수동 입력값과 겹치지 않게) */
function resolveColorCodes(rows: { color: string; codeRaw: string; sizes: string[] }[]): ColorRow[] {
  const used = new Set(rows.map(r => r.codeRaw.trim()).filter(Boolean));
  let counter = 0;
  return rows.map(r => {
    const raw = r.codeRaw.trim();
    if (raw) return { color: r.color, code: raw, sizes: r.sizes };
    let code: string;
    do {
      counter += 1;
      code = String(counter).padStart(3, '0');
    } while (used.has(code));
    used.add(code);
    return { color: r.color, code, sizes: r.sizes };
  });
}

/* ───── Excel parser ───── */
async function parseExcel(file: File): Promise<Omit<ParsedProduct, 'productImages'|'colorImages'|'imageCount'|'imageWarnings'|'isDuplicate'|'existingId'|'action'>[]> {
  const XLSX = await import('xlsx');
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h: any) => String(h ?? '').trim());
  const col = (name: string) => header.indexOf(name);

  const rawRows = rows.slice(1)
    .filter(row => row.some(c => c !== undefined && c !== ''))
    .map(row => {
      const g = (name: string) => String(row[col(name)] ?? '').trim();
      return {
        productNumber: g('상품코드'),
        name:          g('상품명'),
        brand:         g('브랜드'),
        categoryGroup: g('카테고리 분류'),
        categoryName:  g('카테고리'),
        sizeCategoryName: g('카테고리 사이즈'),
        color:         g('색상'),
        colorCode:     g('색상코드'),
        sizes:         parseSizes(g('사이즈')),
        price:         Number(row[col('일반가')] || 0),
        prices:        [
          { grade: 'REGULAR', price: Number(row[col('일반가')]   || 0) },
          { grade: 'SILVER',  price: Number(row[col('SILVER가')] || 0) },
          { grade: 'GOLD',    price: Number(row[col('GOLD가')]   || 0) },
          { grade: 'VIP',     price: Number(row[col('VIP가')]    || 0) },
        ].filter(p => p.price > 0),
        saleRate:    Number(row[col('세일률(%)')] || 0),
        salePrice:   Number(row[col('세일가')] || 0),
        season:      g('시즌'),
        gender:      g('성별') || '공용',
        description: g('설명'),
        remark:      g('비고'),
      };
    })
    .filter(p => p.productNumber);

  // 같은 상품코드가 여러 행에 걸쳐 나오면 한 상품 — 행마다 색상 하나 + 그 색상의 사이즈 목록
  const order: string[] = [];
  const groups = new Map<string, typeof rawRows>();
  for (const row of rawRows) {
    if (!groups.has(row.productNumber)) { groups.set(row.productNumber, []); order.push(row.productNumber); }
    groups.get(row.productNumber)!.push(row);
  }

  return order.map(productNumber => {
    const groupRows = groups.get(productNumber)!;
    const first = groupRows[0];
    const rawColorRows = groupRows.filter(r => r.color).map(r => ({ color: r.color, codeRaw: r.colorCode, sizes: r.sizes }));
    const colorRows = resolveColorCodes(rawColorRows);
    return {
      productNumber,
      name:             first.name,
      brand:            first.brand,
      categoryGroup:    first.categoryGroup,
      categoryName:     first.categoryName,
      sizeCategoryName: first.sizeCategoryName,
      colorRows,
      colors:           colorRows.map(cr => cr.color),
      sizes:            Array.from(new Set(colorRows.flatMap(cr => cr.sizes))),
      price:            first.price,
      prices:           first.prices,
      saleRate:         first.saleRate,
      salePrice:        first.salePrice,
      season:           first.season,
      gender:           first.gender,
      description:      first.description,
      remark:           first.remark,
    };
  });
}

/* ───── 이미지 파일명 파서 ─────
   상품코드_STT.jpg          → 상품 공통 이미지 (2 부분)
   상품코드_색상코드_STT.jpg  → 색상별 이미지 (3 부분)
   상품코드에는 "_"를 쓸 수 없다 (구분자와 충돌) */
type ParsedImage = ImgFile & { productCode: string; colorCode: string | null; seq: number };
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

function parseImageFilename(filename: string): { productCode: string; colorCode: string | null; seq: number } | null {
  const name = filename.replace(/\.[^.]+$/, '');
  const parts = name.split('_').filter(Boolean);
  if (parts.length === 2) {
    const [productCode, seqStr] = parts;
    const seq = parseInt(seqStr, 10);
    if (!productCode || Number.isNaN(seq)) return null;
    return { productCode, colorCode: null, seq };
  }
  if (parts.length === 3) {
    const [productCode, colorCode, seqStr] = parts;
    const seq = parseInt(seqStr, 10);
    if (!productCode || !colorCode || Number.isNaN(seq)) return null;
    return { productCode, colorCode, seq };
  }
  return null;
}

async function collectImages(files: File[]): Promise<{ byProduct: Map<string, ParsedImage[]>; unmatched: string[] }> {
  const byProduct = new Map<string, ParsedImage[]>();
  const unmatched: string[] = [];
  files.forEach(file => {
    if (!IMAGE_EXT.test(file.name)) { unmatched.push(file.name); return; }
    const parsed = parseImageFilename(file.name);
    if (!parsed) { unmatched.push(file.name); return; }
    const blobUrl = URL.createObjectURL(file);
    const entry: ParsedImage = { file, blobUrl, filename: file.name, ...parsed };
    if (!byProduct.has(parsed.productCode)) byProduct.set(parsed.productCode, []);
    byProduct.get(parsed.productCode)!.push(entry);
  });
  return { byProduct, unmatched };
}

/* ───── 이미지를 상품/색상에 매칭 ─────
   일반(상품코드_STT) → productImages, 색상(상품코드_색상코드_STT) → 해당 색상코드의 colorImages(다수 가능) */
function attachImages(products: ParsedProduct[], byProduct: Map<string, ParsedImage[]>): { products: ParsedProduct[]; unmatchedProductCodes: string[] } {
  const result = products.map(p => {
    const imgs = byProduct.get(p.productNumber) || [];
    const general = imgs.filter(i => i.colorCode === null).sort((a, b) => a.seq - b.seq);

    const colorMap = new Map<string, ParsedImage[]>();
    imgs.filter(i => i.colorCode !== null).forEach(i => {
      const key = i.colorCode!;
      if (!colorMap.has(key)) colorMap.set(key, []);
      colorMap.get(key)!.push(i);
    });
    colorMap.forEach(arr => arr.sort((a, b) => a.seq - b.seq));

    const matchedCodes = new Set<string>();
    const colorImages: ColorImageGroup[] = p.colorRows.map(cr => {
      const arr = colorMap.get(cr.code) || [];
      if (arr.length) matchedCodes.add(cr.code);
      return { color: cr.color, code: cr.code, images: arr };
    });

    const imageWarnings: string[] = [];
    colorMap.forEach((arr, code) => {
      if (!matchedCodes.has(code)) {
        arr.forEach(a => imageWarnings.push(`${a.filename} (색상코드 '${code}'를 찾을 수 없음)`));
      }
    });

    const imageCount = general.length + colorImages.reduce((s, c) => s + c.images.length, 0);
    return { ...p, productImages: general, colorImages, imageCount, imageWarnings };
  });

  const productCodes = new Set(products.map(p => p.productNumber));
  const unmatchedProductCodes = Array.from(byProduct.keys()).filter(code => !productCodes.has(code));

  return { products: result, unmatchedProductCodes };
}

/* ═══════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════ */
const PAGE_SIZE = 50;

export default function BulkImportPage() {
  const [step, setStep]           = useState<Step>('upload');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [parseError, setParseError] = useState('');
  const [products, setProducts]   = useState<ParsedProduct[]>([]);
  const [imageIssues, setImageIssues] = useState<ImageIssues>({ unmatchedFiles: [], unmatchedProductCodes: [] });
  const [page, setPage]           = useState(0);
  const [progress, setProgress]   = useState<Progress>({ phase: '', pct: 0, current: 0, total: 0 });
  const [results, setResults]     = useState<Results | null>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

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
        ...p,
        productImages: [],
        colorImages: p.colorRows.map(cr => ({ color: cr.color, code: cr.code, images: [] })),
        imageCount: 0,
        imageWarnings: [],
        isDuplicate: false,
        action: 'create',
      }));

      let issues: ImageIssues = { unmatchedFiles: [], unmatchedProductCodes: [] };
      if (imageFiles.length) {
        const { byProduct, unmatched } = await collectImages(imageFiles);
        const attached = attachImages(parsed, byProduct);
        parsed = attached.products;
        issues = { unmatchedFiles: unmatched, unmatchedProductCodes: attached.unmatchedProductCodes };
      }
      setImageIssues(issues);

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

    /* Phase 1: upload images (상품 공통이미지 + 색상별 이미지) */
    const blobMap = new Map<string, string>();
    const allImgs: ImgFile[] = [];
    const seen = new Set<string>();
    toImport.forEach(p => {
      p.productImages.forEach(img => {
        if (!seen.has(img.blobUrl)) { seen.add(img.blobUrl); allImgs.push(img); }
      });
      p.colorImages.forEach(g => g.images.forEach(img => {
        if (!seen.has(img.blobUrl)) { seen.add(img.blobUrl); allImgs.push(img); }
      }));
    });

    setProgress({ phase: '이미지 업로드 중', pct: 0, current: 0, total: allImgs.length });
    const IMG_BATCH = 20;
    for (let i = 0; i < allImgs.length; i += IMG_BATCH) {
      const batch = allImgs.slice(i, i + IMG_BATCH);
      const fd = new FormData();
      batch.forEach(img => fd.append('files', img.file, img.filename));
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
        productNumber:    p.productNumber,
        name:             p.name,
        brand:            p.brand,
        categoryGroup:    p.categoryGroup,
        categoryName:     p.categoryName,
        sizeCategoryName: p.sizeCategoryName,
        colorRows:        p.colorRows,
        colors:           p.colors,
        sizes:            p.sizes,
        price:            p.price,
        prices:           p.prices,
        saleRate:         p.saleRate,
        salePrice:        p.salePrice,
        season:           p.season,
        gender:           p.gender,
        description:      p.description,
        remark:           p.remark,
        images:           p.productImages.map(img => blobMap.get(img.blobUrl) || '').filter(Boolean),
        colorImages:      p.colorImages.flatMap(g =>
          g.images.map((img, idx) => ({ color: g.color, imageUrl: blobMap.get(img.blobUrl) || '', sequence: idx + 1 }))
        ).filter(ci => ci.imageUrl),
        action:           p.action,
        existingId:       p.existingId,
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
          <li>이미지 파일명은 아래 규칙에 맞게 지정합니다.</li>
          <li>Excel 파일과 이미지 파일들을 업로드 후 파싱합니다.</li>
          <li>미리보기에서 확인·수정 후 등록합니다.</li>
        </ol>
        <div className="pt-1">
          <p className="text-xs text-blue-600 font-semibold mb-1">이미지 파일명 규칙:</p>
          <pre className="text-xs bg-blue-100 rounded p-2 text-blue-800 leading-relaxed whitespace-pre-wrap">
{`상품이미지(공통):  상품코드_순번.jpg        예) A001_01.jpg
색상별이미지:      상품코드_색상코드_순번.jpg  예) A001_001_01.jpg

- 색상코드는 Excel "색상코드" 칸에 직접 입력하거나, 비워두면 같은
  상품 안에서 색상이 나온 순서대로 001, 002...가 자동 배정됩니다.
- 같은 색상에 여러 장(_01, _02...) 등록 가능 — 첫 장이 대표이미지로 쓰입니다.
- 상품코드에는 "_"를 사용할 수 없습니다.`}
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

        {/* 이미지 */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">② 상품 이미지 <span className="text-xs text-slate-400 font-normal">(선택, 여러 개 한 번에 선택 가능)</span></p>
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => imageRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const files = Array.from(e.dataTransfer.files); if (files.length) setImageFiles(files); }}
          >
            {imageFiles.length > 0 ? (
              <p className="text-sm font-medium text-primary-700">{imageFiles.length}개 파일 선택됨</p>
            ) : (
              <>
                <p className="text-slate-400 mb-1">클릭하거나 파일을 드래그 (여러 개 선택 가능)</p>
                <p className="text-xs text-slate-300">.jpg, .png, .webp, .gif</p>
              </>
            )}
          </div>
          <input ref={imageRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files) setImageFiles(Array.from(e.target.files)); }} />
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
      <p className="text-slate-500">파일 분석 중... 이미지 개수가 많으면 시간이 걸릴 수 있습니다.</p>
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
    const hasImageIssues = imageIssues.unmatchedFiles.length > 0 || imageIssues.unmatchedProductCodes.length > 0;

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

        {/* 이미지 매칭 경고 */}
        {hasImageIssues && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs font-semibold text-red-700 mb-1">이미지 파일 확인 필요</p>
            {imageIssues.unmatchedProductCodes.length > 0 && (
              <p className="text-xs text-red-600">Excel에 없는 상품코드의 이미지: {imageIssues.unmatchedProductCodes.join(', ')}</p>
            )}
            {imageIssues.unmatchedFiles.length > 0 && (
              <p className="text-xs text-red-600">파일명 규칙에 맞지 않는 이미지: {imageIssues.unmatchedFiles.join(', ')}</p>
            )}
          </div>
        )}

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
                <th className="px-3 py-2.5 text-left w-20">카테고리 분류</th>
                <th className="px-3 py-2.5 text-left w-24">카테고리</th>
                <th className="px-3 py-2.5 text-left w-24">카테고리 사이즈</th>
                <th className="px-3 py-2.5 text-left w-64">색상별 사이즈(코드)</th>
                <th className="px-3 py-2.5 text-right w-24">일반가</th>
                <th className="px-3 py-2.5 text-right w-20">세일률(%)</th>
                <th className="px-3 py-2.5 text-right w-24">세일가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageProducts.map((p, relIdx) => {
                const absIdx = page * PAGE_SIZE + relIdx;
                const repImage = p.colorImages.find(g => g.images.length > 0)?.images[0] ?? p.productImages[0];
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
                        {repImage ? (
                          <img src={repImage.blobUrl} alt="" className="w-8 h-8 object-cover rounded border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-300 text-xs">없음</div>
                        )}
                        {p.imageCount > 1 && <span className="text-slate-400">+{p.imageCount - 1}</span>}
                      </div>
                      {p.imageWarnings.length > 0 && (
                        <p className="text-red-500 mt-1">⚠ {p.imageWarnings.length}건 확인필요</p>
                      )}
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
                    {/* 카테고리 분류 (editable) */}
                    <td className="px-3 py-2">
                      <input
                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-primary-300 focus:rounded px-1 outline-none"
                        placeholder="의류/아이템"
                        value={p.categoryGroup}
                        onChange={e => updateProduct(absIdx, 'categoryGroup', e.target.value)}
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
                    {/* 카테고리 사이즈 (editable) */}
                    <td className="px-3 py-2">
                      <input
                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-primary-300 focus:rounded px-1 outline-none"
                        placeholder="선택 안 함"
                        value={p.sizeCategoryName}
                        onChange={e => updateProduct(absIdx, 'sizeCategoryName', e.target.value)}
                      />
                    </td>
                    {/* 색상별 사이즈(코드) */}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        {p.colorRows.map(cr => (
                          <span key={cr.color} className="text-slate-600">
                            <span className="font-semibold">{cr.color}</span>
                            <span className="text-slate-400">({p.productNumber}_{cr.code})</span>
                            {' '}{cr.sizes.join(', ')}
                          </span>
                        ))}
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
                    {/* 세일률 (editable) */}
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-16 text-xs text-right border-0 bg-transparent focus:bg-white focus:border focus:border-primary-300 focus:rounded px-1 outline-none"
                        value={p.saleRate || ''}
                        placeholder="-"
                        onChange={e => updateProduct(absIdx, 'saleRate', Number(e.target.value))}
                      />
                    </td>
                    {/* 세일가 (editable) */}
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-20 text-xs text-right border-0 bg-transparent focus:bg-white focus:border focus:border-primary-300 focus:rounded px-1 outline-none"
                        value={p.salePrice || ''}
                        placeholder="-"
                        onChange={e => updateProduct(absIdx, 'salePrice', Number(e.target.value))}
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
          <button onClick={() => { setStep('upload'); setProducts([]); setResults(null); setExcelFile(null); setImageFiles([]); }} className="flex-1 btn-outline">
            추가 등록
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}
