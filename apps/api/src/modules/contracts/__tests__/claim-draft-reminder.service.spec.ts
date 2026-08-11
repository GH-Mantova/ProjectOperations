// Mock-based unit tests for ClaimDraftReminderService.
// Mirrors the house pattern in contracts.service.spec.ts: Prisma is a
// plain object of jest.fn()s built per-test by `buildService`, and the
// service is instantiated directly with `as never` casts on injected
// dependencies.
//
// Two core cases are exercised:
//   1. An ACTIVE contract with no ProgressClaim for the current month
//      receives a notification + email.
//   2. An ACTIVE contract that already has a ProgressClaim for the current
//      month is skipped (no notification, no email).

import { ClaimDraftReminderService } from "../claim-draft-reminder.service";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TODAY = new Date(Date.UTC(2026, 7, 28)); // 2026-08-28

const activeContract = (overrides: Record<string, unknown> = {}) => ({
  id: "contract-1",
  status: "ACTIVE",
  project: {
    id: "project-1",
    projectNumber: "P-2026-001",
    name: "Demo Project",
    client: {
      id: "client-1",
      name: "Acme Pty Ltd",
      claimReminderUserId: "user-1",
      claimReminderUser: {
        id: "user-1",
        email: "amy@initialservices.net",
        firstName: "Amy",
        lastName: "Accounts"
      }
    }
  },
  progressClaims: [],
  ...overrides
});

// ─── Builder ──────────────────────────────────────────────────────────────────

function buildService(extraPrisma: Record<string, unknown> = {}) {
  const notificationCreate = jest.fn().mockResolvedValue(undefined);
  const sendNotificationEmail = jest.fn().mockResolvedValue(undefined);

  const prisma: Record<string, unknown> = {
    contract: {
      findMany: jest.fn().mockResolvedValue([])
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "user-supervisor-002" })
    },
    ...extraPrisma
  };

  const notifications = { create: notificationCreate };
  const email = { sendNotificationEmail };

  const service = new ClaimDraftReminderService(
    prisma as never,
    notifications as never,
    email as never
  );

  return { service, prisma, notificationCreate, sendNotificationEmail };
}

// ─── checkDraftsReadyForReview ─────────────────────────────────────────────────

describe("ClaimDraftReminderService.checkDraftsReadyForReview", () => {
  it("notifies the reminder user and emails when no claim exists for the current month", async () => {
    const { service, prisma, notificationCreate, sendNotificationEmail } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      activeContract({ progressClaims: [] })
    ]);

    await service.checkDraftsReadyForReview(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        title: "Draft claim ready — P-2026-001",
        severity: "LOW"
      })
    );
    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "claim.draft_ready_for_review",
        subject: "Draft progress claim ready — P-2026-001"
      })
    );
  });

  it("skips a contract that already has a claim for the current month", async () => {
    const { service, prisma, notificationCreate, sendNotificationEmail } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      activeContract({ progressClaims: [{ id: "claim-1" }] })
    ]);

    await service.checkDraftsReadyForReview(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("falls back to user-supervisor-002 when the client has no reminder user configured", async () => {
    const { service, prisma, notificationCreate, sendNotificationEmail } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      activeContract({
        progressClaims: [],
        project: {
          id: "project-1",
          projectNumber: "P-2026-001",
          name: "Demo Project",
          client: {
            id: "client-1",
            name: "Acme Pty Ltd",
            claimReminderUserId: null,
            claimReminderUser: null
          }
        }
      })
    ]);

    await service.checkDraftsReadyForReview(TODAY);

    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-supervisor-002" })
    );
    // No email address available for the fallback user → no email sent.
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("sends no email when the reminder user has no email address", async () => {
    const { service, prisma, notificationCreate, sendNotificationEmail } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      activeContract({
        progressClaims: [],
        project: {
          id: "project-1",
          projectNumber: "P-2026-001",
          name: "Demo Project",
          client: {
            id: "client-1",
            name: "Acme Pty Ltd",
            claimReminderUserId: "user-1",
            claimReminderUser: { id: "user-1", email: null, firstName: "Amy", lastName: "Accounts" }
          }
        }
      })
    ]);

    await service.checkDraftsReadyForReview(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("handles multiple contracts independently — only those missing a claim are notified", async () => {
    const { service, prisma, notificationCreate, sendNotificationEmail } = buildService();
    const contractWithClaim = activeContract({
      id: "contract-2",
      progressClaims: [{ id: "claim-existing" }],
      project: {
        id: "project-2",
        projectNumber: "P-2026-002",
        name: "Second Project",
        client: {
          id: "client-2",
          name: "Beta Pty Ltd",
          claimReminderUserId: "user-2",
          claimReminderUser: { id: "user-2", email: "beta@example.com", firstName: "Bob", lastName: "Beta" }
        }
      }
    });
    (prisma.contract as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      activeContract({ progressClaims: [] }),
      contractWithClaim
    ]);

    await service.checkDraftsReadyForReview(TODAY);

    // Only the first contract (no claim) should be notified.
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" })
    );
    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
  });
});

// ─── runClaimDraftReminders ────────────────────────────────────────────────────

describe("ClaimDraftReminderService.runClaimDraftReminders", () => {
  it("swallows errors from the inner check so the cron never crashes", async () => {
    const { service, prisma } = buildService();
    (prisma.contract as { findMany: jest.Mock }).findMany.mockRejectedValueOnce(new Error("db down"));
    await expect(service.runClaimDraftReminders()).resolves.toBeUndefined();
  });
});
