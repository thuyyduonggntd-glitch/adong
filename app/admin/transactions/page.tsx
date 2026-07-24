'use client';
import { useEffect, useState, useMemo } from 'react';
import { formatPrice, formatDate } from '@/lib/utils';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 40;

/* ─── 타입 ─── */
type UserSummary = {
  id: string; name: string; email: string; phone: string | null;
  shopName: string | null; depositAmount: number; totalSales: number;
};

type TxEntry = {
  id: string; type: 'DEPOSIT' | 'WITHDRAWAL'; amount: number;
  description: string | null; date: string;
};

type LedgerRow = {
  key: string; date: string;
  category: '입금' | '출금';
  content: string; amount: number; balance: number;
  sourceId: string; sourceType: 'tx';
};

function buildLedger(txs: TxEntry[]): LedgerRow[] {
  const entries: Array<{
    date: string; category: '입금' | '출금';
    content: string; amount: number; sourceId: string; sourceType: 'tx';
  }> = [];

  for (const t of txs) {
    entries.push({
      date: t.date, category: t.type === 'DEPOSIT' ? '입금' : '출금',
      content: t.description || '-', amount: t.amount, sourceId: t.id, sourceType: 'tx',
    });
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let balance = 0;
  return entries.map((e, i) => {
    if (e.category === '출금') balance += e.amount;
    else                       balance -= e.amount;
    return { key: `${e.sourceType}-${e.sourceId}-${i}`, ...e, balance };
  }).reverse();
}

/* ─── 메인 ─── */
export default function AdminTransactionsPage() {
  const [users, setUsers]     = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  /* 펼쳐진 회원 */
  const [openId, setOpenId] = useState<string | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);

  /* 펼쳐진 회원의 데이터 캐시 */
  const [cache, setCache] = useState<Record<string, { txs: TxEntry[]; loaded: boolean }>>({});

  /* 거래 추가 폼 */
  const [txForm, setTxForm] = useState({
    type: 'DEPOSIT', amount: '', description: '',
    date: new Date().toISOString().slice(0, 10),
  });

  /* 거래 수정 */
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txEdit, setTxEdit] = useState({ type: 'DEPOSIT', amount: '', description: '', date: '' });

  /* 회원 목록 로드 */
  useEffect(() => {
    fetch('/api/users?admin=1')
      .then((r) => r.json())
      .then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  /* 특정 회원 데이터 로드 */
  const loadUserData = async (userId: string) => {
    if (cache[userId]?.loaded) return;
    setCache((c) => ({ ...c, [userId]: { txs: [], loaded: false } }));
    const txs = await fetch(`/api/transactions?userId=${userId}`).then((r) => r.json());
    setCache((c) => ({
      ...c,
      [userId]: {
        txs:    Array.isArray(txs) ? txs : [],
        loaded: true,
      },
    }));
  };

  /* 회원 행 토글 */
  const handleToggle = async (userId: string) => {
    if (openId === userId) { setOpenId(null); return; }
    setOpenId(userId);
    setEditingTxId(null);
    setLedgerPage(1);
    setTxForm((f) => ({ ...f, amount: '', description: '' }));
    await loadUserData(userId);
  };

  /* 거래 추가 */
  const handleAddTx = async (userId: string) => {
    if (!txForm.amount) return;
    const res = await fetch('/api/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type: txForm.type, amount: Number(txForm.amount), description: txForm.description, date: txForm.date }),
    });
    if (!res.ok) return;
    const newTx: TxEntry = await res.json();
    setCache((c) => ({ ...c, [userId]: { ...c[userId], txs: [newTx, ...(c[userId]?.txs ?? [])] } }));
    const allTxs = [...(cache[userId]?.txs ?? []), newTx];
    const net = allTxs.reduce((s, t) => t.type === 'DEPOSIT' ? s + t.amount : s - t.amount, 0);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, depositAmount: net } : u));
    setTxForm((f) => ({ ...f, amount: '', description: '' }));
  };

  /* 거래 삭제 */
  const handleDeleteTx = async (userId: string, txId: string) => {
    if (!confirm('거래 내역을 삭제하시겠습니까?')) return;
    await fetch(`/api/transactions/${txId}`, { method: 'DELETE' });
    const remaining = (cache[userId]?.txs ?? []).filter((t) => t.id !== txId);
    const net = remaining.reduce((s, t) => t.type === 'DEPOSIT' ? s + t.amount : s - t.amount, 0);
    setCache((c) => ({ ...c, [userId]: { ...c[userId], txs: remaining } }));
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, depositAmount: net } : u));
  };

  /* 거래 수정 저장 */
  const handleSaveTx = async (userId: string, txId: string) => {
    const res = await fetch(`/api/transactions/${txId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: txEdit.type, amount: Number(txEdit.amount), description: txEdit.description, date: txEdit.date }),
    });
    if (!res.ok) return;
    const updated: TxEntry = await res.json();
    const newTxs = (cache[userId]?.txs ?? []).map((t) => t.id === txId ? updated : t);
    const net = newTxs.reduce((s, t) => t.type === 'DEPOSIT' ? s + t.amount : s - t.amount, 0);
    setCache((c) => ({ ...c, [userId]: { ...c[userId], txs: newTxs } }));
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, depositAmount: net } : u));
    setEditingTxId(null);
  };

  const filtered = useMemo(() =>
    users.filter((u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone?.includes(search) ?? false) ||
      (u.shopName?.toLowerCase().includes(search.toLowerCase()) ?? false)
    ), [users, search]);

  /* ─────────── RENDER ─────────── */
  return (
    <div className="pb-16">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">거래 내역</h1>
        <input className="input max-w-xs text-sm" placeholder="이름, 이메일, 연락처, 샵명 검색..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* 전체 합계 */}
      {!loading && filtered.length > 0 && (
        <div className="card p-4 mb-5 flex gap-6 flex-wrap text-sm">
          <span className="text-slate-500">총 <strong className="text-slate-800">{filtered.length}명</strong></span>
          <span className="text-slate-500">전체 매출 <strong className="text-slate-800">{formatPrice(filtered.reduce((s, u) => s + u.totalSales, 0))}</strong></span>
          <span className="text-slate-500">전체 입금 <strong className="text-green-700">{formatPrice(filtered.reduce((s, u) => s + u.depositAmount, 0))}</strong></span>
          <span className="text-slate-500">전체 미수금 <strong className="text-red-600">{formatPrice(filtered.reduce((s, u) => s + Math.max(0, -u.depositAmount), 0))}</strong></span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">검색 결과가 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => {
            const outstanding = -user.depositAmount;
            const isOpen      = openId === user.id;
            const data        = cache[user.id];
            const ledger      = data?.loaded ? buildLedger(data.txs) : [];
            const ledgerTotalPages = Math.max(1, Math.ceil(ledger.length / PAGE_SIZE));
            const pagedLedger = isOpen ? ledger.slice((ledgerPage - 1) * PAGE_SIZE, ledgerPage * PAGE_SIZE) : [];

            return (
              <div key={user.id} className={`card overflow-hidden transition-shadow ${isOpen ? 'shadow-md' : ''}`}>

                {/* ── 회원 요약 행 ── */}
                <button
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => handleToggle(user.id)}
                >
                  {/* 아바타 */}
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">
                    {user.name[0]}
                  </div>

                  {/* 이름/이메일 */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{user.name}</span>
                      {user.shopName && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{user.shopName}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{user.email} · {user.phone || '-'}</p>
                  </div>

                  {/* 금액 요약 */}
                  <div className="flex items-center gap-5 text-right flex-shrink-0">
                    <div className="hidden sm:block">
                      <p className="text-xs text-slate-400">매출</p>
                      <p className="text-sm font-bold text-slate-700">{formatPrice(user.totalSales)}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-slate-400">입금</p>
                      <p className="text-sm font-bold text-green-600">{formatPrice(user.depositAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">미수금</p>
                      <p className={`text-sm font-bold ${outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-blue-500' : 'text-green-600'}`}>
                        {outstanding > 0
                          ? formatPrice(outstanding)
                          : outstanding < 0
                          ? `초과 ${formatPrice(Math.abs(outstanding))}`
                          : '정산완료'}
                      </p>
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* ── 상세 내역 패널 ── */}
                {isOpen && (
                  <div className="border-t border-slate-100">

                    {/* 거래 추가 폼 */}
                    <div className="px-4 py-4 bg-slate-50 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-600 mb-2.5">입출금 내역 추가</p>
                      <div className="flex flex-wrap gap-2">
                        <select className="input text-sm w-24"
                          value={txForm.type}
                          onChange={(e) => setTxForm((f) => ({ ...f, type: e.target.value }))}>
                          <option value="DEPOSIT">입금</option>
                          <option value="WITHDRAWAL">출금</option>
                        </select>
                        <input type="number" className="input text-sm w-32" placeholder="금액"
                          value={txForm.amount}
                          onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))} />
                        <input type="text" className="input text-sm flex-1 min-w-[140px]" placeholder="내용 (선택)"
                          value={txForm.description}
                          onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))} />
                        <input type="date" className="input text-sm w-36"
                          value={txForm.date}
                          onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))} />
                        <button onClick={() => handleAddTx(user.id)}
                          className="btn-primary text-sm py-2 px-4 whitespace-nowrap">추가</button>
                      </div>
                    </div>

                    {/* 장부 테이블 */}
                    {!data?.loaded ? (
                      <div className="text-center py-8 text-slate-400 text-sm">로딩 중...</div>
                    ) : ledger.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">거래 내역이 없습니다.</div>
                    ) : (
                      <div>
                      <div className="px-4 pt-3">
                        <Pagination page={ledgerPage} totalPages={ledgerTotalPages} onChange={setLedgerPage}
                          summary={`총 ${ledger.length}건`} />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-max">
                          <thead className="text-left text-xs text-slate-400 border-b border-slate-100 bg-white">
                            <tr>
                              <th className="px-4 py-2.5">날짜</th>
                              <th className="px-4 py-2.5">구분</th>
                              <th className="px-4 py-2.5">내용</th>
                              <th className="px-4 py-2.5 text-right">입금</th>
                              <th className="px-4 py-2.5 text-right">출금</th>
                              <th className="px-4 py-2.5 text-right">잔액(미수금)</th>
                              <th className="px-4 py-2.5 w-20" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {pagedLedger.map((row) => (
                              <tr key={row.key} className="hover:bg-slate-50 transition-colors text-slate-700">

                                {/* 수정 중인 행 */}
                                {editingTxId === row.sourceId && row.sourceType === 'tx' ? (
                                  <td colSpan={6} className="px-4 py-2">
                                    <div className="flex gap-2 flex-wrap items-center">
                                      <select className="input text-xs w-24" value={txEdit.type}
                                        onChange={(e) => setTxEdit((f) => ({ ...f, type: e.target.value }))}>
                                        <option value="DEPOSIT">입금</option>
                                        <option value="WITHDRAWAL">출금</option>
                                      </select>
                                      <input type="number" className="input text-xs w-28" value={txEdit.amount}
                                        onChange={(e) => setTxEdit((f) => ({ ...f, amount: e.target.value }))} />
                                      <input type="text" className="input text-xs w-44" placeholder="내용"
                                        value={txEdit.description}
                                        onChange={(e) => setTxEdit((f) => ({ ...f, description: e.target.value }))} />
                                      <input type="date" className="input text-xs w-36" value={txEdit.date}
                                        onChange={(e) => setTxEdit((f) => ({ ...f, date: e.target.value }))} />
                                      <button onClick={() => handleSaveTx(user.id, row.sourceId)}
                                        className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg">저장</button>
                                      <button onClick={() => setEditingTxId(null)}
                                        className="text-xs text-slate-400 hover:text-slate-600">취소</button>
                                    </div>
                                  </td>
                                ) : (
                                  <>
                                    <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                                      {formatDate(row.date)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className={`badge text-xs ${
                                        row.category === '입금' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                      }`}>{row.category}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={row.content}>
                                      {row.content}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-semibold text-green-600">
                                      {row.category === '입금' ? formatPrice(row.amount) : ''}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-semibold text-red-500">
                                      {row.category === '출금' ? formatPrice(row.amount) : ''}
                                    </td>
                                    <td className={`px-4 py-2.5 text-right font-bold ${
                                      row.balance > 0 ? 'text-red-600' :
                                      row.balance < 0 ? 'text-blue-500' : 'text-green-600'
                                    }`}>
                                      {row.balance > 0
                                        ? formatPrice(row.balance)
                                        : row.balance < 0
                                        ? `초과 ${formatPrice(Math.abs(row.balance))}`
                                        : '정산'}
                                    </td>
                                  </>
                                )}

                                {/* 수정/삭제 버튼 */}
                                <td className="px-4 py-2.5">
                                  {row.sourceType === 'tx' && editingTxId !== row.sourceId && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          const t = data.txs.find((x) => x.id === row.sourceId);
                                          if (!t) return;
                                          setEditingTxId(t.id);
                                          setTxEdit({ type: t.type, amount: String(t.amount), description: t.description || '', date: t.date.slice(0, 10) });
                                        }}
                                        className="text-xs text-primary-500 hover:text-primary-700">수정</button>
                                      <button
                                        onClick={() => handleDeleteTx(user.id, row.sourceId)}
                                        className="text-xs text-red-400 hover:text-red-600">삭제</button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>

                          {/* 합계 행 */}
                          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                            {(() => {
                              const finalBalance = ledger.length > 0 ? ledger[0].balance : 0;
                              return (
                                <tr className="font-bold text-sm">
                                  <td colSpan={3} className="px-4 py-3 text-xs text-slate-500">합계 / 최종 잔액</td>
                                  <td className="px-4 py-3 text-right text-green-600">
                                    {formatPrice(ledger.filter((r) => r.category === '입금').reduce((s, r) => s + r.amount, 0))}
                                  </td>
                                  <td className="px-4 py-3 text-right text-red-500">
                                    {formatPrice(ledger.filter((r) => r.category === '출금').reduce((s, r) => s + r.amount, 0))}
                                  </td>
                                  <td className={`px-4 py-3 text-right ${finalBalance > 0 ? 'text-red-600' : finalBalance < 0 ? 'text-blue-500' : 'text-green-600'}`}>
                                    {finalBalance > 0
                                      ? `미수금 ${formatPrice(finalBalance)}`
                                      : finalBalance < 0
                                      ? `초과 ${formatPrice(Math.abs(finalBalance))}`
                                      : '정산완료'}
                                  </td>
                                  <td />
                                </tr>
                              );
                            })()}
                          </tfoot>
                        </table>
                      </div>
                      <div className="px-4 pb-3">
                        <Pagination page={ledgerPage} totalPages={ledgerTotalPages} onChange={setLedgerPage} />
                      </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
