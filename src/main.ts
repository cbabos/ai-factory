import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./core/config-loader.js";
import { EnvSecretsProvider } from "./core/secrets.js";
import { ConsoleLogger } from "./core/logger.js";
import { SQLiteTaskRepository } from "./core/sqlite-task-repository.js";
import {
  SQLiteWorkflowArtifactRepository,
  SQLiteWorkflowRepository,
  SQLiteWorkflowRunRepository,
  SQLiteHumanTaskRepository,
} from "./core/sqlite-workflow-repository.js";
import { ToolRegistry, createFileTools, RunShellCommandTool } from "./tools/index.js";
import { SQLiteConfigStore } from "./core/sqlite-config-store.js";
import { seedStarterWorkflows } from "./core/starter-workflows.js";
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
import {
  WebhookSensor,
  FileWatcherSensor,
} from "./sensors/index.js";

async function main() {
  const logger = new ConsoleLogger({ namespace: "AI Factory", level: "debug" });
  const config = loadConfig("./factory.config.json");
  const uiDistPath = resolve(process.cwd(), "src/ui/dist");
  const secrets = new EnvSecretsProvider();
  const tools = new ToolRegistry();
  for (const tool of createFileTools()) {
    tools.register(tool);
  }
  tools.register(new RunShellCommandTool());
  const taskRepository = new SQLiteTaskRepository("./ai-factory.db", "tasks");
  const workflowRepository = new SQLiteWorkflowRepository("./ai-factory.db");
  const workflowRunRepository = new SQLiteWorkflowRunRepository("./ai-factory.db");
  const humanTaskRepository = new SQLiteHumanTaskRepository("./ai-factory.db");
  const artifactRepository = new SQLiteWorkflowArtifactRepository("./ai-factory.db");
  const settingsStore = new SQLiteConfigStore("./ai-factory.db");
  await seedStarterWorkflows(workflowRepository);
  
  const factory = new AIFactory({ 
    config, 
    secrets, 
    logger, 
    taskRepository, 
    workflowRepository,
    workflowRunRepository,
    humanTaskRepository,
    artifactRepository,
    tools,
    apiServerOptions: {
      port: 3001,
      enableSse: true,
      staticPath: existsSync(uiDistPath) ? uiDistPath : undefined,
    }
  });
  
  factory.setSettingsStore(settingsStore);

  await factory.initialize();

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
  //factory.registerSensor(new CronSensor(60_000, "Periodic status check"));
  factory.registerSensor(new WebhookSensor(3000));
  factory.registerSensor(new FileWatcherSensor("./watched", logger));

  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down AI Factory...");
    await factory.stop();
    await taskRepository.close();
    await workflowRepository.close();
    await workflowRunRepository.close();
    await humanTaskRepository.close();
    await artifactRepository.close();
    process.exit(0);
  });

  logger.info("AI Factory started.");
  await factory.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
