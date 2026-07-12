import { mkdir, readFile, rm, stat, readdir } from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface MediaStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
}

export function isSafeStorageKey(key: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) && !key.includes("..");
}

function assertKey(key: string) {
  if (!isSafeStorageKey(key)) {
    throw new Error("Invalid media storage key");
  }
}

export class LocalMediaStorage implements MediaStorage {
  constructor(private readonly root = path.resolve(process.cwd(), ".data/media")) {}

  private resolve(key: string) {
    assertKey(key);
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid media path");
    return target;
  }

  async put(key: string, bytes: Uint8Array, _contentType: string) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await import("fs/promises").then(({ writeFile }) => writeFile(target, bytes));
  }

  async get(key: string) {
    return readFile(this.resolve(key));
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string) {
    try { await stat(this.resolve(key)); return true; } catch { return false; }
  }

  async list(prefix = "") {
    const start = this.resolve(prefix || "progress");
    const keys: string[] = [];
    const walk = async (dir: string) => {
      let entries;
      try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else keys.push(path.relative(this.root, full).split(path.sep).join("/"));
      }
    };
    await walk(start);
    return keys;
  }
}

export class R2MediaStorage implements MediaStorage {
  private readonly client: S3Client;
  constructor(private readonly bucket: string, endpoint: string, accessKeyId: string, secretAccessKey: string) {
    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    assertKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }));
  }
  async get(key: string) {
    assertKey(key);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error("Media object has no body");
    return result.Body.transformToByteArray();
  }
  async delete(key: string) {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async exists(key: string) {
    assertKey(key);
    try { await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); return true; }
    catch (error: unknown) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return false;
      throw error;
    }
  }
  async list(prefix = "progress/") {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      keys.push(...(page.Contents ?? []).flatMap((item) => item.Key ? [item.Key] : []));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }
}

let cached: MediaStorage | undefined;
export function getMediaStorage(): MediaStorage {
  if (cached) return cached;
  const values = [process.env.R2_ENDPOINT, process.env.R2_BUCKET, process.env.R2_ACCESS_KEY_ID, process.env.R2_SECRET_ACCESS_KEY];
  if (values.every(Boolean)) {
    cached = new R2MediaStorage(values[1]!, values[0]!, values[2]!, values[3]!);
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("Private media storage is not configured: R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required in production");
  } else {
    cached = new LocalMediaStorage();
  }
  return cached;
}
