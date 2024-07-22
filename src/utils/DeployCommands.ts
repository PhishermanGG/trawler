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
			// Clear any existing commands
			await Promise.all([
				rest
					.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_DEV_GUILD_ID), { body: [] })
					.then(() => console.log("Successfully deleted all guild commands for guild", DISCORD_DEV_GUILD_ID))
					.catch(console.error),
				rest
					.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: [] })
					.then(() => console.log("Successfully deleted all application commands."))
					.catch(console.error),
			]);

			await new Promise(resolve => setTimeout(resolve, 3000));

			// Send new commands
			await rest
				.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_DEV_GUILD_ID), {
					body: botCommands,
				})
				.then(res => {
               //@ts-ignore
					console.log(`Successfully registered ${res?.length ?? 0} application commands`);
					process.exit(1);
				});
		} else if (NODE_ENV === "production") {
			// Clear any existing commands
			await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
				body: [],
			});
			// Send new commands
			await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
				body: botCommands,
			});
		}
	} catch (error) {
		ErrorHandler("error", "DISCORD API", error);
	}
}
deployCommands();
