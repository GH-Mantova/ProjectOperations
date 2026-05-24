import { ProposeQuoteContentHandler } from "../propose-quote-content.handler";
import type { ToolHandlerContext } from "../../tool-handler.types";

describe("ProposeQuoteContentHandler", () => {
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

  it("delegates to QuoteProposalsService.storeQuoteProposals and emits an SSE side-effect", async () => {
    const storeQuoteProposals = jest.fn(async () => ({
      message: { id: "msg-stored" },
      proposals: [
        {
          index: 0,
          quoteId: "q-1",
          costLines: [{ label: "Demo", description: "d" }],
          status: "pending"
        }
      ]
    }));
    const handler = new ProposeQuoteContentHandler({ storeQuoteProposals } as never);

    const result = await handler.execute(
      {
        quoteId: "q-1",
        costLines: [{ label: "Demo", description: "d" }]
      },
      CTX
    );

    expect(storeQuoteProposals).toHaveBeenCalledTimes(1);
    expect(storeQuoteProposals).toHaveBeenCalledWith(
      "conv-1",
      "toolu_X",
      expect.objectContaining({ quoteId: "q-1" })
    );

    const text = (result.result.content[0] as { text: string }).text;
    expect(text).toMatch(/Drafted quote content/);
    expect(text).toMatch(/1 cost line/);
    expect(text).toMatch(/wait for the user/i);

    const sideEffects = result.sideEffects ?? [];
    expect(sideEffects).toHaveLength(1);
    expect(sideEffects[0]).toEqual(
      expect.objectContaining({
        type: "sse",
        event: "quote_proposals",
        data: expect.objectContaining({ messageId: "msg-stored" })
      })
    );
  });

  it("describes the proposal by composing all three content groups", async () => {
    const storeQuoteProposals = jest.fn(async () => ({
      message: { id: "msg" },
      proposals: [
        {
          index: 0,
          quoteId: "q-1",
          costLines: [
            { label: "a", description: "x" },
            { label: "b", description: "y" }
          ],
          exclusions: [{ text: "e1" }],
          assumptions: [{ text: "a1" }, { text: "a2" }, { text: "a3" }],
          status: "pending"
        }
      ]
    }));
    const handler = new ProposeQuoteContentHandler({ storeQuoteProposals } as never);
    const result = await handler.execute(
      {
        quoteId: "q-1",
        costLines: [
          { label: "a", description: "x" },
          { label: "b", description: "y" }
        ],
        exclusions: [{ text: "e1" }],
        assumptions: [{ text: "a1" }, { text: "a2" }, { text: "a3" }]
      },
      CTX
    );
    const text = (result.result.content[0] as { text: string }).text;
    expect(text).toMatch(/2 cost lines/);
    expect(text).toMatch(/1 exclusion/);
    expect(text).toMatch(/3 assumptions/);
  });

  it("propagates errors from the proposals service", async () => {
    const storeQuoteProposals = jest.fn(async () => {
      throw new Error("DB down");
    });
    const handler = new ProposeQuoteContentHandler({ storeQuoteProposals } as never);
    await expect(handler.execute({ quoteId: "q-1" }, CTX)).rejects.toThrow("DB down");
  });
});
