import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PasswordService } from "../../common/security/password.service";
import { CreateWorkerDto } from "./dto/create-worker.dto";
import { ListWorkersQueryDto, UpdateWorkerDto } from "./dto/update-worker.dto";

/**
 * Business logic for the HR/compliance worker roster (WorkerProfile).
 *
 * Distinct from the scheduler's Worker model in the resources module.
 * Deletion is a soft delete (isActive=false), and provisionMobileAccess
 * creates a linked User account with the Field Worker role inside a
 * transaction. No audit entries are written by this service.
 */
@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService
  ) {}

  /**
   * List worker profiles, filtered and paginated.
   *
   * Defaults to active workers unless `isActive` is explicitly "false"
   * (string compare). `search` matches firstName, lastName, preferredName,
   * or role; `role` is an exact case-insensitive match. Limit is clamped
   * to 1–100 (default 50).
   *
   * @param query - search / role / isActive filters plus page and limit
   * @returns { items, total, page, limit } of summary fields only
   */
  async list(query: ListWorkersQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const isActive = query.isActive === undefined ? true : query.isActive === "true";
    const where: Prisma.WorkerProfileWhereInput = {
      isActive,
      ...(query.role ? { role: { equals: query.role, mode: "insensitive" } } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { preferredName: { contains: query.search, mode: "insensitive" } },
              { role: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.workerProfile.count({ where }),
      this.prisma.workerProfile.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          role: true,
          phone: true,
          email: true,
          hasMobileAccess: true,
          isActive: true
        }
      })
    ]);

    return { items, total, page, limit };
  }

  /**
   * Get a worker profile with current and upcoming project allocations.
   *
   * Allocations are filtered to those with no endDate or an endDate on or
   * after today (local midnight), ordered by startDate ascending.
   *
   * @param id - worker profile id
   * @returns the profile with allocations and project summaries
   * @throws NotFoundException when the worker does not exist
   */
  async getById(id: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { id },
      include: {
        allocations: {
          where: {
            OR: [{ endDate: null }, { endDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }]
          },
          orderBy: { startDate: "asc" },
          include: {
            project: {
              select: { id: true, projectNumber: true, name: true, status: true }
            }
          }
        }
      }
    });
    if (!profile) throw new NotFoundException("Worker not found.");
    return profile;
  }

  /**
   * Create a worker profile.
   *
   * hasMobileAccess defaults to false; the linked login is provisioned
   * separately via provisionMobileAccess.
   *
   * @param dto - worker profile fields
   * @returns the created worker profile
   */
  create(dto: CreateWorkerDto) {
    return this.prisma.workerProfile.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        preferredName: dto.preferredName ?? null,
        role: dto.role,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        emergencyContactName: dto.emergencyContactName ?? null,
        emergencyContactPhone: dto.emergencyContactPhone ?? null,
        licenceNumber: dto.licenceNumber ?? null,
        licenceClass: dto.licenceClass ?? null,
        ticketNumbers: dto.ticketNumbers ?? null,
        hasMobileAccess: dto.hasMobileAccess ?? false
      }
    });
  }

  /**
   * Update a worker profile; undefined fields are left unchanged.
   *
   * internalUserId is deliberately not updatable here — it is set only by
   * the mobile-access provisioning flow.
   *
   * @param id - worker profile id
   * @param dto - partial worker profile fields
   * @returns the updated worker profile
   * @throws NotFoundException when the worker does not exist
   */
  async update(id: string, dto: UpdateWorkerDto) {
    const existing = await this.prisma.workerProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Worker not found.");
    return this.prisma.workerProfile.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        preferredName: dto.preferredName,
        role: dto.role,
        phone: dto.phone,
        email: dto.email,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        licenceNumber: dto.licenceNumber,
        licenceClass: dto.licenceClass,
        ticketNumbers: dto.ticketNumbers,
        hasMobileAccess: dto.hasMobileAccess
      }
    });
  }

  /**
   * Soft delete: set isActive=false on the worker profile.
   *
   * Existing allocations and any linked user account are untouched.
   *
   * @param id - worker profile id
   * @returns the deactivated worker profile
   * @throws NotFoundException when the worker does not exist
   */
  async deactivate(id: string) {
    const existing = await this.prisma.workerProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Worker not found.");
    return this.prisma.workerProfile.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * List every project allocation for a worker, newest startDate first.
   *
   * No pagination and no existence check — an unknown id returns an
   * empty array.
   *
   * @param id - worker profile id
   * @returns all allocations with project summaries
   */
  allocationsForWorker(id: string) {
    return this.prisma.projectAllocation.findMany({
      where: { workerProfileId: id },
      orderBy: { startDate: "desc" },
      include: {
        project: {
          select: { id: true, projectNumber: true, name: true, status: true }
        }
      }
    });
  }

  /**
   * Provision a field-worker login for a worker profile.
   *
   * In a single transaction: creates a User (worker's lower-cased email,
   * hashed tempPassword, forcePasswordReset=true) with the seeded
   * "Field Worker" role, then links it via internalUserId and flips
   * hasMobileAccess to true. The temp password is never stored in plain text.
   *
   * @param id - worker profile id
   * @param tempPassword - one-time password to hash for the new account
   * @returns { message, userId } for the created user
   * @throws NotFoundException when the worker does not exist
   * @throws BadRequestException when already provisioned, the worker has no
   *   email, the email is already a user, or the Field Worker role is not seeded
   */
  async provisionMobileAccess(id: string, tempPassword: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { id } });
    if (!worker) throw new NotFoundException("Worker not found.");
    if (worker.hasMobileAccess || worker.internalUserId) {
      throw new BadRequestException("Mobile access has already been provisioned for this worker.");
    }
    if (!worker.email) {
      throw new BadRequestException("Worker must have an email address before mobile access can be provisioned.");
    }

    const existing = await this.prisma.user.findUnique({ where: { email: worker.email.toLowerCase() } });
    if (existing) {
      throw new BadRequestException("A user account with this email already exists.");
    }

    const fieldRole = await this.prisma.role.findUnique({ where: { name: "Field Worker" } });
    if (!fieldRole) {
      throw new BadRequestException(
        "Field Worker role is not configured. Re-run the Initial Services seed to create it."
      );
    }

    const passwordHash = this.passwordService.hashPassword(tempPassword);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: worker.email!.toLowerCase(),
          firstName: worker.firstName,
          lastName: worker.lastName,
          passwordHash,
          isActive: true,
          forcePasswordReset: true,
          userRoles: {
            create: [{ roleId: fieldRole.id }]
          }
        }
      });
      await tx.workerProfile.update({
        where: { id },
        data: { hasMobileAccess: true, internalUserId: createdUser.id }
      });
      return createdUser;
    });

    return { message: "Mobile access provisioned", userId: user.id };
  }
}
