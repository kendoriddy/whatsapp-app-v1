export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pilot signup intake. Persists nowhere yet — returns acceptance so the
 * landing "Start free" flow is real. Wire to CRM / waitlist when ready.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      businessName?: string;
      email?: string;
      whatsapp?: string;
    };
    const businessName = String(body.businessName ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const whatsapp = String(body.whatsapp ?? "").trim();

    if (!businessName || !email || !whatsapp) {
      return Response.json(
        { error: { code: "invalid", message: "All fields are required" } },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: { code: "invalid", message: "Enter a valid email" } },
        { status: 400 },
      );
    }

    console.info("[signup]", { businessName, email, whatsapp });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: { code: "error", message: "Could not start signup" } },
      { status: 500 },
    );
  }
}
