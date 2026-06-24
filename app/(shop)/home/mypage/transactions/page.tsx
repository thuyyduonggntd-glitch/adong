'use client';
import { useEffect, useState } from 'react';
import { formatPrice, formatDate } from '@/lib/utils';

type Transaction = {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  description: string | null;
  date: string;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => r.json())
      .then((d) => { setTransactions(d); setLoading(false); });
  }, []);

  const totalDeposit    = transactions.filter((t) => t.type === 'DEPOSIT').reduce((s, t) => s + t.amount, 0);
  const totalWithdrawal = transactions.filter((t) => t.type === 'WITHDRAWAL').reduce((s, t) => s + t.amount, 0);
  const balance         = totalDeposit - totalWithdrawal;

  // 잔금 누적 계산 (오래된 순서로 계산 후 최신순 표시)
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = 0;
  const withBalance = sorted.map((t) => {
    running += t.type === 'DEPOSIT' ? t.amount : -t.amount;
    return { ...t, running };
  });
  const displayList = [...withBalance].reverse();

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-4">입출금 내역</h2>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">총 입금</p>
          <p className="text-lg font-bold text-green-600">{formatPrice(totalDeposit)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">총 출금</p>
          <p className="text-lg font-bold text-red-500">{formatPrice(totalWithdrawal)}</p>
        </div>
        <div className={`card p-4 text-center border ${balance >= 0 ? 'bg-primary-50 border-primary-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-slate-400 mb-1">잔금</p>
          <p className={`text-lg font-bold ${balance >= 0 ? 'text-primary-700' : 'text-red-600'}`}>{formatPrice(balance)}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">로딩 중...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">💳</div>
          <p>입출금 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-400 uppercase">
                  <th className="px-4 py-3">날짜</th>
                  <th className="px-4 py-3 text-right text-green-600">입금</th>
                  <th className="px-4 py-3 text-right text-red-500">출금</th>
                  <th className="px-4 py-3">내용</th>
                  <th className="px-4 py-3 text-right">잔금</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayList.map((tx) => (
                  <tr key={tx.id} className="text-slate-700 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      {tx.type === 'DEPOSIT' ? formatPrice(tx.amount) : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">
                      {tx.type === 'WITHDRAWAL' ? formatPrice(tx.amount) : ''}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{tx.description || '-'}</td>
                    <td className={`px-4 py-3 text-right font-medium ${tx.running >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                      {formatPrice(tx.running)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
