import { serializeMessagesForAnthropic } from "../providers/anthropic.provider";
import type { ChatMessage } from "../ai-providers.types";

describe("Anthropic adapter — tool result serialisation (multi-turn loop)", () => {
  it("passes through string-content messages unchanged (legacy callers)", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" }
    ];
    expect(serializeMessagesForAnthropic(messages)).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" }
    ]);
  });

  it("serialises an assistant turn with text + tool_use blocks", () => {
    const messages: ChatMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Looking it up." },
          { type: "tool_use", id: "tu-1", name: "lookup", input: { q: "foo" } }
        ]
      }
    ];
    expect(serializeMessagesForAnthropic(messages)).toEqual([
      {
        role: "assistant",
        content: [
          { type: "text", text: "Looking it up." },
          { type: "tool_use", id: "tu-1", name: "lookup", input: { q: "foo" } }
        ]
      }
    ]);
  });

  it("serialises a tool_result block with text content into Anthropic's wire shape", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolUseId: "tu-1",
            content: [{ type: "text", text: "result text" }]
          }
        ]
      }
    ];
    expect(serializeMessagesForAnthropic(messages)).toEqual([
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu-1",
            content: [{ type: "text", text: "result text" }]
          }
        ]
      }
    ]);
  });

  it("serialises a tool_result block with image content using base64 source", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolUseId: "tu-2",
            content: [
              { type: "text", text: "see attached" },
              { type: "image", mediaType: "image/png", data: "iVBORw0KGgo=" }
            ]
          }
        ]
      }
    ];
    expect(serializeMessagesForAnthropic(messages)).toEqual([
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu-2",
            content: [
              { type: "text", text: "see attached" },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: "iVBORw0KGgo="
                }
              }
            ]
          }
        ]
      }
    ]);
  });

  it("sets is_error: true when ToolResult.isError is true", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolUseId: "tu-3",
            content: [{ type: "text", text: "boom" }],
            isError: true
          }
        ]
      }
    ];
    const result = serializeMessagesForAnthropic(messages) as Array<{
      content: Array<Record<string, unknown>>;
    }>;
    expect(result[0]!.content[0]!.is_error).toBe(true);
  });

  it("rejects unsupported image media types", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolUseId: "tu-4",
            content: [
              {
                type: "image",
                mediaType: "image/svg+xml" as never,
                data: "..."
              }
            ]
          }
        ]
      }
    ];
    expect(() => serializeMessagesForAnthropic(messages)).toThrow(/Invalid image media type/);
  });
});
