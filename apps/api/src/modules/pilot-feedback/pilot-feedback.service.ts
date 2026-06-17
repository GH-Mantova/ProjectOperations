import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export const FEEDBACK_CATEGORIES = ["bug", "idea", "question", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = ["new", "triaged", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type CreateFeedbackInput = {
  route: string;
  category: FeedbackCategory;
  message: string;
};

@Injectable()
export class PilotFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateFeedbackInput) {
    if (!input.message?.trim()) {
      throw new BadRequestException("Message is required.");
    }
    if (!FEEDBACK_CATEGORIES.includes(input.category)) {
      throw new BadRequestException(`Category must be one of ${FEEDBACK_CATEGORIES.join(", ")}.`);
    }
    return this.prisma.pilotFeedback.create({
      data: {
        userId,
        route: input.route?.trim() || "unknown",
        category: input.category,
        message: input.message.trim()
      }
    });
  }

  list() {
    return this.prisma.pilotFeedback.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
  }

  async updateStatus(id: string, status: FeedbackStatus) {
    if (!FEEDBACK_STATUSES.includes(status)) {
      throw new BadRequestException(`Status must be one of ${FEEDBACK_STATUSES.join(", ")}.`);
    }
    const existing = await this.prisma.pilotFeedback.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Feedback not found.");
    return this.prisma.pilotFeedback.update({ where: { id }, data: { status } });
  }
}
