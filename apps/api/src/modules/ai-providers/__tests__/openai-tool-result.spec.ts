import { serializeMessagesForOpenAI } from "../providers/openai.provider";
import type { ChatMessage } from "../ai-providers.types";

describe("OpenAI adapter — tool result serialisation (multi-turn loop)", () => {
  it("passes through string-content messages unchanged (legacy callers)", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" }
    ];
    expect(serializeMessagesForOpenAI("system prompt", messages)).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" }
    ]);
  });

  it("serialises an assistant turn with tool_use blocks into tool_calls array", () => {
    const messages: ChatMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Looking up." },
          { type: "tool_use", id: "call_1", name: "lookup", input: { q: "foo" } }
        ]
      }
    ];
    const result = serializeMessagesForOpenAI(null, messages);
    expect(result).toEqual([
      {
        role: "assistant",
        content: "Looking up.",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "lookup", arguments: JSON.stringify({ q: "foo" }) }
          }
        ]
      }
    ]);
  });

  it("serialises text-only tool_result into a single tool message", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolUseId: "call_1",
            content: [{ type: "text", text: "result text" }]
          }
        ]
      }
    ];
    const result = serializeMessagesForOpenAI(null, messages);
    expect(result).toEqual([
      { role: "tool", tool_call_id: "call_1", content: "result text" }
    ]);
  });

  it("serialises tool_result with image content into tool message + follow-up user image_url message", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolUseId: "call_2",
            content: [
              { type: "text", text: "see image" },
              { type: "image", mediaType: "image/png", data: "BASE64DATA" }
            ]
          }
        ]
      }
    ];
    const result = serializeMessagesForOpenAI(null, messages);
    expect(result).toEqual([
      { role: "tool", tool_call_id: "call_2", content: "see image" },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Image attachment(s) from the previous tool call(s):"
          },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,BASE64DATA" }
          }
        ]
      }
    ]);
  });

  it("prefixes tool message content with [tool error] when isError is true", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolUseId: "call_err",
            content: [{ type: "text", text: "boom" }],
            isError: true
          }
        ]
      }
    ];
    const result = serializeMessagesForOpenAI(null, messages) as Array<{
      content: string;
    }>;
    expect(result[0]!.content).toBe("[tool error] boom");
  });

  it("rejects unsupported image media types", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolUseId: "call_5",
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
    expect(() => serializeMessagesForOpenAI(null, messages)).toThrow(/Invalid image media type/);
  });
});
