import { describe, expect, it } from "vitest";
import { signMetaPayload, verifyMetaSignature, timingSafeEqualString } from "@mmabon/whatsapp";

describe("AC-WH signature + handshake helpers", () => {
  it("AC-WH-1 style verify token compare", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
  });

  it("AC-WH-2/3 signature", () => {
    const body = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
    const secret = "test-secret";
    const sig = signMetaPayload(body, secret);
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
    const tampered = Buffer.from(body);
    tampered[0] = tampered[0]! ^ 1;
    expect(verifyMetaSignature(tampered, sig, secret)).toBe(false);
  });
});
