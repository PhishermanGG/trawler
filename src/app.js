import "dotenv/config";
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import * as fs from "fs";
import * as cron from "node-schedule";
import path from "path";
import axios from "axios";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { reviewReport } from "./modules/phisherman.js";
import { populateBrandList } from "./commands/reportPhish.js";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	environment: process.env.NODE_ENV,
	integrations: [new ProfilingIntegration()],
	// Performance Monitoring
	tracesSampleRate: 1.0,
	// Set sampling rate for profiling - this is relative to tracesSampleRate
	profilesSampleRate: 1.0,
});

// Create client
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

// Load commands
const commands = new Collection();
const commandsDir = path.join(process.cwd(), "src/commands");
const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
	const command = await import(`file://${commandsDir}/${file}`);
	commands.set(command.default.data.name, command);
}

bot
	.on("error", async error => {
		console.error(error);
		Sentry.captureException(error);
	})
	.on("warn", console.warn)
	.on("rateLimit", async rateLimitInfo => {
		console.error(`[RATE LIMIT] Path: ${rateLimitInfo.path}`);
	});

bot.once("ready", () => {
	console.log(`Logged in as ${bot.user.tag}! Replica ID:`, process.env?.RAILWAY_REPLICA_ID ?? "none");
	populateBrandList().catch(err => {
		console.error(err);
		if (process.env.NODE_ENV === "production") Sentry.captureException(err);
	});
});

// Interaction Handler
bot.on("interactionCreate", async interaction => {
	if (interaction.isChatInputCommand()) {
		console.log("interactionCreate", new Date().toISOString().slice(0, 19).replace("T", " "));
		const commandToExec = commands.get(interaction.commandName);

		try {
			await commandToExec.default.execute(interaction);
		} catch (err) {}
		console.log("interaction finished", new Date().toISOString().slice(0, 19).replace("T", " "));
	} else if (interaction.isAutocomplete()) {
		const command = commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.default.autocomplete(interaction);
		} catch {}
	} else if (interaction.customId) {
		const reportAction = interaction.customId ? (interaction.customId === "approve_new_phish" || interaction.customId === "approve_new_phish_malicious" ? "approve" : "reject") : null;

		const reportId = interaction.message.embeds[0].fields[1].value;

		if (reportAction && reportId) {
			await interaction.deferUpdate();
			return reviewReport(interaction, reportAction, reportId);
		} else {
			console.error("[Trawler] Error: INTERACTION.REVIEW.APPROVE");
		}
	}
});

// Login to Discord
bot.login(process.env.DISCORD_BOT_TOKEN);

// Uptime Heartbeat
cron.scheduleJob("*/2 * * * *", async () => {
	try {
		axios.get(process.env.HEARTBEAT_URL);
	} catch {}
});
