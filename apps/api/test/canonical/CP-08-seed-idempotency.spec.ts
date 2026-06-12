import { execSync } from "node:child_process";
import { scryptSync } from "node:crypto";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

jest.setTimeout(300_000);

const repoRoot = join(__dirname, "..", "..", "..", "..");

function runSeed(): void {
  execSync("pnpm seed", { cwd: repoRoot, stdio: "inherit" });
}

describe("Canonical CP-08 — pnpm seed is idempotent", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("running the seed twice leaves every seeded table's row count unchanged", async () => {
    // Every Prisma model written by prisma/seed*.ts (upsert/create/createMany).
    const counters: Record<string, () => Promise<number>> = {
      asset: () => prisma.asset.count(),
      assetBreakdown: () => prisma.assetBreakdown.count(),
      assetCategory: () => prisma.assetCategory.count(),
      assetInspection: () => prisma.assetInspection.count(),
      assetMaintenanceEvent: () => prisma.assetMaintenanceEvent.count(),
      assetMaintenancePlan: () => prisma.assetMaintenancePlan.count(),
      assetStatusHistory: () => prisma.assetStatusHistory.count(),
      availabilityWindow: () => prisma.availabilityWindow.count(),
      client: () => prisma.client.count(),
      clientQuote: () => prisma.clientQuote.count(),
      competency: () => prisma.competency.count(),
      contact: () => prisma.contact.count(),
      crew: () => prisma.crew.count(),
      crewWorker: () => prisma.crewWorker.count(),
      cuttingOtherRate: () => prisma.cuttingOtherRate.count(),
      dashboard: () => prisma.dashboard.count(),
      dashboardWidget: () => prisma.dashboardWidget.count(),
      documentLink: () => prisma.documentLink.count(),
      entityInsurance: () => prisma.entityInsurance.count(),
      entityLicence: () => prisma.entityLicence.count(),
      estimateCoreHoleRate: () => prisma.estimateCoreHoleRate.count(),
      estimateCuttingRate: () => prisma.estimateCuttingRate.count(),
      estimateEnclosureRate: () => prisma.estimateEnclosureRate.count(),
      estimateFuelRate: () => prisma.estimateFuelRate.count(),
      estimateLabourRate: () => prisma.estimateLabourRate.count(),
      estimateMaterialDensity: () => prisma.estimateMaterialDensity.count(),
      estimatePlantRate: () => prisma.estimatePlantRate.count(),
      estimateWasteRate: () => prisma.estimateWasteRate.count(),
      formField: () => prisma.formField.count(),
      formRule: () => prisma.formRule.count(),
      formSection: () => prisma.formSection.count(),
      formSubmission: () => prisma.formSubmission.count(),
      formTemplate: () => prisma.formTemplate.count(),
      formTemplateVersion: () => prisma.formTemplateVersion.count(),
      globalAISettings: () => prisma.globalAISettings.count(),
      globalList: () => prisma.globalList.count(),
      globalListItem: () => prisma.globalListItem.count(),
      hazardNumberSequence: () => prisma.hazardNumberSequence.count(),
      hazardObservation: () => prisma.hazardObservation.count(),
      healthcheckSeedMarker: () => prisma.healthcheckSeedMarker.count(),
      job: () => prisma.job.count(),
      jobActivity: () => prisma.jobActivity.count(),
      jobCloseout: () => prisma.jobCloseout.count(),
      jobConversion: () => prisma.jobConversion.count(),
      jobIssue: () => prisma.jobIssue.count(),
      jobNumberSequence: () => prisma.jobNumberSequence.count(),
      jobProgressEntry: () => prisma.jobProgressEntry.count(),
      jobStage: () => prisma.jobStage.count(),
      jobStatusHistory: () => prisma.jobStatusHistory.count(),
      jobVariation: () => prisma.jobVariation.count(),
      lookupValue: () => prisma.lookupValue.count(),
      notification: () => prisma.notification.count(),
      notificationTriggerConfig: () => prisma.notificationTriggerConfig.count(),
      permission: () => prisma.permission.count(),
      persona: () => prisma.persona.count(),
      personaCompanyInstruction: () => prisma.personaCompanyInstruction.count(),
      quoteAssumption: () => prisma.quoteAssumption.count(),
      quoteCostLine: () => prisma.quoteCostLine.count(),
      quoteCostOption: () => prisma.quoteCostOption.count(),
      quoteExclusion: () => prisma.quoteExclusion.count(),
      quoteProvisionalLine: () => prisma.quoteProvisionalLine.count(),
      quoteScopeItem: () => prisma.quoteScopeItem.count(),
      resourceType: () => prisma.resourceType.count(),
      role: () => prisma.role.count(),
      rolePermission: () => prisma.rolePermission.count(),
      safetyIncident: () => prisma.safetyIncident.count(),
      safetyIncidentNumberSequence: () => prisma.safetyIncidentNumberSequence.count(),
      schedulingConflict: () => prisma.schedulingConflict.count(),
      scopeCard: () => prisma.scopeCard.count(),
      scopeOfWorksItem: () => prisma.scopeOfWorksItem.count(),
      searchEntry: () => prisma.searchEntry.count(),
      sharePointFileLink: () => prisma.sharePointFileLink.count(),
      sharePointFolderLink: () => prisma.sharePointFolderLink.count(),
      shift: () => prisma.shift.count(),
      shiftAssetAssignment: () => prisma.shiftAssetAssignment.count(),
      shiftRoleRequirement: () => prisma.shiftRoleRequirement.count(),
      shiftWorkerAssignment: () => prisma.shiftWorkerAssignment.count(),
      site: () => prisma.site.count(),
      subcontractorSupplier: () => prisma.subcontractorSupplier.count(),
      tender: () => prisma.tender.count(),
      tenderClarification: () => prisma.tenderClarification.count(),
      tenderClarificationNote: () => prisma.tenderClarificationNote.count(),
      tenderClient: () => prisma.tenderClient.count(),
      tenderDocumentLink: () => prisma.tenderDocumentLink.count(),
      tenderFollowUp: () => prisma.tenderFollowUp.count(),
      tenderNote: () => prisma.tenderNote.count(),
      tenderOutcome: () => prisma.tenderOutcome.count(),
      tenderPricingSnapshot: () => prisma.tenderPricingSnapshot.count(),
      user: () => prisma.user.count(),
      userDashboard: () => prisma.userDashboard.count(),
      userRole: () => prisma.userRole.count(),
      worker: () => prisma.worker.count(),
      workerCompetency: () => prisma.workerCompetency.count(),
      workerProfile: () => prisma.workerProfile.count(),
      workerQualification: () => prisma.workerQualification.count(),
      workerRoleSuitability: () => prisma.workerRoleSuitability.count()
    };

    runSeed();

    const first: Record<string, number> = {};
    for (const [name, count] of Object.entries(counters)) {
      first[name] = await count();
    }

    runSeed();

    const grew: string[] = [];
    for (const [name, count] of Object.entries(counters)) {
      const second = await count();
      if (second !== first[name]) {
        grew.push(`${name}: ${first[name]} -> ${second} (${second - first[name] > 0 ? "+" : ""}${second - first[name]})`);
      }
    }

    if (grew.length > 0) {
      throw new Error(
        `Seed is not idempotent — row counts changed on second run:\n${grew.join("\n")}`
      );
    }
  });

  // Row counts alone miss sequence regressions (LL-26): a re-seed that resets
  // a number sequence below already-issued numbers leaves counts intact but
  // breaks every subsequent create with unique-constraint collisions.
  it("safety number sequences are never left below the highest issued number", async () => {
    const maxSuffix = (numbers: string[], prefix: string): number =>
      numbers.reduce((max, value) => {
        if (!value.startsWith(prefix)) return max;
        const parsed = parseInt(value.slice(prefix.length), 10);
        return Number.isFinite(parsed) && parsed > max ? parsed : max;
      }, 0);

    const incidents = await prisma.safetyIncident.findMany({
      select: { incidentNumber: true }
    });
    const incidentSeq = await prisma.safetyIncidentNumberSequence.findUnique({
      where: { id: 1 }
    });
    expect(incidentSeq).not.toBeNull();
    expect(incidentSeq!.lastNumber).toBeGreaterThanOrEqual(
      maxSuffix(incidents.map((r) => r.incidentNumber), "IS-INC")
    );

    const hazards = await prisma.hazardObservation.findMany({
      select: { hazardNumber: true }
    });
    const hazardSeq = await prisma.hazardNumberSequence.findUnique({
      where: { id: 1 }
    });
    expect(hazardSeq).not.toBeNull();
    expect(hazardSeq!.lastNumber).toBeGreaterThanOrEqual(
      maxSuffix(hazards.map((r) => r.hazardNumber), "IS-HAZ")
    );
  });
});

// G3 (pr-173) — pnpm seed:prod provisions reference data + SSO-only staff
// users and never creates demo entities. Runs against a scratch schema in the
// same local server so the dev database is untouched.
describe("Canonical CP-08 — pnpm seed:prod is idempotent and demo-free", () => {
  const devUrl =
    process.env.DATABASE_URL ??
    "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public";
  const SCRATCH_SCHEMA = "cp08_seed_prod_scratch";
  const scratchUrl = devUrl.includes("schema=")
    ? devUrl.replace(/schema=[^&]+/, `schema=${SCRATCH_SCHEMA}`)
    : `${devUrl}${devUrl.includes("?") ? "&" : "?"}schema=${SCRATCH_SCHEMA}`;
  let scratch: PrismaClient;

  const runProdSeed = () =>
    execSync("pnpm seed:prod", {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: scratchUrl }
    });

  beforeAll(() => {
    execSync("pnpm --filter @project-ops/api exec prisma db push --skip-generate", {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: scratchUrl }
    });
    scratch = new PrismaClient({ datasources: { db: { url: scratchUrl } } });
  });

  afterAll(async () => {
    await scratch.$disconnect();
    const admin = new PrismaClient({ datasources: { db: { url: devUrl } } });
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCRATCH_SCHEMA}" CASCADE`);
    await admin.$disconnect();
  });

  it("creates reference data + 3 SSO-only users, zero demo rows, stable across two runs", async () => {
    const counts = async () => ({
      user: await scratch.user.count(),
      userRole: await scratch.userRole.count(),
      workerProfile: await scratch.workerProfile.count(),
      role: await scratch.role.count(),
      permission: await scratch.permission.count(),
      rolePermission: await scratch.rolePermission.count(),
      estimateLabourRate: await scratch.estimateLabourRate.count(),
      estimatePlantRate: await scratch.estimatePlantRate.count(),
      estimateCuttingRate: await scratch.estimateCuttingRate.count(),
      cuttingOtherRate: await scratch.cuttingOtherRate.count(),
      estimateMaterialDensity: await scratch.estimateMaterialDensity.count(),
      globalList: await scratch.globalList.count(),
      globalListItem: await scratch.globalListItem.count(),
      lookupValue: await scratch.lookupValue.count(),
      formTemplate: await scratch.formTemplate.count(),
      notificationTriggerConfig: await scratch.notificationTriggerConfig.count(),
      persona: await scratch.persona.count(),
      client: await scratch.client.count(),
      contact: await scratch.contact.count(),
      site: await scratch.site.count(),
      tender: await scratch.tender.count(),
      worker: await scratch.worker.count(),
      job: await scratch.job.count(),
      formSubmission: await scratch.formSubmission.count()
    });

    runProdSeed();
    const first = await counts();
    runProdSeed();
    const second = await counts();
    expect(second).toEqual(first);

    // Reference layer present.
    expect(first.permission).toBeGreaterThan(0);
    expect(first.role).toBeGreaterThanOrEqual(10);
    expect(first.estimateLabourRate).toBeGreaterThan(0);
    expect(first.estimateCuttingRate).toBeGreaterThan(0);
    expect(first.cuttingOtherRate).toBeGreaterThan(0);
    expect(first.estimateMaterialDensity).toBeGreaterThan(0);
    expect(first.globalList).toBeGreaterThan(0);
    expect(first.globalListItem).toBeGreaterThan(0);
    expect(first.formTemplate).toBeGreaterThan(0);
    expect(first.notificationTriggerConfig).toBeGreaterThan(0);
    expect(first.persona).toBeGreaterThan(0);

    // Exactly the Section-1 pilot users; Marco carries Admin + WHS Officer.
    expect(first.user).toBe(3);
    expect(first.userRole).toBe(4);
    expect(first.workerProfile).toBe(3);

    // Zero demo entities.
    expect(first.client).toBe(0);
    expect(first.contact).toBe(0);
    expect(first.site).toBe(0);
    expect(first.tender).toBe(0);
    expect(first.worker).toBe(0);
    expect(first.job).toBe(0);
    expect(first.formSubmission).toBe(0);

    const users = await scratch.user.findMany({
      select: { email: true, ssoOnly: true, isSuperUser: true, passwordHash: true }
    });
    expect(users.every((u) => u.ssoOnly)).toBe(true);
    expect(users.every((u) => u.email.endsWith("@initialservices.net"))).toBe(true);
    expect(users.find((u) => u.email === "sean@initialservices.net")?.isSuperUser).toBe(true);

    // The shared dev password must not unlock any prod account.
    for (const u of users) {
      const [salt, derivedKey] = u.passwordHash.split(":");
      expect(salt).toBeTruthy();
      expect(scryptSync("Password123!", salt, 64).toString("hex")).not.toBe(derivedKey);
    }
  });

  it("refuses (non-zero exit) when the target database contains dev seed users", async () => {
    await scratch.user.create({
      data: {
        id: "cp08-dev-pollution",
        email: "admin@projectops.local",
        firstName: "Alex",
        lastName: "Admin",
        isActive: true,
        passwordHash: "deadbeef:deadbeef"
      }
    });
    try {
      expect(() =>
        execSync("pnpm seed:prod", {
          cwd: repoRoot,
          stdio: "pipe",
          env: { ...process.env, DATABASE_URL: scratchUrl }
        })
      ).toThrow();
    } finally {
      await scratch.user.delete({ where: { id: "cp08-dev-pollution" } });
    }
  });
});
