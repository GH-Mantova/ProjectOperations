import { describe, expect, it } from "vitest";
import { rebuildMessagesFromHistory } from "../use-streaming-chat";

describe("rebuildMessagesFromHistory", () => {
  it("returns user + assistant + proposals rows; drops tool_call rows", () => {
    const rows = [
      { id: "m1", role: "user", content: "hi" },
      { id: "m2", role: "tool_call", content: "(tool invocation)", metadata: { name: "x" } },
      {
        id: "m3",
        role: "tool_result",
        content: "1 pending",
        metadata: {
          toolUseId: "tu-1",
          proposals: [
            {
              index: 0,
              discipline: "demolition" as const,
              title: "x",
              description: "y",
              quantity: 1,
              unit: "ea",
              status: "pending" as const
            }
          ]
        }
      },
      { id: "m4", role: "assistant", content: "let me know" }
    ];
    const result = rebuildMessagesFromHistory(rows);
    expect(result.map((r) => r.role)).toEqual(["user", "proposals", "assistant"]);
    if (result[1]?.role !== "proposals") throw new Error("expected proposals row");
    expect(result[1].messageId).toBe("m3");
    expect(result[1].proposals).toHaveLength(1);
  });

  it("skips tool_result rows with no proposals metadata (defence-in-depth)", () => {
    const rows = [
      { id: "m1", role: "tool_result", content: "x", metadata: null }
    ];
    expect(rebuildMessagesFromHistory(rows)).toEqual([]);
  });

  it("preserves accepted/rejected statuses and acceptedScopeItemId", () => {
    const rows = [
      {
        id: "m1",
        role: "tool_result",
        content: "1",
        metadata: {
          toolUseId: "tu-1",
          proposals: [
            {
              index: 0,
              discipline: "civil" as const,
              title: "x",
              description: "y",
              quantity: 1,
              unit: "ea",
              status: "accepted" as const,
              acceptedScopeItemId: "scope-7"
            }
          ]
        }
      }
    ];
    const result = rebuildMessagesFromHistory(rows);
    if (result[0]?.role !== "proposals") throw new Error("expected proposals row");
    expect(result[0].proposals[0]?.status).toBe("accepted");
    expect(result[0].proposals[0]?.acceptedScopeItemId).toBe("scope-7");
  });

  it("ignores unknown roles", () => {
    const rows = [
      { id: "m1", role: "system", content: "system msg" },
      { id: "m2", role: "user", content: "hi" }
    ];
    const result = rebuildMessagesFromHistory(rows);
    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("user");
  });
});
