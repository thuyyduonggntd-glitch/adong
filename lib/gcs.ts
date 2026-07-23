import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = process.env.GCS_BUCKET || 'kkumbb-images';
const PROJECT_ID = process.env.GCS_PROJECT_ID || 'project-79c92a60-b909-49e6-b0c';

let storage: Storage | null = null;

function getStorage(): Storage {
  if (storage) return storage;
  
  // Dùng Application Default Credentials (gcloud auth application-default login)
  // Không cần JSON key file
  storage = new Storage({ projectId: PROJECT_ID });
  return storage;
}

export async function uploadToGCS(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const objectPath = `products/${filename}`;
  const bucket = getStorage().bucket(BUCKET_NAME);
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    contentType,
    resumable: false,
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${objectPath}`;
}

/** 우리 GCS 버킷 URL이 아니면(placehold.co 등 외부/레거시 이미지) 조용히 건너뛴다. */
export async function deleteFromGCS(url: string): Promise<void> {
  const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
  if (!url.startsWith(prefix)) return;
  const objectPath = url.slice(prefix.length);
  await getStorage().bucket(BUCKET_NAME).file(objectPath).delete({ ignoreNotFound: true });
}

/** GCS에 업로드된 파일(엑셀 등)을 버퍼로 다운로드한다. */
export async function downloadFromGCS(objectPath: string): Promise<Buffer> {
  const [buf] = await getStorage().bucket(BUCKET_NAME).file(objectPath).download();
  return buf;
}

/**
 * products/{productNumber}_{순번}.{ext} 형태로 이미 업로드된 일반 상품이미지들을
 * 순번(1, 2, 3...) 순서대로 조회해 URL 배열로 반환한다.
 */
export async function listProductImageUrls(productNumber: string): Promise<string[]> {
  const prefix = `products/${productNumber}_`;
  const [files] = await getStorage().bucket(BUCKET_NAME).getFiles({ prefix });
  const suffixPattern = /^(\d+)\.(jpe?g|png|gif|webp)$/i;

  const matched = files
    .map((f) => {
      const suffix = f.name.slice(prefix.length); // 예: "1.jpg"
      const m = suffix.match(suffixPattern);
      return m ? { name: f.name, idx: parseInt(m[1], 10) } : null;
    })
    .filter((x): x is { name: string; idx: number } => x !== null)
    .sort((a, b) => a.idx - b.idx);

  return matched.map((m) => `https://storage.googleapis.com/${BUCKET_NAME}/${m.name}`);
}

/**
 * products/{productNumber}_color_{색상명}.{ext} 형태로 이미 업로드된 색상별 대표이미지를
 * 색상명 기준으로 매칭해 { color, imageUrl } 배열로 반환한다.
 */
export async function listProductColorImageUrls(productNumber: string): Promise<{ color: string; imageUrl: string }[]> {
  const prefix = `products/${productNumber}_color_`;
  const [files] = await getStorage().bucket(BUCKET_NAME).getFiles({ prefix });
  const suffixPattern = /^(.+)\.(jpe?g|png|gif|webp)$/i;

  return files
    .map((f) => {
      const suffix = f.name.slice(prefix.length); // 예: "레드.jpg"
      const m = suffix.match(suffixPattern);
      return m ? { color: m[1], imageUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${f.name}` } : null;
    })
    .filter((x): x is { color: string; imageUrl: string } => x !== null);
}