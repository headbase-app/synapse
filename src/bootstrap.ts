import { createServer as createHttpServer } from 'http';
import express from "express";

import {Config, ConfigService} from "./services/config/config.service.js";
import {RelayServer} from "./modules/relay/relay.controller.js";
import { LoggerService } from './services/logger/logger.service.js';


export function bootstrap(configOverride?: Partial<Config>) {
	const config = new ConfigService()
	const logger = new LoggerService()

	const serverConfig = {
		...config.(),
		...(configOverride ? configOverride : {})
	}

	const app = express();
	const server = createHttpServer(app);

	app.get('/', (req, res) => {
		res.send({
			message: "Hello from a Headbase Relay Server! Learn more at https://github.com/headbase-app/relay.",
		})
	})

	app.get('/v1', (req, res) => {
		res.send({
			version: serverConfig.serverVersion,
			isPublic: serverConfig.adminSecret === null,
		})
	})

	new RelayServer(server, serverConfig)

	return server
}
