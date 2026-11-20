import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  fetchMediaBytes,
  verifyMediaSha256,
} from "../../apps/worker/src/handlers/download-media";
import {
  buildMediaStoragePath,
  defaultMediaFilename,
  extFromMime,
} from "../../apps/worker/src/lib/media-path";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const JPEG_SHA = createHash("sha256").update(JPEG).digest("hex");

describe("media path helpers", () => {
  it("maps common mime types", () => {
    expect(extFromMime("image/jpeg")).toBe("jpg");
    expect(extFromMime("application/pdf")).toBe("pdf");
  });

  it("builds storage path with utc year/month", () => {
    const path = buildMediaStoragePath({
      conversationId: "conv-1",
      mediaAssetId: "asset-1",
      mimeType: "image/jpeg",
      now: new Date("2026-03-15T12:00:00Z"),
    });
    expect(path).toBe("2026/03/conv-1/asset-1.jpg");
  });

  it("prefers document filename from webhook", () => {
    expect(
      defaultMediaFilename("document", "application/pdf", "quote.pdf"),
    ).toBe("quote.pdf");
    expect(defaultMediaFilename("image", "image/png", null)).toBe("image.png");
  });
});

describe("verifyMediaSha256", () => {
  it("passes when hashes match", () => {
    expect(() => verifyMediaSha256(JPEG, JPEG_SHA)).not.toThrow();
  });

  it("throws SHA_MISMATCH when hashes differ", () => {
    expect(() => verifyMediaSha256(JPEG, "deadbeef".repeat(8))).toThrow(
      "SHA_MISMATCH",
    );
  });

  it("skips when meta hash is absent", () => {
    expect(() => verifyMediaSha256(JPEG, null)).not.toThrow();
  });
});

describe("fetchMediaBytes", () => {
  it("downloads bytes from graph metadata url", async () => {
    const graph = {
      getMedia: vi.fn(async () => ({
        url: "http://example/media",
        mime_type: "image/jpeg",
        sha256: JPEG_SHA,
        file_size: 4,
      })),
      downloadUrl: vi.fn(async () => JPEG),
    };

    const result = await fetchMediaBytes({
      waMediaId: "media1",
      phoneNumberId: "phone1",
      graph,
    });

    expect(result.bytes).toEqual(JPEG);
    expect(result.mimeType).toBe("image/jpeg");
    expect(graph.getMedia).toHaveBeenCalledOnce();
    expect(graph.downloadUrl).toHaveBeenCalledOnce();
  });

  it("retries getMedia after a 404 on the download url", async () => {
    const notFound = Object.assign(new Error("Media download failed: 404"), {
      status: 404,
    });
    const graph = {
      getMedia: vi
        .fn()
        .mockResolvedValueOnce({
          url: "http://example/stale",
          mime_type: "image/jpeg",
          sha256: JPEG_SHA,
          file_size: 4,
        })
        .mockResolvedValueOnce({
          url: "http://example/fresh",
          mime_type: "image/jpeg",
          sha256: JPEG_SHA,
          file_size: 4,
        }),
      downloadUrl: vi
        .fn()
        .mockRejectedValueOnce(notFound)
        .mockResolvedValueOnce(JPEG),
    };

    const result = await fetchMediaBytes({
      waMediaId: "media1",
      phoneNumberId: "phone1",
      graph,
    });

    expect(result.bytes).toEqual(JPEG);
    expect(graph.getMedia).toHaveBeenCalledTimes(2);
    expect(graph.downloadUrl).toHaveBeenCalledTimes(2);
    expect(graph.downloadUrl).toHaveBeenLastCalledWith("http://example/fresh");
  });

  it("does not mark success path when download fails without recovery", async () => {
    const graph = {
      getMedia: vi.fn(async () => ({
        url: "http://example/media",
        mime_type: "image/jpeg",
        sha256: JPEG_SHA,
        file_size: 4,
      })),
      downloadUrl: vi.fn(async () => {
        throw Object.assign(new Error("Media download failed: 500"), {
          status: 500,
        });
      }),
    };

    await expect(
      fetchMediaBytes({
        waMediaId: "media1",
        phoneNumberId: "phone1",
        graph,
      }),
    ).rejects.toThrow("500");
    expect(graph.getMedia).toHaveBeenCalledOnce();
  });
});

describe("stored media flow (unit)", () => {
  it("hash mismatch prevents treating bytes as valid", () => {
    const wrongMeta = "0000000000000000000000000000000000000000000000000000000000000000";
    expect(() => verifyMediaSha256(JPEG, wrongMeta)).toThrow("SHA_MISMATCH");
  });
});
