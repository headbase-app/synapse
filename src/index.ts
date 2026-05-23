import {config} from "./services/config/config.service.js";
import { logger } from "./services/logger/logger.service.js";
import {bootstrap} from "./bootstrap.js";

const server = bootstrap();
server.listen(config().port);
logger.info("server", `server started at http://localhost:${config().port}`)
