import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Config } from "./config.js";
import { GraphicsEventBroker } from "./events.js";
import { TemplateStore } from "./store/template-store.js";
import { ActiveGraphicsStore } from "./store/active-graphics-store.js";
import { AssetStore } from "./store/asset-store.js";
import { AtemAdapterClient } from "./switcher/piswitch-client.js";
import { FleetStreamSupervisor } from "./fleet/fleet-client.js";
import { GatewayClient } from "./gateway/gateway-client.js";
import { templateRoutes } from "./routes/template-routes.js";
import { activeRoutes } from "./routes/active-routes.js";
import { displayRoutes } from "./routes/display-routes.js";
import { eventRoutes } from "./routes/event-routes.js";
import { assetRoutes } from "./routes/asset-routes.js";
import { switcherRoutes } from "./routes/switcher-routes.js";
import { streamRoutes } from "./routes/stream-routes.js";
import { canvaRoutes } from "./routes/canva-routes.js";

export interface AppDependencies {
  config: Config;
  eventBroker?: GraphicsEventBroker | undefined;
  templateStore?: TemplateStore | undefined;
  activeStore?: ActiveGraphicsStore | undefined;
  assetStore?: AssetStore | undefined;
  atemClient?: AtemAdapterClient | undefined;
  fleetSupervisor?: FleetStreamSupervisor | undefined;
  gatewayClient?: GatewayClient | undefined;
}

export function buildApp(deps: AppDependencies): FastifyInstance {
  const { config } = deps;
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  const eventBroker = deps.eventBroker ?? new GraphicsEventBroker();
  const templateStore = deps.templateStore ?? new TemplateStore(config.templatesDir);
  const activeStore = deps.activeStore ?? new ActiveGraphicsStore(eventBroker);
  const assetStore = deps.assetStore ?? new AssetStore(config.assetsDir);

  const atemClient =
    deps.atemClient ??
    new AtemAdapterClient({
      piswitchUrl: config.piswitchUrl,
      templateStore,
      activeStore,
      eventBroker,
      logger: app.log,
    });

  const fleetSupervisor =
    deps.fleetSupervisor ??
    new FleetStreamSupervisor({
      fffleetUrl: config.fffleetUrl,
      fffleetToken: config.fffleetToken,
      pageBaseUrl: config.pageBaseUrl,
      rtmpBase: config.rtmpBase,
      ffmpegPath: config.ffmpegPath,
      eventBroker,
      logger: app.log,
    });

  const gatewayClient =
    deps.gatewayClient ??
    new GatewayClient({
      gatewayUrl: config.gatewayUrl,
      activeStore,
      eventBroker,
      atemClient,
      logger: app.log,
    });

  // Enable CORS
  void app.register(cors, { origin: true });

  // Health and status
  app.get("/health", async () => ({ status: "ok", service: "pigraphics", port: config.port }));
  app.get("/api/v1/status", async () => ({
    service: "pigraphics",
    version: "0.1.0",
    port: config.port,
    templatesCount: templateStore.list().length,
    activeCount: activeStore.getActive().length,
    stream: fleetSupervisor.getStatus(),
    gatewayConnected: gatewayClient.isConnected(),
  }));

  // Mount route modules
  void app.register(templateRoutes(templateStore));
  void app.register(activeRoutes(activeStore, templateStore));
  void app.register(displayRoutes(activeStore, templateStore, config.pageBaseUrl));
  void app.register(eventRoutes(eventBroker));
  void app.register(assetRoutes(assetStore));
  void app.register(switcherRoutes(atemClient));
  void app.register(streamRoutes(fleetSupervisor));
  void app.register(canvaRoutes(atemClient));

  // Attach services to Fastify instance for lifecycle management
  app.decorate("gatewayClient", gatewayClient);
  app.decorate("fleetSupervisor", fleetSupervisor);

  return app;
}
