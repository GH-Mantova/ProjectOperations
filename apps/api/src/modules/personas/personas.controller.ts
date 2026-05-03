import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AiProvidersService } from "../ai-providers/ai-providers.service";
import { sanitiseProviderError } from "../ai-providers/error-sanitiser";
import { buildSubModeKey, getToolsForSubMode } from "../ai-providers/tools/tool-registry";
import type { ProposeScopeItemsArgs } from "../ai-providers/tools/propose-scope-items.tool";
import { ProposalsService } from "../tendering/scope/proposals.service";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { ConversationsService } from "./conversations.service";
import { PersonaPermissionGuard } from "./persona-permission.guard";
import { PersonasService } from "./personas.service";
import { ChatRequestDto, StartConversationDto } from "./dto/chat.dto";
import { UpdateCompanyInstructionDto } from "./dto/update-company-instruction.dto";
import { UpdateUserPersonaSettingsDto } from "./dto/update-user-persona-settings.dto";
import { UpdateGlobalAISettingsDto } from "./dto/update-global-ai-settings.dto";

@ApiTags("personas")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("personas")
export class PersonasController {
  private readonly logger = new Logger(PersonasController.name);

  constructor(
    private readonly service: PersonasService,
    private readonly aiProviders: AiProvidersService,
    private readonly conversations: ConversationsService,
    private readonly proposals: ProposalsService
  ) {}

  @Get("global-settings")
  @ApiOperation({
    summary: "Get company-wide AI toggles (Super User only)",
    description:
      "Returns the singleton GlobalAISettings row. Sean uses this to set company-wide provider access, allow-user-instruction-overrides toggle, and BYOK toggle."
  })
  @ApiResponse({ status: 200, description: "Global AI settings." })
  @ApiResponse({ status: 403, description: "Super User only." })
  async getGlobalSettings(@CurrentUser() actor: AuthenticatedUser | undefined) {
    if (!actor?.isSuperUser) {
      throw new ForbiddenException("Super User only");
    }
    return this.service.getGlobalSettings();
  }

  @Put("global-settings")
  @ApiOperation({
    summary: "Update company-wide AI toggles (Super User only)",
    description: "Updates the singleton GlobalAISettings row. Sean only."
  })
  @ApiResponse({ status: 200, description: "Updated global AI settings." })
  @ApiResponse({ status: 403, description: "Super User only." })
  async updateGlobalSettings(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() dto: UpdateGlobalAISettingsDto
  ) {
    if (!actor?.isSuperUser) {
      throw new ForbiddenException("Super User only");
    }
    return this.service.updateGlobalSettings(dto);
  }

  @Get()
  @ApiOperation({
    summary: "List all personas the caller can access",
    description:
      "Combines code-defined PersonaDefinition entries with their DB rows (displayName, isActive). Filters to personas the caller has permission for. Super Users see all."
  })
  @ApiResponse({ status: 200, description: "Array of persona summaries." })
  async list(@CurrentUser() actor: AuthenticatedUser | undefined) {
    const all = await this.service.listPersonas();
    if (actor?.isSuperUser) return all;
    const granted = new Set(actor?.permissions ?? []);
    return all.filter((p) => granted.has(p.permissionRequired));
  }

  @Get("active-for-route")
  @ApiOperation({
    summary: "Get the persona active for the supplied URL (caller-aware)",
    description:
      "Resolves the persona+sub-mode for the given `url` query param (path + optional ?detail= search). Returns 200 + null when no persona matches, when the URL is missing, or when the caller lacks the persona's required permission — so the floating window can gracefully not render. Authentication required."
  })
  @ApiResponse({ status: 200, description: "Active persona + subMode summary, or null." })
  async activeForRoute(
    @Query("url") url: string | undefined,
    @CurrentUser() actor: AuthenticatedUser | undefined
  ) {
    if (!url || typeof url !== "string") return null;
    return this.service.resolveActivePersonaForRoute(url, actor);
  }

  @Get(":slug")
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "Get one persona's full state (definition + company instruction)",
    description:
      "Returns the PersonaDefinition (structure) merged with the DB row (displayName, isActive) and the current company instruction. Permission required: persona.permissionRequired (resolved from the slug)."
  })
  @ApiResponse({ status: 200, description: "Persona detail." })
  @ApiResponse({ status: 403, description: "Missing required permission for this persona." })
  @ApiResponse({ status: 404, description: "Persona not found." })
  async getOne(@Param("slug") slug: string) {
    const definition = this.service.getDefinitionBySlug(slug);
    const instruction = await this.service.getCompanyInstruction(slug);
    return { definition, companyInstruction: instruction };
  }

  @Put(":slug/company-instruction")
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "Update the persona's company-wide instruction",
    description:
      "Updates PersonaCompanyInstruction.instruction. Caller's user ID is recorded in updatedById. Permission required: persona.permissionRequired (resolved from the slug). Super User bypasses."
  })
  @ApiResponse({ status: 200, description: "Updated company instruction row." })
  @ApiResponse({ status: 403, description: "Missing required permission for this persona." })
  @ApiResponse({ status: 404, description: "Persona not found." })
  async updateCompanyInstruction(
    @Param("slug") slug: string,
    @Body() dto: UpdateCompanyInstructionDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.updateCompanyInstruction(slug, dto.instruction, actor.sub);
  }

  @Get(":slug/my-settings")
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "Get the caller's settings for this persona",
    description:
      "Returns UserPersonaSettings for (req.user.sub, persona). Creates a default row on first call so callers always get a stable shape. Permission required: persona.permissionRequired (resolved from the slug)."
  })
  @ApiResponse({ status: 200, description: "User persona settings." })
  @ApiResponse({ status: 403, description: "Missing required permission for this persona." })
  @ApiResponse({ status: 404, description: "Persona not found." })
  async getMySettings(@Param("slug") slug: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.getUserSettings(actor.sub, slug);
  }

  @Put(":slug/my-settings")
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "Update the caller's settings for this persona",
    description:
      "Upserts UserPersonaSettings. userId is taken from the JWT — body cannot specify userId. Partial updates are honored: omitted fields are left unchanged; explicit null clears the override. Honoring of providerOverride / instructionOverride / bringYourOwnKey is gated by Sean's GlobalAISettings toggles."
  })
  @ApiResponse({ status: 200, description: "Updated user persona settings." })
  @ApiResponse({ status: 403, description: "Missing required permission for this persona." })
  @ApiResponse({ status: 404, description: "Persona not found." })
  async updateMySettings(
    @Param("slug") slug: string,
    @Body() dto: UpdateUserPersonaSettingsDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.updateUserSettings(actor.sub, slug, dto);
  }

  @Post(":slug/chat")
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "Stream a chat response from the persona",
    description:
      "Sends the message history to the configured AI provider and streams chunks back as Server-Sent Events. Each event has shape `data: {\"type\":\"content\",\"text\":\"...\"}` for text deltas, `data: {\"type\":\"error\",\"error\":\"...\"}` on failure, and `data: {\"type\":\"done\"}` when the stream completes. Persona permission required (PersonaPermissionGuard)."
  })
  @ApiResponse({
    status: 200,
    description: "text/event-stream with type=content|error|done events.",
    content: { "text/event-stream": { schema: { type: "string" } } }
  })
  @ApiResponse({ status: 400, description: "Malformed messages array." })
  @ApiResponse({ status: 403, description: "Missing required permission for this persona." })
  @ApiResponse({ status: 404, description: "Persona not found." })
  @ApiResponse({ status: 503, description: "AI provider not configured (missing API key)." })
  async chat(
    @Param("slug") slug: string,
    @Body() dto: ChatRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response
  ): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (event: {
      type: "content" | "error" | "done" | "conversation" | "proposals";
      [k: string]: unknown;
    }) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Defence-in-depth: every error path goes through sanitiseProviderError.
    // The user gets one of six categorised, hardcoded user-facing messages —
    // never raw provider strings. The full original error text is logged
    // server-side for ops debugging. Closes CodeQL alert #9.
    const sendSanitisedError = (err: unknown) => {
      const sanitised = sanitiseProviderError(err);
      this.logger.error(
        `Chat endpoint error [persona=${slug}, user=${actor.sub}, category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      send({ type: "error", error: sanitised.userMessage });
    };

    // §5A.1 PR 10: persistence. Resolve or create the conversation BEFORE
    // streaming, append the latest user message synchronously, and emit
    // the conversation id as the first SSE event so the client can track
    // which thread this exchange landed in. Assistant message is appended
    // only on stream success — failed/interrupted streams don't pollute
    // history.
    const subMode = dto.subMode ?? "register";
    const contextKey = dto.contextKey ?? null;
    const lastUser = dto.messages[dto.messages.length - 1];
    let conversationId: string | null = null;
    try {
      const conversation = dto.conversationId
        ? (await this.conversations.loadConversation(actor.sub, dto.conversationId)).conversation
        : await this.conversations.findOrCreateActiveConversation({
            userId: actor.sub,
            personaSlug: slug,
            subMode,
            contextKey
          });
      conversationId = conversation.id;
      if (lastUser && lastUser.role === "user" && lastUser.content.trim().length > 0) {
        await this.conversations.appendMessage(conversation.id, "user", lastUser.content);
      }
      send({ type: "conversation", conversationId });
    } catch (err) {
      // Persistence failure — surface as the categorised "config" or
      // generic error and stop. We do NOT proceed with the stream because
      // a successful response we can't save would leave history orphaned.
      sendSanitisedError(err);
      send({ type: "done" });
      res.end();
      return;
    }

    let accumulatedAssistant = "";
    try {
      const config = await this.aiProviders.resolveProviderConfig(actor.sub, slug);
      // Audit log entry: which key source served this chat. Never logs the
      // key itself, only the source label ("user" or "company").
      this.logger.log(
        `Chat key source [persona=${slug}, user=${actor.sub}, provider=${config.providerId}, source=${config.source}, conversation=${conversationId}]`
      );
      const systemPrompt = await this.aiProviders.resolveSystemPrompt(slug, actor.sub, dto.subMode);
      // §5A.1 PR 11: tool calling. Sub-mode-specific tool registry; both
      // Anthropic and OpenAI providers translate to native format.
      //
      // ARCHITECTURE LIMITATION (verified during BLOCKED PR for §5A.1
      // Item 5 drawing tools): this is a SINGLE-TURN dispatch. The
      // model emits one assistant turn (text + optional tool_use blocks),
      // we surface tool_use_stop chunks as side-effects (e.g.
      // propose_scope_items writes proposals + emits SSE), but we do
      // NOT feed tool results back to the model in a follow-up call.
      //
      // Tools that require the model to SEE the result (e.g. vision-based
      // drawing analysis) need a multi-turn agent loop on top of this:
      // dispatch tool, build tool_result block, call streamChat again
      // with [...originalMessages, assistantTurn, toolResult], splice
      // the new stream into this SSE response, repeat until stop_reason
      // is "end_turn". Not built yet.
      const tools = getToolsForSubMode(buildSubModeKey(slug, dto.subMode));
      const stream = this.aiProviders.streamChat({
        systemPrompt,
        messages: dto.messages,
        config,
        tools: tools.length > 0 ? tools : undefined
      });

      let streamFailed = false;
      for await (const chunk of stream) {
        if (chunk.type === "error") {
          // Provider-level error chunk — sanitise its text rather than
          // forwarding raw provider output.
          sendSanitisedError(chunk.error);
          streamFailed = true;
          break;
        }
        if (chunk.type === "content") {
          accumulatedAssistant += chunk.text;
          send({ type: "content", text: chunk.text });
        } else if (chunk.type === "tool_use_start" || chunk.type === "tool_use_delta") {
          // No client-facing UI for partial tool args today — swallow.
          continue;
        } else if (chunk.type === "tool_use_stop") {
          if (chunk.name === "propose_scope_items" && conversationId) {
            try {
              const args = chunk.finalArgs as ProposeScopeItemsArgs;
              const stored = await this.proposals.storeProposals(conversationId, chunk.id, args);
              send({
                type: "proposals",
                messageId: stored.message.id,
                proposals: stored.proposals
              });
            } catch (err) {
              this.logger.error(
                `Proposal store failed [conversation=${conversationId}, tool=${chunk.id}]: ${(err as Error).message}`
              );
              send({ type: "error", error: "Could not save the AI's proposals — please try again." });
              streamFailed = true;
              break;
            }
          }
        } else if (chunk.type === "done") {
          // ai-providers.service yields a final done; we emit our own below.
          continue;
        }
      }
      if (!streamFailed && accumulatedAssistant.length > 0 && conversationId) {
        await this.conversations.appendMessage(
          conversationId,
          "assistant",
          accumulatedAssistant,
          { model: config.model, providerSource: config.source }
        );
      }
      send({ type: "done" });
    } catch (err) {
      sendSanitisedError(err);
      send({ type: "done" });
    } finally {
      res.end();
    }
  }

  // ── Conversation history (§5A.1 PR 10) ─────────────────────────────────

  @Get(":slug/conversations")
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "List recent conversations for the current user in the given persona scope",
    description:
      "Returns up to `limit` conversations matching (user, personaSlug, subMode, contextKey), ordered by updatedAt desc. Each row includes a 200-char preview of the user's first message."
  })
  @ApiResponse({ status: 200, description: "Array of conversation summaries." })
  async listConversations(
    @Param("slug") slug: string,
    @Query("subMode") subMode: string | undefined,
    @Query("contextKey") contextKey: string | undefined,
    @Query("limit") limit: string | undefined,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 20;
    return this.conversations.listRecentConversations(
      {
        userId: actor.sub,
        personaSlug: slug,
        subMode: subMode ?? "register",
        contextKey: contextKey ?? null
      },
      Number.isFinite(parsedLimit) ? parsedLimit : 20
    );
  }

  @Get(":slug/conversations/:id")
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "Load a conversation with its full ordered message history",
    description: "404s if the conversation belongs to another user."
  })
  @ApiResponse({ status: 200, description: "Conversation + messages." })
  @ApiResponse({ status: 404, description: "Not found or not owner." })
  async loadConversation(
    @Param("slug") _slug: string,
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.conversations.loadConversation(actor.sub, id);
  }

  @Post(":slug/conversations/new")
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "Start a fresh conversation, even when a recent one exists for this scope",
    description:
      "Used by the 'New conversation' button on the chat panel header. The previous conversation is preserved — the user can find it under History."
  })
  @ApiResponse({ status: 201, description: "The newly created conversation." })
  async startNewConversation(
    @Param("slug") slug: string,
    @Body() dto: StartConversationDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.conversations.startNewConversation({
      userId: actor.sub,
      personaSlug: slug,
      subMode: dto.subMode,
      contextKey: dto.contextKey ?? null
    });
  }

  @Delete(":slug/conversations/:id")
  @HttpCode(200)
  @UseGuards(PersonaPermissionGuard)
  @ApiOperation({
    summary: "Delete a conversation and all its messages (cascade)",
    description: "404s if the conversation belongs to another user."
  })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  @ApiResponse({ status: 404, description: "Not found or not owner." })
  async deleteConversation(
    @Param("slug") _slug: string,
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    await this.conversations.deleteConversation(actor.sub, id);
    return { ok: true };
  }
}
