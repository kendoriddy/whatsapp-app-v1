"use client";

import type { ReactNode } from "react";

type MediaInfo = {
  id: string;
  status: string | null;
  mimeType: string | null;
  filename: string | null;
  url: string | null;
};

type Props = {
  type: string;
  caption: string | null;
  textBody: string | null;
  media: MediaInfo | null | undefined;
};

function isVisual(type: string, mime: string | null) {
  return (
    type === "image" ||
    type === "sticker" ||
    Boolean(mime?.startsWith("image/"))
  );
}

function isAudio(type: string, mime: string | null) {
  return type === "audio" || Boolean(mime?.startsWith("audio/"));
}

function isVideo(type: string, mime: string | null) {
  return type === "video" || Boolean(mime?.startsWith("video/"));
}

export function MessageMedia({ type, caption, textBody, media }: Props) {
  const hasMediaType = ["image", "audio", "video", "document", "sticker"].includes(
    type,
  );

  if (!hasMediaType && !media) {
    return <>{textBody ?? caption ?? `[${type}]`}</>;
  }

  const status = media?.status ?? "pending";
  const mime = media?.mimeType ?? null;
  const url = media?.url;
  const filename = media?.filename ?? `${type} attachment`;

  let body: ReactNode = null;

  if (status === "pending" || status === "downloading") {
    body = <span className="msg-media-status">Downloading…</span>;
  } else if (status === "failed" || status === "expired" || !url) {
    body = <span className="msg-media-status">Media unavailable</span>;
  } else if (isVisual(type, mime)) {
    body = (
      <a
        className="msg-media-link"
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${filename}`}
      >
        <img className="msg-media-thumb" src={url} alt={caption ?? filename} />
      </a>
    );
  } else if (isAudio(type, mime)) {
    body = (
      <audio className="msg-media-audio" controls preload="metadata" src={url}>
        <a href={url} target="_blank" rel="noreferrer">
          Open audio
        </a>
      </audio>
    );
  } else if (isVideo(type, mime)) {
    body = (
      <video className="msg-media-video" controls preload="metadata" src={url}>
        <a href={url} target="_blank" rel="noreferrer">
          Open video
        </a>
      </video>
    );
  } else {
    body = (
      <div className="msg-media-doc">
        <span className="msg-media-doc-name" title={filename}>
          {filename}
        </span>
        <a
          className="msg-media-open"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Open
        </a>
      </div>
    );
  }

  return (
    <div className="msg-media">
      {body}
      {caption ? <div className="msg-media-caption">{caption}</div> : null}
    </div>
  );
}
