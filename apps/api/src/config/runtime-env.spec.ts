import { isProductionRuntime } from "./runtime-env";

describe("isProductionRuntime", () => {
  it("returns true when NODE_ENV is 'production'", () => {
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
  });

  it("returns true when WEBSITE_SITE_NAME is set (and NODE_ENV is absent)", () => {
    expect(isProductionRuntime({ WEBSITE_SITE_NAME: "my-app" })).toBe(true);
  });

  it("returns false when neither NODE_ENV nor WEBSITE_SITE_NAME is set", () => {
    expect(isProductionRuntime({})).toBe(false);
  });

  it("returns false when WEBSITE_SITE_NAME is an empty string", () => {
    expect(isProductionRuntime({ WEBSITE_SITE_NAME: "" })).toBe(false);
  });

  it("returns false when NODE_ENV is 'development'", () => {
    expect(isProductionRuntime({ NODE_ENV: "development" })).toBe(false);
  });
});
