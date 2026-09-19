import { IncomingMessage, Server } from "node:http";
import {WebSocketServer, WebSocket, RawData} from "ws"
import {Duplex} from "node:stream";
import {ConfigService} from "../../services/config/config.service.js";
import {LoggerService} from "../../services/logger/logger.service.js";
import {PeerSentMessageSchema} from "../../services/validation/messages.js";


export interface RelayWebSocket extends WebSocket {
	// A unique identifier supplied by the peer, used for directing messages.
	pid: string
	// An optional human-readable name supplied by the peer
	knownAs?: string
	// The relay identifier used to connect peers together.
	rid: string
	// Measuring connection activity to close unresponsive sockets
	isAlive: boolean
}

export class RelayServer {
	#wss: WebSocketServer
	#connectionCheck: NodeJS.Timeout

	constructor(
		server: Server,
		private readonly configService: ConfigService,
		private readonly loggerService: LoggerService,
	) {
		this.#wss = new WebSocketServer({ noServer: true });

		server.on("upgrade", this.handleServerUpgrade.bind(this));
		this.#wss.on("connection", this.handleConnection.bind(this));
		this.#wss.on("close", this.handleClose.bind(this));

		this.loggerService.info("server", `started connection checks every ${this.configService.config().relay.connectionCheckInterval}ms`)
		this.#connectionCheck = setInterval(this.runConnectionCheck.bind(this), this.configService.config().relay.connectionCheckInterval);
	}

	async handleServerUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
		const baseUrl = `http://${req.headers.host}`
		const url = new URL(`${baseUrl}${req.url}`);
		const relayPath = new URLPattern(`${baseUrl}/relay/:rid`)
		const relayId = relayPath.exec(url)?.pathname?.groups['rid']

		if (!relayId) {
			// todo: send error response of some kind?
			this.loggerService.warn("connection", "denied connection due to invalid path");
			socket.destroy()
			return;
		}

		if (!this.configService.config().server.allowedOrigins.includes("*")) {
			if (!req.headers.origin || !this.configService.config().server.allowedOrigins.includes(req.headers.origin)) {
				// todo: send error response of some kind?
				this.loggerService.warn("connection", "denied connection due to invalid origin");
				socket.destroy();
				return;
			}
		}

		if (this.configService.config().relay.accessSecret) {
			const adminToken = req.headers["sec-websocket-protocol"];
			if (typeof adminToken !== "string" || adminToken !== this.configService.config().relay.accessSecret) {
				// todo: send error response of some kind?
				this.loggerService.warn("connection", "denied connection due to missing or invalid admin token");
				socket.destroy();
				return;
			}
		}

		const peerId = url.searchParams.get("pid");
		const knownAs = url.searchParams.get("knownAs");

		if (!relayId || !peerId) {
			// todo: send error response of some kind?
			this.loggerService.warn("connection", "denied connection due to missing rid/pid query params");
			socket.destroy()
			return;
		}

		// @ts-ignore --- Using custom type which expands WebSocket type with metadata
		this.#wss.handleUpgrade(req, socket, head, async (socket: RelayWebSocket) => {
			socket.pid = peerId;
			socket.rid = relayId;
			socket.knownAs = knownAs ?? undefined
			socket.isAlive = true;
			this.#wss.emit("connection", socket, req);
		})
	}

	handleConnection(ws: RelayWebSocket) {
		this.loggerService.info("connection", `peer '${ws.pid}' (${ws.knownAs ?? 'no knownAs'}) connected to relay '${ws.rid}'`)

		// todo: is this needed?
		ws.on("error", (e) => {
			this.loggerService.error("server", `encountered error with peer '${ws.pid}' (${ws.knownAs ?? 'no knownAs'})`, e)
		});

		ws.on("message", async (data, isBinary) => {
			// todo: validate to a set of expected messages?
			// todo: apply rate limiting/abuse protection for clients?
			this.handleMessage(ws, data, isBinary)
		});

		ws.on("close", async () => {
			this.loggerService.info("connection", `peer '${ws.pid}' (${ws.knownAs ?? 'no knownAs'}) disconnecting from relay '${ws.rid}'`)
		})
	}

	handleClose() {
		this.loggerService.info("server", "server closing, stopping connection checks")
		clearInterval(this.#connectionCheck)
	}

	handleMessage(sourceSocket: RelayWebSocket, data: RawData, isBinary?: boolean) {
		const sendingSocket = (sourceSocket as RelayWebSocket)
		sendingSocket.isAlive = true

		if (isBinary) {
			this.loggerService.warn("message", `peer '${sendingSocket.pid}' sent invalid message (as binary)`)
			return;
		}

		let message: PeerSentMessageSchema;
		try {
			const rawMessage = JSON.parse(data.toString());
			message = PeerSentMessageSchema.parse(rawMessage)
		}
		catch (e) {
			this.loggerService.warn("message", `peer '${sendingSocket.pid}' sent invalid message`, data)
			return;
		}


		if (message.kind === "pong") return
		if (message.kind === "ping") {
			sendingSocket.send(JSON.stringify({kind: "pong"}))
			return;
		}

		if (message.kind === "peers.discover") {
			const relayPeers: {pid: string, knownAs?: string}[] = []
			// todo: this forEach might scale badly with lots of connected sockets?
			// If so, sockets could be stored in a {rid: socket[]} map to avoid looping over all clients.
			this.#wss.clients.forEach((client) => {
				if ((client as RelayWebSocket).rid === sendingSocket.rid) {
					relayPeers.push({
						pid: sendingSocket.pid,
						knownAs: sendingSocket.knownAs,
					})
				}
			})

			sendingSocket.send(JSON.stringify({
				kind: "peers.list",
				peers: relayPeers,
			}))
			return;
		}

		if (message.to) {
			// todo: this forEach might scale badly with lots of connected sockets?
			// If so, sockets could be stored in a {rid: socket[]} map to avoid looping over all clients.
			for (const [client] of this.#wss.clients.entries()) {
				if (
					(client as RelayWebSocket).rid === sendingSocket.rid
					&& message.to.includes((client as RelayWebSocket).pid)
				) {
					client.send(JSON.stringify({
						...message,
						from: sendingSocket.pid,
					}))
				}
			}
		}
		else {
			// todo: this forEach might scale badly with lots of connected sockets?
			// If so, sockets could be stored in a {rid: socket[]} map to avoid looping over all clients.
			for (const [client] of this.#wss.clients.entries()) {
				if (
					(client as RelayWebSocket).rid === sendingSocket.rid
					&& client != sendingSocket
					&& client.readyState === WebSocket.OPEN
				) {
					client.send(JSON.stringify({
						...message,
						from: sendingSocket.pid,
					}))
				}
			}
		}
	}

	runConnectionCheck() {
		this.loggerService.debug("server", `running connection health check for ${this.#wss.clients.size} total peers`);

		this.#wss.clients.forEach((ws) => {
			const relaySocket = ws as RelayWebSocket;
			if (!relaySocket.isAlive) {
				this.loggerService.info("connection", `disconnecting peer '${relaySocket.pid}' (${relaySocket.knownAs ?? 'no knownAs'}) from relay '${relaySocket.rid}' due to failed connection check`)
				return relaySocket.terminate();
			}
			relaySocket.isAlive = false;
			relaySocket.send(JSON.stringify({kind: "ping"}));
		});
	}
}
