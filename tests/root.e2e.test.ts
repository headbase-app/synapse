import {describe, test, expect} from "vitest";
import supertest from "supertest";

import {createServer} from "../src/create-server.js";
import {ConfigOverride, ConfigService} from "../src/services/config/config.service.js";
import {LoggerService} from "../src/services/logger/logger.service.js";

const MOCK_CONFIG = {relay: {accessSecret: null}} satisfies ConfigOverride
const configService = new ConfigService(MOCK_CONFIG);
const loggerService = new LoggerService({level: 'error'});

describe('/ [GET]', () => {
	test('Root endpoint should supply welcome message', async () => {
		const server = createServer(configService, loggerService);
		const response = await supertest(server).get("/").send()

		expect(response.statusCode).toEqual(200)
		expect(response.body).toMatchObject({
			message: expect.any(String),
		})
	});
});
