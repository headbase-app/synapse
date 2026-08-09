import { createServer as createHttpServer } from 'http';
import express from "express";

import {ConfigService} from "./services/config/config.service.js";
import {RelayServer} from "./modules/relay/relay.controller.js";
import { LoggerService } from './services/logger/logger.service.js';

export function createServer(
	configService: ConfigService,
	loggerService: LoggerService,
) {
	const app = express();
	const server = createHttpServer(app);

	// todo: endpoint isn't formally included in spec document.
	app.get('/', (req, res) => {
		res.send({
			message: "Hello from a Headbase Relay Server! Learn more at https://github.com/headbase-app/relay.",
		})
	})

	// todo: endpoint isn't formally included in spec document.
	app.get('/v1', (req, res) => {
		res.send({
			version: configService.config().relay.serverVersion,
			isPublic: configService.config().relay.accessSecret === null,
		})
	})

	new RelayServer(server, configService, loggerService)
	return server
}
