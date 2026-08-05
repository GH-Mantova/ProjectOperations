import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/test/canonical/"],
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  // Mirror tsconfig.base.json paths so runtime imports of the shared config
  // package resolve during jest. `import type` gets elided by ts-jest so the
  // types imported in F-2a worked without this, but F-2b's value-level
  // evaluateCondition / evaluateConditionGroup imports need real resolution.
  moduleNameMapper: {
    "^@project-ops/config/(.*)$": "<rootDir>/../../packages/config/src/$1"
  },
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "coverage",
  testEnvironment: "node",
};

export default config;
