import { Injectable } from "@nestjs/common";
import { AuthProvider } from "./auth-provider.interface";
import { LocalAuthProvider } from "./local-auth.provider";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthProviderService {
  private readonly provider: AuthProvider;

  constructor(private readonly localAuthProvider: LocalAuthProvider) {
    this.provider = this.localAuthProvider;
  }

  authenticate(input: LoginDto) {
    return this.provider.authenticate(input);
  }
}
