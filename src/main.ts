import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import type { GatewayClient } from "./gateway/gateway-client.js";
import type { FleetStreamSupervisor } from "./fleet/fleet-client.js";

async function main() {
  const config = loadConfig();
  const app = buildApp({ config });

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`PiGraphics microservice listening on http://${config.host}:${config.port}`);

    const gatewayClient = (app as any).gatewayClient as GatewayClient | undefined;
    if (gatewayClient) {
      gatewayClient.start();
    }

    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      if (gatewayClient) {
        gatewayClient.stop();
      }
      const fleetSupervisor = (app as any).fleetSupervisor as FleetStreamSupervisor | undefined;
      if (fleetSupervisor) {
        await fleetSupervisor.stopStream();
      }
      await app.close();
      process.exit(0);
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("main.ts") || process.argv[1]?.endsWith("main.js")) {
  void main();
}
