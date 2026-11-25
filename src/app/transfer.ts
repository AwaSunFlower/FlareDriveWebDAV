import pLimit from "p-limit";

import { encodeKey, FileItem } from "../FileGrid";
import { AuthRequiredError, SPA_REQUEST_HEADERS } from "./api";
import { TransferTask } from "./transferQueue";

const WEBDAV_ENDPOINT = "/webdav/";

export async function fetchPath(path: string, shareToken?: string) {
  const url = shareToken
    ? `${WEBDAV_ENDPOINT}${encodeKey(path)}?share=${encodeURIComponent(
        shareToken
      )}`
    : `${WEBDAV_ENDPOINT}${encodeKey(path)}`;

  const res = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Depth: "1",
      ...SPA_REQUEST_HEADERS,
    },
    cache: "no-store",
  });

  if (res.status === 401) throw new AuthRequiredError("请先登录以查看目录");
  if (!res.ok) throw new Error(`加载目录失败 (${res.status})`);
  if (!res.headers.get("Content-Type")?.includes("application/xml"))
    throw new Error("服务端返回了无效的数据格式");

  const parser = new DOMParser();
  const text = await res.text();
  const document = parser.parseFromString(text, "application/xml");
  const normalizedTarget = path.replace(/\/$/, "");

  const items: FileItem[] = Array.from(document.querySelectorAll("response"))
    .filter((response) => {
      const href = response.querySelector("href")?.textContent ?? "";
      return (
        decodeURIComponent(href)
          .slice(WEBDAV_ENDPOINT.length)
          .replace(/\/$/, "") !== normalizedTarget
      );
    })
    .map((response) => {
      const href = response.querySelector("href")?.textContent;
      if (!href) throw new Error("Invalid response");
      const contentType = response.querySelector("getcontenttype")?.textContent;
      const size = response.querySelector("getcontentlength")?.textContent;
      const lastModified =
        response.querySelector("getlastmodified")?.textContent;
      const thumbnail = response.getElementsByTagNameNS(
        "flaredrive",
        "thumbnail"
      )[0]?.textContent;
      return {
        key: decodeURIComponent(href).replace(/^\/webdav\//, ""),
        size: size ? Number(size) : 0,
        uploaded: lastModified!,
        httpMetadata: { contentType: contentType! },
        customMetadata: { thumbnail },
      } as FileItem;
    });
  return items;
}

const THUMBNAIL_SIZE = 144;

export async function generateThumbnail(file: File) {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const ctx = canvas.getContext("2d")!;

  if (file.type.startsWith("image/")) {
    const image = await new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = URL.createObjectURL(file);
    });
    ctx.drawImage(image, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (file.type === "video/mp4") {
    const video = await new Promise<HTMLVideoElement>(
      async (resolve, reject) => {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.src = URL.createObjectURL(file);
        setTimeout(() => reject(new Error("Video load timeout")), 2000);
        await vid.play();
        vid.pause();
        vid.currentTime = 0;
        resolve(vid);
      }
    );
    ctx.drawImage(video, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (file.type === "application/pdf") {
    const pdfjsLib = await import(
      // @ts-ignore
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs"
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const page = await pdf.getPage(1);
    const { width, height } = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_SIZE / Math.max(width, height);
    const viewport = page.getViewport({ scale });
    const renderContext = { canvasContext: ctx, viewport };
    await page.render(renderContext).promise;
  }

  const thumbnailBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob!))
  );

  return thumbnailBlob;
}

export async function blobDigest(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  const digestArray = Array.from(new Uint8Array(digest));
  const digestHex = digestArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return digestHex;
}

export const SIZE_LIMIT = 100 * 1000 * 1000; // 100MB

function xhrFetch(
  url: RequestInfo | URL,
  requestInit: RequestInit & {
    onUploadProgress?: (progressEvent: ProgressEvent) => void;
  }
) {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = requestInit.onUploadProgress ?? null;
    xhr.open(
      requestInit.method ?? "GET",
      url instanceof Request ? url.url : url
    );
    const headers = new Headers(requestInit.headers);
    headers.set("X-Requested-With", "SunflowerDrive");
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.onload = () => {
      const responseHeaders = xhr
        .getAllResponseHeaders()
        .trim()
        .split("\r\n")
        .reduce((acc, header) => {
          const idx = header.indexOf(": ");
          if (idx > 0) {
            acc[header.slice(0, idx)] = header.slice(idx + 2);
          }
          return acc;
        }, {} as Record<string, string>);
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          headers: responseHeaders,
        })
      );
    };
    xhr.onerror = reject;
    if (
      requestInit.body instanceof Blob ||
      typeof requestInit.body === "string"
    ) {
      xhr.send(requestInit.body);
    }
  });
}

export async function multipartUpload(
  key: string,
  file: File,
  options?: {
    headers?: Record<string, string>;
    onUploadProgress?: (progressEvent: {
      loaded: number;
      total: number;
    }) => void;
  }
) {
  const headers: Record<string, string> = {
    ...SPA_REQUEST_HEADERS,
    ...(options?.headers || {}),
    "content-type": file.type || "application/octet-stream",
  };

  const uploadResponse = await fetch(`/webdav/${encodeKey(key)}?uploads`, {
    headers,
    method: "POST",
  });
  if (uploadResponse.status === 401) throw new AuthRequiredError();
  if (!uploadResponse.ok) {
    throw new Error(`初始化分片上传失败 (${uploadResponse.status})`);
  }
  const { uploadId } = await uploadResponse.json<{ uploadId: string }>();
  const totalChunks = Math.ceil(file.size / SIZE_LIMIT);

  const limit = pLimit(2);
  const parts = Array.from({ length: totalChunks }, (_, i) => i + 1);
  const partsLoaded = Array.from({ length: totalChunks + 1 }, () => 0);
  const promises = parts.map((i) =>
    limit(async () => {
      const chunk = file.slice((i - 1) * SIZE_LIMIT, i * SIZE_LIMIT);
      const searchParams = new URLSearchParams({
        partNumber: i.toString(),
        uploadId,
      });
      const uploadUrl = `/webdav/${encodeKey(key)}?${searchParams}`;
      if (i === limit.concurrency)
        await new Promise((resolve) => setTimeout(resolve, 1000));

      const uploadPart = () =>
        xhrFetch(uploadUrl, {
          method: "PUT",
          headers,
          body: chunk,
          onUploadProgress: (progressEvent) => {
            partsLoaded[i] = progressEvent.loaded;
            options?.onUploadProgress?.({
              loaded: partsLoaded.reduce((a, b) => a + b),
              total: file.size,
            });
          },
        });

      const retryReducer = (acc: Promise<Response>) =>
        acc
          .then((res) => {
            const retryAfter = res.headers.get("retry-after");
            if (!retryAfter) return res;
            return uploadPart();
          })
          .catch(uploadPart);
      const response = await [1, 2].reduce(retryReducer, uploadPart());
      if (!response.ok) {
        throw new Error(`分片 ${i} 上传失败 (${response.status})`);
      }
      return { partNumber: i, etag: response.headers.get("etag")! };
    })
  );
  const uploadedParts = await Promise.all(promises);
  const completeParams = new URLSearchParams({ uploadId });
  const response = await fetch(`/webdav/${encodeKey(key)}?${completeParams}`, {
    method: "POST",
    headers: SPA_REQUEST_HEADERS,
    body: JSON.stringify({ parts: uploadedParts }),
  });
  if (response.status === 401) throw new AuthRequiredError();
  if (!response.ok) throw new Error(await response.text());
  return response;
}

export async function copyPaste(source: string, target: string, move = false) {
  const uploadUrl = `${WEBDAV_ENDPOINT}${encodeKey(source)}`;
  const destinationUrl = new URL(
    `${WEBDAV_ENDPOINT}${encodeKey(target)}`,
    window.location.href
  );
  const res = await fetch(uploadUrl, {
    method: move ? "MOVE" : "COPY",
    headers: {
      Destination: destinationUrl.href,
      ...SPA_REQUEST_HEADERS,
    },
  });
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) {
    throw new Error(`${move ? "移动/重命名" : "复制"}失败 (${res.status})`);
  }
}

export async function createFolder(cwd: string, providedName?: string) {
  const rawName =
    providedName !== undefined ? providedName : window.prompt("Folder name");
  const folderName = rawName?.trim();
  if (!folderName) return false;
  if (folderName.includes("/")) {
    throw new Error("文件夹名称不能包含 /");
  }
  const folderKey = `${cwd}${folderName}`;
  const uploadUrl = `${WEBDAV_ENDPOINT}${encodeKey(folderKey)}`;
  const res = await fetch(uploadUrl, {
    method: "MKCOL",
    headers: SPA_REQUEST_HEADERS,
  });
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) {
    throw new Error(`创建文件夹失败 (${res.status})`);
  }
  return true;
}

export async function ensureFoldersExist(
  baseDir: string,
  relativeDirs: Iterable<string>
): Promise<number> {
  const uniqueAncestors = new Set<string>();
  for (const rawRel of relativeDirs) {
    const clean = rawRel.replace(/^\/+|\/+$/g, "");
    if (!clean) continue;
    const segments = clean.split("/").filter(Boolean);
    let acc = "";
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      uniqueAncestors.add(acc);
    }
  }

  const ordered = Array.from(uniqueAncestors).sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
  );

  for (const relDir of ordered) {
    const fullKey = `${baseDir}${relDir}`;
    const res = await fetch(`${WEBDAV_ENDPOINT}${encodeKey(fullKey)}`, {
      method: "MKCOL",
      headers: SPA_REQUEST_HEADERS,
    });
    if (res.status === 401) {
      throw new AuthRequiredError("上传文件夹失败：请先登录管理员账号");
    }
    // 201 Created = newly created; 405 Method Not Allowed = already exists
    if (!res.ok && res.status !== 405) {
      throw new Error(`创建子目录「${relDir}」失败 (${res.status})`);
    }
  }

  return ordered.length;
}

export interface StagedUploadFile {
  file: File;
  relativeDir: string;
}

interface WebkitEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (
    success: (file: File) => void,
    error?: (err: unknown) => void
  ) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: WebkitEntryLike[]) => void,
      error?: (err: unknown) => void
    ) => void;
  };
}

async function readDirectoryEntries(
  entry: WebkitEntryLike,
  parentPath: string,
  filesOut: StagedUploadFile[],
  dirsOut: Set<string>
): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File | null>((resolve) => {
      entry.file!(
        (f) => resolve(f),
        () => resolve(null)
      );
    });
    if (file) {
      filesOut.push({ file, relativeDir: parentPath });
    }
    return;
  }

  if (entry.isDirectory && entry.createReader) {
    const nextDir = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    dirsOut.add(nextDir);
    const reader = entry.createReader();
    const allChildren: WebkitEntryLike[] = [];

    while (true) {
      const batch = await new Promise<WebkitEntryLike[]>((resolve) => {
        reader.readEntries(
          (entries) => resolve(entries),
          () => resolve([])
        );
      });
      if (!batch.length) break;
      allChildren.push(...batch);
    }

    for (const child of allChildren) {
      await readDirectoryEntries(child, nextDir, filesOut, dirsOut);
    }
  }
}

export async function collectDroppedEntries(
  dataTransfer: DataTransfer
): Promise<{ files: StagedUploadFile[]; dirs: string[] }> {
  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item): WebkitEntryLike | null => {
      const withEntry = item as DataTransferItem & {
        webkitGetAsEntry?: () => unknown;
      };
      return typeof withEntry.webkitGetAsEntry === "function"
        ? ((withEntry.webkitGetAsEntry() as WebkitEntryLike | null) ?? null)
        : null;
    })
    .filter((entry): entry is WebkitEntryLike => entry !== null);

  if (entries.length > 0) {
    const filesOut: StagedUploadFile[] = [];
    const dirsOut = new Set<string>();
    for (const entry of entries) {
      await readDirectoryEntries(entry, "", filesOut, dirsOut);
    }
    return { files: filesOut, dirs: Array.from(dirsOut) };
  }

  const plainFiles = Array.from(dataTransfer.files || []).map((file) => ({
    file,
    relativeDir: "",
  }));
  return { files: plainFiles, dirs: [] };
}

export async function processTransferTask({
  task,
  onTaskProgress,
}: {
  task: TransferTask;
  onTaskProgress?: (event: { loaded: number; total: number }) => void;
}) {
  const { remoteKey, file } = task;
  if (task.type !== "upload" || !file) throw new Error("Invalid task");
  let thumbnailDigest = null;

  if (
    file.type.startsWith("image/") ||
    file.type === "video/mp4" ||
    file.type === "application/pdf"
  ) {
    try {
      const thumbnailBlob = await generateThumbnail(file);
      const digestHex = await blobDigest(thumbnailBlob);

      const thumbnailUploadUrl = `/webdav/_$flaredrive$/thumbnails/${digestHex}.png`;
      try {
        const thumbRes = await fetch(thumbnailUploadUrl, {
          method: "PUT",
          headers: SPA_REQUEST_HEADERS,
          body: thumbnailBlob,
        });
        if (thumbRes.ok) {
          thumbnailDigest = digestHex;
        }
      } catch {
        console.log(`Upload ${digestHex}.png failed`);
      }
    } catch {
      console.log("Generate thumbnail failed");
    }
  }

  const headers: Record<string, string> = {};
  if (thumbnailDigest) headers["fd-thumbnail"] = thumbnailDigest;
  if (file.type) headers["Content-Type"] = file.type;

  if (file.size >= SIZE_LIMIT) {
    return await multipartUpload(remoteKey, file, {
      headers,
      onUploadProgress: onTaskProgress,
    });
  } else {
    const uploadUrl = `${WEBDAV_ENDPOINT}${encodeKey(remoteKey)}`;
    const res = await xhrFetch(uploadUrl, {
      method: "PUT",
      headers,
      body: file,
      onUploadProgress: onTaskProgress,
    });
    if (res.status === 401) throw new AuthRequiredError("上传失败：请先登录管理员账号");
    if (!res.ok) throw new Error(`上传失败 (${res.status})`);
    return res;
  }
}
