import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import ErrorHandler from "./utils/ErrorHandler";
import { commands } from "./commands";
import { populateBrandList } from "./utils/GetBrands";
import Phisherman from "./modules/Phisherman";

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
	populateBrandList();
});

client.on("interactionCreate", async interaction => {
	try {
		if (interaction.isAutocomplete()) {
			const { commandName } = interaction;
			if (commandName in commands) {
				commands[commandName].autocomplete(interaction);
			}
		} else if (interaction.isChatInputCommand()) {
			const { commandName } = interaction;
			if (commandName in commands) {
				commands[commandName].execute(interaction);
			}
		} else if (interaction.isButton()) {

			const reportAction = interaction.customId ?? null;

			const reportId = interaction.message.embeds[0].fields[1].value;
			await interaction.deferUpdate();

			if (/^approve$|^approve_malicious$/.test(reportAction)) {
            const classification = reportAction === "approve_malicious" ? "malicious" : "suspicious";
            new Phisherman().approveReport(interaction, reportId, classification);
			} else if (reportAction === "reject") {
				new Phisherman().rejectReport(interaction, reportId);
			}
		}
	} catch (error) {
		ErrorHandler("error", "interactionCreate", error);
	}
});

// Login
client.login(DISCORD_TOKEN).catch(error => ErrorHandler("error", "DISCORD API", error));
