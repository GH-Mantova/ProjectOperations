import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes and verifies a password", () => {
    const hash = service.hashPassword("Password123!");

    expect(service.verifyPassword("Password123!", hash)).toBe(true);
    expect(service.verifyPassword("wrong-password", hash)).toBe(false);
  });
});
