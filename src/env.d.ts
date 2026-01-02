// Extend the Env interface with our custom secrets
interface Env {
	ASSETS: Fetcher;
	RESEND_API_KEY: string;
	CRON_SECRET: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
	interface Locals extends Runtime {}
}
