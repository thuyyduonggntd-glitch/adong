'use client';
import { useEffect, useState, Fragment } from 'react';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';

type DailyBreakdown = { date: string; orderCount: number; orderAmount: number; deposit: number; descriptions: string[] };
type UserStat = {
  userId: string; userName: string;
  totalOrders: number; totalRevenue: number; totalDeposit: number; balance: number;
  dailyBreakdown: DailyBreakdown[];
};
type Stats = { totalOrders: number; pendingOrders: number; revenue: number; totalUsers: number; userStats: UserStat[] };

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0, pendingOrders: 0, revenue: 0, totalUsers: 0, userStats: [],
  });
  const [openUser, setOpenUser] = useState<string | null>(null);
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

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' });
  };

  if (loading) return <div className="text-center py-16 text-slate-400">로딩 중...</div>;

  const totalDeposit = stats.userStats.reduce((s, u) => s + u.totalDeposit, 0);
  const totalRevenue = stats.userStats.reduce((s, u) => s + u.totalRevenue, 0);

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

      {/* 아이디별 현황 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">
            아이디별 현황
            <span className="text-xs font-normal text-slate-400 ml-1">(최근 60일 · 클릭하면 날짜별 상세)</span>
          </h2>
          <Link href="/admin/orders" className="text-primary-600 text-sm hover:underline">주문관리 →</Link>
        </div>

        {stats.userStats.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm">데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400 uppercase">
                  <th className="pb-3 pr-4 w-6" />
                  <th className="pb-3 pr-6">아이디</th>
                  <th className="pb-3 pr-6 text-center">주문건수</th>
                  <th className="pb-3 pr-6 text-right">입금</th>
                  <th className="pb-3 pr-6 text-right">매출</th>
                  <th className="pb-3 text-right">잔금</th>
                </tr>
              </thead>
              <tbody>
                {stats.userStats.map((user) => {
                  const isOpen = openUser === user.userId;
                  return (
                    <Fragment key={user.userId}>
                      {/* 아이디 행 */}
                      <tr
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${isOpen ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}
                        onClick={() => setOpenUser(isOpen ? null : user.userId)}
                      >
                        <td className="py-3 pr-4 text-slate-400 text-xs">
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="py-3 pr-6 font-semibold text-slate-800">{user.userName}</td>
                        <td className="py-3 pr-6 text-center">
                          {user.totalOrders > 0
                            ? <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{user.totalOrders}건</span>
                            : <span className="text-slate-300 text-xs">-</span>}
                        </td>
                        <td className="py-3 pr-6 text-right font-medium text-emerald-600">
                          {user.totalDeposit > 0 ? formatPrice(user.totalDeposit) : <span className="text-slate-300 text-xs">-</span>}
                        </td>
                        <td className="py-3 pr-6 text-right font-semibold text-primary-700">
                          {user.totalRevenue > 0 ? formatPrice(user.totalRevenue) : <span className="text-slate-300 text-xs">-</span>}
                        </td>
                        <td className="py-3 text-right font-bold text-slate-700">
                          {formatPrice(user.balance)}
                        </td>
                      </tr>

                      {/* 날짜별 상세 (펼치기) */}
                      {isOpen && (
                        <tr>
                          <td colSpan={6} className="pb-1 bg-slate-50/60">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-400 uppercase border-b border-slate-200">
                                  <th className="py-2 pl-10 pr-4 text-left font-medium">날짜</th>
                                  <th className="py-2 pr-4 text-center font-medium">주문건수</th>
                                  <th className="py-2 pr-4 text-right font-medium">입금</th>
                                  <th className="py-2 pr-4 text-right font-medium">매출</th>
                                  <th className="py-2 pr-4 text-right font-medium">잔금</th>
                                  <th className="py-2 pr-4 text-left font-medium">내용</th>
                                </tr>
                              </thead>
                              <tbody>
                                {user.dailyBreakdown.map((d) => (
                                  <tr key={d.date} className="border-b border-slate-100 hover:bg-white transition-colors">
                                    <td className="py-2 pl-10 pr-4 text-slate-500 font-medium">{formatDate(d.date)}</td>
                                    <td className="py-2 pr-4 text-center text-slate-500">
                                      {d.orderCount > 0 ? `${d.orderCount}건` : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="py-2 pr-4 text-right text-emerald-600 font-medium">
                                      {d.deposit > 0 ? formatPrice(d.deposit) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="py-2 pr-4 text-right text-primary-700 font-semibold">
                                      {d.orderAmount > 0 ? formatPrice(d.orderAmount) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="py-2 pr-4 text-right text-slate-600 font-bold">
                                      {formatPrice(user.balance)}
                                    </td>
                                    <td className="py-2 pr-4 text-slate-400 max-w-[160px] truncate">
                                      {d.descriptions.length > 0 ? d.descriptions.join(' · ') : <span className="text-slate-200">-</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200">
                <tr className="bg-slate-50 font-bold text-slate-700">
                  <td className="py-3 pr-4" />
                  <td className="py-3 pr-6 text-xs text-slate-500 font-semibold">합계</td>
                  <td className="py-3 pr-6 text-center text-blue-700 text-xs">
                    {stats.userStats.reduce((s, u) => s + u.totalOrders, 0)}건
                  </td>
                  <td className="py-3 pr-6 text-right text-emerald-600">{formatPrice(totalDeposit)}</td>
                  <td className="py-3 pr-6 text-right text-primary-700">{formatPrice(totalRevenue)}</td>
                  <td className="py-3 text-right text-slate-400 text-xs font-normal">현재잔금</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
