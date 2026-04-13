import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

@Injectable()
export class PasswordService {
  hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, 64).toString("hex");

    return `${salt}:${derivedKey}`;
  }

  verifyPassword(password: string, storedHash: string) {
    const [salt, derivedKey] = storedHash.split(":");

    if (!salt || !derivedKey) {
      return false;
    }

    const passwordBuffer = scryptSync(password, salt, 64);
    const hashBuffer = Buffer.from(derivedKey, "hex");

    if (passwordBuffer.length !== hashBuffer.length) {
      return false;
    }

    return timingSafeEqual(passwordBuffer, hashBuffer);
  }

  hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
