import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadToGCS } from '@/lib/gcs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll('files') as File[];

  try {
    const urls: string[] = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const filename = `${crypto.randomUUID()}.${ext}`;
      const url = await uploadToGCS(buffer, filename, file.type || 'application/octet-stream');
      urls.push(url);
    }
    return NextResponse.json({ urls });
  } catch (e: any) {
    console.error('[upload] GCS upload failed:', e);
    return NextResponse.json({ error: 'GCS 업로드 실패: ' + e.message }, { status: 500 });
  }
}
