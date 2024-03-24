import "dotenv/config";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import ErrorHandler from "./ErrorHandler";
import { commands } from "../commands";

const { NODE_ENV, DISCORD_CLIENT_ID, DISCORD_TOKEN, DISCORD_DEV_GUILD_ID } = process.env ?? {};

export async function deployCommands() {
	try {
		if (!DISCORD_TOKEN) return ErrorHandler("error", "TRAWLER", "FATAL: Missing Discord Token");
		if (!DISCORD_CLIENT_ID) return ErrorHandler("error", "TRAWLER", "FATAL: Missing Discord Client ID");

		const botCommands = Object.values(commands).map(c => c.data);
		const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

		if (NODE_ENV === "development") {
			if (!DISCORD_DEV_GUILD_ID) return ErrorHandler("error", "TRAWLER", "FATAL: Missing Dev Guild ID");
			await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_DEV_GUILD_ID), {
				body: botCommands,
			});
		} else if (NODE_ENV === "production") {
			await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
				body: botCommands,
			});
		}
	} catch (error) {
		ErrorHandler("error", "DISCORD API", error);
	}
}
deployCommands();
