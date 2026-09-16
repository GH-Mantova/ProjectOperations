// SCOPE_QUOTE_DESTINATION_V1 (scopecards-s2a) -- backfill spec.
//
// Re-executes the UPDATE-only statements from migration
// 20260916090001_scopecards_s2a_quote_destination_backfill against the
// test database and asserts:
//   (a) A plain DEM item stays PRICE.
//   (b) An item with is_provisional=true becomes PROVISIONAL.
//   (c) An item on an Other-discipline card becomes PROVISIONAL.
//   (d) An item with priced_by_sub_item_id set becomes INTERNAL.
//   (e) An item already at OPTION is NOT touched.
//   A second run changes nothing (idempotent).
//
// Pattern taken from bp0a2-backfill.spec.ts: loadStatements() + $transaction.
// Runs against the real test database -- serial suite only.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, QuoteDestination } from "@prisma/client";
import { SEEDED_DEFAULT_TENANT_ID } from "../../../common/tenancy/tenant.constants";

jest.setTimeout(60_000);

const MIGRATION_SQL_PATH = join(
  __dirname,
  "../../../../prisma/migrations/20260916090001_scopecards_s2a_quote_destination_backfill/migration.sql"
);

function loadStatements(): string[] {
  const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

describe("S2a backfill -- quote_destination derivation from legacy columns", () => {
  const prisma = new PrismaClient();

  const PREFIX = "ZZTEST-S2A-BF-";

  // IDs captured in beforeAll
  let tenderId: string;
  let cardDemId: string;
  let cardOtherId: string;
  let itemPlainId: string;
  let itemProvFlagId: string;
  let itemOtherCardId: string;
  let itemSubLinkedId: string;
  let subItemId: string;
  let itemAlreadyOptionId: string;

  async function runBackfill(): Promise<void> {
    const statements = loadStatements();
    await prisma.$transaction(statements.map((stmt) => prisma.$executeRawUnsafe(stmt)));
  }

  async function cleanup(): Promise<void> {
    await prisma.scopeOfWorksItem.deleteMany({ where: { tender: { tenderNumber: { startsWith: PREFIX } } } });
    await prisma.scopeCard.deleteMany({ where: { tender: { tenderNumber: { startsWith: PREFIX } } } });
    await prisma.tender.deleteMany({ where: { tenderNumber: { startsWith: PREFIX } } });
    await prisma.site.deleteMany({ where: { name: PREFIX + "Site" } });
    await prisma.client.deleteMany({ where: { name: PREFIX + "Client" } });
    await prisma.user.deleteMany({ where: { email: PREFIX + "user@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();

    const user = await prisma.user.create({
      data: {
        email: PREFIX + "user@projectops.local",
        firstName: "ZZTEST",
        lastName: "S2A-BF",
        passwordHash: "not-a-login"
      }
    });

    const client = await prisma.client.create({ data: { name: PREFIX + "Client" } });
    const site = await prisma.site.create({
      data: {
        name: PREFIX + "Site",
        clientId: client.id,
        addressLine1: "1 Backfill St",
        suburb: "Test",
        state: "QLD",
        postcode: "4000"
      }
    });

    const tender = await prisma.tender.create({
      data: {
        tenantId: SEEDED_DEFAULT_TENANT_ID,
        tenderNumber: PREFIX + "T1",
        title: PREFIX + "Tender",
        siteId: site.id
      }
    });
    tenderId = tender.id;

    const cardDem = await prisma.scopeCard.create({
      data: {
        tenderId,
        discipline: "DEM",
        cardNumber: 1,
        sortOrder: 0,
        createdById: user.id
      }
    });
    cardDemId = cardDem.id;

    const cardOther = await prisma.scopeCard.create({
      data: {
        tenderId,
        discipline: "Other",
        cardNumber: 2,
        sortOrder: 1,
        createdById: user.id
      }
    });
    cardOtherId = cardOther.id;

    // (a) plain DEM item -- no flags, expect PRICE after backfill
    const itemPlain = await prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId: cardDemId,
        wbsCode: "DEM1.1",
        itemNumber: 1,
        rowType: "general-labour",
        description: "Plain item",
        status: "confirmed",
        aiProposed: false,
        createdById: user.id,
        isProvisional: false
      }
    });
    itemPlainId = itemPlain.id;

    // (b) DEM item with is_provisional=true, expect PROVISIONAL after backfill
    const itemProvFlag = await prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId: cardDemId,
        wbsCode: "DEM1.2",
        itemNumber: 2,
        rowType: "general-labour",
        description: "Provisional flag item",
        status: "confirmed",
        aiProposed: false,
        createdById: user.id,
        isProvisional: true
      }
    });
    itemProvFlagId = itemProvFlag.id;

    // (c) item on Other-discipline card, expect PROVISIONAL after backfill
    const itemOtherCard = await prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId: cardOtherId,
        wbsCode: "Other2.1",
        itemNumber: 1,
        rowType: "general-labour",
        description: "Other card item",
        status: "confirmed",
        aiProposed: false,
        createdById: user.id,
        isProvisional: false
      }
    });
    itemOtherCardId = itemOtherCard.id;

    // (d) SUB line that will cover another item
    const subItem = await prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId: cardDemId,
        wbsCode: "DEM1.3",
        itemNumber: 3,
        rowType: "general-labour",
        description: "SUB line",
        status: "confirmed",
        aiProposed: false,
        createdById: user.id,
        isProvisional: false
      }
    });
    subItemId = subItem.id;

    // (d) item with priced_by_sub_item_id set, expect INTERNAL after backfill
    const itemSubLinked = await prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId: cardDemId,
        wbsCode: "DEM1.4",
        itemNumber: 4,
        rowType: "general-labour",
        description: "Sub-linked item",
        status: "confirmed",
        aiProposed: false,
        createdById: user.id,
        isProvisional: false,
        pricedBySubItemId: subItemId
      }
    });
    itemSubLinkedId = itemSubLinked.id;

    // (e) item already at OPTION, must NOT be changed by backfill
    const itemAlreadyOption = await prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId: cardDemId,
        wbsCode: "DEM1.5",
        itemNumber: 5,
        rowType: "general-labour",
        description: "Already OPTION",
        status: "confirmed",
        aiProposed: false,
        createdById: user.id,
        isProvisional: false,
        quoteDestination: QuoteDestination.OPTION
      }
    });
    itemAlreadyOptionId = itemAlreadyOption.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("(a) plain DEM item stays PRICE after backfill", async () => {
    await runBackfill();
    const item = await prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemPlainId } });
    expect(item.quoteDestination).toBe(QuoteDestination.PRICE);
  });

  it("(b) item with is_provisional=true becomes PROVISIONAL", async () => {
    const item = await prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemProvFlagId } });
    expect(item.quoteDestination).toBe(QuoteDestination.PROVISIONAL);
  });

  it("(c) item on Other-discipline card becomes PROVISIONAL", async () => {
    const item = await prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemOtherCardId } });
    expect(item.quoteDestination).toBe(QuoteDestination.PROVISIONAL);
  });

  it("(d) item with priced_by_sub_item_id set becomes INTERNAL", async () => {
    const item = await prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemSubLinkedId } });
    expect(item.quoteDestination).toBe(QuoteDestination.INTERNAL);
  });

  it("(e) item already at OPTION is unchanged", async () => {
    const item = await prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemAlreadyOptionId } });
    expect(item.quoteDestination).toBe(QuoteDestination.OPTION);
  });

  it("second run is a no-op (idempotent)", async () => {
    await runBackfill();
    const [plain, prov, other, linked, option] = await Promise.all([
      prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemPlainId } }),
      prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemProvFlagId } }),
      prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemOtherCardId } }),
      prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemSubLinkedId } }),
      prisma.scopeOfWorksItem.findUniqueOrThrow({ where: { id: itemAlreadyOptionId } })
    ]);
    expect(plain.quoteDestination).toBe(QuoteDestination.PRICE);
    expect(prov.quoteDestination).toBe(QuoteDestination.PROVISIONAL);
    expect(other.quoteDestination).toBe(QuoteDestination.PROVISIONAL);
    expect(linked.quoteDestination).toBe(QuoteDestination.INTERNAL);
    expect(option.quoteDestination).toBe(QuoteDestination.OPTION);
  });
});
