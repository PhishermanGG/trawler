import * as Sentry from "@sentry/node";
import chalk from "chalk";

const { SENTRY_DSN, NODE_ENV } = process.env ?? {};

if (!SENTRY_DSN) {
	console.error(`[${"TRAWLER"}]`, chalk.red("FATAL: Missing SENTRY DSN"));
	process.exit(1);
}

Sentry.init({
	dsn: SENTRY_DSN,
	environment: NODE_ENV,
	// Performance Monitoring
	tracesSampleRate: 1.0,
	// Set sampling rate for profiling - this is relative to tracesSampleRate
	profilesSampleRate: 1.0,
});

export default async function (type: string, module: string, error: Error | any) {
	// Only send errors to Sentry in production
	if (NODE_ENV === "production") Sentry.captureException(error);

	if (type === "error") {
		console.error(`[${module}]`, chalk.red(error?.message ?? error));
	} else if (type === "warning") {
		console.error(`[${module}]`, chalk.yellowBright(error?.message ?? error));
	}
}
