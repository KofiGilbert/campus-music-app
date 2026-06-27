import "./instrument"; // Sentry init — must be first.
import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { createSocketGateway } from "./realtime/socketGateway";
import { seedTracks } from "./lib/seedTracks";
import { seedArtists } from "./lib/seedArtists";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await seedArtists();
  await seedTracks();

  // Wrap Express in an explicit HTTP server so socket.io can share the port.
  const httpServer = createServer(app);
  createSocketGateway(httpServer);

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => {
      logger.info({ port }, "Server listening");
      resolve();
    });
    httpServer.on("error", reject);
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
