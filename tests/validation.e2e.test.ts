import {afterEach, beforeEach, describe, test} from "vitest";
import {
	awaitSocketsError, awaitSocketsOpen,
} from "./helpers/helpers.js";

import {createServer} from "../src/create-server.js";
import {ConfigOverride, ConfigService} from "../src/services/config/config.service.js";
import {LoggerService} from "../src/services/logger/logger.service.js";

const MOCK_CONFIG = {relay: {accessSecret: null}} satisfies ConfigOverride
const configService = new ConfigService(MOCK_CONFIG);
const loggerService = new LoggerService({level: 'error'});

describe('Validation checks', () => {
	const server = createServer(configService, loggerService);
	beforeEach(() => {
		server.listen(42100);
	});
	afterEach(() => {
		server.close();
	});

	test('Given no relay id supplied, the socket should be closed', async () => {
		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1`)
		await awaitSocketsError([socket1]);
		server.close();
	});

	test('Given no peer id supplied, the socket should be closed', async () => {
		const socket1 = new WebSocket(`ws://localhost:42100/v1?relayId=relay-1`)
		await awaitSocketsError([socket1]);
		server.close();
	});

	test('Given upgrading connection on invalid url, the socket should be closed', async () => {
		const socket1 = new WebSocket(`ws://localhost:42100/invalid?peerId=peer-1&relayId=relay-1`)
		await awaitSocketsError([socket1]);
		server.close();
	});

	test('Given trailing slash in URL, the socket should still be opened', async () => {
		const socket1 = new WebSocket(`ws://localhost:42100/v1/?peerId=peer-1&relayId=relay-1`)
		await awaitSocketsOpen([socket1]);
		server.close();
	});
});
