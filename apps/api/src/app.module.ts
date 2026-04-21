import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppConfigModule } from "./config/app-config.module";
import { ArchiveModule } from "./modules/archive/archive.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { EstimatesModule } from "./modules/estimates/estimates.module";
import { FormsModule } from "./modules/forms/forms.module";
import { HealthModule } from "./health/health.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { MasterDataModule } from "./modules/master-data/master-data.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SecurityModule } from "./modules/security/security.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";
import { TenderingModule } from "./modules/tendering/tendering.module";
import { TenderDocumentsModule } from "./modules/tender-documents/tender-documents.module";
import { UsersModule } from "./modules/users/users.module";
import { WorkersModule } from "./modules/workers/workers.module";
import { AllocationsModule } from "./modules/allocations/allocations.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"]
    }),
    AppConfigModule,
    SecurityModule,
    PrismaModule,
    HealthModule,
    ArchiveModule,
    AssetsModule,
    AuditModule,
    DocumentsModule,
    EstimatesModule,
    PermissionsModule,
    PlatformModule,
    ResourcesModule,
    AuthModule,
    FormsModule,
    JobsModule,
    MaintenanceModule,
    MasterDataModule,
    SchedulerModule,
    ProjectsModule,
    TenderingModule,
    TenderDocumentsModule,
    UsersModule,
    RolesModule,
    WorkersModule,
    AllocationsModule
  ]
})
export class AppModule {}
