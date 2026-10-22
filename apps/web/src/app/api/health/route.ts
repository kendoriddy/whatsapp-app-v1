export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    db: "ok",
    queue: "ok",
    version: process.env.npm_package_version ?? "0.0.1",
  });
}
