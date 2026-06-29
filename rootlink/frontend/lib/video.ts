// Client-side video thumbnail derivation (mirrors backend services/oembed.py).
// YouTube thumbnails are deterministic; a stored `poster` (e.g. Vimeo via oEmbed)
// takes precedence. Returns null when no thumbnail can be derived.

const YT = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
];

export function youtubeId(url?: string | null): string | null {
  if (!url) return null;
  for (const re of YT) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

export function videoThumbnail(url?: string | null, poster?: string | null): string | null {
  if (poster) return poster;
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
