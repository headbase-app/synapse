import {createServer} from "../src/server";
import {describe, test} from "vitest";
import {
	awaitSocketsError,
	awaitSocketsOpen
} from "./helpers/helpers";

describe('Authentication checks', () => {
	test('Given valid admin token, socket should be upgraded successfully', async () => {
		const ACCESS_SECRET = "testing"
		const server = createServer({adminSecret: ACCESS_SECRET});
		server.listen(42100)

		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`, [ACCESS_SECRET])
		await awaitSocketsOpen([socket1]);

		server.close();
	});

	test('Given invalid admin token, socket should be closed', async () => {
		const ACCESS_SECRET = "testing"
		const server = createServer({adminSecret: ACCESS_SECRET});
		server.listen(42100)

		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`, ["invalid"])
		await awaitSocketsError([socket1]);

		server.close();
	});

	test('Given no admin token, socket should be closed', async () => {
		const ACCESS_SECRET = "testing"
		const server = createServer({adminSecret: ACCESS_SECRET});
		server.listen(42100)

		const socket1 = new WebSocket(`ws://localhost:42100/v1?peerId=peer-1&relayId=relay-1`)
		await awaitSocketsError([socket1]);

		server.close();
	});
});
