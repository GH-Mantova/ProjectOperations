import { Injectable, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PasswordService } from "../../common/security/password.service";
import { UsersService } from "../users/users.service";
import { AuthProvider } from "./auth-provider.interface";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class LocalAuthProvider implements AuthProvider {
  // Verified against when the account is unknown, inactive, or has no usable
  // password hash (SSO-only users), so every failed login performs the same
  // scrypt work and returns the same message — no user enumeration via
  // response text or timing.
  private readonly fallbackHash: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService
  ) {
    this.fallbackHash = this.passwordService.hashPassword(randomUUID());
  }

  async authenticate(input: LoginDto) {
    const user = await this.usersService.findByEmailWithSecurity(input.email);

    const storedHash =
      user !== null && user.passwordHash.includes(":") ? user.passwordHash : this.fallbackHash;
    const passwordValid = this.passwordService.verifyPassword(input.password, storedHash);

    if (!user || !user.isActive || storedHash === this.fallbackHash || !passwordValid) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return {
      user,
      permissions: this.usersService.flattenPermissions(user)
    };
  }
}
