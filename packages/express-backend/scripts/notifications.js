import {
  notificationRuntime,
  pushSettings
} from "../src/notifications/runtime.js";

if (process.argv[2] === "setup") {
  const settings = pushSettings();
  console.log(
    `Notification keys are ready in ${settings.directory}. Keep this directory private and reuse it across server restarts.`
  );
} else {
  const runtime = notificationRuntime();
  try {
    console.log(JSON.stringify(await runtime.runAll()));
  } finally {
    await runtime.close();
  }
}
