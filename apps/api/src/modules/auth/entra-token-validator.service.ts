import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { JWTPayload } from "jose";

type EntraPrincipal = {
  issuer: string;
  audience: string;
  subject: string;
  email: string;
  displayName: string | null;
};

@Injectable()
export class EntraTokenValidatorService {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwksUri: string;
  private readonly authority: string;
  private jwks?: unknown;

  constructor(private readonly configService: ConfigService) {
    const mode = this.configService.get<string>("auth.mode", "local");
    this.issuer = this.configService.get<string>("auth.entra.issuer", "");
    this.audience = this.configService.get<string>("auth.entra.clientId", "");
    this.jwksUri = this.configService.get<string>("auth.entra.jwksUri", "");
    this.authority = this.configService.get<string>("auth.entra.authority", "");

    if (mode === "entra" && (!this.issuer || !this.audience || !this.jwksUri || !this.authority)) {
      throw new Error(
        "AUTH_MODE=\"entra\" requires ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_ISSUER, ENTRA_JWKS_URI, and ENTRA_AUTHORITY to be configured."
      );
    }

  }

  getPublicConfiguration() {
    return {
      clientId: this.audience,
      authority: this.authority
    };
  }

  async validateIdToken(idToken: string): Promise<EntraPrincipal> {
    if (!this.issuer || !this.audience || !this.jwksUri || !this.authority) {
      throw new UnauthorizedException("Microsoft Entra ID is not configured.");
    }

    let payload: JWTPayload;
    const { jwtVerify } = await import("jose");
    const jwks = await this.getJwks();

    try {
      ({ payload } = await jwtVerify(idToken, jwks as Parameters<typeof jwtVerify>[1], {
        issuer: this.issuer,
        audience: this.audience
      }));
    } catch {
      throw new UnauthorizedException("Invalid Microsoft identity token.");
    }

    const email = this.resolveEmail(payload);

    if (!email) {
      throw new UnauthorizedException("Microsoft identity token is missing a usable email claim.");
    }

    return {
      issuer: String(payload.iss ?? ""),
      audience: typeof payload.aud === "string" ? payload.aud : this.audience,
      subject: String(payload.sub ?? ""),
      email,
      displayName: this.resolveDisplayName(payload)
    };
  }

  private resolveEmail(payload: JWTPayload) {
    const candidate =
      this.readStringClaim(payload.preferred_username) ??
      this.readStringClaim(payload.email) ??
      this.readStringClaim((payload as JWTPayload & { upn?: unknown }).upn);

    return candidate?.trim().toLowerCase() ?? "";
  }

  private resolveDisplayName(payload: JWTPayload) {
    return this.readStringClaim(payload.name) ?? null;
  }

  private readStringClaim(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private async getJwks() {
    if (!this.jwks) {
      const { createRemoteJWKSet } = await import("jose");
      this.jwks = createRemoteJWKSet(
        new URL(
          this.jwksUri || "https://login.microsoftonline.com/common/discovery/v2.0/keys"
        )
      );
    }

    return this.jwks;
  }
}
