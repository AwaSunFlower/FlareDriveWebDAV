import { notFound, RequestHandlerParams } from "./utils";

export async function handleRequestHead({
  bucket,
  path,
}: RequestHandlerParams) {
  const obj = await bucket.head(path);
  if (obj === null) return notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", obj.size.toString());
  if (obj.httpEtag) {
    headers.set("ETag", obj.httpEtag);
  }
  return new Response(null, { headers });
}
