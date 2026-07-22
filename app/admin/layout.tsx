import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/layout/AdminSidebar';
import NoticePopup from '@/components/NoticePopup';
import { NoticeProvider } from '@/hooks/useNotices';
import { isStaffRole } from '@/lib/adminAccess';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !isStaffRole((session.user as any)?.role)) {
    redirect('/login');
  }

  return (
    <NoticeProvider>
      <div className="flex min-h-screen bg-slate-50">
        <NoticePopup />
        <AdminSidebar />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </NoticeProvider>
  );
}
