import { Injectable, Logger } from "@nestjs/common";
import type { ConversationMessage } from "@prisma/client";
import { AiProvidersService } from "../../ai-providers/ai-providers.service";
import type {
  ChatMessage,
  ChatMessageBlock,
  ChatToolUseBlock,
  ProviderConfig
} from "../../ai-providers/ai-providers.types";
import { ConversationsService } from "../conversations.service";
import {
  ToolHandlerRegistry,
  buildSubModeKey
} from "../tools/tool-handler.registry";
import type { ToolResult } from "../tools/tool-handler.types";

// Cap turns to prevent infinite tool-loop runaway. 10 is generous —
// most tasks complete in 2-3 turns. Hitting the cap is a real failure
// mode that gets surfaced as a synthesised assistant message.
const MAX_TURNS = 10;
// Cap parallel tool calls per turn. Models occasionally pathologically
// fan out; this prevents a single turn from blocking on dozens of
// concurrent tool executions.
const MAX_PARALLEL_CALLS_PER_TURN = 8;

export type DispatcherEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_use_started"; toolUseId: string; name: string }
  | { type: "tool_use_completed"; toolUseId: string; name: string }
  | { type: "tool_side_effect"; event: string; data: Record<string, unknown> }
  | { type: "turn_complete"; turn: number; final: boolean }
  | { type: "error"; error: string }
  | { type: "done" };

export type DispatchArgs = {
  conversationId: string;
  personaSlug: string;
  subMode: string;
  contextKey: string | null;
  systemPrompt: string;
  config: ProviderConfig;
  // Caller has already appended the latest user message to the
  // conversation. Dispatcher reloads the full history (including
  // INTERNAL turns) before each model call.
  actor: { sub: string; permissions?: string[]; isSuperUser?: boolean };
};

@Injectable()
export class PersonaDispatcherService {
  private readonly logger = new Logger(PersonaDispatcherService.name);

  constructor(
    private readonly registry: ToolHandlerRegistry,
    private readonly aiProviders: AiProvidersService,
    private readonly conversations: ConversationsService
  ) {}

  // The multi-turn loop. Yields events the controller forwards to the
  // SSE response. Each turn:
  //   1. Reload conversation history (to include any tool turns
  //      written since the last call)
  //   2. Call streamChat with full history + current sub-mode tools
  //   3. Consume the stream; surface text + tool lifecycle events;
  //      accumulate the assistant turn (text + tool_use blocks)
  //   4. Persist the assistant turn (visibility INTERNAL when it has
  //      tool_use, USER otherwise)
  //   5. If no tool calls → final, yield done, exit
  //   6. Run all tool calls in parallel (cap = 8); collect ToolResult
  //   7. Emit any side-effect SSE events
  //   8. Persist tool_result rows (visibility INTERNAL)
  //   9. Loop
  async *dispatch(args: DispatchArgs): AsyncIterable<DispatcherEvent> {
    const { conversationId, personaSlug, subMode, contextKey, systemPrompt, config, actor } = args;
    const subModeKey = buildSubModeKey(personaSlug, subMode);
    const tools = this.registry.getToolsForSubMode(subModeKey);
    const toolSchemas =
      tools.length > 0 ? this.registry.schemasForSubMode(subModeKey) : undefined;

    yield { type: "conversation", conversationId };

    let lastError: string | null = null;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // 1. Reload history (filtered to the rows providers can serialise)
      const allMessages = await this.conversations.loadAllMessages(conversationId);
      const messages = this.rebuildMessagesForProvider(allMessages);

      // 2. Call provider
      let stream: AsyncIterable<unknown>;
      try {
        stream = this.aiProviders.streamChat({
          systemPrompt,
          messages,
          config,
          tools: toolSchemas
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        yield { type: "error", error: msg };
        yield { type: "done" };
        return;
      }

      // 3. Consume stream
      let assistantText = "";
      const toolUses: ChatToolUseBlock[] = [];
      let stopReason: string | null = null;

      try {
        for await (const chunk of stream as AsyncIterable<{ type: string; [k: string]: unknown }>) {
          if (chunk.type === "content" && typeof chunk.text === "string") {
            assistantText += chunk.text;
            yield { type: "text_delta", text: chunk.text };
          } else if (chunk.type === "tool_use_start") {
            yield {
              type: "tool_use_started",
              toolUseId: chunk.id as string,
              name: chunk.name as string
            };
          } else if (chunk.type === "tool_use_stop") {
            const id = chunk.id as string;
            const name = chunk.name as string;
            toolUses.push({
              type: "tool_use",
              id,
              name,
              input: chunk.finalArgs
            });
            yield { type: "tool_use_completed", toolUseId: id, name };
          } else if (chunk.type === "stop_reason") {
            stopReason = chunk.reason as string;
          } else if (chunk.type === "error") {
            lastError = (chunk.error as string) ?? "Provider error";
            break;
          } else if (chunk.type === "done") {
            break;
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if (lastError) {
        yield { type: "error", error: lastError };
        yield { type: "done" };
        return;
      }

      // 4. Persist assistant turn
      const isInternal = toolUses.length > 0;
      await this.conversations.appendMessage(
        conversationId,
        "assistant",
        assistantText,
        {
          model: config.model,
          providerSource: config.source,
          visibility: isInternal ? "INTERNAL" : "USER",
          payload:
            toolUses.length > 0
              ? { toolUses: toolUses.map((tu) => ({ id: tu.id, name: tu.name, input: tu.input })) }
              : null
        }
      );

      // 5. Final?
      if (toolUses.length === 0) {
        yield { type: "turn_complete", turn, final: true };
        yield { type: "done" };
        return;
      }

      // 6. Cap + run in parallel
      if (toolUses.length > MAX_PARALLEL_CALLS_PER_TURN) {
        yield {
          type: "error",
          error: `Model emitted ${toolUses.length} tool calls in one turn (max ${MAX_PARALLEL_CALLS_PER_TURN}). Try a more specific request.`
        };
        yield { type: "done" };
        return;
      }

      type ExecutedTool = {
        toolUseId: string;
        name: string;
        result: ToolResult;
        sideEffects: Array<{ event: string; data: Record<string, unknown> }>;
      };

      const executed: ExecutedTool[] = await Promise.all(
        toolUses.map(async (tu) => this.executeOneTool(tu, { conversationId, contextKey, actor }))
      );

      // 7. Emit side effects in arrival order
      for (const ex of executed) {
        for (const sfx of ex.sideEffects) {
          yield { type: "tool_side_effect", event: sfx.event, data: sfx.data };
        }
      }

      // 8. Persist tool_result rows (INTERNAL — model sees them on next
      //    iteration via loadAllMessages, UI does not)
      for (const ex of executed) {
        const textPreview = ex.result.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join(" | ");
        const imageMarkers = ex.result.content
          .filter(
            (c): c is Extract<ToolResult["content"][number], { type: "image" }> =>
              c.type === "image"
          )
          .map((c) => `[image ${c.mediaType}, ${Math.round(c.data.length / 1.37)} bytes]`);
        await this.conversations.appendMessage(
          conversationId,
          "tool_result",
          textPreview || imageMarkers.join(" "),
          {
            visibility: "INTERNAL",
            payload: {
              toolUseId: ex.toolUseId,
              name: ex.name,
              isError: ex.result.isError ?? false,
              // Image content NOT persisted — replay would have to re-run
              // the tool. Keep DB lean. Markers above record what was returned.
              content: ex.result.content.map((c) =>
                c.type === "text" ? c : { type: "image", mediaType: c.mediaType, omitted: true }
              )
            }
          }
        );
      }

      yield { type: "turn_complete", turn, final: false };
    }

    // 9. MAX_TURNS exhausted — synthesise a closing message
    const closingText =
      "I tried to complete your request but reached the maximum number of tool calls. Try rephrasing or breaking the task into smaller steps.";
    await this.conversations.appendMessage(conversationId, "assistant", closingText, {
      model: config.model,
      providerSource: config.source,
      visibility: "USER"
    });
    yield { type: "text_delta", text: closingText };
    yield {
      type: "error",
      error: `Maximum tool turns (${MAX_TURNS}) reached.`
    };
    yield { type: "done" };
  }

  private async executeOneTool(
    tu: ChatToolUseBlock,
    ctx: { conversationId: string; contextKey: string | null; actor: DispatchArgs["actor"] }
  ): Promise<{
    toolUseId: string;
    name: string;
    result: ToolResult;
    sideEffects: Array<{ event: string; data: Record<string, unknown> }>;
  }> {
    const handler = this.registry.get(tu.name);
    if (!handler) {
      return {
        toolUseId: tu.id,
        name: tu.name,
        result: {
          content: [{ type: "text", text: `Unknown tool: ${tu.name}` }],
          isError: true
        },
        sideEffects: []
      };
    }
    try {
      const out = await handler.execute(tu.input, {
        actor: ctx.actor as never,
        conversationId: ctx.conversationId,
        contextKey: ctx.contextKey,
        toolUseId: tu.id
      });
      return {
        toolUseId: tu.id,
        name: tu.name,
        result: out.result,
        sideEffects: (out.sideEffects ?? [])
          .filter((s) => s.type === "sse")
          .map((s) => ({ event: s.event, data: s.data }))
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${tu.name} threw [conversation=${ctx.conversationId}]: ${message}`);
      return {
        toolUseId: tu.id,
        name: tu.name,
        result: {
          content: [{ type: "text", text: `Tool error: ${message}` }],
          isError: true
        },
        sideEffects: []
      };
    }
  }

  // Rebuild the messages array for the next provider call from the
  // persisted conversation. Each row maps to a ChatMessage with
  // appropriate blocks. Filters out PR #137-style tool_call rows that
  // duplicate info now carried on assistant rows' payload.toolUses.
  private rebuildMessagesForProvider(rows: ConversationMessage[]): ChatMessage[] {
    const out: ChatMessage[] = [];
    for (const row of rows) {
      if (row.role === "user") {
        out.push({ role: "user", content: row.content });
        continue;
      }
      if (row.role === "assistant") {
        const meta = (row.metadata as { toolUses?: Array<{ id: string; name: string; input: unknown }> } | null) ?? null;
        if (meta?.toolUses && meta.toolUses.length > 0) {
          const blocks: ChatMessageBlock[] = [];
          if (row.content.length > 0) blocks.push({ type: "text", text: row.content });
          for (const tu of meta.toolUses) {
            blocks.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input });
          }
          out.push({ role: "assistant", content: blocks });
        } else {
          out.push({ role: "assistant", content: row.content });
        }
        continue;
      }
      if (row.role === "tool_result") {
        const meta =
          (row.metadata as
            | {
                toolUseId?: string;
                isError?: boolean;
                content?: Array<
                  | { type: "text"; text: string }
                  | { type: "image"; mediaType: string; omitted?: boolean }
                >;
                proposals?: unknown;
              }
            | null) ?? null;
        if (!meta?.toolUseId) continue;
        // Image content was omitted at persist time — for replay, send
        // a text marker only. If a tool needs the image again it can be
        // re-called.
        const content = (meta.content ?? []).flatMap((c) => {
          if (c.type === "text") return [{ type: "text" as const, text: c.text }];
          return [
            { type: "text" as const, text: `[image ${c.mediaType} not replayed — call the tool again to refresh]` }
          ];
        });
        // PR #137 proposals tool_result rows used a different metadata
        // shape; if `proposals` is set, include a brief text summary.
        if (meta.proposals && Array.isArray(meta.proposals)) {
          content.push({
            type: "text" as const,
            text: `Previously drafted ${meta.proposals.length} scope item proposal(s).`
          });
        }
        out.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              toolUseId: meta.toolUseId,
              content: content.length > 0 ? content : [{ type: "text", text: "(no content)" }],
              isError: meta.isError ?? false
            }
          ]
        });
      }
      // tool_call rows from PR #137: skip — the tool_use info is now
      // carried on the assistant row's payload.toolUses for new turns,
      // and the legacy rows existed only as provenance.
    }
    return out;
  }
}
