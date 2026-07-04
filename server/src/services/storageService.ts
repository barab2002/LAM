import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { getFirebase } from '../lib/firebase';

const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

export interface StoredFile {
  /** Publicly reachable URL for the stored file */
  url: string;
  /** Storage key (bucket path or local relative path) */
  key: string;
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

/**
 * Stores an image buffer. Uses Firebase Cloud Storage when configured,
 * otherwise falls back to the local uploads/ directory (served statically
 * by the server in dev).
 */
export async function storeImage(
  buffer: Buffer,
  opts: { userId: string; mimeType: string; prefix?: string },
): Promise<StoredFile> {
  const name = `${opts.prefix ?? 'img'}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extensionFor(opts.mimeType)}`;
  const key = `users/${opts.userId}/${name}`;

  const firebase = getFirebase();
  if (firebase && env.firebase.storageBucket) {
    const bucket = firebase.storage().bucket();
    const file = bucket.file(key);
    await file.save(buffer, { contentType: opts.mimeType, resumable: false });
    // Long-lived signed URL; rotate via re-sign if you need stricter access.
    const [url] = await file.getSignedUrl({ action: 'read', expires: '2100-01-01' });
    return { url, key };
  }

  const dir = path.join(LOCAL_UPLOAD_DIR, 'users', opts.userId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buffer);
  return { url: `${env.publicBaseUrl}/uploads/${key}`, key };
}

export function localUploadDir(): string {
  return LOCAL_UPLOAD_DIR;
}
