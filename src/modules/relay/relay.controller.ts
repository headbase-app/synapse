import { IncomingMessage, Server } from "node:http";
import {WebSocketServer, WebSocket, RawData} from "ws"
import {Duplex} from "node:stream";

import {Config} from "./services/config/config.js";
import { logger } from "./logger.js";


export interface RelayWebSocket extends WebSocket {
	// A unique peer identifier passed to the server on connection, used for directing messages.
	peerId: string
	// The relay identifier supplied by the connecting socket used for relaying messages between sockets with the same relay id.
	relayId: string
	// Measuring connection activity to close unresponsive sockets
	isAlive: boolean
}

export class RelayServer {
	server: Server
	#config: Config
	#wss: WebSocketServer
	#connectionCheck: NodeJS.Timeout

	constructor(server: Server, config: Config) {
		this.#config = config;
		this.server = server;

		this.#wss = new WebSocketServer({ noServer: true });

		server.on("upgrade", this.handleServerUpgrade.bind(this));
		this.#wss.on("connection", this.handleConnection.bind(this));
		this.#wss.on("close", this.handleClose.bind(this));

		logger.info("server", `started connection checks every ${this.#config.connectionCheckInterval}ms`)
		this.#connectionCheck = setInterval(this.runConnectionCheck.bind(this), this.#config.connectionCheckInterval);
	}

	async handleServerUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
		if (!this.#config.allowedOrigins.includes("*")) {
			if (!req.headers.origin || !this.#config.allowedOrigins.includes(req.headers.origin)) {
				// todo: send error response of some kind?
				logger.warn("connection", "denied connection due to invalid origin");
				socket.destroy();
				return;
			}
		}

		if (this.#config.adminSecret) {
			const adminToken = req.headers["sec-websocket-protocol"];
			if (typeof adminToken !== "string" || adminToken !== this.#config.adminSecret) {
				// todo: send error response of some kind?
				logger.warn("connection", "denied connection due to missing or invalid admin token");
				socket.destroy();
				return;
			}
		}

		const url = new URL(`http://localhost:0${req.url}`);
		if (!(url.pathname === "/v1" || url.pathname === "/v1/")) {
			// todo: send error response of some kind?
			logger.warn("connection", "denied connection due to invalid path");
			socket.destroy()
			return;
		}

		const relayId = url.searchParams.get("relayId");
		const peerId = url.searchParams.get("peerId");
		if (!relayId || !peerId) {
			// todo: send error response of some kind?
			logger.warn("connection", "denied connection due to missing relayId/peerId");
			socket.destroy()
			return;
		}

		// @ts-ignore --- Using custom type which expands WebSocket type with metadata
		this.#wss.handleUpgrade(req, socket, head, async (socket: RelayWebSocket) => {
			socket.peerId = peerId;
			socket.relayId = relayId;
			this.#wss.emit("connection", socket, req);
		})
	}

	handleConnection(ws: RelayWebSocket) {
		logger.info("connection", `peer '${ws.peerId}' connected to relay '${ws.relayId}'`)

		// todo: is this needed?
		ws.on("error", (e) => {
			logger.error("server", `encountered error with peer '${ws.peerId}'`, e)
		});

		ws.on("message", async (data, isBinary) => {
			// todo: validate to a set of expected messages?
			// todo: apply rate limiting/abuse protection for clients?
			this.handleMessage(ws, data, isBinary)
		});

		ws.on("close", async () => {
			logger.info("connection", `peer '${ws.peerId}' disconnecting from relay '${ws.relayId}'`)
		})
	}

	handleClose() {
		logger.info("server", "server closing, stopping connection checks")
		clearInterval(this.#connectionCheck)
	}

	handleMessage(sourceSocket: RelayWebSocket, data: RawData, isBinary?: boolean) {
		const message = isBinary ? data : data.toString();

		const relaySocket = (sourceSocket as RelayWebSocket)
		relaySocket.isAlive = true

		if (message === "pong") return
		if (message === "ping") {
			relaySocket.send("pong")
			return;
		}

		let targetPeerId: string | null = null;
		if (typeof message === "string") {
			try {
				const parsed = JSON.parse(message);
				if (parsed.targetPeerId) {
					targetPeerId = parsed.targetPeerId ? parsed.targetPeerId : null;
				}
			}
			catch (error) {
				targetPeerId = null;
			}
		}

		if (targetPeerId) {
			// todo: this forEach might scale badly with lots of connected sockets?
			// If so, sockets could be stored in a {relayId: socket[]} map to avoid looping over all clients.
			this.#wss.clients.forEach((client) => {
				if ((client as RelayWebSocket).peerId === targetPeerId) {
					client.send(data, {binary: isBinary})
				}
			})
		}
		else {
			// todo: this forEach might scale badly with lots of connected sockets?
			// If so, sockets could be stored in a {relayId: socket[]} map to avoid looping over all clients.
			this.#wss.clients.forEach((client) => {
				if (client !== relaySocket && (client as RelayWebSocket).relayId === relaySocket.relayId && client.readyState === WebSocket.OPEN) {
					client.send(data, {binary: isBinary})
				}
			})
		}
	}

	runConnectionCheck() {
		logger.debug("server", `running connection health check for ${this.#wss.clients.size} total peers`);

		this.#wss.clients.forEach((ws) => {
			const relaySocket = ws as RelayWebSocket;
			if (relaySocket.isAlive === false) {
				logger.info("connection", `disconnecting peer '${relaySocket.peerId}' from relay '${relaySocket.relayId}' due to failed connection check`)
				return relaySocket.terminate();
			}
			relaySocket.isAlive = false;
			relaySocket.send("ping");
		});
	}
}
