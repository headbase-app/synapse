import {describe, beforeEach, afterEach, test, expect} from "vitest";
import {expectNoMessagesForDuration, inspectNextMessage, awaitSocketsOpen} from "./helpers/helpers.js";
import {testPeerIds} from "./helpers/data.js";

import {createServer} from "../src/create-server.js";
import {ConfigOverride, ConfigService} from "../src/services/config/config.service.js";
import {LoggerService} from "../src/services/logger/logger.service.js";

const MOCK_CONFIG = {relay: {accessSecret: null}} satisfies ConfigOverride
const configService = new ConfigService(MOCK_CONFIG);
const loggerService = new LoggerService({level: 'error'});

describe('Relaying messages to specific peers', () => {
	const server = createServer(configService, loggerService);

	beforeEach(() => {
		server.listen(42100);
	});
	afterEach(() => {
		server.close();
	});

	test("Messages with 'to' property should be directed to that peer", async (ctx) => {
		const relay1socket1 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.one}`)
		const relay1socket2 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.two}`)
		const relay1socket3 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=${testPeerIds.three}`)
		await awaitSocketsOpen([relay1socket1, relay1socket2, relay1socket3]);

		const expectNoSocket3Messages = expectNoMessagesForDuration(ctx, relay1socket3, 1000)

		const targetedMessage = {kind: "message", to: [testPeerIds.two], data: "test"}
		const expectSocket2Message = inspectNextMessage(
			relay1socket2,
			(event: MessageEvent) => {
				const jsonEventData = JSON.parse(event.data);
				expect(jsonEventData).toEqual({
					...targetedMessage,
					from: testPeerIds.one,
				})
			},
			() => {
				relay1socket1.send(JSON.stringify(targetedMessage));
			},
		)

		await Promise.all([
			expectSocket2Message,
			expectNoSocket3Messages,
		]);
	});
});
