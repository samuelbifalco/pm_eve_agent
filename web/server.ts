import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const EVE_BASE_URL = process.env.EVE_BASE_URL ?? "http://127.0.0.1:2000";
const UI_PORT = Number(process.env.UI_PORT ?? 3001);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ico": "image/x-icon",
};

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function proxyToEve(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  search: string,
): Promise<void> {
  const targetUrl = new URL(`${pathname}${search}`, EVE_BASE_URL);
  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (key === "host" || key === "connection") continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body?.length ? new Uint8Array(body) : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach Eve dev server";
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: `Eve unreachable at ${EVE_BASE_URL}. Start it with: npm run dev`,
        detail: message,
      }),
    );
    return;
  }

  res.writeHead(upstream.status, {
    ...Object.fromEntries(upstream.headers.entries()),
    "access-control-allow-origin": "*",
  });

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
): Promise<void> {
  if (!existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const content = await readFile(filePath);
  res.writeHead(200, { "content-type": MIME_TYPES[ext] ?? "application/octet-stream" });
  res.end(content);
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === "/api/health") {
    try {
      const health = await fetch(new URL("/eve/v1/health", EVE_BASE_URL));
      const payload = health.ok ? await health.json() : { status: "error" };
      res.writeHead(health.ok ? 200 : 503, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(
        JSON.stringify({
          ui: "ok",
          eve: health.ok ? "ok" : "error",
          eveBaseUrl: EVE_BASE_URL,
          eveHealth: payload,
        }),
      );
    } catch {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          ui: "ok",
          eve: "unreachable",
          eveBaseUrl: EVE_BASE_URL,
          hint: "Run npm run dev in another terminal to start the Eve agent.",
        }),
      );
    }
    return;
  }

  if (url.pathname.startsWith("/eve/")) {
    await proxyToEve(req, res, url.pathname, url.search);
    return;
  }

  let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }

  await serveStatic(req, res, filePath);
});

server.listen(UI_PORT, () => {
  console.log(`PM Assistant UI: http://127.0.0.1:${UI_PORT}`);
  console.log(`Proxying /eve/* -> ${EVE_BASE_URL}`);
  console.log("Start Eve in another terminal: npm run dev");
});
