import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { EntraAuthService } from "../auth/entra-auth.service";
import { EntraTokenValidatorService } from "../auth/entra-token-validator.service";
import { tierOf } from "../admin-users/admin-users.service";

const DEFAULT_NOTIFY_EMAIL = "marco@initialservices.net";

// Discriminator kept on the row so a future FIELD (personal-email
// site-worker) request-access channel can share this table without a
// migration. Nothing else in this PR consumes it — the shape just has
// to exist.
type AccessRequestKind = "OFFICE" | "FIELD";

/**
 * Gated-Entra access request flow.
 *
 * When /auth/sso rejects an unregistered Entra user with
 * ENTRA_NOT_REGISTERED, the frontend collects an optional message and
 * POSTs /auth/request-access. Identity is re-derived from the validated
 * idToken — never trust the client for email/oid.
 *
 * Admins list, approve, or deny requests via /admin/access-requests/*.
 * Approve creates the user (SSO-only, no password) with the chosen roles.
 */
@Injectable()
export class AccessRequestsService {
  private readonly logger = new Logger(AccessRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly entraTokenValidator: EntraTokenValidatorService,
    private readonly entraAuthService: EntraAuthService
  ) {}

  async submitFromEntraToken(idToken: string, message?: string) {
    // Identity is derived from the validated token — never from the client.
    const principal = await this.entraTokenValidator.validateIdToken(idToken);
    const email = principal.email.trim().toLowerCase();
    const displayName = principal.displayName?.trim() || null;
    const entraOid = principal.subject || null;
    const trimmedMessage = message?.trim() || null;
    const kind: AccessRequestKind = "OFFICE";

    // Dedupe: if a PENDING request already exists for this identity,
    // refresh its message/timestamp instead of stacking duplicates.
    const existingPending = await this.prisma.accessRequest.findFirst({
      where: {
        status: "PENDING",
        kind,
        OR: [{ email }, ...(entraOid ? [{ entraOid }] : [])]
      },
      orderBy: { createdAt: "desc" }
    });

    const record = existingPending
      ? await this.prisma.accessRequest.update({
          where: { id: existingPending.id },
          data: {
            message: trimmedMessage ?? existingPending.message,
            displayName: displayName ?? existingPending.displayName,
            entraOid: entraOid ?? existingPending.entraOid,
            createdAt: new Date()
          }
        })
      : await this.prisma.accessRequest.create({
          data: {
            email,
            displayName,
            entraOid,
            kind,
            message: trimmedMessage,
            status: "PENDING"
          }
        });

    // Fire-and-forget admin email — the persisted record is the source of
    // truth, so a mail failure must not fail the request. Never log the
    // raw idToken.
    void this.notifyAdmin({ email, displayName, message: trimmedMessage }).catch((err) => {
      this.logger.warn(
        `access-request email notification failed for ${email}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });

    return { id: record.id };
  }

  async listPending(actorId: string) {
    await this.assertAdmin(actorId);
    const rows = await this.prisma.accessRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      kind: row.kind,
      message: row.message,
      createdAt: row.createdAt,
      entraOid: row.entraOid
    }));
  }

  async approve(actorId: string, requestId: string, roleIds: string[]) {
    const actor = await this.assertAdmin(actorId);

    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      throw new BadRequestException("At least one role is required.");
    }

    const request = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Access request not found.");
    if (request.status !== "PENDING") {
      throw new ConflictException(`Access request is already ${request.status.toLowerCase()}.`);
    }

    // Tier gate: Admins cannot assign the Admin role — mirrors AdminUsersService.
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true }
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException("One or more roleIds are unknown.");
    }
    if (actor.tier === "admin" && roles.some((r) => r.name === "Admin")) {
      throw new ForbiddenException("Admins cannot assign the Admin role.");
    }

    const email = request.email.trim().toLowerCase();
    const { firstName, lastName } = this.entraAuthService.splitDisplayName(
      request.displayName,
      email
    );

    // Idempotency: if a user already exists for that email, link the
    // request to it and mark APPROVED rather than throwing. This handles
    // the "admin created the user directly, then approved the pending
    // request" race.
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // SSO-only user — random password hash placeholder so the local-
      // password path can never authenticate this account.
      const created = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash: `sso-only:${randomBytes(16).toString("hex")}`,
          isActive: true,
          ssoOnly: true,
          createdById: actorId,
          updatedById: actorId,
          userRoles: {
            create: roleIds.map((roleId) => ({ roleId }))
          }
        }
      });
      userId = created.id;
    }

    const approved = await this.prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: actorId,
        createdUserId: userId
      }
    });

    await this.auditService.write({
      actorId,
      action: "access_request.approve",
      entityType: "AccessRequest",
      entityId: request.id,
      metadata: {
        email,
        roleIds,
        userId,
        userAlreadyExisted: Boolean(existingUser)
      }
    });

    return { id: approved.id, userId };
  }

  async deny(actorId: string, requestId: string) {
    await this.assertAdmin(actorId);

    const request = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Access request not found.");
    if (request.status !== "PENDING") {
      throw new ConflictException(`Access request is already ${request.status.toLowerCase()}.`);
    }

    const denied = await this.prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        status: "DENIED",
        reviewedAt: new Date(),
        reviewedById: actorId
      }
    });

    await this.auditService.write({
      actorId,
      action: "access_request.deny",
      entityType: "AccessRequest",
      entityId: request.id,
      metadata: { email: request.email }
    });

    return { id: denied.id };
  }

  private async assertAdmin(actorId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      include: { userRoles: { include: { role: { select: { name: true } } } } }
    });
    if (!actor) throw new ForbiddenException("Admin access required.");
    const tier = tierOf({
      isSuperUser: actor.isSuperUser,
      roles: actor.userRoles.map((ur) => ({ name: ur.role.name }))
    });
    if (tier === "none") throw new ForbiddenException("Admin access required.");
    return { id: actor.id, email: actor.email, tier };
  }

  private async notifyAdmin(input: {
    email: string;
    displayName: string | null;
    message: string | null;
  }) {
    const notifyEmail =
      this.config.get<string>("ACCESS_REQUEST_NOTIFY_EMAIL") ?? DEFAULT_NOTIFY_EMAIL;

    const subject = `Project Ops access request: ${input.email}`;
    const displayName = input.displayName ?? "(no name)";
    const messageHtml = input.message
      ? `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">${escapeHtml(
          input.message
        )}</blockquote>`
      : "<p><em>No message provided.</em></p>";
    const html = `
      <p>A Microsoft-authenticated user is requesting access to Project Ops.</p>
      <p><strong>Email:</strong> ${escapeHtml(input.email)}<br />
         <strong>Name:</strong> ${escapeHtml(displayName)}</p>
      <p><strong>Message:</strong></p>
      ${messageHtml}
      <p>Approve or deny from the admin Access requests page.</p>
    `;
    const text = [
      "A Microsoft-authenticated user is requesting access to Project Ops.",
      `Email: ${input.email}`,
      `Name: ${displayName}`,
      "",
      "Message:",
      input.message ?? "(no message)",
      "",
      "Approve or deny from the admin Access requests page."
    ].join("\n");

    const provider = await this.emailService.resolveProvider();
    await provider.sendMail({
      to: [notifyEmail],
      subject,
      html,
      text
    });
    this.logger.log(`access-request notification sent to ${notifyEmail} for ${input.email}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
