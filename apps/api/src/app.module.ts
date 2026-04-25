import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminSettingsModule } from "./modules/admin-settings/admin-settings.module";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { AppConfigModule } from "./config/app-config.module";
import { ArchiveModule } from "./modules/archive/archive.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { EmailModule } from "./modules/email/email.module";
import { ClientQuotesModule } from "./modules/client-quotes/client-quotes.module";
import { EstimateExportModule } from "./modules/estimate-export/estimate-export.module";
import { EstimatesModule } from "./modules/estimates/estimates.module";
import { FormsModule } from "./modules/forms/forms.module";
import { GlobalListsModule } from "./modules/global-lists/global-lists.module";
import { HealthModule } from "./health/health.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { DirectoryModule } from "./modules/directory/directory.module";
import { SafetyModule } from "./modules/safety/safety.module";
import { MasterDataModule } from "./modules/master-data/master-data.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { PortalModule } from "./modules/portal/portal.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { QuoteModule } from "./modules/quote/quote.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SecurityModule } from "./modules/security/security.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";
import { TenderClarificationsModule } from "./modules/tender-clarifications/tender-clarifications.module";
import { TenderClientsModule } from "./modules/tender-clients/tender-clients.module";
import { TenderingModule } from "./modules/tendering/tendering.module";
import { TenderDocumentsModule } from "./modules/tender-documents/tender-documents.module";
import { UserAiProvidersModule } from "./modules/user-ai-providers/user-ai-providers.module";
import { UsersModule } from "./modules/users/users.module";
import { WorkersModule } from "./modules/workers/workers.module";
import { AllocationsModule } from "./modules/allocations/allocations.module";
import { FieldModule } from "./modules/field/field.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"]
    }),
    ScheduleModule.forRoot(),
    AppConfigModule,
    SecurityModule,
    PrismaModule,
    HealthModule,
    EmailModule,
    AdminSettingsModule,
    AdminUsersModule,
    ContractsModule,
    ArchiveModule,
    AssetsModule,
    AuditModule,
    DocumentsModule,
    ClientQuotesModule,
    EstimateExportModule,
    EstimatesModule,
    PermissionsModule,
    PlatformModule,
    ResourcesModule,
    AuthModule,
    FormsModule,
    GlobalListsModule,
    JobsModule,
    MaintenanceModule,
    MasterDataModule,
    DirectoryModule,
    ContactsModule,
    ComplianceModule,
    SafetyModule,
    SchedulerModule,
    ProjectsModule,
    QuoteModule,
    TenderClarificationsModule,
    TenderClientsModule,
    TenderingModule,
    TenderDocumentsModule,
    UserAiProvidersModule,
    UsersModule,
    RolesModule,
    WorkersModule,
    AllocationsModule,
    FieldModule,
    PortalModule
  ]
})
export class AppModule {}
