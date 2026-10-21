import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../site/", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".txt": "text/plain",
};
http
  .createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const target = path.resolve(
        root,
        "." + (name === "/" ? "/index.html" : name),
      );
      if (!target.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const body = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
    }
  })
  .listen(4624, "127.0.0.1", () =>
    console.log("Rye project preview: http://127.0.0.1:4624"),
  );
