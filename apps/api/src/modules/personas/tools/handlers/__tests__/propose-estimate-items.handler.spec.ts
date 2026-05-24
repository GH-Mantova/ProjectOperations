import { ProposeEstimateItemsHandler } from "../propose-estimate-items.handler";
import type { ToolHandlerContext } from "../../tool-handler.types";

describe("ProposeEstimateItemsHandler", () => {
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

  it("delegates to EstimateProposalsService.storeEstimateProposals and returns a text result + SSE side-effect", async () => {
    const storeEstimateProposals = jest.fn(async () => ({
      message: { id: "msg-stored" },
      proposals: [{ index: 0, code: "DEM", title: "X", status: "pending" }]
    }));
    const service = { storeEstimateProposals } as never;
    const handler = new ProposeEstimateItemsHandler(service);

    const result = await handler.execute(
      {
        proposals: [
          {
            code: "DEM",
            title: "X",
            labourLines: [
              { role: "Demolition labourer", qty: 1, days: 1, shift: "Day", rate: 72.5 }
            ]
          }
        ]
      },
      CTX
    );

    expect(storeEstimateProposals).toHaveBeenCalledTimes(1);
    expect(storeEstimateProposals).toHaveBeenCalledWith(
      "conv-1",
      "toolu_X",
      expect.objectContaining({
        proposals: expect.arrayContaining([
          expect.objectContaining({ code: "DEM", title: "X" })
        ])
      })
    );

    const text = (result.result.content[0] as { text: string }).text;
    expect(text).toMatch(/Drafted 1 estimate item proposal/);
    expect(text).toMatch(/wait for the user/i);

    const sideEffects = result.sideEffects ?? [];
    expect(sideEffects).toHaveLength(1);
    expect(sideEffects[0]).toEqual(
      expect.objectContaining({
        type: "sse",
        event: "estimate_proposals",
        data: expect.objectContaining({
          messageId: "msg-stored",
          proposals: expect.any(Array)
        })
      })
    );
  });

  it("uses 'proposals' plural when count > 1", async () => {
    const storeEstimateProposals = jest.fn(async () => ({
      message: { id: "msg" },
      proposals: [
        { index: 0, code: "DEM", title: "A", status: "pending" },
        { index: 1, code: "ASB", title: "B", status: "pending" }
      ]
    }));
    const handler = new ProposeEstimateItemsHandler({ storeEstimateProposals } as never);
    const result = await handler.execute(
      { proposals: [{ code: "DEM", title: "A" }, { code: "ASB", title: "B" }] },
      CTX
    );
    const text = (result.result.content[0] as { text: string }).text;
    expect(text).toMatch(/Drafted 2 estimate item proposals/);
  });

  it("propagates errors from the proposals service rather than swallowing them", async () => {
    const storeEstimateProposals = jest.fn(async () => {
      throw new Error("DB down");
    });
    const handler = new ProposeEstimateItemsHandler({ storeEstimateProposals } as never);
    await expect(
      handler.execute({ proposals: [{ code: "DEM", title: "x" }] }, CTX)
    ).rejects.toThrow("DB down");
  });
});
