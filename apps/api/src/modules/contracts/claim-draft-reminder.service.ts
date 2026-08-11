import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ContractStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../platform/notifications.service";

/**
 * Monthly cron that reminds the responsible IS staff member when a draft
 * progress claim exists (i.e. no ProgressClaim for the current claimMonth)
 * on an ACTIVE contract — giving the team a heads-up to generate, review,
 * and issue the claim before the cut-off date.
 *
 * Pattern mirrors `checkClaimCutoffs` in ContractsService: the testable
 * core is extracted into `checkDraftsReadyForReview(today)` so unit tests
 * can inject an arbitrary date.
 */
@Injectable()
export class ClaimDraftReminderService {
  private readonly logger = new Logger(ClaimDraftReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  /**
   * Run near end-of-month: last day at 8am AEST (UTC+10 = 22:00 UTC previous
   * day). Using day 28 so it fires on the 28th of every month — the latest
   * day guaranteed to exist in all months. `timeZone: "UTC"` per house
   * convention (same as claim-cutoff-reminders).
   */
  @Cron("0 22 28 * *", { name: "claim-draft-reminders", timeZone: "UTC" })
  async runClaimDraftReminders() {
    try {
      await this.checkDraftsReadyForReview(new Date());
    } catch (err) {
      this.logger.warn(`claim-draft-reminders failed: ${(err as Error).message}`);
    }
  }

  /**
   * For each ACTIVE contract that has no ProgressClaim for the current
   * claimMonth, create an in-app notification for the responsible user
   * (client.claimReminderUserId, falling back to `user-supervisor-002`) and
   * fire-and-forget a `claim.draft_ready_for_review` email when that user
   * has an email address.
   *
   * @param today - reference date used to compute the current claim month (injected for testability)
   */
  async checkDraftsReadyForReview(today: Date) {
    const claimMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const contracts = await this.prisma.contract.findMany({
      where: { status: ContractStatus.ACTIVE },
      include: {
        project: {
          include: {
            client: {
              include: {
                claimReminderUser: { select: { id: true, email: true, firstName: true, lastName: true } }
              }
            }
          }
        },
        progressClaims: {
          where: { claimMonth },
          select: { id: true }
        }
      }
    });

    const fallback = await this.prisma.user.findUnique({
      where: { id: "user-supervisor-002" },
      select: { id: true }
    });

    for (const contract of contracts) {
      // Skip if a claim for this month already exists.
      if (contract.progressClaims.length > 0) continue;

      const client = contract.project.client;
      const reminderUserId = client.claimReminderUserId ?? fallback?.id ?? null;
      const reminderUserEmail = client.claimReminderUser?.email ?? null;

      if (reminderUserId) {
        await this.notifications.create({
          userId: reminderUserId,
          title: `Draft claim ready — ${contract.project.projectNumber}`,
          body: `No progress claim has been generated yet for ${contract.project.projectNumber} — ${contract.project.name} this month. Please review and issue the claim before the cut-off date.`,
          severity: "LOW"
        });
      }

      if (reminderUserEmail) {
        void this.email.sendNotificationEmail({
          trigger: "claim.draft_ready_for_review",
          subject: `Draft progress claim ready — ${contract.project.projectNumber}`,
          html: `<p>No progress claim has been generated yet for <strong>${contract.project.projectNumber} — ${contract.project.name}</strong> this month. Please review and issue the claim before the cut-off date.</p>`,
          text: `No progress claim generated yet for ${contract.project.projectNumber} — ${contract.project.name} this month. Please review and issue the claim before the cut-off date.`
        });
      }
    }
  }
}
