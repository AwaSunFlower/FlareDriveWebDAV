import { listAll, notFound, RequestHandlerParams } from "./utils";

export async function handleRequestDelete({
  bucket,
  path,
}: RequestHandlerParams) {
  // Prevent accidental wipe of the entire root bucket
  if (path === "") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const obj = await bucket.head(path);
  if (obj === null) return notFound();
  await bucket.delete(path);

  if (obj.httpMetadata?.contentType !== "application/x-directory") {
    return new Response(null, { status: 204 });
  }

  // Recursively remove all nested objects & subdirectories
  const batch: string[] = [];
  for await (const child of listAll(bucket, `${path}/`, true)) {
    batch.push(child.key);
    if (batch.length >= 100) {
      await bucket.delete(batch.splice(0, batch.length));
    }
  }
  if (batch.length > 0) {
    await bucket.delete(batch);
  }

  return new Response(null, { status: 204 });
}
