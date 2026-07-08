import { portalConfig } from "./portal.config";

describe("portalConfig factory", () => {
  const originalPortalPublicUrl = process.env.PORTAL_PUBLIC_URL;
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalPortalPublicUrl === undefined) {
      delete process.env.PORTAL_PUBLIC_URL;
    } else {
      process.env.PORTAL_PUBLIC_URL = originalPortalPublicUrl;
    }
    if (originalCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    }
  });

  it("prefers PORTAL_PUBLIC_URL when set", () => {
    process.env.PORTAL_PUBLIC_URL = "https://portal.example.com";
    process.env.CORS_ORIGIN = "https://a.example.com,https://b.example.com";

    expect(portalConfig().publicUrl).toBe("https://portal.example.com");
  });

  it("falls back to the FIRST origin in CORS_ORIGIN, not the raw comma string", () => {
    delete process.env.PORTAL_PUBLIC_URL;
    process.env.CORS_ORIGIN = "https://a.example.com,https://b.example.com";

    expect(portalConfig().publicUrl).toBe("https://a.example.com");
  });

  it("defaults to the localhost Vite origin when neither env var is set", () => {
    delete process.env.PORTAL_PUBLIC_URL;
    delete process.env.CORS_ORIGIN;

    expect(portalConfig().publicUrl).toBe("http://localhost:5173");
  });
});
