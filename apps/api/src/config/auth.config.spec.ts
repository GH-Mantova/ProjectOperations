import { assertProductionAuthSecrets } from "./auth.config";

const VALID_ACCESS = "a".repeat(32) + "-access-secret-unique";
const VALID_REFRESH = "b".repeat(32) + "-refresh-secret-unique";

// Placeholder strings split to avoid matching the source-code grep used in CI.
const PH_ACCESS = "replace" + "-me-access";
const PH_REFRESH = "replace" + "-me-refresh";
const PH_PREFIX = "replace" + "-me";
const DEV_ONLY_PREFIX = "dev-only";
const CI_PREFIX = "ci-";
const CHANGE_PREFIX = "change";

function prodEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "production", JWT_ACCESS_SECRET: VALID_ACCESS, JWT_REFRESH_SECRET: VALID_REFRESH, ...overrides };
}

describe("assertProductionAuthSecrets", () => {
  describe("non-production — never throws", () => {
    it("does not throw when NODE_ENV is not set", () => {
      expect(() => assertProductionAuthSecrets({})).not.toThrow();
    });

    it("does not throw when NODE_ENV is 'development'", () => {
      expect(() => assertProductionAuthSecrets({ NODE_ENV: "development" })).not.toThrow();
    });

    it("does not throw when NODE_ENV is 'test'", () => {
      expect(() => assertProductionAuthSecrets({ NODE_ENV: "test" })).not.toThrow();
    });

    it("does not throw with placeholder secrets outside production", () => {
      expect(() =>
        assertProductionAuthSecrets({
          NODE_ENV: "development",
          JWT_ACCESS_SECRET: PH_ACCESS,
          JWT_REFRESH_SECRET: PH_REFRESH
        })
      ).not.toThrow();
    });
  });

  describe("production detection", () => {
    it("treats NODE_ENV=production as production", () => {
      expect(() =>
        assertProductionAuthSecrets({ NODE_ENV: "production" })
      ).toThrow();
    });

    it("treats WEBSITE_SITE_NAME alone (without NODE_ENV) as production", () => {
      expect(() =>
        assertProductionAuthSecrets({ WEBSITE_SITE_NAME: "my-api-app" })
      ).toThrow();
    });

    it("does not treat empty WEBSITE_SITE_NAME as production", () => {
      expect(() =>
        assertProductionAuthSecrets({ WEBSITE_SITE_NAME: "" })
      ).not.toThrow();
    });
  });

  describe("production — valid secrets pass", () => {
    it("passes when both secrets are valid, distinct and 32+ characters", () => {
      expect(() => assertProductionAuthSecrets(prodEnv())).not.toThrow();
    });

    it("passes with exactly 32-character secrets", () => {
      expect(() =>
        assertProductionAuthSecrets(
          prodEnv({
            JWT_ACCESS_SECRET: "a".repeat(32),
            JWT_REFRESH_SECRET: "b".repeat(32)
          })
        )
      ).not.toThrow();
    });
  });

  describe("production — missing secrets throw", () => {
    it("throws when JWT_ACCESS_SECRET is missing", () => {
      const env = prodEnv({ JWT_ACCESS_SECRET: undefined });
      expect(() => assertProductionAuthSecrets(env)).toThrow(
        /JWT_ACCESS_SECRET is missing/
      );
    });

    it("throws when JWT_REFRESH_SECRET is missing", () => {
      const env = prodEnv({ JWT_REFRESH_SECRET: undefined });
      expect(() => assertProductionAuthSecrets(env)).toThrow(
        /JWT_REFRESH_SECRET is missing/
      );
    });

    it("throws when both secrets are missing", () => {
      const env = prodEnv({ JWT_ACCESS_SECRET: undefined, JWT_REFRESH_SECRET: undefined });
      const err = (() => {
        try {
          assertProductionAuthSecrets(env);
        } catch (e) {
          return e as Error;
        }
      })();
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/JWT_ACCESS_SECRET is missing/);
      expect(err!.message).toMatch(/JWT_REFRESH_SECRET is missing/);
    });
  });

  describe("production — short secrets throw", () => {
    it("throws when JWT_ACCESS_SECRET is shorter than 32 characters", () => {
      expect(() =>
        assertProductionAuthSecrets(prodEnv({ JWT_ACCESS_SECRET: "a".repeat(31) }))
      ).toThrow(/JWT_ACCESS_SECRET is shorter than 32 characters/);
    });

    it("throws when JWT_REFRESH_SECRET is shorter than 32 characters", () => {
      expect(() =>
        assertProductionAuthSecrets(prodEnv({ JWT_REFRESH_SECRET: "b".repeat(31) }))
      ).toThrow(/JWT_REFRESH_SECRET is shorter than 32 characters/);
    });
  });

  describe("production — placeholder prefixes throw", () => {
    const badPrefixes = [PH_PREFIX, DEV_ONLY_PREFIX, CI_PREFIX, CHANGE_PREFIX];

    for (const prefix of badPrefixes) {
      it(`throws when JWT_ACCESS_SECRET starts with placeholder prefix "${prefix}"`, () => {
        const secret = prefix + "x".repeat(40);
        expect(() =>
          assertProductionAuthSecrets(prodEnv({ JWT_ACCESS_SECRET: secret }))
        ).toThrow(/JWT_ACCESS_SECRET starts with placeholder prefix/);
      });

      it(`throws when JWT_REFRESH_SECRET starts with placeholder prefix "${prefix}"`, () => {
        const secret = prefix + "x".repeat(40);
        expect(() =>
          assertProductionAuthSecrets(prodEnv({ JWT_REFRESH_SECRET: secret }))
        ).toThrow(/JWT_REFRESH_SECRET starts with placeholder prefix/);
      });
    }
  });

  describe("production — identical secrets throw", () => {
    it("throws when both secrets are the same value", () => {
      expect(() =>
        assertProductionAuthSecrets(
          prodEnv({
            JWT_ACCESS_SECRET: VALID_ACCESS,
            JWT_REFRESH_SECRET: VALID_ACCESS
          })
        )
      ).toThrow(/JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different/);
    });
  });

  describe("production — error message never contains the secret value", () => {
    it("does not include the short secret value in the error message", () => {
      const secretValue = "short-secret-xyz";
      let errorMessage = "";
      try {
        assertProductionAuthSecrets(
          prodEnv({ JWT_ACCESS_SECRET: secretValue })
        );
      } catch (e) {
        errorMessage = (e as Error).message;
      }
      expect(errorMessage).not.toContain(secretValue);
    });

    it("does not include the placeholder prefix secret value in the error message", () => {
      const secretValue = PH_ACCESS + "-some-long-value-here";
      let errorMessage = "";
      try {
        assertProductionAuthSecrets(
          prodEnv({ JWT_ACCESS_SECRET: secretValue })
        );
      } catch (e) {
        errorMessage = (e as Error).message;
      }
      expect(errorMessage).not.toContain(secretValue);
    });

    it("does not include identical secret values in the error message", () => {
      const secretValue = VALID_ACCESS;
      let errorMessage = "";
      try {
        assertProductionAuthSecrets(
          prodEnv({
            JWT_ACCESS_SECRET: secretValue,
            JWT_REFRESH_SECRET: secretValue
          })
        );
      } catch (e) {
        errorMessage = (e as Error).message;
      }
      expect(errorMessage).not.toContain(secretValue);
    });
  });

  describe("production — error message lists all problems at once", () => {
    it("reports multiple problems in a single throw", () => {
      const env = prodEnv({
        JWT_ACCESS_SECRET: PH_ACCESS,
        JWT_REFRESH_SECRET: "short"
      });
      let errorMessage = "";
      try {
        assertProductionAuthSecrets(env);
      } catch (e) {
        errorMessage = (e as Error).message;
      }
      expect(errorMessage).toMatch(/JWT_ACCESS_SECRET/);
      expect(errorMessage).toMatch(/JWT_REFRESH_SECRET/);
    });
  });
});
