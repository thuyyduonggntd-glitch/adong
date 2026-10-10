import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { defaultAdminPath } from '@/lib/adminAccess';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const adminZones = (session?.user as any)?.adminZones as string[] | undefined;

  if (role === 'ADMIN') redirect('/admin/dashboard');
  redirect(defaultAdminPath(adminZones));
}
