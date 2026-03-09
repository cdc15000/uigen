// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockGet, mockSet, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
  }),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { SignJWT, jwtVerify, decodeJwt } from "jose";

const SECRET = new TextEncoder().encode("development-secret-key");

async function createToken(payload: object, expiredAt?: number) {
  const exp = expiredAt ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .setIssuedAt()
    .sign(SECRET);
}

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("sets the auth-token cookie with a compact JWT", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockSet).toHaveBeenCalledOnce();
    const [name, token, opts] = mockSet.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });

  test("sets cookie expiry to ~7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const [, , opts] = mockSet.mock.calls[0];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(opts.expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(opts.expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("embeds userId and email in the JWT payload", async () => {
    await createSession("user-42", "hello@example.com");

    const [, token] = mockSet.mock.calls[0];
    const claims = decodeJwt(token);
    expect(claims.userId).toBe("user-42");
    expect(claims.email).toBe("hello@example.com");
  });

  test("signs the JWT with HS256", async () => {
    await createSession("user-1", "test@example.com");

    const [, token] = mockSet.mock.calls[0];
    const header = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString()
    );
    expect(header.alg).toBe("HS256");
  });

  test("produces a verifiable JWT using the default secret", async () => {
    await createSession("user-1", "test@example.com");

    const [, token] = mockSet.mock.calls[0];
    await expect(jwtVerify(token, SECRET)).resolves.toBeDefined();
  });

  test("JWT cannot be verified with a wrong secret", async () => {
    await createSession("user-1", "test@example.com");

    const [, token] = mockSet.mock.calls[0];
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    await expect(jwtVerify(token, wrongSecret)).rejects.toThrow();
  });

  test("secure flag is false outside production", async () => {
    const original = process.env.NODE_ENV;
    // NODE_ENV is 'test' in vitest
    await createSession("user-1", "test@example.com");

    const [, , opts] = mockSet.mock.calls[0];
    expect(opts.secure).toBe(false);
    process.env.NODE_ENV = original;
  });

  test("token produced by createSession is accepted by getSession", async () => {
    await createSession("user-99", "round@trip.com");
    const [, token] = mockSet.mock.calls[0];

    // Feed the produced token back through getSession
    mockGet.mockReturnValue({ value: token });
    const session = await getSession();

    expect(session?.userId).toBe("user-99");
    expect(session?.email).toBe("round@trip.com");
  });

  test("different inputs produce different tokens", async () => {
    await createSession("user-1", "a@example.com");
    const [, token1] = mockSet.mock.calls[0];
    vi.clearAllMocks();

    await createSession("user-2", "b@example.com");
    const [, token2] = mockSet.mock.calls[0];

    expect(token1).not.toBe(token2);
  });
});

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns null when no cookie is present", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await createToken({ userId: "user-1", email: "a@b.com" });
    mockGet.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("a@b.com");
  });

  test("returns null for a malformed token", async () => {
    mockGet.mockReturnValue({ value: "not.a.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 60;
    const token = await createToken({ userId: "user-1", email: "a@b.com" }, expiredAt);
    mockGet.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockDelete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  test("returns null when no cookie is in the request", async () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(await verifySession(req)).toBeNull();
  });

  test("returns session payload for a valid token in the request", async () => {
    const token = await createToken({ userId: "user-2", email: "x@y.com" });
    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: `auth-token=${token}` },
    });

    const session = await verifySession(req);

    expect(session?.userId).toBe("user-2");
    expect(session?.email).toBe("x@y.com");
  });

  test("returns null for a malformed token in the request", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: "auth-token=bad.token.value" },
    });
    expect(await verifySession(req)).toBeNull();
  });

  test("returns null for an expired token in the request", async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 60;
    const token = await createToken({ userId: "user-2", email: "x@y.com" }, expiredAt);
    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: `auth-token=${token}` },
    });
    expect(await verifySession(req)).toBeNull();
  });
});
