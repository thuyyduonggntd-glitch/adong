'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || '회원가입에 실패했습니다.');
      setLoading(false);
      return;
    }
    router.push('/login?registered=1');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/home" className="text-3xl font-bold text-primary-700">꿈비샵</Link>
          <p className="text-slate-500 text-sm mt-1">아동복 전문 쇼핑몰</p>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">회원가입</h1>
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'name',     label: '이름',     type: 'text',     placeholder: '이름' },
              { key: 'email',    label: '이메일',   type: 'email',    placeholder: '이메일 주소' },
              { key: 'password', label: '비밀번호', type: 'password', placeholder: '8자 이상 입력' },
              { key: 'phone',    label: '연락처',   type: 'tel',      placeholder: '010-0000-0000' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type={type}
                  className="input"
                  placeholder={placeholder}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  required={key !== 'phone'}
                  minLength={key === 'password' ? 8 : undefined}
                />
              </div>
            ))}
            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5">
              {loading ? '처리 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-primary-600 font-medium hover:underline">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
