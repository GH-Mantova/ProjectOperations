import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/test/canonical/"],
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  // ESM_PUPPETEER: puppeteer@25 is ESM-only ("type":"module"). Jest's CJS
  // loader chokes on `export` in puppeteer's entry, so we un-ignore its
  // package tree (and its ESM deps) and let ts-jest transpile them to CJS
  // for tests. Runtime uses Node ≥22.12's require(ESM) support and doesn't
  // need this. The pattern has to handle pnpm's virtual store layout
  // (node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/...) so we anchor
  // on the FINAL /node_modules/<pkg>/ segment, not the first one.
  transformIgnorePatterns: [
    "node_modules[\\\\/](?!\\.pnpm[\\\\/]|(puppeteer|puppeteer-core|@puppeteer|chromium-bidi|devtools-protocol|mitt|debug)[\\\\/])",
    "node_modules[\\\\/]\\.pnpm[\\\\/](?!(puppeteer@|puppeteer-core@|@puppeteer\\+[^@]+@|chromium-bidi@|devtools-protocol@|mitt@|debug@))",
    "\\.pnp\\.[^\\\\]+$"
  ],
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
