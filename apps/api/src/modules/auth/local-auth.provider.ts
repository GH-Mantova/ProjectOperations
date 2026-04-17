import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PasswordService } from "../../common/security/password.service";
import { UsersService } from "../users/users.service";
import { AuthProvider } from "./auth-provider.interface";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class LocalAuthProvider implements AuthProvider {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService
  ) {}

  async authenticate(input: LoginDto) {
    const user = await this.usersService.findByEmailWithSecurity(input.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    if (!this.passwordService.verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return {
      user,
      permissions: this.usersService.flattenPermissions(user)
    };
  }
}
