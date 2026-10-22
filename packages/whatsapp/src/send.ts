import { AppError, ErrorCodes } from "@mmabon/shared";
import { classifyGraphError, GRAPH_USER_MESSAGES } from "./errors.js";

export const SEND_ROLES = ["admin", "sales", "manager"] as const;

export type OutboundRow = {
  id: string;
  status: string;
  approvedBy: string | null;
  autoSent: boolean;
  automationSettingKey: string | null;
  kind: "text" | "media" | "template";
  bodyText: string | null;
  templateParams: unknown;
  wamid: string | null;
  origin: string;
};

export type SendDeps = {
  getOutbound: (id: string) => Promise<OutboundRow | null>;
  getApproverRole: (userId: string) => Promise<string | null>;
  getAutomationEnabled: (key: string, origin: string) => Promise<boolean>;
  isSendsPaused: () => Promise<boolean>;
  getPhoneNumberId: (outboundId: string) => Promise<string>;
  getRecipientWaId: (outboundId: string) => Promise<string>;
  getTemplateName: (outboundId: string) => Promise<{ name: string; language: string } | null>;
  markSending: (id: string) => Promise<void>;
  markSent: (id: string, wamid: string) => Promise<void>;
  markFailed: (id: string, code: number | null, error: string, needsManualCheck?: boolean) => Promise<void>;
  graphBaseUrl: string;
  graphVersion: string;
  token: string;
  fetchImpl?: typeof fetch;
};

/**
 * R-2 gated send. The ONLY code path that calls Graph /messages.
 */
export async function sendOutbound(outboundId: string, deps: SendDeps): Promise<{ wamid: string }> {
  if (await deps.isSendsPaused()) {
    throw new AppError(ErrorCodes.SENDS_PAUSED, "Outbound sending is paused", 422);
  }

  const row = await deps.getOutbound(outboundId);
  if (!row) throw new AppError(ErrorCodes.NOT_FOUND, "Outbound not found", 404);

  if (row.autoSent) {
    if (!row.automationSettingKey) {
      await deps.markFailed(outboundId, null, ErrorCodes.R2_SETTING_DISABLED);
      throw new AppError(ErrorCodes.R2_SETTING_DISABLED, "Automation setting missing", 422);
    }
    const ok = await deps.getAutomationEnabled(row.automationSettingKey, row.origin);
    if (!ok) {
      await deps.markFailed(outboundId, null, ErrorCodes.R2_SETTING_DISABLED);
      throw new AppError(ErrorCodes.R2_SETTING_DISABLED, "Automation disabled", 422);
    }
  } else {
    if (row.status !== "approved" || !row.approvedBy) {
      await deps.markFailed(outboundId, null, ErrorCodes.R2_NOT_APPROVED);
      throw new AppError(ErrorCodes.R2_NOT_APPROVED, "Outbound not approved", 422);
    }
    const role = await deps.getApproverRole(row.approvedBy);
    if (!role || !(SEND_ROLES as readonly string[]).includes(role)) {
      await deps.markFailed(outboundId, null, ErrorCodes.R2_NOT_APPROVED);
      throw new AppError(ErrorCodes.R2_NOT_APPROVED, "Approver role cannot send", 422);
    }
  }

  await deps.markSending(outboundId);

  const phoneNumberId = await deps.getPhoneNumberId(outboundId);
  const to = await deps.getRecipientWaId(outboundId);
  const fetchFn = deps.fetchImpl ?? fetch;

  let body: Record<string, unknown>;
  if (row.kind === "text") {
    body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: true, body: row.bodyText },
    };
  } else if (row.kind === "template") {
    const tpl = await deps.getTemplateName(outboundId);
    if (!tpl) throw new AppError(ErrorCodes.NOT_FOUND, "Template missing", 404);
    const params = (row.templateParams as { body?: string[] } | null)?.body ?? [];
    body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tpl.name,
        language: { code: tpl.language },
        components: params.length
          ? [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t })) }]
          : [],
      },
    };
  } else {
    body = {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { id: "placeholder" },
    };
  }

  const url = `${deps.graphBaseUrl}/${deps.graphVersion}/${phoneNumberId}/messages`;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    await deps.markFailed(outboundId, null, String(e), true);
    throw e;
  }

  const json = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id: string }>;
    error?: { code?: number; message?: string; error_subcode?: number; fbtrace_id?: string };
  };

  if (!res.ok) {
    const code = json.error?.code ?? res.status;
    const kind = classifyGraphError(code);
    const msg = GRAPH_USER_MESSAGES[code] ?? json.error?.message ?? `Graph error ${code}`;
    await deps.markFailed(outboundId, code, JSON.stringify(json.error ?? msg), kind === "ambiguous");
    throw new AppError(String(code), msg, 422, json.error);
  }

  const wamid = json.messages?.[0]?.id;
  if (!wamid) {
    await deps.markFailed(outboundId, null, "No wamid in response", true);
    throw new AppError("NO_WAMID", "Graph response missing wamid", 500);
  }
  await deps.markSent(outboundId, wamid);
  return { wamid };
}
