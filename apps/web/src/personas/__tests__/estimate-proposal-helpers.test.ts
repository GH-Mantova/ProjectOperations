import { describe, expect, it } from "vitest";
import {
  appendAssistantMessage,
  appendEstimateProposalsMessage,
  appendUserMessage,
  buildRetryHistory,
  parseSSEEvent,
  toApiMessages,
  updateEstimateProposalsMessage,
  type ChatEstimateProposal,
  type ChatMessage
} from "../chat-helpers";

const sample: ChatEstimateProposal[] = [
  {
    index: 0,
    code: "DEM",
    title: "Internal demo L2",
    description: "Strip-out + structural",
    markup: 30,
    labourLines: [
      { role: "Demolition labourer", qty: 4, days: 5, shift: "Day", rate: 72.5 }
    ],
    plantLines: [{ plantItem: "13T excavator", qty: 1, days: 5, rate: 950 }],
    status: "pending"
  },
  {
    index: 1,
    code: "ASB",
    title: "ACM ceiling removal",
    isProvisional: false,
    status: "pending"
  }
];

describe("appendEstimateProposalsMessage", () => {
  it("appends an estimate-proposals row to the history", () => {
    const result = appendEstimateProposalsMessage([], "msg-1", sample);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "estimate-proposals",
      messageId: "msg-1",
      proposals: sample
    });
  });

  it("preserves prior text + scope-proposals rows untouched", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" }
    ];
    const result = appendEstimateProposalsMessage(start, "msg-1", sample);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(start[0]);
    expect(result[1]).toEqual(start[1]);
    expect(result[2]?.role).toBe("estimate-proposals");
  });
});

describe("updateEstimateProposalsMessage", () => {
  it("only mutates the targeted estimate-proposals row", () => {
    const start: ChatMessage[] = [
      { role: "estimate-proposals", messageId: "msg-A", proposals: sample },
      { role: "estimate-proposals", messageId: "msg-B", proposals: sample }
    ];
    const result = updateEstimateProposalsMessage(start, "msg-B", (proposals) =>
      proposals.map((p) => ({ ...p, status: "rejected" as const }))
    );
    if (result[0]?.role !== "estimate-proposals" || result[1]?.role !== "estimate-proposals") {
      throw new Error("expected estimate-proposals rows");
    }
    expect(result[0].proposals[0]?.status).toBe("pending");
    expect(result[1].proposals[0]?.status).toBe("rejected");
    expect(result[1].proposals[1]?.status).toBe("rejected");
  });

  it("returns a NEW array (immutability check)", () => {
    const start: ChatMessage[] = [
      { role: "estimate-proposals", messageId: "msg-1", proposals: sample }
    ];
    const result = updateEstimateProposalsMessage(start, "msg-1", (p) => p);
    expect(result).not.toBe(start);
  });

  it("no-op when no row matches the messageId", () => {
    const start: ChatMessage[] = [
      { role: "estimate-proposals", messageId: "msg-1", proposals: sample }
    ];
    const result = updateEstimateProposalsMessage(start, "missing", (p) =>
      p.map((x) => ({ ...x, status: "rejected" as const }))
    );
    if (result[0]?.role !== "estimate-proposals") {
      throw new Error("expected estimate-proposals row");
    }
    expect(result[0].proposals[0]?.status).toBe("pending");
  });

  it("ignores scope-proposals rows with the same messageId (different role)", () => {
    const start: ChatMessage[] = [
      {
        role: "proposals",
        messageId: "msg-X",
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
      },
      { role: "estimate-proposals", messageId: "msg-X", proposals: sample }
    ];
    const result = updateEstimateProposalsMessage(start, "msg-X", (proposals) =>
      proposals.map((p) => ({ ...p, status: "accepted" as const }))
    );
    if (result[0]?.role !== "proposals" || result[1]?.role !== "estimate-proposals") {
      throw new Error("expected mixed rows");
    }
    // Scope row untouched, estimate row flipped.
    expect(result[0].proposals[0]?.status).toBe("pending");
    expect(result[1].proposals[0]?.status).toBe("accepted");
  });
});

describe("toApiMessages — also drops estimate-proposals rows", () => {
  it("filters out both scope and estimate proposals rows", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "estimate-proposals", messageId: "m1", proposals: sample },
      { role: "assistant", content: "hello" },
      { role: "user", content: "again" }
    ];
    const result = toApiMessages(start);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });
});

describe("buildRetryHistory with estimate-proposals rows", () => {
  it("walks back to the last user message, dropping estimate-proposals + assistant after it", () => {
    const start: ChatMessage[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "ans" },
      { role: "user", content: "second" },
      { role: "estimate-proposals", messageId: "m1", proposals: sample }
    ];
    const replay = buildRetryHistory(start);
    expect(replay).toHaveLength(3);
    expect(replay[2]).toEqual({ role: "user", content: "second" });
  });
});

describe("parseSSEEvent — estimate_proposals event", () => {
  it("parses estimate_proposals events into the unified chunk shape", () => {
    const raw = `data: ${JSON.stringify({
      type: "estimate_proposals",
      messageId: "msg-server-1",
      proposals: sample
    })}`;
    const result = parseSSEEvent(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "estimate_proposals",
      messageId: "msg-server-1"
    });
  });

  it("ignores malformed estimate_proposals events (missing proposals array)", () => {
    const raw = `data: ${JSON.stringify({
      type: "estimate_proposals",
      messageId: "x"
    })}`;
    expect(parseSSEEvent(raw)).toEqual([]);
  });

  it("scope proposals event still parses (no regression)", () => {
    const raw = `data: ${JSON.stringify({
      type: "proposals",
      messageId: "scope-1",
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
    const result = parseSSEEvent(raw);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("proposals");
  });
});

describe("appendUserMessage / appendAssistantMessage / appendEstimateProposalsMessage interleaving", () => {
  it("interleaves text + estimate-proposals + text correctly", () => {
    let history: ChatMessage[] = [];
    history = appendUserMessage(history, "u1");
    history = appendAssistantMessage(history, "a1");
    history = appendEstimateProposalsMessage(history, "msg-1", sample);
    history = appendUserMessage(history, "u2");
    expect(history.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "estimate-proposals",
      "user"
    ]);
  });
});
