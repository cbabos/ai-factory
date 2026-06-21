import { loadConfig } from "./core/config-loader.js";
import { EnvSecretsProvider } from "./core/secrets.js";
import { ConsoleLogger } from "./core/logger.js";
import { AIFactory } from "./factory.js";
import {
  EmailAdapter,
  SlackAdapter,
  WebhookAdapter,
  CronAdapter,
  FileSystemAdapter,
} from "./adapters/index.js";
import {
  EmailResponder,
  SlackResponder,
  WebhookResponder,
  CronResponder,
  FileSystemResponder,
} from "./responders/index.js";
import { CronSensor } from "./sensors/index.js";

async function main() {
  const logger = new ConsoleLogger({ namespace: "AI Factory", level: "info" });
  const config = loadConfig("./factory.config.json");
  const secrets = new EnvSecretsProvider();
  const factory = new AIFactory({ config, secrets, logger });

  // Register adapters
  factory.registerAdapter(new EmailAdapter());
  factory.registerAdapter(new SlackAdapter());
  factory.registerAdapter(new WebhookAdapter());
  factory.registerAdapter(new CronAdapter());
  factory.registerAdapter(new FileSystemAdapter());

  // Register responders
  factory.registerResponder(new EmailResponder());
  factory.registerResponder(new SlackResponder());
  factory.registerResponder(new WebhookResponder());
  factory.registerResponder(new CronResponder());
  factory.registerResponder(new FileSystemResponder());

  // Register sensors
  factory.registerSensor(new CronSensor(60_000, "Periodic status check"));

  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down AI Factory...");
    await factory.stop();
    process.exit(0);
  });

  logger.info("AI Factory started.");
  await factory.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
