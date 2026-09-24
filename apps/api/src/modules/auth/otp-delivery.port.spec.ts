import { DisabledOtpDelivery } from "./otp-delivery.port";

describe("DisabledOtpDelivery", () => {
  it("rejects with the expected error message", async () => {
    const delivery = new DisabledOtpDelivery();
    await expect(
      delivery.deliverCode({
        email: "field@example.com",
        code: "123456",
        expiresAt: new Date()
      })
    ).rejects.toThrow("OTP email delivery is not configured in production");
  });

  it("never calls a logger (no log output on rejection)", async () => {
    // Spy on Logger to assert no logging occurs.
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const delivery = new DisabledOtpDelivery();
    await expect(
      delivery.deliverCode({
        email: "field@example.com",
        code: "999999",
        expiresAt: new Date()
      })
    ).rejects.toThrow();

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
