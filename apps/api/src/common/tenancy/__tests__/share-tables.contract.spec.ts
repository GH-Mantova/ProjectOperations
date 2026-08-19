// MT-4 SLICE 1 — share-tables contract tests.
//
// These tests assert DB-level contracts on the three share tables introduced
// by this slice: client_shares, worker_shares, contact_shares.
//
// They use PrismaClient directly (no NestJS bootstrapping) so they can run
// independently of the full application stack.  They are skipped when
// DATABASE_URL is not set, matching the behaviour of other infrastructure-
// dependent specs in this repo.
//
// Contract assertions:
//   1. Each table exists and starts empty (no seed data for share grants).
//   2. Inserting a duplicate (recordId, granteeTenantId) pair is rejected by
//      the unique index — the DB enforces the "one grant per pair" invariant.

import { PrismaClient } from "@prisma/client";

const DB_URL = process.env.DATABASE_URL;
const DESCRIBE = DB_URL ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Helper — a tiny random id. Not cryptographically strong, but fine for test
// fixture generation that only needs to be locally unique.
// ---------------------------------------------------------------------------
function testId(): string {
  return `t${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Fixture: create a tenant, a user, a client, a worker, and a contact in the
// DB so we can create share rows against them.
// ---------------------------------------------------------------------------
async function createFixtures(prisma: PrismaClient) {
  const ownerName = `OwnerTenant-${testId()}`;
  const granteeName = `GranteeTenant-${testId()}`;

  const tenantOwner = await prisma.tenant.create({
    data: { name: ownerName },
  });

  const tenantGrantee = await prisma.tenant.create({
    data: { name: granteeName },
  });

  const user = await prisma.user.create({
    data: {
      email: `share-test-${testId()}@example.com`,
      firstName: "Share",
      lastName: "Test",
      passwordHash: "irrelevant-hash-for-tests",
    },
  });

  const client = await prisma.client.create({
    data: {
      name: `TestClient-${testId()}`,
      tenantId: tenantOwner.id,
    },
  });

  const worker = await prisma.worker.create({
    data: {
      firstName: "Share",
      lastName: `Worker-${testId()}`,
      tenantId: tenantOwner.id,
    },
  });

  const contact = await prisma.contact.create({
    data: {
      organisationType: "CLIENT",
      organisationId: client.id,
      firstName: "Share",
      lastName: `Contact-${testId()}`,
      tenantId: tenantOwner.id,
    },
  });

  return { tenantOwner, tenantGrantee, user, client, worker, contact };
}

// ---------------------------------------------------------------------------
// Cleanup helpers — ordered to respect FK constraints.
// ---------------------------------------------------------------------------
async function teardownFixture(
  prisma: PrismaClient,
  fixture: Awaited<ReturnType<typeof createFixtures>>,
  extraTenantIds: string[] = []
) {
  // shares first
  await prisma.clientShare.deleteMany({ where: { clientId: fixture.client.id } });
  await prisma.workerShare.deleteMany({ where: { workerId: fixture.worker.id } });
  await prisma.contactShare.deleteMany({ where: { contactId: fixture.contact.id } });
  // owned records
  await prisma.client.deleteMany({ where: { id: fixture.client.id } });
  await prisma.worker.deleteMany({ where: { id: fixture.worker.id } });
  await prisma.contact.deleteMany({ where: { id: fixture.contact.id } });
  // user
  await prisma.user.deleteMany({ where: { id: fixture.user.id } });
  // tenants last
  const tenantIds = [
    fixture.tenantOwner.id,
    fixture.tenantGrantee.id,
    ...extraTenantIds,
  ];
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

DESCRIBE("MT-4 SLICE 1 — share tables DB contract", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url: DB_URL! } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // 1. Tables exist and are queryable (no seeded share grants)
  // -------------------------------------------------------------------------

  describe("tables exist and are empty", () => {
    it("client_shares count() returns 0 on a clean seed", async () => {
      const count = await prisma.clientShare.count();
      expect(count).toBe(0);
    });

    it("worker_shares count() returns 0 on a clean seed", async () => {
      const count = await prisma.workerShare.count();
      expect(count).toBe(0);
    });

    it("contact_shares count() returns 0 on a clean seed", async () => {
      const count = await prisma.contactShare.count();
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Unique index: duplicate (recordId, granteeTenantId) is rejected
  // -------------------------------------------------------------------------

  describe("unique index enforcement", () => {
    it("ClientShare rejects a duplicate (clientId, granteeTenantId) grant", async () => {
      const fx = await createFixtures(prisma);

      try {
        await prisma.clientShare.create({
          data: {
            clientId: fx.client.id,
            granteeTenantId: fx.tenantGrantee.id,
            grantedByUserId: fx.user.id,
          },
        });

        // Second create with the same pair must throw a unique-constraint error.
        await expect(
          prisma.clientShare.create({
            data: {
              clientId: fx.client.id,
              granteeTenantId: fx.tenantGrantee.id,
              grantedByUserId: fx.user.id,
              note: "duplicate attempt",
            },
          })
        ).rejects.toThrow();
      } finally {
        await teardownFixture(prisma, fx);
      }
    });

    it("WorkerShare rejects a duplicate (workerId, granteeTenantId) grant", async () => {
      const fx = await createFixtures(prisma);

      try {
        await prisma.workerShare.create({
          data: {
            workerId: fx.worker.id,
            granteeTenantId: fx.tenantGrantee.id,
            grantedByUserId: fx.user.id,
          },
        });

        await expect(
          prisma.workerShare.create({
            data: {
              workerId: fx.worker.id,
              granteeTenantId: fx.tenantGrantee.id,
              grantedByUserId: fx.user.id,
            },
          })
        ).rejects.toThrow();
      } finally {
        await teardownFixture(prisma, fx);
      }
    });

    it("ContactShare rejects a duplicate (contactId, granteeTenantId) grant", async () => {
      const fx = await createFixtures(prisma);

      try {
        await prisma.contactShare.create({
          data: {
            contactId: fx.contact.id,
            granteeTenantId: fx.tenantGrantee.id,
            grantedByUserId: fx.user.id,
          },
        });

        await expect(
          prisma.contactShare.create({
            data: {
              contactId: fx.contact.id,
              granteeTenantId: fx.tenantGrantee.id,
              grantedByUserId: fx.user.id,
            },
          })
        ).rejects.toThrow();
      } finally {
        await teardownFixture(prisma, fx);
      }
    });

    it("a different granteeTenantId on the same record is accepted", async () => {
      const fx = await createFixtures(prisma);
      const tenantGrantee2 = await prisma.tenant.create({
        data: { name: `GranteeTenant2-${testId()}` },
      });

      try {
        await prisma.clientShare.create({
          data: {
            clientId: fx.client.id,
            granteeTenantId: fx.tenantGrantee.id,
            grantedByUserId: fx.user.id,
          },
        });

        // Different grantee on same client — must succeed.
        const share2 = await prisma.clientShare.create({
          data: {
            clientId: fx.client.id,
            granteeTenantId: tenantGrantee2.id,
            grantedByUserId: fx.user.id,
          },
        });

        expect(typeof share2.id).toBe("string");
        expect(share2.clientId).toBe(fx.client.id);
        expect(share2.granteeTenantId).toBe(tenantGrantee2.id);
      } finally {
        await teardownFixture(prisma, fx, [tenantGrantee2.id]);
      }
    });
  });
});
