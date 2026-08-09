import {describe, test} from "vitest";
import {
	awaitSocketsError,
	awaitSocketsOpen
} from "./helpers/helpers.js";

import {createServer} from "../src/create-server.js";
import {ConfigOverride, ConfigService} from "../src/services/config/config.service.js";
import {LoggerService} from "../src/services/logger/logger.service.js";

const MOCK_CONFIG = {relay: {accessSecret: "testing"}} satisfies ConfigOverride
const configService = new ConfigService(MOCK_CONFIG);
const loggerService = new LoggerService({level: 'error'});

describe('Authentication Checks', () => {
	test('Given valid admin token, socket should be upgraded successfully', async () => {
		const server = createServer(configService, loggerService);
		server.listen(42100)

		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`, [MOCK_CONFIG.relay.accessSecret])
		await awaitSocketsOpen([socket1]);

		server.close();
	});

	test('Given invalid admin token, socket should be closed', async () => {
		const server = createServer(configService, loggerService);
		server.listen(42100)

		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`, ["invalid"])
		await awaitSocketsError([socket1]);

		server.close();
	});

	test('Given no admin token, socket should be closed', async () => {
		const server = createServer(configService, loggerService);
		server.listen(42100)

		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`)
		await awaitSocketsError([socket1]);

		server.close();
	});
});
