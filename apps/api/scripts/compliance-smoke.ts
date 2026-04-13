import type { INestApplication } from "@nestjs/common";
import request, { type SuperTest, type Test } from "supertest";
import { createApp } from "../src/bootstrap/create-app";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    permissions: string[];
  };
};

type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

type IdName = {
  id: string;
  name?: string;
};

type NamedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

function bearer(client: SuperTest<Test>, token: string) {
  return {
    get: (url: string) => client.get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string) => client.post(url).set("Authorization", `Bearer ${token}`),
    patch: (url: string) => client.patch(url).set("Authorization", `Bearer ${token}`)
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const app = await createApp();
  await app.init();

  try {
    const client = request(app.getHttpServer());
    const now = Date.now();
    const token = await login(client);
    const api = bearer(client, token.accessToken);

    const clients = await fetchPage<IdName>(api.get("/api/v1/master-data/clients"));
    const sites = await fetchPage<IdName>(api.get("/api/v1/master-data/sites"));
    const workers = await fetchPage<IdName & { firstName?: string; lastName?: string }>(api.get("/api/v1/master-data/workers"));
    const assets = await fetchPage<IdName & { assetCode?: string }>(api.get("/api/v1/assets"));
    const users = await fetchPage<NamedUser>(api.get("/api/v1/users"));

    assert(clients.items.length >= 2, "Need at least two clients in seed data.");
    assert(sites.items.length >= 1, "Need at least one site in seed data.");
    assert(workers.items.length >= 1, "Need at least one worker in seed data.");
    assert(assets.items.length >= 1, "Need at least one asset in seed data.");
    assert(users.items.length >= 2, "Need at least two users in seed data.");

    const planner = users.items.find((user) => user.email === "scheduler@projectops.local") ?? users.items[0];
    const supervisor = users.items.find((user) => user.email === "supervisor@projectops.local") ?? users.items[1];

    const tenderCreateResponse = await api.post("/api/v1/tenders").send({
      tenderNumber: `TEN-COMP-${now}`,
      title: `Compliance Tender ${now}`,
      description: "Automated compliance smoke tender.",
      estimatorUserId: planner.id,
      status: "SUBMITTED",
      dueDate: "2026-04-10T00:00:00.000Z",
      proposedStartDate: "2026-04-14T00:00:00.000Z",
      leadTimeDays: 7,
      probability: 65,
      estimatedValue: "125000.00",
      notes: "Created by compliance smoke runner.",
      tenderClients: [
        {
          clientId: clients.items[0].id,
          relationshipType: "Primary Bidder",
          notes: "First invited client."
        },
        {
          clientId: clients.items[1].id,
          relationshipType: "Secondary Bidder",
          notes: "Second invited client."
        }
      ],
      tenderNotes: [{ body: "Compliance note recorded." }],
      clarifications: [{ subject: "Clarification required", status: "OPEN" }],
      pricingSnapshots: [{ versionLabel: "v1", estimatedValue: "125000.00", marginPercent: "21.50" }],
      followUps: [{ dueAt: "2026-04-08T00:00:00.000Z", details: "Follow up with tender clients.", assignedUserId: planner.id }],
      outcomes: [{ outcomeType: "PENDING_REVIEW", notes: "Awaiting award decision." }]
    }).expect(201);

    const tender = tenderCreateResponse.body;
    assert(tender.tenderClients?.length === 2, "Tender should include two linked tender clients.");

    const tenderDocument = await api.post(`/api/v1/tenders/${tender.id}/documents`).send({
      category: "Clarifications",
      title: "Compliance Tender Scope",
      description: "Tender document created by smoke runner.",
      fileName: `compliance-tender-${now}.pdf`,
      mimeType: "application/pdf"
    }).expect(201);

    assert(tenderDocument.body.id, "Tender document should be created.");

    const awardedTenderClientId = tender.tenderClients[0].id;
    await api.patch(`/api/v1/tenders/${tender.id}/award`).send({
      tenderClientId: awardedTenderClientId
    }).expect(200);

    await api.patch(`/api/v1/tenders/${tender.id}/contract`).send({
      tenderClientId: awardedTenderClientId,
      contractIssuedAt: "2026-04-09T00:00:00.000Z"
    }).expect(200);

    const conversionResponse = await api.post(`/api/v1/tenders/${tender.id}/convert-to-job`).send({
      jobNumber: `JOB-COMP-${now}`,
      name: `Compliance Job ${now}`,
      description: "Automated conversion target job.",
      siteId: sites.items[0].id,
      projectManagerId: planner.id,
      supervisorId: supervisor.id,
      carryTenderDocuments: true,
      tenderDocumentIds: [tenderDocument.body.id]
    }).expect(201);

    const job = conversionResponse.body.job ?? conversionResponse.body;
    assert(job?.id, "Tender conversion should return a job.");

    const stageResponse = await api.post(`/api/v1/jobs/${job.id}/stages`).send({
      name: "Mobilisation",
      description: "Compliance stage",
      stageOrder: 1,
      status: "PLANNED",
      startDate: "2026-04-15T00:00:00.000Z",
      endDate: "2026-04-16T00:00:00.000Z"
    }).expect(201);

    const stage = [...(stageResponse.body.stages ?? [])]
      .sort((left: { createdAt?: string }, right: { createdAt?: string }) =>
        (right.createdAt ?? "").localeCompare(left.createdAt ?? "")
      )[0];
    assert(stage?.id, "Job stage should be created.");

    const activityResponse = await api.post(`/api/v1/jobs/${job.id}/activities`).send({
      jobStageId: stage.id,
      name: "Field Setup",
      description: "Compliance activity",
      activityOrder: 1,
      status: "PLANNED",
      plannedDate: "2026-04-15T00:00:00.000Z",
      notes: "Initial field setup activity."
    }).expect(201);

    const activity = (activityResponse.body.stages ?? [])
      .flatMap((item: { activities?: Array<{ id: string; createdAt?: string }> }) => item.activities ?? [])
      .sort((left: { createdAt?: string }, right: { createdAt?: string }) =>
        (right.createdAt ?? "").localeCompare(left.createdAt ?? "")
      )[0];
    assert(activity?.id, "Job activity should be created.");

    const shiftResponse = await api.post("/api/v1/scheduler/shifts").send({
      jobId: job.id,
      jobStageId: stage.id,
      jobActivityId: activity.id,
      title: "Compliance Day Shift",
      startAt: "2026-04-15T07:00:00.000Z",
      endAt: "2026-04-15T15:00:00.000Z",
      status: "PLANNED",
      notes: "Compliance shift",
      workInstructions: "Complete mobilisation and setup."
    }).expect(201);

    const shift = shiftResponse.body;
    assert(shift?.id, "Shift should be created.");

    await api.post(`/api/v1/scheduler/shifts/${shift.id}/workers`).send({
      workerId: workers.items[0].id,
      roleLabel: "Lead Operator"
    }).expect(201);

    await api.post(`/api/v1/scheduler/shifts/${shift.id}/assets`).send({
      assetId: assets.items[0].id
    }).expect(201);

    const schedulerWorkspaceResponse = await api.get("/api/v1/scheduler/workspace?view=job&mode=week").expect(200);
    const schedulerWorkspace = schedulerWorkspaceResponse.body;
    const workspaceShifts = schedulerWorkspace.items?.shifts ?? [];
    const workspaceConflicts = workspaceShifts.flatMap(
      (item: { conflicts?: Array<{ id: string }> }) => item.conflicts ?? []
    );
    assert(
      Array.isArray(workspaceShifts) && workspaceShifts.some((item: { id: string }) => item.id === shift.id),
      "Scheduler workspace should include the created shift."
    );
    assert(Array.isArray(workspaceConflicts), "Scheduler workspace should return conflicts.");

    const maintenanceAssetsResponse = await api.get("/api/v1/maintenance/assets").expect(200);
    const maintenanceAssets = maintenanceAssetsResponse.body.items ?? maintenanceAssetsResponse.body;
    assert(Array.isArray(maintenanceAssets), "Maintenance assets response should be an array.");
    assert(
      maintenanceAssets.some((item: { maintenanceSummary?: { maintenanceState?: string; schedulerImpact?: string } }) =>
        item.maintenanceSummary?.maintenanceState === "DUE_SOON" ||
        item.maintenanceSummary?.maintenanceState === "OVERDUE" ||
        item.maintenanceSummary?.maintenanceState === "UNAVAILABLE" ||
        item.maintenanceSummary?.schedulerImpact === "BLOCK"
      ),
      "Maintenance dataset should include at least one due/overdue asset state."
    );

    const formTemplateResponse = await api.post("/api/v1/forms/templates").send({
      name: `Compliance Check ${now}`,
      code: `COMP-${now}`,
      description: "Compliance smoke form template",
      status: "ACTIVE",
      geolocationEnabled: true,
      associationScopes: ["job", "shift", "asset", "worker", "site"],
      sections: [
        {
          title: "General",
          description: "Basic compliance data",
          sectionOrder: 1,
          fields: [
            {
              fieldKey: "site_ready",
              label: "Site ready",
              fieldType: "multiple_choice",
              fieldOrder: 1,
              isRequired: true,
              optionsJson: ["Yes", "No"]
            },
            {
              fieldKey: "comments",
              label: "Comments",
              fieldType: "textarea",
              fieldOrder: 2
            }
          ]
        }
      ],
      rules: [
        {
          sourceFieldKey: "site_ready",
          targetFieldKey: "comments",
          operator: "equals",
          comparisonValue: "No",
          effect: "require"
        }
      ]
    }).expect(201);

    const latestVersion = formTemplateResponse.body.versions?.[0];
    assert(latestVersion?.id, "Form template should return a latest version.");

    const formSubmissionResponse = await api.post(`/api/v1/forms/versions/${latestVersion.id}/submissions`).send({
      status: "SUBMITTED",
      jobId: job.id,
      assetId: assets.items[0].id,
      workerId: workers.items[0].id,
      siteId: sites.items[0].id,
      shiftId: shift.id,
      summary: "Compliance submission",
      geolocation: "-27.4698,153.0251",
      values: [
        {
          fieldKey: "site_ready",
          valueText: "Yes"
        },
        {
          fieldKey: "comments",
          valueText: "Site setup verified."
        }
      ],
      attachments: [
        {
          fieldKey: "comments",
          fileName: `compliance-${now}.jpg`,
          fileUrl: "https://sharepoint.local/mock/compliance.jpg"
        }
      ],
      signatures: [
        {
          signerName: "Compliance Runner",
          signedAt: "2026-04-15T07:10:00.000Z"
        }
      ]
    }).expect(201);

    const submission = formSubmissionResponse.body;
    assert(submission?.id, "Form submission should be created.");

    const documentResponse = await api.post("/api/v1/documents").send({
      linkedEntityType: "Job",
      linkedEntityId: job.id,
      category: "Reports",
      title: "Compliance Job Report",
      description: "Smoke test report document.",
      fileName: `compliance-job-${now}.pdf`,
      mimeType: "application/pdf",
      tags: ["compliance", "smoke"]
    }).expect(201);

    const document = documentResponse.body;
    assert(document?.id, "Generic document should be created.");

    const openLinkResponse = await api.get(`/api/v1/documents/${document.id}/open-link`).expect(200);
    assert(typeof openLinkResponse.body.url === "string" && openLinkResponse.body.url.length > 0, "Document open-link should resolve.");

    const dashboardsResponse = await api.get("/api/v1/dashboards").expect(200);
    const dashboards = dashboardsResponse.body;
    assert(Array.isArray(dashboards) && dashboards.length > 0, "At least one dashboard should be visible.");

    await api.get(`/api/v1/dashboards/${dashboards[0].id}/render`).expect(200);

    const closeoutResponse = await api.patch(`/api/v1/jobs/${job.id}/closeout`).send({
      status: "ARCHIVED",
      summary: "Compliance smoke job archived successfully.",
      archivedAt: "2026-04-20T00:00:00.000Z",
      readOnlyFrom: "2026-04-20T00:00:00.000Z",
      checklistJson: {
        permitsClosed: true,
        formsComplete: true,
        handoverAccepted: true
      }
    }).expect(200);

    assert(closeoutResponse.body.closeout?.status === "ARCHIVED", "Job closeout should archive the job.");

    const archiveResponse = await api.get("/api/v1/jobs/archive?page=1&pageSize=20").expect(200);
    const archivedItems = archiveResponse.body.items as Array<{ id: string }>;
    assert(archivedItems.some((item) => item.id === job.id), "Archived jobs list should include the smoke-test job.");

    const result = {
      status: "passed",
      checkedAt: new Date().toISOString(),
      loginUser: token.user.email,
      entities: {
        tenderId: tender.id,
        tenderDocumentId: tenderDocument.body.id,
        jobId: job.id,
        stageId: stage.id,
        activityId: activity.id,
        shiftId: shift.id,
        formTemplateId: formTemplateResponse.body.id,
        formVersionId: latestVersion.id,
        formSubmissionId: submission.id,
        documentId: document.id,
        dashboardId: dashboards[0].id
      },
      observations: {
        schedulerConflicts: workspaceConflicts.length,
        maintenanceAssetsReviewed: maintenanceAssets.length,
        archivedJobsCount: archiveResponse.body.total
      }
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeApp(app);
  }
}

async function login(client: SuperTest<Test>) {
  const response = await client.post("/api/v1/auth/login").send({
    email: "admin@projectops.local",
    password: "Password123!"
  }).expect(201);

  return response.body as LoginResponse;
}

async function fetchPage<T>(requestBuilder: Test) {
  const response = await requestBuilder.query({ page: 1, pageSize: 50 }).expect(200);
  return response.body as PagedResult<T>;
}

async function closeApp(app: INestApplication) {
  await app.close();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Compliance smoke failed.";
  console.error(message);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
