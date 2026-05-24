import { describe, expect, it } from "vitest";
import {
  appendAssistantMessage,
  appendQuoteProposalsMessage,
  appendUserMessage,
  buildRetryHistory,
  parseSSEEvent,
  toApiMessages,
  updateQuoteProposalsMessage,
  type ChatMessage,
  type ChatQuoteProposal
} from "../chat-helpers";

const sample: ChatQuoteProposal[] = [
  {
    index: 0,
    quoteId: "q-1",
    costLines: [
      { label: "Internal demolition", description: "Strip-out level 2" },
      { label: "Asbestos removal", description: "Friable VAT", price: 48000 }
    ],
    exclusions: [{ text: "Excludes asbestos not noted in register." }],
    assumptions: [{ text: "Assumes 24/7 site access." }],
    status: "pending"
  }
];

describe("appendQuoteProposalsMessage", () => {
  it("appends a quote-proposals row to the history", () => {
    const result = appendQuoteProposalsMessage([], "msg-1", sample);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "quote-proposals",
      messageId: "msg-1",
      proposals: sample
    });
  });

  it("preserves prior rows untouched", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" }
    ];
    const result = appendQuoteProposalsMessage(start, "msg-1", sample);
    expect(result).toHaveLength(3);
    expect(result[2]?.role).toBe("quote-proposals");
  });
});

describe("updateQuoteProposalsMessage", () => {
  it("only mutates the targeted quote-proposals row", () => {
    const start: ChatMessage[] = [
      { role: "quote-proposals", messageId: "msg-A", proposals: sample },
      { role: "quote-proposals", messageId: "msg-B", proposals: sample }
    ];
    const result = updateQuoteProposalsMessage(start, "msg-B", (proposals) =>
      proposals.map((p) => ({ ...p, status: "rejected" as const }))
    );
    if (result[0]?.role !== "quote-proposals" || result[1]?.role !== "quote-proposals") {
      throw new Error("expected quote-proposals rows");
    }
    expect(result[0].proposals[0]?.status).toBe("pending");
    expect(result[1].proposals[0]?.status).toBe("rejected");
  });

  it("returns a NEW array (immutability check)", () => {
    const start: ChatMessage[] = [
      { role: "quote-proposals", messageId: "msg-1", proposals: sample }
    ];
    const result = updateQuoteProposalsMessage(start, "msg-1", (p) => p);
    expect(result).not.toBe(start);
  });

  it("no-op when no row matches the messageId", () => {
    const start: ChatMessage[] = [
      { role: "quote-proposals", messageId: "msg-1", proposals: sample }
    ];
    const result = updateQuoteProposalsMessage(start, "missing", (p) =>
      p.map((x) => ({ ...x, status: "rejected" as const }))
    );
    if (result[0]?.role !== "quote-proposals") throw new Error("expected row");
    expect(result[0].proposals[0]?.status).toBe("pending");
  });

  it("ignores estimate-proposals rows with the same messageId (different role)", () => {
    const start: ChatMessage[] = [
      {
        role: "estimate-proposals",
        messageId: "msg-X",
        proposals: [
          { index: 0, code: "DEM", title: "x", status: "pending" }
        ]
      },
      { role: "quote-proposals", messageId: "msg-X", proposals: sample }
    ];
    const result = updateQuoteProposalsMessage(start, "msg-X", (proposals) =>
      proposals.map((p) => ({ ...p, status: "accepted" as const }))
    );
    if (
      result[0]?.role !== "estimate-proposals" ||
      result[1]?.role !== "quote-proposals"
    ) {
      throw new Error("expected mixed rows");
    }
    expect(result[0].proposals[0]?.status).toBe("pending");
    expect(result[1].proposals[0]?.status).toBe("accepted");
  });
});

describe("toApiMessages — drops quote-proposals rows", () => {
  it("filters out all three proposal-row variants, keeping user/assistant text", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "quote-proposals", messageId: "m1", proposals: sample },
      { role: "assistant", content: "hello" }
    ];
    const result = toApiMessages(start);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});

describe("buildRetryHistory with quote-proposals rows", () => {
  it("walks back to the last user message, dropping quote-proposals after it", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "first" },
      { role: "user", content: "second" },
      { role: "quote-proposals", messageId: "m1", proposals: sample }
    ];
    const replay = buildRetryHistory(start);
    expect(replay).toHaveLength(2);
    expect(replay[1]).toEqual({ role: "user", content: "second" });
  });
});

describe("parseSSEEvent — quote_proposals event", () => {
  it("parses quote_proposals events into the unified chunk shape", () => {
    const raw = `data: ${JSON.stringify({
      type: "quote_proposals",
      messageId: "msg-server-1",
      proposals: sample
    })}`;
    const result = parseSSEEvent(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "quote_proposals",
      messageId: "msg-server-1"
    });
  });

  it("ignores malformed quote_proposals events (missing proposals array)", () => {
    const raw = `data: ${JSON.stringify({
      type: "quote_proposals",
      messageId: "x"
    })}`;
    expect(parseSSEEvent(raw)).toEqual([]);
  });

  it("estimate_proposals and proposals events still parse (no regression)", () => {
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
    expect(parseSSEEvent(scope)[0]?.type).toBe("proposals");
    expect(parseSSEEvent(estimate)[0]?.type).toBe("estimate_proposals");
  });
});

describe("appendUserMessage / appendAssistantMessage / appendQuoteProposalsMessage interleaving", () => {
  it("interleaves text + quote-proposals + text correctly", () => {
    let history: ChatMessage[] = [];
    history = appendUserMessage(history, "u1");
    history = appendAssistantMessage(history, "a1");
    history = appendQuoteProposalsMessage(history, "msg-1", sample);
    history = appendUserMessage(history, "u2");
    expect(history.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "quote-proposals",
      "user"
    ]);
  });
});
