import {z} from "zod";

import {PeerSentMessageSchema, RelaySentMessageSchema} from "../../services/validation/messages.js";
import {ConfigService} from "../../services/config/config.service.js";
import {LoggerService} from "../../services/logger/logger.service.js";

export const PeerData = z.object({
	// The relay identifier used to connect peers together.
	rid: z.string(),
	// A unique identifier supplied by the peer, used for directing messages.
	pid: z.uuidv4(),
	// An optional human-readable name supplied by the peer
	knownAs: z.string().nullable(),
})
export type PeerData = z.infer<typeof PeerData>

export interface MessageReply {
	peers: string[]
	message: RelaySentMessageSchema
}

export type RelayLookup = Map<string, PeerData[]>
export type PeerLookup = Map<string, PeerData>


export class RelayService {
	#relayLookup: RelayLookup;
	#peerLookup: PeerLookup;

	constructor(
		private readonly configService: ConfigService,
		private readonly loggerService: LoggerService,
	) {
		this.#relayLookup = new Map();
		this.#peerLookup = new Map();
	}

	async connect(peer: PeerData, accessSecret?: string) {
		if (this.configService.config().relay.accessSecret) {
			if (typeof accessSecret !== "string" || accessSecret !== this.configService.config().relay.accessSecret) {
				throw new Error("[connect] denied connection due to missing or invalid admin token")
			}
		}
		if (this.#peerLookup.get(peer.pid)) {
			throw new Error("[connect] denied connection due to existing peer with same id ")
		}

		const relay = this.#relayLookup.get(peer.rid) ?? []
		this.#relayLookup.set(peer.rid, [...relay, peer]);
		this.#peerLookup.set(peer.pid, peer)

		return [this.#createPeerListReply(peer.rid)]
	}

	async processMessage(from: string, message: PeerSentMessageSchema): Promise<MessageReply[]> {
		const peer = this.#peerLookup.get(from);
		if (!peer) {
			throw new Error("[messages] The sending 'from' peer could not be found.")
		}

		if (message.kind === "health/pong") {
			return []
		}
		if (message.kind === "health/ping") {
			return [{
				peers: [from],
				message: {kind: "health/pong"},
			}];
		}
		if (message.kind === "peers/discover") {
			return [this.#createPeerListReply(peer.rid, [from])]
		}
		if (message.kind === "topics/subscribe" || message.kind === "topics/unsubscribe") {
			this.loggerService.warn("message", "received topic subscription message which is not implemented yet", message)
			return [];
		}
		if (message.kind === "msg/dm") {
			return [{
				peers: message.to,
				message: {
					...message,
					from
				}
			}]
		}

		const peers = this.#relayLookup.get(peer.rid) ?? [];
		const targetPeers = peers
				.filter(peer => peer.pid !== from)
				.map(peer => peer.pid)

		return [{
			peers: targetPeers,
			message: {
				...message,
				from
			}
		}]
	}

	#createPeerListReply(rid: string, replyPeers?: string[]): MessageReply {
		const peers = this.#relayLookup.get(rid) ?? [];

		return {
			peers: replyPeers ?? peers.map(peer => peer.pid),
			message: {
				kind: "peers/list",
				peers: peers.map(peer => ({pid: peer.pid, knownAs: peer.knownAs }))
			}
		}
	}

	async disconnect(pid: string) {
		const peer = this.#peerLookup.get(pid);
		if (!peer) {
			throw new Error("[messages] The requested peer to disconnect was not found.")
		}

		this.#peerLookup.delete(pid);
		const relays = this.#relayLookup.get(peer.rid) ?? [];
		this.#relayLookup.set(peer.rid, relays.filter(relay => relay.pid !== pid));
	}
}
