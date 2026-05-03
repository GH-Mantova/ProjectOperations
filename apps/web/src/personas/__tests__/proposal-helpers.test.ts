import { describe, expect, it } from "vitest";
import {
  appendAssistantMessage,
  appendProposalsMessage,
  appendUserMessage,
  buildRetryHistory,
  parseSSEEvent,
  toApiMessages,
  updateProposalsMessage,
  type ChatMessage,
  type ChatProposal
} from "../chat-helpers";

const sampleProposals: ChatProposal[] = [
  {
    index: 0,
    discipline: "demolition",
    title: "Demo L1",
    description: "Internal demo level 1",
    quantity: 250,
    unit: "sqm",
    status: "pending"
  },
  {
    index: 1,
    discipline: "asbestos",
    title: "VAT removal",
    description: "Friable VAT",
    quantity: 200,
    unit: "sqm",
    status: "pending"
  }
];

describe("appendProposalsMessage", () => {
  it("appends a proposals row to the history", () => {
    const result = appendProposalsMessage([], "msg-1", sampleProposals);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "proposals", messageId: "msg-1", proposals: sampleProposals });
  });

  it("preserves prior text messages", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" }
    ];
    const result = appendProposalsMessage(start, "msg-1", sampleProposals);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(start[0]);
    expect(result[1]).toEqual(start[1]);
    expect(result[2]?.role).toBe("proposals");
  });
});

describe("updateProposalsMessage", () => {
  it("only mutates the targeted proposals row", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "proposals", messageId: "msg-A", proposals: sampleProposals },
      { role: "proposals", messageId: "msg-B", proposals: sampleProposals }
    ];
    const result = updateProposalsMessage(start, "msg-B", (proposals) =>
      proposals.map((p) => ({ ...p, status: "rejected" as const }))
    );
    if (result[1]?.role !== "proposals" || result[2]?.role !== "proposals") {
      throw new Error("expected proposals rows");
    }
    expect(result[1].proposals[0]?.status).toBe("pending");
    expect(result[2].proposals[0]?.status).toBe("rejected");
    expect(result[2].proposals[1]?.status).toBe("rejected");
  });

  it("returns a NEW array (immutability check)", () => {
    const start: ChatMessage[] = [
      { role: "proposals", messageId: "msg-1", proposals: sampleProposals }
    ];
    const result = updateProposalsMessage(start, "msg-1", (p) => p);
    expect(result).not.toBe(start);
  });

  it("no-op when no row matches the messageId", () => {
    const start: ChatMessage[] = [
      { role: "proposals", messageId: "msg-1", proposals: sampleProposals }
    ];
    const result = updateProposalsMessage(start, "missing", (p) =>
      p.map((x) => ({ ...x, status: "rejected" as const }))
    );
    if (result[0]?.role !== "proposals") throw new Error("expected proposals row");
    expect(result[0].proposals[0]?.status).toBe("pending");
  });
});

describe("toApiMessages", () => {
  it("filters out proposals rows, keeping user/assistant text", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "proposals", messageId: "msg-1", proposals: sampleProposals },
      { role: "user", content: "and?" }
    ];
    const result = toApiMessages(start);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("returns empty when only proposals rows", () => {
    const start: ChatMessage[] = [
      { role: "proposals", messageId: "msg-1", proposals: sampleProposals }
    ];
    expect(toApiMessages(start)).toEqual([]);
  });
});

describe("buildRetryHistory with proposals rows", () => {
  it("walks back to the last user message, dropping proposals + assistant after it", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "ans" },
      { role: "user", content: "second" },
      { role: "proposals", messageId: "msg-1", proposals: sampleProposals }
    ];
    const replay = buildRetryHistory(start);
    expect(replay).toHaveLength(3);
    expect(replay[2]).toEqual({ role: "user", content: "second" });
  });
});

describe("parseSSEEvent — proposals event", () => {
  it("parses proposals events into the unified chunk shape", () => {
    const raw = `data: ${JSON.stringify({
      type: "proposals",
      messageId: "msg-server-1",
      proposals: sampleProposals
    })}`;
    const result = parseSSEEvent(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "proposals",
      messageId: "msg-server-1"
    });
  });

  it("ignores malformed proposals events (missing fields)", () => {
    const raw = `data: ${JSON.stringify({ type: "proposals", messageId: "x" })}`;
    expect(parseSSEEvent(raw)).toEqual([]);
  });

  it("conversation + content events still work (no regression)", () => {
    expect(parseSSEEvent(`data: ${JSON.stringify({ type: "conversation", conversationId: "c-1" })}`)).toEqual([
      { type: "conversation", conversationId: "c-1" }
    ]);
    expect(parseSSEEvent(`data: ${JSON.stringify({ type: "content", text: "x" })}`)).toEqual([
      { type: "content", text: "x" }
    ]);
  });
});

describe("appendUserMessage / appendAssistantMessage interleaving", () => {
  it("interleaves text + proposals + text correctly", () => {
    let history: ChatMessage[] = [];
    history = appendUserMessage(history, "u1");
    history = appendAssistantMessage(history, "a1");
    history = appendProposalsMessage(history, "msg-1", sampleProposals);
    history = appendUserMessage(history, "u2");
    expect(history.map((m) => m.role)).toEqual(["user", "assistant", "proposals", "user"]);
  });
});
