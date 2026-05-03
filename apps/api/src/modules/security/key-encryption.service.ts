import { Injectable, Logger } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

// AES-256-GCM encryption for AI provider keys (company + per-user). Master key
// comes from BYOK_ENCRYPTION_KEY env var as 64 hex chars (32 bytes). Storage
// format is "<iv-base64>:<authTag-base64>:<ciphertext-base64>" — three colon-
// separated base64 blobs in a single column.
//
// The master key is required for app start. There is no default — losing it
// means every encrypted key in the DB is unreadable and must be re-entered
// via the UI. Generate one with: openssl rand -hex 32
@Injectable()
export class KeyEncryptionService {
  private readonly logger = new Logger(KeyEncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    const masterKey = process.env.BYOK_ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error(
        "BYOK_ENCRYPTION_KEY env var is required for AI provider key encryption."
      );
    }
    this.key = Buffer.from(masterKey, "hex");
    if (this.key.length !== KEY_BYTES) {
      throw new Error(
        `BYOK_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars); got ${this.key.length} bytes.`
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
  }

  decrypt(encrypted: string): string {
    const parts = encrypted.split(":");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new Error("Invalid encrypted key format");
    }
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }

  // §5A.1 fix — was silent on catch, which hid 30+ minutes of diagnosis
  // when a runtime client/engine mismatch (Windows .dll lock — see
  // docs/troubleshooting/prisma-windows-engine-lock.md) made decrypt
  // fail without a single log line. Context is opaque to the encryption
  // service; callers pass scope/provider/subjectId so the warn line
  // points straight at the failing key. Never logs the encrypted blob,
  // any decrypted plaintext, or the master key.
  tryDecrypt(
    encrypted: string | null | undefined,
    context?: { provider?: string; scope?: string; subjectId?: string }
  ): string | null {
    if (!encrypted) return null;
    try {
      return this.decrypt(encrypted);
    } catch (error) {
      const errClass = error instanceof Error ? error.constructor.name : typeof error;
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `tryDecrypt failed [provider=${context?.provider ?? "unknown"}, ` +
          `scope=${context?.scope ?? "unknown"}, subjectId=${context?.subjectId ?? "unknown"}, ` +
          `errClass=${errClass}, msg=${errMsg}]`
      );
      return null;
    }
  }
}
