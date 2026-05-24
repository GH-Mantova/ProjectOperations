import { ProposeClarificationsHandler } from "../propose-clarifications.handler";
import type { ToolHandlerContext } from "../../tool-handler.types";

describe("ProposeClarificationsHandler", () => {
  const CTX: ToolHandlerContext = {
    actor: {
      sub: "u-1",
      email: "u@is",
      permissions: ["ai.persona.tendering"],
      isSuperUser: false
    } as never,
    conversationId: "conv-1",
    contextKey: "tender-1",
    toolUseId: "toolu_X"
  };

  it("delegates to ClarificationProposalsService.storeClarificationProposals + emits SSE side-effect", async () => {
    const storeClarificationProposals = jest.fn(async () => ({
      message: { id: "msg-stored" },
      proposals: [
        {
          index: 0,
          proposal: { kind: "new_rfi", subject: "X" },
          status: "pending"
        }
      ]
    }));
    const handler = new ProposeClarificationsHandler({ storeClarificationProposals } as never);
    const result = await handler.execute(
      { proposals: [{ kind: "new_rfi", subject: "X" }] },
      CTX
    );

    expect(storeClarificationProposals).toHaveBeenCalledTimes(1);
    const text = (result.result.content[0] as { text: string }).text;
    expect(text).toMatch(/Drafted clarifications activity/);
    expect(text).toMatch(/1 RFI/);
    expect(text).toMatch(/wait for the user/i);

    const sideEffects = result.sideEffects ?? [];
    expect(sideEffects).toHaveLength(1);
    expect(sideEffects[0]).toEqual(
      expect.objectContaining({
        type: "sse",
        event: "clarification_proposals",
        data: expect.objectContaining({ messageId: "msg-stored" })
      })
    );
  });

  it("describes proposals by kind in the text result", async () => {
    const storeClarificationProposals = jest.fn(async () => ({
      message: { id: "msg" },
      proposals: [
        { index: 0, proposal: { kind: "new_rfi", subject: "a" }, status: "pending" },
        { index: 1, proposal: { kind: "new_rfi", subject: "b" }, status: "pending" },
        {
          index: 2,
          proposal: { kind: "new_note", noteType: "call", direction: "sent", text: "x" },
          status: "pending"
        },
        {
          index: 3,
          proposal: { kind: "rfi_response", rfiId: "rfi-1", response: "x" },
          status: "pending"
        }
      ]
    }));
    const handler = new ProposeClarificationsHandler({ storeClarificationProposals } as never);
    const result = await handler.execute(
      {
        proposals: [
          { kind: "new_rfi", subject: "a" },
          { kind: "new_rfi", subject: "b" },
          { kind: "new_note", noteType: "call", direction: "sent", text: "x" },
          { kind: "rfi_response", rfiId: "rfi-1", response: "x" }
        ]
      },
      CTX
    );
    const text = (result.result.content[0] as { text: string }).text;
    expect(text).toMatch(/2 RFIs/);
    expect(text).toMatch(/1 note/);
    expect(text).toMatch(/1 RFI response/);
  });

  it("propagates errors from the proposals service", async () => {
    const storeClarificationProposals = jest.fn(async () => {
      throw new Error("DB down");
    });
    const handler = new ProposeClarificationsHandler({ storeClarificationProposals } as never);
    await expect(
      handler.execute({ proposals: [{ kind: "new_rfi", subject: "x" }] }, CTX)
    ).rejects.toThrow("DB down");
  });
});
