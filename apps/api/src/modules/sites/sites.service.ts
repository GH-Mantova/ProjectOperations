import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SignInDto, SignOutDto } from "./dto/site-attendance.dto";

// Attendance is a FACT (someone was on site) not an intention (someone was
// rostered on). Deliberately separate from Shift/ScheduleAllocation. The
// muster/evacuation view (pr-erp-muster-headcount, upcoming) reads from
// this — do not join it against timesheets or payroll here.
@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  // Field-facing endpoints resolve the caller to a WorkerProfile via the
  // internal-user link. Callers without a linked profile (e.g. office admin
  // exploring the mobile UI) get a clear 403 rather than a silent 500.
  private async resolveWorkerProfile(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { internalUserId: userId }
    });
    if (!worker) {
      throw new ForbiddenException(
        "No worker profile is linked to your account. Ask your office to provision mobile access."
      );
    }
    return worker;
  }

  private async assertSiteExists(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true }
    });
    if (!site) throw new NotFoundException(`Site ${siteId} not found`);
  }

  // Idempotent: if the worker already has an open attendance on this site,
  // return it instead of creating a duplicate. A second sign-in on a
  // DIFFERENT site while an old one is still open is still allowed — the
  // muster then legitimately shows them "still open" on the previous site
  // as a data-quality signal, which is exactly what the design note calls
  // out. Auto-close is a separate decision Marco owns.
  async signIn(userId: string, dto: SignInDto) {
    const worker = await this.resolveWorkerProfile(userId);
    await this.assertSiteExists(dto.siteId);

    const existing = await this.prisma.siteAttendance.findFirst({
      where: {
        workerProfileId: worker.id,
        siteId: dto.siteId,
        signedOutAt: null
      },
      orderBy: { signedInAt: "desc" }
    });
    if (existing) return existing;

    return this.prisma.siteAttendance.create({
      data: {
        siteId: dto.siteId,
        workerProfileId: worker.id,
        jobId: dto.jobId ?? null,
        method: dto.method ?? null,
        notes: dto.notes ?? null
      }
    });
  }

  // Signing out when not signed in is a no-op — returns null. Field workers
  // hitting the button twice must not see an error toast; that behaviour
  // trained people to ignore real errors.
  async signOut(userId: string, dto: SignOutDto) {
    const worker = await this.resolveWorkerProfile(userId);
    const open = await this.prisma.siteAttendance.findFirst({
      where: {
        workerProfileId: worker.id,
        signedOutAt: null,
        ...(dto.siteId ? { siteId: dto.siteId } : {})
      },
      orderBy: { signedInAt: "desc" }
    });
    if (!open) return null;

    return this.prisma.siteAttendance.update({
      where: { id: open.id },
      data: {
        signedOutAt: new Date(),
        // Sign-out notes are appended, not clobbered, so the worker's own
        // reason for signing out survives alongside any sign-in note.
        notes: dto.notes
          ? open.notes
            ? `${open.notes}\n${dto.notes}`
            : dto.notes
          : open.notes
      }
    });
  }

  // Worker asks "am I currently signed in anywhere?" — used by the field UI
  // to render the Sign in / Sign out control in the correct state.
  async myCurrentAttendance(userId: string) {
    const worker = await this.resolveWorkerProfile(userId);
    return this.prisma.siteAttendance.findFirst({
      where: { workerProfileId: worker.id, signedOutAt: null },
      orderBy: { signedInAt: "desc" },
      include: { site: { select: { id: true, name: true } } }
    });
  }

  // Sites the caller has active/upcoming allocations on — used by the field
  // UI to seed the sign-in site picker without needing masterdata.view.
  // Includes today and future — a worker mobilising tomorrow can still
  // sign in when they arrive early.
  async myAvailableSites(userId: string) {
    const worker = await this.resolveWorkerProfile(userId);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const allocations = await this.prisma.projectAllocation.findMany({
      where: {
        workerProfileId: worker.id,
        type: "WORKER",
        project: { status: { in: ["MOBILISING", "ACTIVE"] } },
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      select: { project: { select: { site: { select: { id: true, name: true, addressLine1: true, suburb: true, state: true } } } } }
    });
    const seen = new Set<string>();
    const sites: Array<{ id: string; name: string; addressLine1: string | null; suburb: string | null; state: string | null }> = [];
    for (const a of allocations) {
      const s = a.project.site;
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      sites.push({ id: s.id, name: s.name, addressLine1: s.addressLine1, suburb: s.suburb, state: s.state });
    }
    return sites;
  }

  // WHS / PM view — "who is on site right now". Ordered by longest-on-site
  // first so a stale open attendance (data-quality problem — see design
  // notes) surfaces at the top rather than hiding behind fresher rows.
  async currentlyOnSite(siteId: string) {
    await this.assertSiteExists(siteId);
    return this.prisma.siteAttendance.findMany({
      where: { siteId, signedOutAt: null },
      orderBy: { signedInAt: "asc" },
      include: {
        workerProfile: {
          select: { id: true, firstName: true, lastName: true, role: true, phone: true }
        },
        job: { select: { id: true, jobNumber: true, name: true } }
      }
    });
  }
}
