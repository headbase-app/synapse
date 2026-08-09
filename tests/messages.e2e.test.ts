import {describe, beforeEach, afterEach, test, expect} from "vitest";
import {expectNoMessagesForDuration, inspectNextMessage, awaitSocketsOpen} from "./helpers/helpers.js";

import {createServer} from "../src/create-server.js";
import {ConfigOverride, ConfigService} from "../src/services/config/config.service.js";
import {LoggerService} from "../src/services/logger/logger.service.js";

const MOCK_CONFIG = {relay: {accessSecret: null}} satisfies ConfigOverride
const configService = new ConfigService(MOCK_CONFIG);
const loggerService = new LoggerService({level: 'error'});

describe('Relaying messages', () => {
	const server = createServer(configService, loggerService);

	beforeEach(() => {
		server.listen(42100);
	});
	afterEach(() => {
		server.close();
	});

	test('Two sockets can connect and relay messages', async () => {
		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`)
		const socket2 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-2&relayId=relay-1`)
		await awaitSocketsOpen([socket1, socket2]);

		await inspectNextMessage(
			socket2,
			(event: MessageEvent) => {
				expect(event.data).toEqual("test")
			},
			() => {
				socket1.send("test")
			},
		)
	});

	test('Messages should not be relayed back to sender', async (ctx) => {
		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`)
		const socket2 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-2&relayId=relay-1`)
		await awaitSocketsOpen([socket1, socket2]);

		const expectNoSocket1Messages = expectNoMessagesForDuration(ctx, socket1, 1000)
		const expectSocket2Message = inspectNextMessage(
			socket2,
			(event: MessageEvent) => {
				expect(event.data).toEqual("test")
			},
			() => {
				socket1.send("test")
			},
		)

		await Promise.all([expectNoSocket1Messages, expectSocket2Message])
	});

	test('Messages should not leak between relays', async (ctx) => {
		const relay1socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`)
		const relay1socket2 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-2&relayId=relay-1`)
		const relay2socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-2`)
		const relay2socket2 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-2&relayId=relay-2`)
		await awaitSocketsOpen([relay1socket1, relay1socket2, relay2socket1, relay2socket2]);

		const expectNoMessages1 = expectNoMessagesForDuration(ctx, relay2socket1, 1000)
		const expectNoMessages2 = expectNoMessagesForDuration(ctx, relay2socket1, 1000)

		const expectSocket1Message = inspectNextMessage(
			relay1socket1,
			(event: MessageEvent) => {
				expect(event.data).toEqual("test")
			},
			() => {
				relay1socket2.send("test")
			},
		)

		await Promise.all([
			expectNoMessages1,
			expectNoMessages2,
			expectSocket1Message,
		]);
	});
});
