'use client';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';

const STATUS_LABELS: Record<string, string> = {
  PENDING:   '접수대기',
  CONFIRMED: '주문확인',
  ARRIVED:   '입고',
  CANCELLED: '취소',
  OUT_OF_STOCK: '품절',
};

type RecentOrder = {
  id: string; userName: string; firstItem: string;
  totalAmount: number; status: string; createdAt: string;
};
type Stats = {
  totalOrders: number; pendingOrders: number; revenue: number; totalUsers: number;
  recentOrders: RecentOrder[];
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0, pendingOrders: 0, revenue: 0, totalUsers: 0, recentOrders: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((s) => { setStats(s); setLoading(false); });
  }, []);

  const statCards = [
    { label: '총 주문수',  value: `${stats.totalOrders}건`,   color: 'bg-blue-50 text-blue-700' },
    { label: '접수 대기',  value: `${stats.pendingOrders}건`, color: 'bg-yellow-50 text-yellow-700' },
    { label: '총 매출',    value: formatPrice(stats.revenue),  color: 'bg-green-50 text-green-700' },
    { label: '총 회원수',  value: `${stats.totalUsers}명`,    color: 'bg-purple-50 text-purple-700' },
  ];

  if (loading) return <div className="text-center py-16 text-slate-400">로딩 중...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-8">대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl p-5 ${s.color}`}>
            <p className="text-sm opacity-80">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 최근 주문 10건 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">최근 주문</h2>
          <Link href="/admin/orders" className="text-primary-600 text-sm hover:underline">주문 관리 →</Link>
        </div>

        {stats.recentOrders.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm">주문이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400 uppercase">
                  <th className="pb-3 pr-4">회원</th>
                  <th className="pb-3 pr-4">상품</th>
                  <th className="pb-3 pr-4 text-right">금액</th>
                  <th className="pb-3 pr-4 text-center">상태</th>
                  <th className="pb-3 text-right">주문일시</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-800">{o.userName}</td>
                    <td className="py-3 pr-4 text-slate-500 max-w-[200px] truncate" title={o.firstItem}>{o.firstItem}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-primary-700">{formatPrice(o.totalAmount)}</td>
                    <td className="py-3 pr-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        o.status === 'PENDING'   ? 'bg-yellow-50 text-yellow-700' :
                        o.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' :
                        o.status === 'ARRIVED'   ? 'bg-green-50 text-green-700' :
                        o.status === 'CANCELLED' ? 'bg-red-50 text-red-500' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-xs text-slate-400">
                      {new Date(o.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
