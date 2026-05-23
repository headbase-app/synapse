import 'dotenv/config'

export interface Config {
	server: {
		port: number;
		allowedOrigins: string[];
	},
	relay: {
		serverVersion: string;
		adminSecret: string | null;
		connectionCheckInterval: number;
	}
}

export class ConfigService {
	static vars: Config = ConfigService.loadEnvironment()

	static loadEnvironment() {
		// todo: parse/validate variables before using
		const PORT = parseInt(process.env.PORT as string) || 8080
		const ACCESS_SECRET = process.env.ACCESS_SECRET || null
		const SERVER_VERSION = "v1.0"
		const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["*"]
		const CONNECTION_CHECK_INTERVAL = parseInt(process.env.CONNECTION_CHECK_INTERVAL as string) || 30000

		return {
			server: {
				port: PORT,
				allowedOrigins: ALLOWED_ORIGINS,
			},
			relay: {
				serverVersion: SERVER_VERSION,
				adminSecret: ACCESS_SECRET,
				connectionCheckInterval: CONNECTION_CHECK_INTERVAL
			}
		}
	}
}
