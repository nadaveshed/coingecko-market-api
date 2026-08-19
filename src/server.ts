import { createApp } from "./app.js";
import { loadConfig } from "./config/index.js";

const config = loadConfig();
const app = await createApp({ config });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
