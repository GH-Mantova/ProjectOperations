import { Injectable, Logger } from "@nestjs/common";
import type { JsonSchemaObject, SubModeToolBindings, ToolHandler } from "./tool-handler.types";

// Singleton tool-handler registry. Tools register themselves via their
// owning module's onModuleInit. Sub-mode bindings are declared
// alongside registrations so the dispatcher can look up "what tools
// does the tendering.scope sub-mode have?" in one place.
@Injectable()
export class ToolHandlerRegistry {
  private readonly logger = new Logger(ToolHandlerRegistry.name);
  private readonly handlers = new Map<string, ToolHandler>();
  private readonly subModeBindings: SubModeToolBindings = {};

  register(handler: ToolHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(`Tool handler already registered: ${handler.name}`);
    }
    this.handlers.set(handler.name, handler);
    this.logger.log(`Registered tool handler: ${handler.name}`);
  }

  // Bind one or more registered tool names to a sub-mode key
  // (`<personaSlug>.<subMode>`). Idempotent — duplicate binds are
  // collapsed.
  bindToSubMode(subModeKey: string, toolNames: string[]): void {
    const existing = this.subModeBindings[subModeKey] ?? [];
    const merged = Array.from(new Set([...existing, ...toolNames]));
    for (const name of toolNames) {
      if (!this.handlers.has(name)) {
        throw new Error(
          `Cannot bind unknown tool "${name}" to sub-mode "${subModeKey}". ` +
            "Register the handler first."
        );
      }
    }
    this.subModeBindings[subModeKey] = merged;
  }

  get(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }

  // Returns all tools bound to the given sub-mode. Used by the
  // dispatcher to decide which schemas to send to the provider AND to
  // dispatch incoming tool_use_stop events.
  getToolsForSubMode(subModeKey: string): ToolHandler[] {
    const names = this.subModeBindings[subModeKey] ?? [];
    return names
      .map((n) => this.handlers.get(n))
      .filter((h): h is ToolHandler => h !== undefined);
  }

  // JSON Schema definitions in the shape Anthropic + OpenAI adapters
  // expect for the tools[] array on a model API call.
  schemasForSubMode(
    subModeKey: string
  ): Array<{ name: string; description: string; inputSchema: JsonSchemaObject }> {
    return this.getToolsForSubMode(subModeKey).map((h) => ({
      name: h.name,
      description: h.description,
      inputSchema: h.inputSchema
    }));
  }
}

// Helper: build the sub-mode key the registry uses. Persona slug +
// "." + sub-mode name (matches the convention from PR #137's
// tool-registry.ts which this registry replaces.)
export function buildSubModeKey(personaSlug: string, subMode: string | undefined | null): string {
  if (!subMode) return personaSlug;
  return `${personaSlug}.${subMode}`;
}
