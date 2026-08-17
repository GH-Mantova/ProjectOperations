import { APP_INTERCEPTOR } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { TenantContextInterceptor } from "./common/tenancy/tenant-context.interceptor";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AccessRequestsModule } from "./modules/access-requests/access-requests.module";
import { AdminImportsModule } from "./modules/admin-imports/admin-imports.module";
import { AdminSettingsModule } from "./modules/admin-settings/admin-settings.module";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { AiSettingsModule } from "./modules/ai-settings/ai-settings.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { AppConfigModule } from "./config/app-config.module";
import { ArchiveModule } from "./modules/archive/archive.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthorizationModule } from "./modules/authorization/authorization.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { EmailModule } from "./modules/email/email.module";
import { ClientQuotesModule } from "./modules/client-quotes/client-quotes.module";
import { CompanyProfileModule } from "./modules/company-profile/company-profile.module";
import { BrandingModule } from "./modules/branding/branding.module";
import { EstimateExportModule } from "./modules/estimate-export/estimate-export.module";
import { EstimatesModule } from "./modules/estimates/estimates.module";
import { FormsModule } from "./modules/forms/forms.module";
import { GlobalListsModule } from "./modules/global-lists/global-lists.module";
import { HealthModule } from "./health/health.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { DirectoryModule } from "./modules/directory/directory.module";
import { SafetyModule } from "./modules/safety/safety.module";
import { MasterDataModule } from "./modules/master-data/master-data.module";
import { MetadataModule } from "./modules/metadata/metadata.module";
import { PdfRenderingModule } from "./modules/pdf-rendering/pdf-rendering.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PilotFeedbackModule } from "./modules/pilot-feedback/pilot-feedback.module";
import { PersonasModule } from "./modules/personas/personas.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { PortalModule } from "./modules/portal/portal.module";
import { PrismaModule } from "./prisma/prisma.module";
import { XeroModule } from "./modules/xero/xero.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { PublicHolidaysModule } from "./modules/public-holidays/public-holidays.module";
import { QuoteModule } from "./modules/quote/quote.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SecurityModule } from "./modules/security/security.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";
import { CorrespondenceModule } from "./modules/correspondence/correspondence.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { TenderClarificationsModule } from "./modules/tender-clarifications/tender-clarifications.module";
import { TenderClientsModule } from "./modules/tender-clients/tender-clients.module";
import { TenderingModule } from "./modules/tendering/tendering.module";
import { TenderDocumentsModule } from "./modules/tender-documents/tender-documents.module";
import { UsersModule } from "./modules/users/users.module";
import { WorkersModule } from "./modules/workers/workers.module";
import { AllocationsModule } from "./modules/allocations/allocations.module";
import { JobRolesModule } from "./modules/job-roles/job-roles.module";
import { FieldModule } from "./modules/field/field.module";
import { RatesModule } from "./modules/rates/rates.module";
import { ListBindingsModule } from "./modules/list-bindings/list-bindings.module";
import { CommsApprovalsModule } from "./modules/comms-approvals/comms-approvals.module";
import { ProcurementModule } from "./modules/procurement/procurement.module";
import { ClientVersionsModule } from "./modules/client-versions/client-versions.module";
import { ApiKeysModule } from "./modules/api-keys/api-keys.module";
import { IntegrationKeysModule } from "./common/integrations/integration-keys.module";
import { GeocodingModule } from "./modules/geocoding/geocoding.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { SurveysModule } from "./modules/surveys/surveys.module";
import { CasesModule } from "./modules/cases/cases.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { CrmModule } from "./modules/crm/crm.module";
import { LeadIntakeModule } from "./modules/crm/lead-intake/lead-intake.module";
import { CommsModule } from "./modules/crm/comms/comms.module";
import { MapLocationsModule } from "./modules/map-locations/map-locations.module";
import { ReportingModule } from "./modules/reporting/reporting.module";
import { SitesModule } from "./modules/sites/sites.module";
import { NotificationPreferencesModule } from "./modules/notification-preferences/notification-preferences.module";
import { HandoverTemplatesModule } from "./modules/handover-templates/handover-templates.module";
import { HandoversModule } from "./modules/handovers/handovers.module";
import { SubcontractorRatesModule } from "./modules/subcontractor-rates/subcontractor-rates.module";
import { WinLikelihoodModule } from "./modules/win-likelihood/win-likelihood.module";
import { ScheduleOfRatesModule } from "./modules/schedule-of-rates/schedule-of-rates.module";
import { VariationsModule } from "./modules/variations/variations.module";
import { FieldDefinitionsModule } from "./modules/field-definitions/field-definitions.module";
import { AgreedRecordsModule } from "./modules/agreed-records/agreed-records.module";
import { TenantsModule } from "./modules/tenants/tenants.module";

@Module({
  providers: [
    // MT-2: wire the tenant-context interceptor globally so every request
    // establishes an AsyncLocalStorage context from request.user.tenantId.
    // TenantContextService is provided by PrismaModule (@Global) so NestJS
    // can inject it here without a separate import.
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor
    }
  ],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"]
    }),
    ScheduleModule.forRoot(),
    AppConfigModule,
    SecurityModule,
    PrismaModule,
    IntegrationKeysModule,
    ApiKeysModule,
    HealthModule,
    EmailModule,
    AccessRequestsModule,
    AdminImportsModule,
    AdminSettingsModule,
    AdminUsersModule,
    AiSettingsModule,
    ContractsModule,
    ArchiveModule,
    AssetsModule,
    AuditModule,
    DocumentsModule,
    ClientQuotesModule,
    CompanyProfileModule,
    BrandingModule,
    EstimateExportModule,
    EstimatesModule,
    PdfRenderingModule,
    PermissionsModule,
    PilotFeedbackModule,
    PersonasModule,
    PlatformModule,
    ResourcesModule,
    AuthModule,
    AuthorizationModule,
    FormsModule,
    GlobalListsModule,
    JobsModule,
    MaintenanceModule,
    InventoryModule,
    MasterDataModule,
    MetadataModule,
    DirectoryModule,
    ContactsModule,
    ComplianceModule,
    SafetyModule,
    SchedulerModule,
    CalendarModule,
    ProjectsModule,
    PublicHolidaysModule,
    QuoteModule,
    CorrespondenceModule,
    TenderClarificationsModule,
    TenderClientsModule,
    TenderingModule,
    TenderDocumentsModule,
    UsersModule,
    RolesModule,
    WorkersModule,
    AllocationsModule,
    JobRolesModule,
    FieldModule,
    PortalModule,
    XeroModule,
    RatesModule,
    ListBindingsModule,
    CommsApprovalsModule,
    ProcurementModule,
    ClientVersionsModule,
    GeocodingModule,
    ExpensesModule,
    SurveysModule,
    CasesModule,
    KnowledgeModule,
    CrmModule,
    LeadIntakeModule,
    CommsModule,
    MapLocationsModule,
    ReportingModule,
    SitesModule,
    NotificationPreferencesModule,
    HandoverTemplatesModule,
    HandoversModule,
    SubcontractorRatesModule,
    WinLikelihoodModule,
    ScheduleOfRatesModule,
    VariationsModule,
    FieldDefinitionsModule,
    AgreedRecordsModule,
    TenantsModule
  ]
})
export class AppModule {}
