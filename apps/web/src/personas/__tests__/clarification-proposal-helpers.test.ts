import { describe, expect, it } from "vitest";
import {
  appendAssistantMessage,
  appendClarificationProposalsMessage,
  appendUserMessage,
  buildRetryHistory,
  parseSSEEvent,
  toApiMessages,
  updateClarificationProposalsMessage,
  type ChatClarificationProposal,
  type ChatMessage
} from "../chat-helpers";

const sample: ChatClarificationProposal[] = [
  {
    index: 0,
    proposal: { kind: "new_rfi", subject: "Confirm asbestos register coverage" },
    status: "pending"
  },
  {
    index: 1,
    proposal: {
      kind: "new_note",
      noteType: "call",
      direction: "received",
      text: "Brief call with consultant"
    },
    status: "pending"
  },
  {
    index: 2,
    proposal: {
      kind: "rfi_response",
      rfiId: "rfi-1",
      response: "Demolition limited to non-structural walls per A-101."
    },
    status: "pending"
  }
];

describe("appendClarificationProposalsMessage", () => {
  it("appends a clarification-proposals row to the history", () => {
    const result = appendClarificationProposalsMessage([], "msg-1", sample);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "clarification-proposals",
      messageId: "msg-1",
      proposals: sample
    });
  });

  it("preserves prior rows untouched", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" }
    ];
    const result = appendClarificationProposalsMessage(start, "msg-1", sample);
    expect(result).toHaveLength(3);
    expect(result[2]?.role).toBe("clarification-proposals");
  });
});

describe("updateClarificationProposalsMessage", () => {
  it("only mutates the targeted clarification-proposals row", () => {
    const start: ChatMessage[] = [
      { role: "clarification-proposals", messageId: "msg-A", proposals: sample },
      { role: "clarification-proposals", messageId: "msg-B", proposals: sample }
    ];
    const result = updateClarificationProposalsMessage(start, "msg-B", (proposals) =>
      proposals.map((p) => ({ ...p, status: "rejected" as const }))
    );
    if (
      result[0]?.role !== "clarification-proposals" ||
      result[1]?.role !== "clarification-proposals"
    ) {
      throw new Error("expected clarification-proposals rows");
    }
    expect(result[0].proposals[0]?.status).toBe("pending");
    expect(result[1].proposals[0]?.status).toBe("rejected");
  });

  it("returns a NEW array (immutability check)", () => {
    const start: ChatMessage[] = [
      { role: "clarification-proposals", messageId: "msg-1", proposals: sample }
    ];
    const result = updateClarificationProposalsMessage(start, "msg-1", (p) => p);
    expect(result).not.toBe(start);
  });

  it("ignores quote-proposals rows with the same messageId (different role)", () => {
    const start: ChatMessage[] = [
      {
        role: "quote-proposals",
        messageId: "msg-X",
        proposals: [
          {
            index: 0,
            quoteId: "q-1",
            costLines: [{ label: "x", description: "y" }],
            status: "pending"
          }
        ]
      },
      { role: "clarification-proposals", messageId: "msg-X", proposals: sample }
    ];
    const result = updateClarificationProposalsMessage(start, "msg-X", (proposals) =>
      proposals.map((p) => ({ ...p, status: "accepted" as const }))
    );
    if (
      result[0]?.role !== "quote-proposals" ||
      result[1]?.role !== "clarification-proposals"
    ) {
      throw new Error("expected mixed rows");
    }
    expect(result[0].proposals[0]?.status).toBe("pending");
    expect(result[1].proposals[0]?.status).toBe("accepted");
  });
});

describe("toApiMessages — drops clarification-proposals rows", () => {
  it("filters out clarification-proposals rows, keeping user/assistant text", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "clarification-proposals", messageId: "m1", proposals: sample },
      { role: "assistant", content: "hello" }
    ];
    const result = toApiMessages(start);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});

describe("buildRetryHistory with clarification-proposals rows", () => {
  it("walks back to the last user message, dropping clarification-proposals after it", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "first" },
      { role: "user", content: "second" },
      { role: "clarification-proposals", messageId: "m1", proposals: sample }
    ];
    const replay = buildRetryHistory(start);
    expect(replay).toHaveLength(2);
    expect(replay[1]).toEqual({ role: "user", content: "second" });
  });
});

describe("parseSSEEvent — clarification_proposals event", () => {
  it("parses clarification_proposals events into the unified chunk shape", () => {
    const raw = `data: ${JSON.stringify({
      type: "clarification_proposals",
      messageId: "msg-server-1",
      proposals: sample
    })}`;
    const result = parseSSEEvent(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "clarification_proposals",
      messageId: "msg-server-1"
    });
  });

  it("ignores malformed clarification_proposals events (missing proposals)", () => {
    const raw = `data: ${JSON.stringify({
      type: "clarification_proposals",
      messageId: "x"
    })}`;
    expect(parseSSEEvent(raw)).toEqual([]);
  });

  it("scope/estimate/quote events still parse (no regression)", () => {
    const scope = `data: ${JSON.stringify({
      type: "proposals",
      messageId: "s-1",
      proposals: [
        {
          index: 0,
          discipline: "demolition",
          title: "x",
          description: "y",
          quantity: 1,
          unit: "ea",
          status: "pending"
        }
      ]
    })}`;
    const estimate = `data: ${JSON.stringify({
      type: "estimate_proposals",
      messageId: "e-1",
      proposals: [{ index: 0, code: "DEM", title: "x", status: "pending" }]
    })}`;
    const quote = `data: ${JSON.stringify({
      type: "quote_proposals",
      messageId: "q-1",
      proposals: [{ index: 0, quoteId: "q-1", status: "pending" }]
    })}`;
    expect(parseSSEEvent(scope)[0]?.type).toBe("proposals");
    expect(parseSSEEvent(estimate)[0]?.type).toBe("estimate_proposals");
    expect(parseSSEEvent(quote)[0]?.type).toBe("quote_proposals");
  });
});

describe("appendUserMessage / appendAssistantMessage / appendClarificationProposalsMessage interleaving", () => {
  it("interleaves correctly", () => {
    let history: ChatMessage[] = [];
    history = appendUserMessage(history, "u1");
    history = appendAssistantMessage(history, "a1");
    history = appendClarificationProposalsMessage(history, "msg-1", sample);
    history = appendUserMessage(history, "u2");
    expect(history.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "clarification-proposals",
      "user"
    ]);
  });
});
