import { Body, Controller, Logger, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AiProvidersService } from "./ai-providers.service";
import { AssistRequestDto, AssistResponseDto, type AssistTask } from "./dto/assist.dto";
import { sanitiseProviderError } from "./error-sanitiser";
import { ServiceUnavailableException } from "@nestjs/common";

// Persona slug used ONLY for provider resolution — the assist endpoint
// reuses whichever provider + key the caller has configured for the
// Tendering Assistant. When more personas ship this could switch to a
// dedicated "general" persona; for now, tendering is the only registered
// persona and every AI-enabled user already has its provider config.
const PROVIDER_RESOLUTION_PERSONA = "tendering";

// One-shot completions: cap output tokens so the panel stays snappy.
// Plain text only; the panel doesn't render markdown.
const ASSIST_INSTRUCTIONS: Record<AssistTask, string> = {
  summarise:
    "Summarise the record below in 3–6 short sentences. Focus on what a colleague scanning the page would want to know first: what it is, its current status, any dates or amounts that stand out, and open items.",
  draft:
    "Draft a short, professional internal note or email about the record below. Keep it under 150 words. Use plain prose — no headings, no bullet lists — and leave the recipient's name blank as [Name] so the user can fill it in.",
  explain:
    "Explain the record below in plain language for someone new to this project. Assume they haven't seen the module before. 4–8 sentences, no jargon."
};

@ApiTags("assist")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("assist")
export class AssistController {
  private readonly logger = new Logger(AssistController.name);

  constructor(private readonly aiProviders: AiProvidersService) {}

  @Post()
  @RequirePermissions("ai.persona.tendering")
  @ApiOperation({
    summary: "One-shot AI completion for the universal Assist panel",
    description:
      "Sends a task + record context to the caller's configured AI provider (BYOK, resolved via AiProvidersService.resolveProviderConfig using the tendering persona's saved settings) and returns the full text. Non-streaming: the panel shows a spinner then the result. No conversation persistence, no tools. Guarded by the existing `ai.persona.tendering` permission — the same gate that grants access to the Tendering Assistant."
  })
  @ApiResponse({ status: 200, description: "The completion.", type: AssistResponseDto })
  @ApiResponse({ status: 400, description: "Invalid task or empty context." })
  @ApiResponse({ status: 403, description: "Missing required permission." })
  @ApiResponse({ status: 503, description: "AI provider not configured (no BYOK or company key)." })
  async assist(
    @Body() dto: AssistRequestDto,
    @CurrentUser() actor: AuthenticatedUser
  ): Promise<AssistResponseDto> {
    const config = await this.aiProviders.resolveProviderConfig(
      actor.sub,
      PROVIDER_RESOLUTION_PERSONA
    );

    const systemPrompt = buildSystemPrompt(dto.task, dto.instruction, dto.surface);
    const userMessage = buildUserMessage(dto.task, dto.context);

    this.logger.log(
      `Assist call [user=${actor.sub}, task=${dto.task}, surface=${dto.surface ?? "-"}, provider=${config.providerId}, source=${config.source}, ctxChars=${dto.context.length}]`
    );

    try {
      let text = "";
      for await (const chunk of this.aiProviders.streamChat({
        systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        config
      })) {
        if (chunk.type === "content") {
          text += chunk.text;
        } else if (chunk.type === "error") {
          throw new Error(chunk.error);
        } else if (chunk.type === "done") {
          break;
        }
      }
      return { text: text.trim(), provider: config.providerId, model: config.model };
    } catch (err) {
      const sanitised = sanitiseProviderError(err);
      this.logger.error(
        `Assist endpoint error [user=${actor.sub}, category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      throw new ServiceUnavailableException(sanitised.userMessage);
    }
  }
}

function buildSystemPrompt(
  task: AssistTask,
  instruction: string | undefined,
  surface: string | undefined
): string {
  const surfaceLine = surface
    ? `The user is viewing a **${surface}** record in the ProjectOperations ERP.`
    : "The user is viewing a record in the ProjectOperations ERP.";
  const extras = instruction?.trim()
    ? `\n\nAdditional user instruction: ${instruction.trim()}`
    : "";
  return [
    "You are a concise in-context assistant embedded in an ERP page.",
    surfaceLine,
    ASSIST_INSTRUCTIONS[task],
    "Output plain text only. Do not preface the reply with meta commentary (e.g. \"Here is a summary…\"). If the context is empty or clearly insufficient, say so briefly rather than inventing details."
  ].join("\n\n") + extras;
}

function buildUserMessage(task: AssistTask, context: string): string {
  return `Task: ${task}\n\nRecord context:\n${context.trim()}`;
}
