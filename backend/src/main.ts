import { bootstrap } from "./app.controller.js";

bootstrap().catch((err) => {
    console.error('Fatal: bootstrap failed', err);
    process.exit(1);
});
