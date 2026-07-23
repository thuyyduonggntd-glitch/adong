'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 50;

type Brand = {
  id: string; name: string; image: string | null; createdAt: string;
  notice: string | null;
  sizeInfo: string | null; sizeImages: string[];
  modelInfo: string | null; modelImages: string[];
  mallLocation: string | null;
};

type BrandForm = {
  name: string; image: string;
  notice: string;
  sizeInfo: string; sizeImages: string[];
  modelInfo: string; modelImages: string[];
  mallLocation: string;
};

const emptyForm = (): BrandForm => ({
  name: '', image: '', notice: '',
  sizeInfo: '', sizeImages: [],
  modelInfo: '', modelImages: [],
  mallLocation: '',
});

const removeImg = (arr: string[], idx: number): string[] => arr.filter((_, i) => i !== idx);

function ImgThumbs({ urls, onRemove }: { urls: string[]; onRemove: (i: number) => void }) {
  if (urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {urls.map((u, i) => (
        <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
          <Image src={u} alt="" fill className="object-cover" />
          <button
            type="button" onClick={() => onRemove(i)}
            aria-label="이미지 삭제"
            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center hover:bg-red-500"
          >×</button>
        </div>
      ))}
    </div>
  );
}

/* 저장 전 선택한 파일들을 미리보기 + 개별 삭제(×) 가능하게 보여주는 피커 */
function PendingImagePicker({ label, files, onChange }: { label: string; files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => { urls.forEach((u) => URL.revokeObjectURL(u)); }, [urls]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) onChange([...files, ...picked]);
    e.target.value = '';
  };
  const removeAt = (i: number) => onChange(files.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handlePick} className="hidden" />
      <button
        type="button" onClick={() => inputRef.current?.click()}
        className="text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 font-medium hover:bg-primary-100"
      >사진 선택</button>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {urls.map((u, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
              <img src={u} alt="" className="w-full h-full object-cover" />
              <button
                type="button" onClick={() => removeAt(i)}
                aria-label="선택 취소"
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center hover:bg-red-500"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 추가 폼 ── */
function AddForm({
  form, setForm, error, saving, uploading, onSubmit,
  imageFile, setImageFile, sizeFiles, setSizeFiles, modelFiles, setModelFiles,
}: {
  form: BrandForm;
  setForm: React.Dispatch<React.SetStateAction<BrandForm>>;
  error: string;
  saving: boolean;
  uploading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  sizeFiles: File[];
  setSizeFiles: (files: File[]) => void;
  modelFiles: File[];
  setModelFiles: (files: File[]) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile]);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
    e.target.value = '';
  };
  const handleImageRemove = () => {
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">브랜드명 *</label>
          <input className="input w-full text-sm" placeholder="예: Little Star" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">쇼핑몰(브랜드 위치) <span className="text-slate-300">— 관리자 전용</span></label>
          <input className="input w-full text-sm" placeholder="예: 동대문 누존, 디자이너클럽" value={form.mallLocation}
            onChange={(e) => setForm((f) => ({ ...f, mallLocation: e.target.value }))} />
        </div>
      </div>

      <div className="max-w-[240px]">
        <label className="block text-xs text-slate-500 mb-1">대표 이미지</label>
        {imagePreview ? (
          <div className="relative w-full h-20 rounded-lg overflow-hidden bg-slate-100 mb-1">
            <img src={imagePreview} alt="" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-full h-20 rounded-lg bg-slate-100 mb-1 flex items-center justify-center text-xs text-slate-300">이미지 없음</div>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
        <div className="flex gap-2">
          <button type="button" onClick={() => imageInputRef.current?.click()}
            className="flex-1 text-xs px-2 py-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">사진 선택</button>
          <button type="button" onClick={handleImageRemove} disabled={!imageFile}
            className="flex-1 text-xs px-2 py-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed">삭제</button>
        </div>
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
          <PendingImagePicker label="사이즈 이미지 (복수 가능)" files={sizeFiles} onChange={setSizeFiles} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">모델 정보</p>
          <textarea className="input w-full text-sm resize-none" rows={3}
            placeholder="예: 키 110cm / 5세 / 110 착용"
            value={form.modelInfo} onChange={(e) => setForm((f) => ({ ...f, modelInfo: e.target.value }))} />
          <PendingImagePicker label="모델 이미지 (복수 가능)" files={modelFiles} onChange={setModelFiles} />
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
}

/* ── 편집 폼 ── */
function EditForm({
  editForm, setEditForm, saving, uploading, error, onSave, onCancel,
  editImageRef, sizeFiles, setSizeFiles, modelFiles, setModelFiles,
}: {
  editForm: BrandForm;
  setEditForm: React.Dispatch<React.SetStateAction<BrandForm>>;
  saving: boolean;
  uploading: boolean;
  error: string;
  onSave: () => void;
  onCancel: () => void;
  editImageRef: React.RefObject<HTMLInputElement>;
  sizeFiles: File[];
  setSizeFiles: (files: File[]) => void;
  modelFiles: File[];
  setModelFiles: (files: File[]) => void;
}) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageRemove = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setEditForm((f) => ({ ...f, image: '' }));
    if (editImageRef.current) editImageRef.current.value = '';
  };

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">브랜드명</label>
          <input className="input w-full text-sm" value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">대표 이미지</label>
          {imagePreview ? (
            <div className="relative w-full h-20 rounded-lg overflow-hidden bg-slate-100 mb-1">
              <img src={imagePreview} alt={editForm.name} className="w-full h-full object-contain" />
            </div>
          ) : editForm.image ? (
            <div className="relative w-full h-20 rounded-lg overflow-hidden bg-slate-100 mb-1">
              <Image src={editForm.image} alt={editForm.name} fill className="object-contain" />
            </div>
          ) : (
            <div className="w-full h-20 rounded-lg bg-slate-100 mb-1 flex items-center justify-center text-xs text-slate-300">이미지 없음</div>
          )}
          <input ref={editImageRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          <div className="flex gap-2">
            <button type="button" onClick={() => editImageRef.current?.click()}
              className="flex-1 text-xs px-2 py-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">변경</button>
            <button type="button" onClick={handleImageRemove} disabled={!imagePreview && !editForm.image}
              className="flex-1 text-xs px-2 py-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed">삭제</button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">쇼핑몰(브랜드 위치) <span className="text-slate-300">— 관리자 전용</span></label>
        <input className="input w-full text-sm" placeholder="예: 동대문 누존, 디자이너클럽" value={editForm.mallLocation}
          onChange={(e) => setEditForm((f) => ({ ...f, mallLocation: e.target.value }))} />
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
          <PendingImagePicker label="새 사이즈 이미지 추가" files={sizeFiles} onChange={setSizeFiles} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">모델 정보</p>
          <textarea className="input w-full text-sm resize-none" rows={3}
            value={editForm.modelInfo} onChange={(e) => setEditForm((f) => ({ ...f, modelInfo: e.target.value }))} />
          <ImgThumbs urls={editForm.modelImages} onRemove={(i) => setEditForm((f) => ({ ...f, modelImages: removeImg(f.modelImages, i) }))} />
          <PendingImagePicker label="새 모델 이미지 추가" files={modelFiles} onChange={setModelFiles} />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving || uploading}
          className="flex-1 text-xs px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {uploading ? '업로드 중...' : saving ? '저장 중...' : '저장'}
        </button>
        <button onClick={onCancel}
          className="flex-1 text-xs px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
          취소
        </button>
      </div>
    </div>
  );
}

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
  const [editError, setEditError] = useState('');
  const [page, setPage]           = useState(1);

  const [addImageFile, setAddImageFile]   = useState<File | null>(null);
  const [addSizeFiles, setAddSizeFiles]   = useState<File[]>([]);
  const [addModelFiles, setAddModelFiles] = useState<File[]>([]);
  const [editSizeFiles, setEditSizeFiles]   = useState<File[]>([]);
  const [editModelFiles, setEditModelFiles] = useState<File[]>([]);

  const editImageRef      = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(brands.length / PAGE_SIZE))));
  }, [brands.length]);

  useEffect(() => {
    fetch('/api/brands').then((r) => r.json()).then((d) => { setBrands(d); setLoading(false); });
  }, []);

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    setUploading(true);
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || '이미지 업로드 실패');
    }
    const { urls } = await res.json();
    return urls as string[];
  };

  const uploadSingle = async (files: File[]): Promise<string> => {
    const urls = await uploadFiles(files);
    return urls[0] ?? '';
  };

  /* ── 추가 ── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaving(true);

    try {
      const imgUrl        = addImageFile ? await uploadSingle([addImageFile]) : form.image;
      const newSizeImgs   = addSizeFiles.length  ? await uploadFiles(addSizeFiles)  : [];
      const newModelImgs  = addModelFiles.length ? await uploadFiles(addModelFiles) : [];

      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, image: imgUrl,
          notice: form.notice,
          sizeInfo: form.sizeInfo, sizeImages: [...form.sizeImages, ...newSizeImgs],
          modelInfo: form.modelInfo, modelImages: [...form.modelImages, ...newModelImgs],
          mallLocation: form.mallLocation,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || '오류'); return; }
      const newBrand = await res.json();
      setBrands((prev) => [...prev, newBrand].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
      setForm(emptyForm());
      setAddImageFile(null);
      setAddSizeFiles([]); setAddModelFiles([]);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  /* ── 수정 시작 ── */
  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setOpenId(null);
    setEditError('');
    setEditSizeFiles([]); setEditModelFiles([]);
    setEditForm({
      name: brand.name, image: brand.image ?? '',
      notice: brand.notice ?? '',
      sizeInfo: brand.sizeInfo ?? '', sizeImages: brand.sizeImages,
      modelInfo: brand.modelInfo ?? '', modelImages: brand.modelImages,
      mallLocation: brand.mallLocation ?? '',
    });
  };

  /* ── 수정 저장 ── */
  const handleEditSave = async (id: string) => {
    setEditError(''); setSaving(true);
    try {
      const imgUrl       = editImageRef.current?.files?.[0] ? await uploadSingle(Array.from(editImageRef.current.files)) : editForm.image;
      const newSizeImgs  = editSizeFiles.length  ? await uploadFiles(editSizeFiles)  : [];
      const newModelImgs = editModelFiles.length ? await uploadFiles(editModelFiles) : [];

      const body = {
        name: editForm.name, image: imgUrl,
        notice: editForm.notice,
        sizeInfo: editForm.sizeInfo, sizeImages: [...editForm.sizeImages, ...newSizeImgs],
        modelInfo: editForm.modelInfo, modelImages: [...editForm.modelImages, ...newModelImgs],
        mallLocation: editForm.mallLocation,
      };
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setEditError(d.error || '저장 실패'); return; }
      const updated = await res.json();
      setBrands((prev) =>
        prev.map((b) => b.id === id ? { ...b, ...updated } : b)
          .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      );
      setEditingId(null);
      setEditSizeFiles([]); setEditModelFiles([]);
      if (editImageRef.current) editImageRef.current.value = '';
    } catch (err: any) {
      setEditError(err.message || '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, brandName: string) => {
    if (!confirm(`"${brandName}" 브랜드를 삭제하시겠습니까?`)) return;
    await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    setBrands((prev) => prev.filter((b) => b.id !== id));
  };

  const totalPages = Math.max(1, Math.ceil(brands.length / PAGE_SIZE));
  const paged = brands.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">브랜드 관리</h1>

      {/* 추가 폼 */}
      <div className="card p-5 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">새 브랜드 추가</h2>
        <AddForm
          form={form} setForm={setForm} error={error} saving={saving} uploading={uploading}
          onSubmit={handleAdd}
          imageFile={addImageFile} setImageFile={setAddImageFile}
          sizeFiles={addSizeFiles} setSizeFiles={setAddSizeFiles}
          modelFiles={addModelFiles} setModelFiles={setAddModelFiles}
        />
      </div>

      {/* 브랜드 목록 */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : brands.length === 0 ? (
        <div className="text-center py-16 text-slate-400">등록된 브랜드가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} summary={`전체 ${brands.length}개 브랜드`} />
          {paged.map((brand) => (
            <div key={brand.id} className="card overflow-hidden">
              {editingId === brand.id ? (
                <EditForm
                  editForm={editForm} setEditForm={setEditForm}
                  saving={saving} uploading={uploading} error={editError}
                  onSave={() => handleEditSave(brand.id)}
                  onCancel={() => { setEditingId(null); setEditSizeFiles([]); setEditModelFiles([]); }}
                  editImageRef={editImageRef}
                  sizeFiles={editSizeFiles} setSizeFiles={setEditSizeFiles}
                  modelFiles={editModelFiles} setModelFiles={setEditModelFiles}
                />
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
                      <p className="font-bold text-slate-800">
                        {brand.name}
                        {brand.mallLocation && (
                          <span className="ml-2 text-xs font-normal text-slate-400">({brand.mallLocation})</span>
                        )}
                      </p>
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
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
