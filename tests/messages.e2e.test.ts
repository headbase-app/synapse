import {describe, beforeEach, afterEach, test, expect} from "vitest";
import {expectNoMessagesForDuration, inspectNextMessage, awaitSocketsOpen} from "./helpers/helpers.js";
import {testPeerIds} from "./helpers/data.js";

import {createServer} from "../src/create-server.js";
import {ConfigOverride, ConfigService} from "../src/services/config/config.service.js";
import {LoggerService} from "../src/services/logger/logger.service.js";

const MOCK_CONFIG = {relay: {accessSecret: null}} satisfies ConfigOverride
const configService = new ConfigService(MOCK_CONFIG);
const loggerService = new LoggerService({level: 'error'});

const testMessage = {kind: "message", data: "test"}

describe('Relaying messages', () => {
	const server = createServer(configService, loggerService);

	beforeEach(() => {
		server.listen(42100);
	});
	afterEach(() => {
		server.close();
	});

	test('Two sockets can connect and relay messages', async () => {
		const socket1 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.one}`)
		const socket2 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.two}`)
		await awaitSocketsOpen([socket1, socket2]);

		await inspectNextMessage(
			socket2,
			(event: MessageEvent) => {
				const jsonEventData = JSON.parse(event.data);
				expect(jsonEventData).toEqual({
					...testMessage,
					from: testPeerIds.one
				})
			},
			() => {
				socket1.send(JSON.stringify(testMessage))
			},
		)
	});

	test('Messages should not be relayed back to sender', async (ctx) => {
		const socket1 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.one}`)
		const socket2 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.two}`)
		await awaitSocketsOpen([socket1, socket2]);

		const expectNoSocket1Messages = expectNoMessagesForDuration(ctx, socket1, 1000)
		const expectSocket2Message = inspectNextMessage(
			socket2,
			(event: MessageEvent) => {
				const jsonEventData = JSON.parse(event.data);
				expect(jsonEventData).toEqual({
					...testMessage,
					from: testPeerIds.one
				})
			},
			() => {
				socket1.send(JSON.stringify(testMessage))
			},
		)

		await Promise.all([expectNoSocket1Messages, expectSocket2Message])
	});

	test('Messages should not leak between relays', async (ctx) => {
		const relay1socket1 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.one}`)
		const relay1socket2 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.two}`)
		const relay2socket1 = new WebSocket(`ws://localhost:42100/relay/relay-2?pid=${testPeerIds.one}`)
		const relay2socket2 = new WebSocket(`ws://localhost:42100/relay/relay-2?pid=${testPeerIds.two}`)
		await awaitSocketsOpen([relay1socket1, relay1socket2, relay2socket1, relay2socket2]);

		const expectNoMessages1 = expectNoMessagesForDuration(ctx, relay2socket1, 1000)
		const expectNoMessages2 = expectNoMessagesForDuration(ctx, relay2socket1, 1000)

		const expectSocket1Message = inspectNextMessage(
			relay1socket1,
			(event: MessageEvent) => {
				const eventJsonData = JSON.parse(event.data);
				expect(eventJsonData).toEqual({
					...testMessage,
					from: testPeerIds.two
				})
			},
			() => {
				relay1socket2.send(JSON.stringify(testMessage))
			},
		)

		await Promise.all([
			expectNoMessages1,
			expectNoMessages2,
			expectSocket1Message,
		]);
	});
});
