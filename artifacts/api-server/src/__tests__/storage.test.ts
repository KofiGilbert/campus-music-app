import { describe, it, expect } from "vitest";
import { MemoryStorageAdapter, storageKeys, type StorageProvider } from "@workspace/storage";

describe("MemoryStorageAdapter", () => {
  it("round-trips a buffer and reports existence", async () => {
    const s: StorageProvider = new MemoryStorageAdapter("test");
    const key = storageKeys.audio("track1", "160");
    expect(await s.objectExists(key)).toBe(false);

    await s.putBuffer(key, Buffer.from("hello"), "audio/mp4");
    expect(await s.objectExists(key)).toBe(true);
    expect((await s.getBuffer(key)).toString()).toBe("hello");

    await s.deleteObject(key);
    expect(await s.objectExists(key)).toBe(false);
  });

  it("returns placeholder URLs and rejects missing reads", async () => {
    const s: StorageProvider = new MemoryStorageAdapter("test");
    expect(await s.getPresignedUploadUrl("k", "audio/mp4")).toContain("upload/k");
    expect(await s.getSignedReadUrl("k")).toContain("read/k");
    await expect(s.getBuffer("missing")).rejects.toThrow();
  });
});

describe("storageKeys", () => {
  it("builds the documented key layout", () => {
    expect(storageKeys.rawUpload("t", "a.mp3")).toBe("uploads/t/a.mp3");
    expect(storageKeys.audio("t", "320")).toBe("audio/t/320.m4a");
    expect(storageKeys.cover("t", "thumb")).toBe("covers/t/thumb.webp");
    expect(storageKeys.stem("t", "vocals")).toBe("stems/t/vocals.m4a");
    expect(storageKeys.avatar("u", "medium")).toBe("avatars/u/medium.webp");
  });
});
