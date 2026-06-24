'use client';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/home';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      if (result.error === 'ACCOUNT_INACTIVE') {
        setError('비활성화된 계정입니다. 관리자에게 문의하세요.');
      } else {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
      setLoading(false);
      return;
    }

    const meRes = await fetch('/api/users/me');
    const me = await meRes.json();
    if (me.role === 'ADMIN') {
      router.push('/admin/dashboard');
    } else {
      router.push(callbackUrl);
    }
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/home" className="text-3xl font-bold text-primary-700">꿈비샵</Link>
          <p className="text-slate-500 text-sm mt-1">아동복 전문 쇼핑몰</p>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">로그인</h1>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
              <input
                type="email"
                className="input"
                placeholder="이메일 주소"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
              <input
                type="password"
                className="input"
                placeholder="비밀번호"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            계정이 없으신가요?{' '}
            <Link href="/register" className="text-primary-600 font-medium hover:underline">회원가입</Link>
          </p>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-400 space-y-1">
            <p>테스트 계정:</p>
            <p>어드민: admin@kkumbb.com / admin1234</p>
            <p>사용자: kim@test.com / user1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
