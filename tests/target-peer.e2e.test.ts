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

	test("Messages with 'to' property should be directed to that peer", async (ctx) => {
		const relay1socket1 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=peer-1`)
		const relay1socket2 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=peer-2`)
		const relay1socket3 = new WebSocket(`ws://localhost:42100/relay/relay-1?pid=peer-3`)
		await awaitSocketsOpen([relay1socket1, relay1socket2, relay1socket3]);

		const expectNoSocket3Messages = expectNoMessagesForDuration(ctx, relay1socket3, 1000)

		// todo: peer ids must be UUID?
		const targetedMessage = {kind: "message", to: ["peer-2"], data: "test"}
		const expectSocket2Message = inspectNextMessage(
			relay1socket2,
			(event: MessageEvent) => {
				const jsonEventData = JSON.parse(event.data);
				expect(jsonEventData).toEqual({
					...targetedMessage,
					from: "peer-1",
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
