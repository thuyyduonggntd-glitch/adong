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