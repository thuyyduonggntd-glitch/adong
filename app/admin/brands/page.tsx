'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

type Brand = {
  id: string; name: string; image: string | null; createdAt: string;
  notice: string | null;
  sizeInfo: string | null; sizeImages: string[];
  modelInfo: string | null; modelImages: string[];
};

type BrandForm = {
  name: string; image: string;
  notice: string;
  sizeInfo: string; sizeImages: string[];
  modelInfo: string; modelImages: string[];
};

const emptyForm = (): BrandForm => ({
  name: '', image: '', notice: '',
  sizeInfo: '', sizeImages: [],
  modelInfo: '', modelImages: [],
});

export default function AdminBrandsPage() {
  const [brands, setBrands]       = useState<Brand[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId]       = useState<string | null>(null);

  const [form, setForm]     = useState<BrandForm>(emptyForm());
  const [editForm, setEditForm] = useState<BrandForm>(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const addImageRef       = useRef<HTMLInputElement>(null);
  const addSizeImgRef     = useRef<HTMLInputElement>(null);
  const addModelImgRef    = useRef<HTMLInputElement>(null);
  const editImageRef      = useRef<HTMLInputElement>(null);
  const editSizeImgRef    = useRef<HTMLInputElement>(null);
  const editModelImgRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/brands').then((r) => r.json()).then((d) => { setBrands(d); setLoading(false); });
  }, []);

  const uploadFiles = async (files: FileList | null): Promise<string[]> => {
    if (!files || files.length === 0) return [];
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const { urls } = await res.json();
    setUploading(false);
    return urls as string[];
  };

  const uploadSingle = async (files: FileList | null): Promise<string> => {
    const urls = await uploadFiles(files);
    return urls[0] ?? '';
  };

  /* ── 추가 ── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaving(true);

    const imgUrl        = addImageRef.current?.files?.[0]    ? await uploadSingle(addImageRef.current.files)   : form.image;
    const newSizeImgs   = addSizeImgRef.current?.files?.length  ? await uploadFiles(addSizeImgRef.current.files)  : [];
    const newModelImgs  = addModelImgRef.current?.files?.length ? await uploadFiles(addModelImgRef.current.files) : [];

    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, image: imgUrl,
        notice: form.notice,
        sizeInfo: form.sizeInfo, sizeImages: [...form.sizeImages, ...newSizeImgs],
        modelInfo: form.modelInfo, modelImages: [...form.modelImages, ...newModelImgs],
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || '오류'); return; }
    const newBrand = await res.json();
    setBrands((prev) => [...prev, newBrand].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    setForm(emptyForm());
    [addImageRef, addSizeImgRef, addModelImgRef].forEach((r) => { if (r.current) r.current.value = ''; });
  };

  /* ── 수정 시작 ── */
  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setOpenId(null);
    setEditForm({
      name: brand.name, image: brand.image ?? '',
      notice: brand.notice ?? '',
      sizeInfo: brand.sizeInfo ?? '', sizeImages: brand.sizeImages,
      modelInfo: brand.modelInfo ?? '', modelImages: brand.modelImages,
    });
  };

  /* ── 수정 저장 ── */
  const handleEditSave = async (id: string) => {
    setSaving(true);
    const imgUrl       = editImageRef.current?.files?.[0]    ? await uploadSingle(editImageRef.current.files)   : editForm.image;
    const newSizeImgs  = editSizeImgRef.current?.files?.length  ? await uploadFiles(editSizeImgRef.current.files)  : [];
    const newModelImgs = editModelImgRef.current?.files?.length ? await uploadFiles(editModelImgRef.current.files) : [];

    const body = {
      name: editForm.name, image: imgUrl,
      notice: editForm.notice,
      sizeInfo: editForm.sizeInfo, sizeImages: [...editForm.sizeImages, ...newSizeImgs],
      modelInfo: editForm.modelInfo, modelImages: [...editForm.modelImages, ...newModelImgs],
    };
    const res = await fetch(`/api/brands/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const updated = await res.json();
    setBrands((prev) =>
      prev.map((b) => b.id === id ? { ...b, ...updated } : b)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    );
    setSaving(false);
    setEditingId(null);
    [editImageRef, editSizeImgRef, editModelImgRef].forEach((r) => { if (r.current) r.current.value = ''; });
  };

  const handleDelete = async (id: string, brandName: string) => {
    if (!confirm(`"${brandName}" 브랜드를 삭제하시겠습니까?`)) return;
    await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    setBrands((prev) => prev.filter((b) => b.id !== id));
  };

  const removeImg = (arr: string[], idx: number): string[] => arr.filter((_, i) => i !== idx);

  const FileInput = ({ inputRef, label, multiple = false }: { inputRef: React.RefObject<HTMLInputElement>; label: string; multiple?: boolean }) => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        ref={inputRef} type="file" accept="image/*" multiple={multiple}
        className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
      />
    </div>
  );

  const ImgThumbs = ({ urls, onRemove }: { urls: string[]; onRemove: (i: number) => void }) => (
    urls.length > 0 ? (
      <div className="flex flex-wrap gap-2 mt-1">
        {urls.map((u, i) => (
          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
            <Image src={u} alt="" fill className="object-cover" />
            <button
              type="button" onClick={() => onRemove(i)}
              className="absolute inset-0 bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >삭제</button>
          </div>
        ))}
      </div>
    ) : null
  );

  /* ── 추가 폼 ── */
  const AddForm = () => (
    <form onSubmit={handleAdd} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">브랜드명 *</label>
          <input className="input w-full text-sm" placeholder="예: Little Star" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <FileInput inputRef={addImageRef} label="대표 이미지" />
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">브랜드 공지사항</label>
        <textarea className="input w-full text-sm resize-none" rows={2}
          placeholder="회원에게 표시할 공지사항을 입력하세요"
          value={form.notice} onChange={(e) => setForm((f) => ({ ...f, notice: e.target.value }))} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">사이즈 정보</p>
          <textarea className="input w-full text-sm resize-none" rows={3}
            placeholder="예: 90/100/110/120/130cm 취급"
            value={form.sizeInfo} onChange={(e) => setForm((f) => ({ ...f, sizeInfo: e.target.value }))} />
          <FileInput inputRef={addSizeImgRef} label="사이즈 이미지 (복수 가능)" multiple />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">모델 정보</p>
          <textarea className="input w-full text-sm resize-none" rows={3}
            placeholder="예: 키 110cm / 5세 / 110 착용"
            value={form.modelInfo} onChange={(e) => setForm((f) => ({ ...f, modelInfo: e.target.value }))} />
          <FileInput inputRef={addModelImgRef} label="모델 이미지 (복수 가능)" multiple />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={saving || uploading} className="btn-primary text-sm px-6">
          {uploading ? '업로드 중...' : saving ? '저장 중...' : '+ 브랜드 추가'}
        </button>
      </div>
    </form>
  );

  /* ── 편집 폼 ── */
  const EditForm = ({ brand }: { brand: Brand }) => (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">브랜드명</label>
          <input className="input w-full text-sm" value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">대표 이미지</label>
          {editForm.image && (
            <div className="relative w-full h-20 rounded-lg overflow-hidden bg-slate-100 mb-1">
              <Image src={editForm.image} alt={editForm.name} fill className="object-contain" />
            </div>
          )}
          <input ref={editImageRef} type="file" accept="image/*"
            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-600 cursor-pointer" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">브랜드 공지사항</label>
        <textarea className="input w-full text-sm resize-none" rows={2}
          value={editForm.notice} onChange={(e) => setEditForm((f) => ({ ...f, notice: e.target.value }))} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">사이즈 정보</p>
          <textarea className="input w-full text-sm resize-none" rows={3}
            value={editForm.sizeInfo} onChange={(e) => setEditForm((f) => ({ ...f, sizeInfo: e.target.value }))} />
          <ImgThumbs urls={editForm.sizeImages} onRemove={(i) => setEditForm((f) => ({ ...f, sizeImages: removeImg(f.sizeImages, i) }))} />
          <input ref={editSizeImgRef} type="file" accept="image/*" multiple
            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-600 cursor-pointer" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">모델 정보</p>
          <textarea className="input w-full text-sm resize-none" rows={3}
            value={editForm.modelInfo} onChange={(e) => setEditForm((f) => ({ ...f, modelInfo: e.target.value }))} />
          <ImgThumbs urls={editForm.modelImages} onRemove={(i) => setEditForm((f) => ({ ...f, modelImages: removeImg(f.modelImages, i) }))} />
          <input ref={editModelImgRef} type="file" accept="image/*" multiple
            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-600 cursor-pointer" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={() => handleEditSave(brand.id)} disabled={saving || uploading}
          className="flex-1 text-xs px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {uploading ? '업로드 중...' : saving ? '저장 중...' : '저장'}
        </button>
        <button onClick={() => setEditingId(null)}
          className="flex-1 text-xs px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
          취소
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">브랜드 관리</h1>

      {/* 추가 폼 */}
      <div className="card p-5 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">새 브랜드 추가</h2>
        <AddForm />
      </div>

      {/* 브랜드 목록 */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : brands.length === 0 ? (
        <div className="text-center py-16 text-slate-400">등록된 브랜드가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {brands.map((brand) => (
            <div key={brand.id} className="card overflow-hidden">
              {editingId === brand.id ? (
                <EditForm brand={brand} />
              ) : (
                <>
                  {/* 헤더 행 */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100">
                      {brand.image
                        ? <Image src={brand.image} alt={brand.name} fill className="object-contain p-1" />
                        : <span className="flex h-full items-center justify-center text-slate-300 text-xs">없음</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800">{brand.name}</p>
                      <div className="flex gap-3 mt-0.5 text-xs text-slate-400">
                        {brand.notice      && <span className="text-amber-600">공지 있음</span>}
                        {brand.sizeInfo    && <span>사이즈 정보</span>}
                        {brand.sizeImages.length > 0 && <span>사이즈 이미지 {brand.sizeImages.length}장</span>}
                        {brand.modelInfo   && <span>모델 정보</span>}
                        {brand.modelImages.length > 0 && <span>모델 이미지 {brand.modelImages.length}장</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setOpenId(openId === brand.id ? null : brand.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                        {openId === brand.id ? '접기' : '상세'}
                      </button>
                      <button onClick={() => startEdit(brand)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">수정</button>
                      <button onClick={() => handleDelete(brand.id, brand.name)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors">삭제</button>
                    </div>
                  </div>

                  {/* 상세 펼치기 */}
                  {openId === brand.id && (
                    <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/50">
                      {brand.notice && (
                        <div>
                          <p className="text-xs font-semibold text-amber-600 mb-1">공지사항</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{brand.notice}</p>
                        </div>
                      )}
                      {(brand.sizeInfo || brand.sizeImages.length > 0) && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-1">사이즈 정보</p>
                          {brand.sizeInfo && <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{brand.sizeInfo}</p>}
                          {brand.sizeImages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {brand.sizeImages.map((u, i) => (
                                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                                  <Image src={u} alt={`사이즈 ${i + 1}`} fill className="object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {(brand.modelInfo || brand.modelImages.length > 0) && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-1">모델 정보</p>
                          {brand.modelInfo && <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{brand.modelInfo}</p>}
                          {brand.modelImages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {brand.modelImages.map((u, i) => (
                                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                                  <Image src={u} alt={`모델 ${i + 1}`} fill className="object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
