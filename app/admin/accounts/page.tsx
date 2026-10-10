'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Account = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  adminZones: string[];
  createdAt: string;
};

const ZONE_LABELS: Record<string, string> = {
  orders: '주문 (주문 관리·배송·문의·회원)',
  goods: '상품 (상품 관리·브랜드)',
};

export default function AccountsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (session !== undefined && role !== 'ADMIN') router.replace('/admin/orders');
  }, [session, role, router]);

  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ name: '', email: '', password: '', adminZones: [] as string[] });
  const [error, setError]         = useState('');

  const reload = () => {
    setLoading(true);
    fetch('/api/admin/accounts')
      .then((r) => r.json())
      .then((d) => { setAccounts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(reload, []);

  const toggleZone = (zone: string) => {
    setForm((f) => ({
      ...f,
      adminZones: f.adminZones.includes(zone)
        ? f.adminZones.filter((z) => z !== zone)
        : [...f.adminZones, zone],
    }));
  };

  const handleCreate = async () => {
    setError('');
    if (!form.name || !form.email || !form.password) { setError('모든 필드를 입력해 주세요.'); return; }
    if (form.adminZones.length === 0) { setError('구역을 하나 이상 선택해 주세요.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || '생성 실패'); return; }
      setForm({ name: '', email: '', password: '', adminZones: [] });
      setShowCreate(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const patchAccount = async (id: string, data: Partial<Account>) => {
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    reload();
  };

  const deleteAccount = async (id: string, name: string) => {
    if (!confirm(`'${name}' 계정을 삭제하시겠습니까?`)) return;
    await fetch('/api/admin/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    reload();
  };

  const updateZones = async (id: string, currentZones: string[], zone: string) => {
    const newZones = currentZones.includes(zone)
      ? currentZones.filter((z) => z !== zone)
      : [...currentZones, zone];
    await patchAccount(id, { adminZones: newZones });
  };

  if (role !== 'ADMIN') return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">관리자 계정</h1>
          <p className="text-sm text-slate-500 mt-1">부관리자 계정을 생성하고 담당 구역을 설정합니다.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(''); }}
          className="btn btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          부관리자 추가
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-6 border border-primary-200 bg-primary-50/40">
          <h2 className="text-base font-semibold text-slate-700 mb-4">새 부관리자 계정</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">이름</label>
                <input className="input w-full" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="홍길동" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">이메일</label>
                <input className="input w-full" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="staff@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">초기 비밀번호</label>
                <input className="input w-full" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="4자리 이상" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">담당 구역</label>
              <div className="flex flex-wrap gap-3">
                {Object.entries(ZONE_LABELS).map(([zone, label]) => (
                  <label key={zone} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.adminZones.includes(zone)}
                      onChange={() => toggleZone(zone)}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="btn btn-secondary">취소</button>
              <button onClick={handleCreate} disabled={saving} className="btn btn-primary">
                {saving ? '저장 중...' : '계정 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">로딩 중...</div>
      ) : accounts.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400 text-sm">부관리자 계정이 없습니다.</p>
          <p className="text-slate-300 text-xs mt-1">위의 버튼으로 계정을 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800">{acc.name}</span>
                    <span className="text-xs text-slate-500">{acc.email}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${acc.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                      {acc.isActive ? '활성' : '잠김'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {Object.entries(ZONE_LABELS).map(([zone, label]) => (
                      <label key={zone} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={acc.adminZones.includes(zone)}
                          onChange={() => updateZones(acc.id, acc.adminZones, zone)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600"
                        />
                        <span className="text-xs text-slate-600">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => patchAccount(acc.id, { isActive: !acc.isActive })}
                    className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${acc.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {acc.isActive ? '잠그기' : '활성화'}
                  </button>
                  <button
                    onClick={() => deleteAccount(acc.id, acc.name)}
                    className="text-xs px-3 py-1.5 rounded font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    삭제
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                생성일: {new Date(acc.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
