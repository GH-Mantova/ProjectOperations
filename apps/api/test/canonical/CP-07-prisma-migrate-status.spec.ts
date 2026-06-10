import { execSync } from "node:child_process";

describe("Canonical CP-07 — Prisma migration set is in sync with schema", () => {
  it("prisma migrate status reports the schema is up to date", () => {
    let output = "";
    try {
      output = execSync(
        "pnpm --filter @project-ops/api exec prisma migrate status",
        { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
      );
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string };
      output = (e.stdout ?? "") + "\n" + (e.stderr ?? "") + "\n" + e.message;
    }
    expect(output).toContain("Database schema is up to date!");
  });
});
