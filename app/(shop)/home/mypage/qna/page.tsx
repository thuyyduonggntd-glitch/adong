import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function MypageQnaPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">💬</div>
      <h2 className="text-lg font-bold text-slate-800 mb-2">질의응답</h2>
      <p className="text-slate-500 mb-6">질의응답 페이지에서 문의하세요.</p>
      <Link href="/home/qna" className="btn-primary">질의응답 바로가기</Link>
    </div>
  );
}
