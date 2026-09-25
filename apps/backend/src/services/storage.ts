import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads');

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
