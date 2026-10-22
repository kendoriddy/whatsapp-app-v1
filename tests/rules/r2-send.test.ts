import { describe, expect, it, vi } from "vitest";
import { sendOutbound } from "@mmabon/whatsapp";

function baseDeps(overrides: Partial<Parameters<typeof sendOutbound>[1]> = {}) {
  return {
    getOutbound: vi.fn(async () => ({
      id: "o1",
      status: "pending_approval",
      approvedBy: null,
      autoSent: false,
      automationSettingKey: null,
      kind: "text" as const,
      bodyText: "hi",
      templateParams: null,
      wamid: null,
      origin: "staff_composed",
    })),
    getApproverRole: vi.fn(async () => "admin"),
    getAutomationEnabled: vi.fn(async () => false),
    isSendsPaused: vi.fn(async () => false),
    getPhoneNumberId: vi.fn(async () => "phone1"),
    getRecipientWaId: vi.fn(async () => "2348000000001"),
    getTemplateName: vi.fn(async () => null),
    markSending: vi.fn(async () => {}),
    markSent: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    graphBaseUrl: "http://localhost:4010",
    graphVersion: "v25.0",
    token: "t",
    fetchImpl: vi.fn(
      async () =>
        new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), {
          status: 200,
        }),
    ),
    ...overrides,
  };
}

describe("R-2 send gate", () => {
  it("r2-unapproved-not-sent", async () => {
    const deps = baseDeps();
    await expect(sendOutbound("o1", deps)).rejects.toThrow();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
    expect(deps.markFailed).toHaveBeenCalled();
  });

  it("r2-auto-send-default-off", async () => {
    const deps = baseDeps({
      getOutbound: vi.fn(async () => ({
        id: "o1",
        status: "approved",
        approvedBy: null,
        autoSent: true,
        automationSettingKey: "auto_send.read_receipts",
        kind: "text" as const,
        bodyText: "hi",
        templateParams: null,
        wamid: null,
        origin: "system_auto",
      })),
      getAutomationEnabled: vi.fn(async () => false),
    });
    await expect(sendOutbound("o1", deps)).rejects.toMatchObject({
      code: "R2_SETTING_DISABLED",
    });
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("sends when approved by SEND_ROLE", async () => {
    const deps = baseDeps({
      getOutbound: vi.fn(async () => ({
        id: "o1",
        status: "approved",
        approvedBy: "u1",
        autoSent: false,
        automationSettingKey: null,
        kind: "text" as const,
        bodyText: "hi",
        templateParams: null,
        wamid: null,
        origin: "staff_composed",
      })),
    });
    const r = await sendOutbound("o1", deps);
    expect(r.wamid).toBe("wamid.1");
    expect(deps.fetchImpl).toHaveBeenCalled();
  });
});
