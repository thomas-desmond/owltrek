// Extend the Env interface with our custom secrets
interface Env {
	ASSETS: Fetcher;
	RESEND_API_KEY: string;
	CRON_SECRET: string;
	OWLTREK_DB: D1Database;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
	interface Locals extends Runtime {}
}