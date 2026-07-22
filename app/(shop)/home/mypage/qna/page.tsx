import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import T from '@/components/i18n/T';

export default async function MypageQnaPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">💬</div>
      <h2 className="text-lg font-bold text-slate-800 mb-2"><T k="nav.qna" /></h2>
      <p className="text-slate-500 mb-6"><T k="mypageQna.desc" /></p>
      <Link href="/home/qna" className="btn-primary"><T k="mypageQna.goLink" /></Link>
    </div>
  );
}
