import { bootstrap } from "./app.controller.js";

// Start monazem backend
bootstrap().catch((err) => {
    console.error('Fatal: bootstrap failed', err);
    process.exit(1);
});
