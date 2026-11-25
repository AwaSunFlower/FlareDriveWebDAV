import { notFound, RequestHandlerParams } from "./utils";

function computeContentRange(
  range: R2Range,
  totalSize: number
): { start: number; end: number; length: number } | null {
  if (totalSize <= 0) return null;
  if ("suffix" in range && typeof range.suffix === "number") {
    const length = Math.min(range.suffix, totalSize);
    if (length <= 0) return null;
    const start = totalSize - length;
    return { start, end: totalSize - 1, length };
  }
  const offset = "offset" in range && typeof range.offset === "number" ? range.offset : 0;
  if (offset < 0 || offset >= totalSize) return null;
  const maxLen = totalSize - offset;
  const length =
    "length" in range && typeof range.length === "number"
      ? Math.min(range.length, maxLen)
      : maxLen;
  if (length <= 0) return null;
  return { start: offset, end: offset + length - 1, length };
}

export async function handleRequestGet({
  bucket,
  path,
  request,
  isSharedAccess = false,
}: RequestHandlerParams) {
  const hasRangeHeader = request.headers.has("range");
  const obj = await bucket.get(path, {
    onlyIf: request.headers,
    range: hasRangeHeader ? request.headers : undefined,
  });

  if (obj === null) return notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("X-Content-Type-Options", "nosniff");
  if (obj.httpEtag) {
    headers.set("ETag", obj.httpEtag);
  }

  if (!("body" in obj)) {
    const status = request.headers.has("if-none-match") ? 304 : 412;
    return new Response(null, { status, headers });
  }

  if (path.startsWith("_$flaredrive$/thumbnails/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (isSharedAccess) {
    headers.set("Cache-Control", "private, max-age=60");
  }

  const url = new URL(request.url);
  if (url.searchParams.get("download") === "1") {
    const filename = path.split("/").pop() || "download";
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
  }

  if (hasRangeHeader && obj.range) {
    const computed = computeContentRange(obj.range, obj.size);
    if (computed) {
      headers.set(
        "Content-Range",
        `bytes ${computed.start}-${computed.end}/${obj.size}`
      );
      headers.set("Content-Length", computed.length.toString());
      return new Response(obj.body, { status: 206, headers });
    }
  }

  headers.set("Content-Length", obj.size.toString());
  return new Response(obj.body, { status: 200, headers });
}
