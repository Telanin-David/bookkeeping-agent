import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), config.storage.localDir);

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  if (config.storage.driver === 's3') {
    return saveToS3(buffer, filename);
  }
  return saveLocally(buffer, filename);
}

export async function deleteFile(filePath: string): Promise<void> {
  if (config.storage.driver === 's3') {
    await deleteFromS3(filePath);
  } else {
    await fs.unlink(filePath).catch(() => {});
  }
}

export async function readFile(filePath: string): Promise<Buffer> {
  if (config.storage.driver === 's3') {
    return readFromS3(filePath);
  }
  return fs.readFile(filePath);
}

async function saveLocally(buffer: Buffer, filename: string): Promise<string> {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const dest = path.join(LOCAL_UPLOAD_DIR, filename);
  await fs.writeFile(dest, buffer);
  return dest;
}

async function saveToS3(_buffer: Buffer, _filename: string): Promise<string> {
  // TODO: implement S3 upload (Deliverable 10 — DevOps)
  throw new Error('S3 storage not yet implemented');
}

async function deleteFromS3(_filePath: string): Promise<void> {
  // TODO: implement S3 deletion
}

async function readFromS3(_filePath: string): Promise<Buffer> {
  // TODO: implement S3 read
  throw new Error('S3 storage not yet implemented');
}

// ── Shop branding images ───────────────────────────────────────
// Stored under <upload dir>/branding/<key>. Keys are generated server-side and checked
// against BRANDING_KEY_RE before every file access, so a key can never be a path.
export const BRANDING_KEY_RE = /^[0-9a-f-]{36}-(logo|signature)-[0-9a-f]{16}\.(png|jpg)$/;
const BRANDING_DIR = path.join(LOCAL_UPLOAD_DIR, 'branding');

function brandingPath(key: string): string {
  if (!BRANDING_KEY_RE.test(key)) throw new Error('Invalid branding key');
  if (config.storage.driver === 's3') throw new Error('S3 storage not yet implemented');
  return path.join(BRANDING_DIR, key);
}

export async function saveBrandingFile(key: string, buffer: Buffer): Promise<void> {
  const dest = brandingPath(key);
  await fs.mkdir(BRANDING_DIR, { recursive: true });
  await fs.writeFile(dest, buffer);
}

/** Returns null when the file is missing (e.g. deleted by hand) rather than throwing. */
export async function readBrandingFile(key: string): Promise<Buffer | null> {
  return fs.readFile(brandingPath(key)).catch(() => null);
}

export async function deleteBrandingFile(key: string): Promise<void> {
  await fs.unlink(brandingPath(key)).catch(() => {});
}

/** Loads a shop's logo/signature for embedding in a PDF, from its public URL. */
export async function loadBrandingImage(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  const key = url.slice(url.lastIndexOf('/') + 1);
  return BRANDING_KEY_RE.test(key) ? readBrandingFile(key) : null;
}
