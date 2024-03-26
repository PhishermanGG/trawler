import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import ErrorHandler from "./utils/ErrorHandler";
import { commands } from "./commands";

// Check we have required vars
const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = process.env ?? {};
if (!DISCORD_TOKEN) {
	ErrorHandler("error", "TRAWLER", "FATAL: Missing Discord Token"), process.exit(1);
}
if (!DISCORD_CLIENT_ID) {
	ErrorHandler("error", "TRAWLER", "FATAL: Missing Discord Client ID"), process.exit(1);
}

// Create new Client instance
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
	allowedMentions: { parse: ["users"] },
});

// Log when client is ready
client.once(Events.ClientReady, async c => {
	console.log("[TRAWLER] Client ready, logged in as", c.user.tag);
});

client.on("interactionCreate", async interaction => {
	try {
		if (interaction.isChatInputCommand()) {
			const { commandName } = interaction;
			if (commandName in commands) {
				commands[commandName].execute(interaction);
			}
		}
	} catch (error) {
		ErrorHandler("error", "DISCORD API", error);
	}
});

// Login
client.login(DISCORD_TOKEN).catch(error => ErrorHandler("error", "DISCORD API", error));
