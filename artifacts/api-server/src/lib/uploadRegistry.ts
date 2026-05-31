const TTL_MS = 60 * 60 * 1000;

interface UploadRecord {
  userId: string;
  issuedAt: number;
}

const registry = new Map<string, UploadRecord>();

export function registerUpload(objectPath: string, userId: string): void {
  registry.set(objectPath, { userId, issuedAt: Date.now() });
}

export function verifyUploadOwner(objectPath: string, userId: string): boolean {
  const record = registry.get(objectPath);
  if (!record) return false;
  if (Date.now() - record.issuedAt > TTL_MS) {
    registry.delete(objectPath);
    return false;
  }
  return record.userId === userId;
}

export function consumeUploadRecord(objectPath: string): void {
  registry.delete(objectPath);
}
