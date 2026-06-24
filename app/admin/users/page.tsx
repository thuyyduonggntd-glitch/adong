'use client';
import { useEffect, useState, useMemo } from 'react';
import { formatPrice, formatDate, DEALER_GRADE_LABELS, DEALER_GRADE_ORDER } from '@/lib/utils';

type UserRow = {
  id: string; name: string; email: string; phone: string | null; role: 'USER' | 'ADMIN';
  isActive: boolean;
  dealerGrade: string;
  shopName: string | null; businessNumber: string | null; address: string | null;
  shippingName: string | null; shippingPhone: string | null;
  depositAmount: number; createdAt: string;
  _count: { orders: number };
  totalSales: number;
};

type EditForm = {
  name: string; email: string; phone: string; shopName: string;
  businessNumber: string; address: string; shippingName: string;
  shippingPhone: string; password: string; dealerGrade: string;
};

type UserCardProps = {
  user: UserRow;
  isOpen: boolean;
  editForm: EditForm;
  saving: boolean;
  savedId: string | null;
  togglingId: string | null;
  onExpand: (user: UserRow) => void;
  onFormChange: (key: keyof EditForm, value: string) => void;
  onSave: (userId: string) => void;
  onClose: () => void;
  onToggleActive: (user: UserRow) => void;
};

function UserCard({
  user, isOpen, editForm, saving, savedId, togglingId,
  onExpand, onFormChange, onSave, onClose, onToggleActive,
}: UserCardProps) {
  const outstanding = user.totalSales - user.depositAmount;
  const isAdmin     = user.role === 'ADMIN';

  return (
    <div className={`card overflow-hidden ${isOpen ? 'shadow-md' : ''} ${!user.isActive ? 'opacity-60' : ''}`}>
      {/* 요약 행 */}
      <button
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
        onClick={() => onExpand(user)}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isAdmin ? 'bg-amber-100 text-amber-600' : 'bg-primary-100 text-primary-600'}`}>
          {user.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{user.name}</span>
            {isAdmin && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">관리자</span>
            )}
            {!user.isActive && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-semibold">비활성</span>
            )}
            {user.shopName && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{user.shopName}</span>
            )}
            <span className="text-xs text-slate-400">{user.email}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {user.phone || '-'} · 주문 {user._count.orders}건 · 가입 {formatDate(user.createdAt)}
            {user.businessNumber && ` · 사업자 ${user.businessNumber}`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-right flex-shrink-0">
          {!isAdmin && (
            <>
              <div className="hidden sm:block">
                <p className="text-xs text-slate-400">입금합계</p>
                <p className="text-sm font-bold text-green-600">{formatPrice(user.depositAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">미수금</p>
                <p className={`text-sm font-bold ${outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-blue-500' : 'text-green-600'}`}>
                  {outstanding > 0 ? formatPrice(outstanding) : outstanding < 0 ? `초과 ${formatPrice(Math.abs(outstanding))}` : '정산완료'}
                </p>
              </div>
            </>
          )}
          <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 수정 패널 */}
      {isOpen && (
        <div className="border-t border-slate-100 p-5 bg-slate-50 space-y-5">

          {/* 기본 정보 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">기본 정보</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                { label: '이름',       key: 'name',           type: 'text',  placeholder: '이름' },
                { label: '이메일',     key: 'email',          type: 'email', placeholder: 'email@example.com' },
                { label: '연락처',     key: 'phone',          type: 'tel',   placeholder: '010-0000-0000' },
                { label: '샵명',       key: 'shopName',       type: 'text',  placeholder: '상호명' },
                { label: '사업자번호', key: 'businessNumber', type: 'text',  placeholder: '000-00-00000' },
              ] as { label: string; key: keyof EditForm; type: string; placeholder: string }[]).map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  <input type={type} className="input text-sm w-full" placeholder={placeholder}
                    value={editForm[key]}
                    onChange={(e) => onFormChange(key, e.target.value)} />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-500 mb-1">대리점 등급</label>
                <select className="input text-sm w-full" value={editForm.dealerGrade}
                  onChange={(e) => onFormChange('dealerGrade', e.target.value)}>
                  {DEALER_GRADE_ORDER.map((g) => (
                    <option key={g} value={g}>{DEALER_GRADE_LABELS[g]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 배송 정보 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">배송 정보</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">수령인 이름</label>
                <input type="text" className="input text-sm w-full" placeholder="수령인 이름"
                  value={editForm.shippingName}
                  onChange={(e) => onFormChange('shippingName', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">수령인 연락처</label>
                <input type="tel" className="input text-sm w-full" placeholder="010-0000-0000"
                  value={editForm.shippingPhone}
                  onChange={(e) => onFormChange('shippingPhone', e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs text-slate-500 mb-1">주소</label>
                <input type="text" className="input text-sm w-full" placeholder="배송 주소"
                  value={editForm.address}
                  onChange={(e) => onFormChange('address', e.target.value)} />
              </div>
            </div>
          </div>

          {/* 비밀번호 변경 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">비밀번호 변경</p>
            <div className="max-w-xs">
              <label className="block text-xs text-slate-500 mb-1">새 비밀번호 (변경 시에만 입력)</label>
              <input type="password" className="input text-sm w-full" placeholder="4자 이상"
                value={editForm.password} autoComplete="new-password"
                onChange={(e) => onFormChange('password', e.target.value)} />
            </div>
          </div>

          {/* 저장 + 비활성화 */}
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <button onClick={() => onSave(user.id)} disabled={saving}
              className="btn-primary text-sm py-2 px-6 disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={onClose} className="btn-outline text-sm py-2 px-4">닫기</button>
            <button
              onClick={() => onToggleActive(user)}
              disabled={togglingId === user.id}
              className={`text-sm py-2 px-4 rounded border font-medium transition-colors disabled:opacity-50 ${
                user.isActive
                  ? 'border-red-300 text-red-600 hover:bg-red-50'
                  : 'border-green-300 text-green-600 hover:bg-green-50'
              }`}
            >
              {togglingId === user.id ? '처리 중...' : user.isActive ? '계정 비활성화' : '계정 활성화'}
            </button>
            {savedId === user.id && (
              <span className="text-xs text-green-600 font-medium">저장되었습니다.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers]           = useState<UserRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm]     = useState<EditForm>({
    name: '', email: '', phone: '', shopName: '', businessNumber: '',
    address: '', shippingName: '', shippingPhone: '', password: '', dealerGrade: 'REGULAR',
  });
  const [saving, setSaving]         = useState(false);
  const [savedId, setSavedId]       = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const handleExpand = (user: UserRow) => {
    if (expandedId === user.id) { setExpandedId(null); return; }
    setExpandedId(user.id);
    setSavedId(null);
    setEditForm({
      name: user.name, email: user.email, phone: user.phone || '',
      shopName: user.shopName || '', businessNumber: user.businessNumber || '',
      address: user.address || '',
      shippingName: user.shippingName || '', shippingPhone: user.shippingPhone || '',
      password: '', dealerGrade: user.dealerGrade || 'REGULAR',
    });
  };

  const handleFormChange = (key: keyof EditForm, value: string) => {
    setEditForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = async (userId: string) => {
    setSaving(true);
    const body: Record<string, string> = {
      name: editForm.name, email: editForm.email, phone: editForm.phone,
      shopName: editForm.shopName, businessNumber: editForm.businessNumber,
      address: editForm.address,
      shippingName: editForm.shippingName, shippingPhone: editForm.shippingPhone,
      dealerGrade: editForm.dealerGrade,
    };
    if (editForm.password.trim()) body.password = editForm.password;

    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...body } : u));
      setEditForm((f) => ({ ...f, password: '' }));
      setSavedId(userId);
    }
    setSaving(false);
  };

  const handleToggleActive = async (user: UserRow) => {
    if (togglingId) return;
    const action = user.isActive ? '비활성화' : '활성화';
    if (!confirm(`${user.name} 계정을 ${action}하시겠습니까?`)) return;
    setTogglingId(user.id);
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !user.isActive } : u));
    }
    setTogglingId(null);
  };

  const filtered = useMemo(() =>
    users.filter((u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone?.includes(search) ?? false) ||
      (u.shopName?.toLowerCase().includes(search.toLowerCase()) ?? false)
    ), [users, search]);

  const admins  = filtered.filter((u) => u.role === 'ADMIN');
  const members = filtered.filter((u) => u.role === 'USER');

  const cardProps = { editForm, saving, savedId, togglingId, onFormChange: handleFormChange, onSave: handleSave, onClose: () => setExpandedId(null), onToggleActive: handleToggleActive };

  return (
    <div className="pb-16">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">회원 관리</h1>
        <input className="input max-w-xs text-sm" placeholder="이름, 이메일, 연락처, 샵명 검색..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!loading && members.length > 0 && (
        <div className="card p-4 mb-5 flex gap-6 flex-wrap text-sm">
          <span className="text-slate-500">일반 회원 <strong className="text-slate-800">{members.length}명</strong></span>
          <span className="text-slate-500">전체 매출 <strong className="text-slate-800">{formatPrice(members.reduce((s, u) => s + u.totalSales, 0))}</strong></span>
          <span className="text-slate-500">전체 입금 <strong className="text-green-700">{formatPrice(members.reduce((s, u) => s + u.depositAmount, 0))}</strong></span>
          <span className="text-slate-500">전체 미수금 <strong className="text-red-600">{formatPrice(members.reduce((s, u) => s + Math.max(0, u.totalSales - u.depositAmount), 0))}</strong></span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : (
        <div className="space-y-6">
          {admins.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                관리자 계정 ({admins.length})
              </p>
              <div className="space-y-2">
                {admins.map((u) => (
                  <UserCard key={u.id} user={u} isOpen={expandedId === u.id} onExpand={handleExpand} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {members.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-400 inline-block" />
                일반 회원 ({members.length})
              </p>
              <div className="space-y-2">
                {members.map((u) => (
                  <UserCard key={u.id} user={u} isOpen={expandedId === u.id} onExpand={handleExpand} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">검색 결과가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}
