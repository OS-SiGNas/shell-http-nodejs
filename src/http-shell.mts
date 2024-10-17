import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { argv, exit } from "node:process";
import { promisify } from "node:util";
import { extname } from "node:path";
import { platform, arch } from "node:os";
import { IncomingMessage, Server, ServerResponse } from "node:http";

type Controller = (
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage> & { req: IncomingMessage },
) => void;

const ShellHttp = class {
  constructor() {
    const server = new Server();
    const PORT = argv[2] !== undefined && !isNaN(+argv[2]) ? +argv[2] : 0;

    server.on("request", (request, response) => {
      this.#logger(request, response);
      if (request.method !== "GET") return response.writeHead(404).end();
      if (request.url?.includes("/status")) return response.writeHead(204).end();
      if (request.url?.includes("/info")) return this.#info(request, response);
      if (request.url?.includes("/sh")) return this.#shHandler(request, response);
      if (request.url?.includes("/file")) return this.#fileHandler(request, response);
      else return response.writeHead(404).end();
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
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write(`${platform()} ${arch()}`);
    return res.end();
  };

  readonly #shHandler: Controller = async (request, response) => {
    const query = this.#extractQueryParams(request.url as string) as unknown as { command: string };
    if (query.command === undefined) return response.writeHead(400).end();
    if (typeof query.command !== "string") return response.writeHead(400).end();
    try {
      const { stderr, stdout } = await promisify(exec)(query.command as string);
      if (stderr.length !== 0) throw new Error(stderr);
      response.writeHead(200, { "Content-Type": "text/plain" }).write(stdout);
      return response.end();
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json" }).write(JSON.stringify(error));
      return response.end();
    }
  };

  readonly #fileHandler: Controller = async (request, response) => {
    const query = this.#extractQueryParams(request.url as string) as unknown as { name: string };
    if (query.name === undefined) return response.writeHead(400).end();
    if (typeof query.name !== "string") return response.writeHead(400).end();
    try {
      const contentType = { "Content-Type": this.#getContentType(extname(query.name)) };
      response.writeHead(200, contentType).write(await readFile(query.name));
      return response.end();
    } catch (error) {
      console.trace(error);
      response.writeHead(400).write(error);
      return response.end();
    }
  };

  readonly #getContentType = (type: string): string => {
    if (type === ".html") return "text/html";
    if (type === ".png") return "image/png";
    if (type === ".jpg") return "image/jpg";
    if (type === ".mp3") return "audio/mp3";
    if (type === ".ogg") return "audio/ogg";
    if (type === ".mp4") return "video/mp4";
    if (type === ".mkv") return "video/mkv";
    if (type === ".json") return "application/json";
    return "";
  };

  readonly #extractQueryParams = (endpoint: string) => {
    const [_, queryString] = endpoint.split("?");
    if (queryString === undefined) return { query: {} };
    const url = new URL("https://example.com" + endpoint);
    const searchParams = new URLSearchParams(url.search);
    return Object.fromEntries(searchParams.entries());
  };
};

new ShellHttp();
