import { LoginDto } from "./dto/login.dto";

export type LocalAuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  passwordHash: string;
  forcePasswordReset?: boolean;
  userRoles: Array<{
    role: {
      id: string;
      name: string;
      description: string | null;
      rolePermissions: Array<{ permission: { code: string } }>;
    };
  }>;
};

export type AuthenticatedPrincipal = {
  user: LocalAuthUser;
  permissions: string[];
};

export interface AuthProvider {
  authenticate(input: LoginDto): Promise<AuthenticatedPrincipal>;
}
