import { isPrivatePath } from "../../utils/auth";
import {
  listAll,
  RequestHandlerParams,
  ROOT_OBJECT,
  WEBDAV_ENDPOINT,
} from "./utils";

type DavProperties = {
  creationdate: string | undefined;
  displayname: string | undefined;
  getcontentlanguage: string | undefined;
  getcontentlength: string | undefined;
  getcontenttype: string | undefined;
  getetag: string | undefined;
  getlastmodified: string | undefined;
  resourcetype: string;
  "fd:thumbnail": string | undefined;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeHrefPath(key: string): string {
  if (!key) return WEBDAV_ENDPOINT;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${WEBDAV_ENDPOINT}${encoded}`;
}

function fromR2Object(object: R2Object | typeof ROOT_OBJECT): DavProperties {
  return {
    creationdate: object.uploaded.toUTCString(),
    displayname: object.httpMetadata?.contentDisposition,
    getcontentlanguage: object.httpMetadata?.contentLanguage,
    getcontentlength: object.size.toString(),
    getcontenttype: object.httpMetadata?.contentType,
    getetag: object.etag,
    getlastmodified: object.uploaded.toUTCString(),
    resourcetype:
      object.httpMetadata?.contentType === "application/x-directory"
        ? "<collection />"
        : "",
    "fd:thumbnail": object.customMetadata?.thumbnail,
  };
}

async function findChildren({
  bucket,
  path,
  depth,
  hiddenPrivateDirs,
}: {
  bucket: R2Bucket;
  path: string;
  depth: string;
  hiddenPrivateDirs: string[];
}) {
  if (!["1", "infinity"].includes(depth)) return [];

  const objects: Array<R2Object> = [];

  const prefix = path === "" ? path : `${path}/`;
  for await (const object of listAll(bucket, prefix, depth === "infinity")) {
    if (
      hiddenPrivateDirs.length > 0 &&
      isPrivatePath(object.key, hiddenPrivateDirs)
    ) {
      continue;
    }
    objects.push(object);
  }

  return objects;
}

export async function handleRequestPropfind({
  bucket,
  path,
  request,
  hiddenPrivateDirs = [],
}: RequestHandlerParams) {
  const responseTemplate = `<?xml version="1.0" encoding="utf-8" ?>
<multistatus xmlns="DAV:" xmlns:fd="flaredrive">
{{items}}
</multistatus>`;

  const rootObject = path === "" ? ROOT_OBJECT : await bucket.head(path);
  if (!rootObject) return new Response("Not found", { status: 404 });
  const isDirectory =
    rootObject === ROOT_OBJECT ||
    rootObject.httpMetadata?.contentType === "application/x-directory";
  const depth = request.headers.get("Depth") ?? "infinity";

  const children = !isDirectory
    ? []
    : await findChildren({
        bucket,
        path,
        depth,
        hiddenPrivateDirs,
      });

  const items = [rootObject, ...children].map((child) => {
    const properties = fromR2Object(child);
    const propXml = Object.entries(properties)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        const rendered = key === "resourcetype" ? value! : escapeXml(value!);
        return `<${key}>${rendered}</${key}>`;
      })
      .join("\n        ");

    return `
  <response>
    <href>${escapeXml(encodeHrefPath(child.key))}</href>
    <propstat>
      <prop>
        ${propXml}
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>`;
  });

  return new Response(responseTemplate.replace("{{items}}", items.join("")), {
    status: 207,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
