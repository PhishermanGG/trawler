import { SlashCommandBuilder } from "@discordjs/builders";
import { APIEmbed, ChatInputCommandInteraction, Embed, EmbedData, Message } from "discord.js";
import isValidUrl from "is-valid-http-url";
import isValidDomain from "is-valid-domain";
import Phisherman from "../modules/Phisherman";
import ErrorHandler from "../utils/ErrorHandler";

export const data = new SlashCommandBuilder()
	.setName("check")
	.setDescription("Checks the supplied URL against our database.")
	.addStringOption(option =>
		option.setName("link").setDescription("The full url you wish to check. eg https://domain.com/page").setRequired(true)
	);

export async function execute(interaction: ChatInputCommandInteraction) {
	try {
		const link = interaction.options.getString("link");

		// Validate URL/domain is valid
		if (!link) return interaction.reply({ content: "🚫 Invalid URL provided", ephemeral: true });
		if (!isValidUrl(link)) return interaction.reply({ content: "🚫 Invalid URL provided", ephemeral: true });

		const domain = new URL(link).hostname.replace("www.", "").toLowerCase();
		if (!isValidDomain(domain))
			return interaction.reply({ content: "🚫 Domain validation failed. Please check provided URL", ephemeral: true });

		// Defer reply
		await interaction.deferReply();

		const PhishermanResponse = await new Phisherman().GetDomainInfo(domain);

		if (!PhishermanResponse) {
			return interaction.editReply({ content: "<:fail:914177905603543040> API Error. Please try again." });
		}

		return interaction.editReply({ embeds: [PhishermanResponse.embed], components: [PhishermanResponse?.embedButtons] });
	} catch (error) {
		ErrorHandler("error", "TRAWLER", error);
		return interaction.reply({ content: "🚫 Invalid URL provided", ephemeral: true });
	}
}
