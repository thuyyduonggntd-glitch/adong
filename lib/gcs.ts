import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = process.env.GCS_BUCKET || 'kkumbb-images';

let storage: Storage | null = null;

function getStorage(): Storage {
  if (storage) return storage;

  const projectId = process.env.GCS_PROJECT_ID;
  const rawCredentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
  if (!projectId || !rawCredentials) {
    throw new Error('GCS_PROJECT_ID / GOOGLE_CLOUD_CREDENTIALS 환경변수가 설정되지 않았습니다.');
  }

  const credentials = JSON.parse(rawCredentials);
  storage = new Storage({ projectId, credentials });
  return storage;
}

export async function uploadToGCS(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const objectPath = `products/${filename}`;
  const bucket = getStorage().bucket(BUCKET_NAME);
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    contentType,
    resumable: false,
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${objectPath}`;
}
