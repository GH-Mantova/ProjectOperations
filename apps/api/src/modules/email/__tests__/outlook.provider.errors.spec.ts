import type { ConfigService } from "@nestjs/config";
import type { Client } from "@microsoft/microsoft-graph-client";
import {
  MailAuthError,
  MailError,
  MailRateLimitError,
  MailServerError,
  MailValidationError
} from "../mail-errors";
import { OutlookEmailProvider, resolveMailCreds } from "../providers/outlook.provider";

type PostFn = jest.Mock<Promise<unknown>, [unknown]>;
type GetFn = jest.Mock<Promise<unknown>, []>;

function buildMockClient(opts: { post?: PostFn; get?: GetFn } = {}): {
  client: Client;
  post: PostFn;
  get: GetFn;
} {
  const post: PostFn = opts.post ?? jest.fn().mockResolvedValue(undefined);
  const get: GetFn = opts.get ?? jest.fn().mockResolvedValue({ id: "u1" });
  const api = jest.fn().mockReturnValue({
    post,
    get,
    select: jest.fn().mockReturnThis()
  });
  const client = { api } as unknown as Client;
  return { client, post, get };
}

function buildProvider(post: PostFn): OutlookEmailProvider {
  const { client } = buildMockClient({ post });
  const config = { get: jest.fn() } as unknown as ConfigService;
  return new OutlookEmailProvider(config, "noreply@example.com", client);
}

const SAMPLE_INPUT = {
  to: ["dest@example.com"],
  subject: "hello",
  html: "<p>hi</p>",
  text: "hi"
};

describe("OutlookEmailProvider categorised errors", () => {
  it("maps 401 to MailAuthError", async () => {
    const post = jest.fn().mockRejectedValue(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));
    const provider = buildProvider(post);
    await expect(provider.sendMail(SAMPLE_INPUT)).rejects.toBeInstanceOf(MailAuthError);
    await expect(provider.sendMail(SAMPLE_INPUT)).rejects.toMatchObject({
      category: "auth",
      upstreamStatus: 401
    });
  });

  it("maps 403 to MailAuthError", async () => {
    const post = jest.fn().mockRejectedValue(Object.assign(new Error("Forbidden"), { statusCode: 403 }));
    const provider = buildProvider(post);
    await expect(provider.sendMail(SAMPLE_INPUT)).rejects.toBeInstanceOf(MailAuthError);
  });

  it("preserves the Mail.Send remediation message even when status is missing", async () => {
    const post = jest.fn().mockRejectedValue(new Error("ErrorAccessDenied: Mail.Send is required"));
    const provider = buildProvider(post);
    await expect(provider.sendMail(SAMPLE_INPUT)).rejects.toMatchObject({
      category: "auth",
      message: expect.stringContaining("Mail.Send permission required")
    });
  });

  it("maps 429 with Retry-After header to MailRateLimitError carrying retryAfterSec", async () => {
    const err = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
      headers: { "retry-after": "30" }
    });
    const post = jest.fn().mockRejectedValue(err);
    const provider = buildProvider(post);
    let caught: unknown;
    try {
      await provider.sendMail(SAMPLE_INPUT);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MailRateLimitError);
    expect((caught as MailRateLimitError).retryAfterSec).toBe(30);
    expect((caught as MailRateLimitError).upstreamStatus).toBe(429);
  });

  it("maps 400 to MailValidationError", async () => {
    const post = jest.fn().mockRejectedValue(Object.assign(new Error("Bad request"), { statusCode: 400 }));
    const provider = buildProvider(post);
    await expect(provider.sendMail(SAMPLE_INPUT)).rejects.toBeInstanceOf(MailValidationError);
  });

  it("maps 500 to MailServerError", async () => {
    const post = jest.fn().mockRejectedValue(Object.assign(new Error("server"), { statusCode: 500 }));
    const provider = buildProvider(post);
    await expect(provider.sendMail(SAMPLE_INPUT)).rejects.toBeInstanceOf(MailServerError);
  });

  it("maps 503 to MailServerError", async () => {
    const post = jest.fn().mockRejectedValue(Object.assign(new Error("Unavailable"), { statusCode: 503 }));
    const provider = buildProvider(post);
    await expect(provider.sendMail(SAMPLE_INPUT)).rejects.toBeInstanceOf(MailServerError);
  });

  it("returns without throwing on a successful send", async () => {
    const post = jest.fn().mockResolvedValue(undefined);
    const provider = buildProvider(post);
    await expect(provider.sendMail(SAMPLE_INPUT)).resolves.toBeUndefined();
  });

  it("categorises a network failure (no status, fetch failed) as network", async () => {
    const post = jest.fn().mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));
    const provider = buildProvider(post);
    let caught: unknown;
    try {
      await provider.sendMail(SAMPLE_INPUT);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MailError);
    expect((caught as MailError).category).toBe("network");
  });

  it("strips HTML tags from upstream error message before throwing", async () => {
    const post = jest.fn().mockRejectedValue(
      Object.assign(new Error("<script>alert('x')</script><b>bad</b>"), { statusCode: 500 })
    );
    const provider = buildProvider(post);
    let caught: unknown;
    try {
      await provider.sendMail(SAMPLE_INPUT);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MailServerError);
    expect((caught as Error).message).not.toContain("<script>");
    expect((caught as Error).message).not.toContain("<b>");
  });
});

describe("resolveMailCreds", () => {
  it("returns AZURE_MAIL_* values when all are set", () => {
    const env = {
      AZURE_MAIL_TENANT_ID: "azt",
      AZURE_MAIL_CLIENT_ID: "azc",
      AZURE_MAIL_CLIENT_SECRET: "azs",
      AZURE_MAIL_SENDER_USER_ID: "sender@example.com",
      SHAREPOINT_TENANT_ID: "spt",
      SHAREPOINT_CLIENT_ID: "spc",
      SHAREPOINT_CLIENT_SECRET: "sps"
    } as unknown as NodeJS.ProcessEnv;
    expect(resolveMailCreds(env)).toEqual({
      tenantId: "azt",
      clientId: "azc",
      clientSecret: "azs",
      senderUserId: "sender@example.com"
    });
  });

  it("falls back to SHAREPOINT_* values when AZURE_MAIL_* is unset", () => {
    const env = {
      SHAREPOINT_TENANT_ID: "spt",
      SHAREPOINT_CLIENT_ID: "spc",
      SHAREPOINT_CLIENT_SECRET: "sps"
    } as unknown as NodeJS.ProcessEnv;
    expect(resolveMailCreds(env)).toEqual({
      tenantId: "spt",
      clientId: "spc",
      clientSecret: "sps",
      senderUserId: null
    });
  });

  it("mixes AZURE_MAIL_* (precedence) with SHAREPOINT_* (fallback) per-field", () => {
    const env = {
      AZURE_MAIL_CLIENT_ID: "azc",
      SHAREPOINT_TENANT_ID: "spt",
      SHAREPOINT_CLIENT_ID: "spc",
      SHAREPOINT_CLIENT_SECRET: "sps"
    } as unknown as NodeJS.ProcessEnv;
    expect(resolveMailCreds(env)).toEqual({
      tenantId: "spt",
      clientId: "azc",
      clientSecret: "sps",
      senderUserId: null
    });
  });

  it("returns all nulls when nothing is set", () => {
    expect(resolveMailCreds({} as NodeJS.ProcessEnv)).toEqual({
      tenantId: null,
      clientId: null,
      clientSecret: null,
      senderUserId: null
    });
  });

  it("treats AZURE_MAIL_FROM as the senderUserId fallback when AZURE_MAIL_SENDER_USER_ID is unset", () => {
    const env = { AZURE_MAIL_FROM: "from@example.com" } as unknown as NodeJS.ProcessEnv;
    expect(resolveMailCreds(env).senderUserId).toBe("from@example.com");
  });
});
