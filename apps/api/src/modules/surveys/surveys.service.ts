import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// ─── DTOs ──────────────────────────────────────────────────────────────────

export type SurveyQuestion = {
  id: string;
  prompt: string;
  type: "rating" | "text";
  required: boolean;
  min?: number;
  max?: number;
};

export type CreateSurveyInput = {
  name: string;
  description?: string | null;
  questions: SurveyQuestion[];
  isDefault?: boolean;
};

export type SurveyAnswer = {
  questionId: string;
  value: string | number;
};

export type CreateSurveyResponseInput = {
  clientId: string;
  jobId?: string | null;
  projectId?: string | null;
  answers: SurveyAnswer[];
};

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class SurveysService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Survey template CRUD ────────────────────────────────────────────────

  async createSurvey(input: CreateSurveyInput) {
    if (!input.name?.trim()) throw new BadRequestException("Survey name is required.");
    if (!Array.isArray(input.questions) || input.questions.length === 0) {
      throw new BadRequestException("Survey must have at least one question.");
    }
    return this.prisma.survey.create({
      data: {
        name: input.name.trim(),
        description: input.description ?? null,
        questions: input.questions as never,
        isDefault: input.isDefault ?? false
      }
    });
  }

  async listSurveys() {
    return this.prisma.survey.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });
  }

  async getSurvey(id: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id } });
    if (!survey) throw new NotFoundException(`Survey ${id} not found.`);
    return survey;
  }

  // ── Capture a response ──────────────────────────────────────────────────

  async createResponse(surveyId: string, input: CreateSurveyResponseInput, createdById?: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException(`Survey ${surveyId} not found.`);

    const client = await this.prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw new NotFoundException(`Client ${input.clientId} not found.`);

    if (!Array.isArray(input.answers) || input.answers.length === 0) {
      throw new BadRequestException("Answers are required.");
    }

    // Compute overallScore = mean of numeric (rating) answers, 1-5 scale.
    const ratingAnswers = input.answers
      .filter((a) => typeof a.value === "number")
      .map((a) => Number(a.value));

    const overallScore =
      ratingAnswers.length > 0
        ? ratingAnswers.reduce((sum, v) => sum + v, 0) / ratingAnswers.length
        : 0;

    const response = await this.prisma.surveyResponse.create({
      data: {
        surveyId,
        clientId: input.clientId,
        jobId: input.jobId ?? null,
        projectId: input.projectId ?? null,
        answers: input.answers as never,
        overallScore,
        createdById: createdById ?? null
      },
      include: {
        survey: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } }
      }
    });

    // Rollup: update Client.preferenceScore to the average of all response
    // overallScores (rounded to nearest integer, clamped 1-5).
    // Simple MVP: arithmetic mean of all responses for this client.
    await this.rollupClientScore(input.clientId);

    return response;
  }

  // ── Client satisfaction aggregate ───────────────────────────────────────

  async getClientSatisfaction(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client ${clientId} not found.`);

    const responses = await this.prisma.surveyResponse.findMany({
      where: { clientId },
      orderBy: { submittedAt: "desc" },
      take: 50
    });

    if (responses.length === 0) {
      return {
        clientId,
        count: 0,
        meanScore: null,
        lastSubmittedAt: null,
        latestComments: []
      };
    }

    const meanScore =
      responses.reduce((sum, r) => sum + r.overallScore, 0) / responses.length;

    // Extract top-N text answers from the most recent 5 responses.
    const latestComments: string[] = [];
    for (const r of responses.slice(0, 5)) {
      const answers = r.answers as SurveyAnswer[];
      for (const a of answers) {
        if (typeof a.value === "string" && a.value.trim()) {
          latestComments.push(a.value.trim());
        }
      }
    }

    return {
      clientId,
      count: responses.length,
      meanScore: Math.round(meanScore * 100) / 100,
      lastSubmittedAt: responses[0].submittedAt,
      latestComments: latestComments.slice(0, 5)
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Rollup: compute mean of all SurveyResponse.overallScore for a client,
   * round to nearest integer (1-5 scale), and write to Client.preferenceScore.
   * This matches the existing preferenceScore column which is Int? on the
   * Client model and is used for client relationship health scoring.
   */
  private async rollupClientScore(clientId: string) {
    const rows = await this.prisma.surveyResponse.findMany({
      where: { clientId },
      select: { overallScore: true }
    });
    if (rows.length === 0) return;
    const mean = rows.reduce((sum, r) => sum + r.overallScore, 0) / rows.length;
    const rounded = Math.round(mean);
    await this.prisma.client.update({
      where: { id: clientId },
      data: { preferenceScore: rounded }
    });
  }
}
