import {describe, beforeEach, afterEach, test, expect} from "vitest";
import {expectNoMessagesForDuration, inspectNextMessage, awaitSocketsOpen} from "./helpers/helpers.js";

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

	test("JSON messages with 'targetPeerId' should be directed to that peer", async (ctx) => {
		const relay1socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`)
		const relay1socket2 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-2&relayId=relay-1`)
		const relay1socket3 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-3&relayId=relay-1`)
		await awaitSocketsOpen([relay1socket1, relay1socket2, relay1socket3]);

		const expectNoSocket3Messages = expectNoMessagesForDuration(ctx, relay1socket3, 1000)

		const targetedMessage = JSON.stringify({targetPeerId: "peer-2", example: "test"})
		const expectSocket2Message = inspectNextMessage(
			relay1socket2,
			(event: MessageEvent) => {
				expect(event.data).toEqual(targetedMessage)
			},
			() => {
				relay1socket1.send(targetedMessage);
			},
		)

		await Promise.all([
			expectSocket2Message,
			expectNoSocket3Messages,
		]);
	});
});
