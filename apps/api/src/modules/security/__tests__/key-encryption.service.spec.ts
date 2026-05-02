import { KeyEncryptionService } from "../key-encryption.service";

const VALID_HEX_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("KeyEncryptionService", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.BYOK_ENCRYPTION_KEY;
    process.env.BYOK_ENCRYPTION_KEY = VALID_HEX_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.BYOK_ENCRYPTION_KEY;
    } else {
      process.env.BYOK_ENCRYPTION_KEY = originalKey;
    }
  });

  it("encrypts and decrypts a key roundtrip", () => {
    const service = new KeyEncryptionService();
    const plaintext = "sk-ant-api03-XXXXXXX";
    const encrypted = service.encrypt(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it("produces three colon-separated base64 segments", () => {
    const service = new KeyEncryptionService();
    const encrypted = service.encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const service = new KeyEncryptionService();
    const a = service.encrypt("same-key");
    const b = service.encrypt("same-key");
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe("same-key");
    expect(service.decrypt(b)).toBe("same-key");
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    const service = new KeyEncryptionService();
    const encrypted = service.encrypt("test");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const ctBuf = Buffer.from(ciphertext!, "base64");
    ctBuf[0] = ctBuf[0]! ^ 0x01;
    const tampered = `${iv}:${authTag}:${ctBuf.toString("base64")}`;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it("throws on invalid format", () => {
    const service = new KeyEncryptionService();
    expect(() => service.decrypt("not:valid")).toThrow("Invalid encrypted key format");
    expect(() => service.decrypt("only-one-segment")).toThrow("Invalid encrypted key format");
    expect(() => service.decrypt("a:b:c:d")).toThrow("Invalid encrypted key format");
  });

  it("throws on missing master key in constructor", () => {
    delete process.env.BYOK_ENCRYPTION_KEY;
    expect(() => new KeyEncryptionService()).toThrow(/BYOK_ENCRYPTION_KEY/);
  });

  it("throws on wrong-length master key", () => {
    process.env.BYOK_ENCRYPTION_KEY = "deadbeef";
    expect(() => new KeyEncryptionService()).toThrow(/32-byte/);
  });

  it("tryDecrypt returns null on bad ciphertext, plaintext on good", () => {
    const service = new KeyEncryptionService();
    const encrypted = service.encrypt("hello");
    expect(service.tryDecrypt(encrypted)).toBe("hello");
    expect(service.tryDecrypt("garbage")).toBeNull();
    expect(service.tryDecrypt(null)).toBeNull();
    expect(service.tryDecrypt(undefined)).toBeNull();
    expect(service.tryDecrypt("")).toBeNull();
  });
});
