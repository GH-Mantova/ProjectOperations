import { execSync } from "node:child_process";
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
});
