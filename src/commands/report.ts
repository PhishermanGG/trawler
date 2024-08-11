import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, AutocompleteInteraction, AutocompleteFocusedOption, APIEmbed } from "discord.js";
import isValidUrl from "is-valid-http-url";
import isValidDomain from "is-valid-domain";
import ErrorHandler from "../utils/ErrorHandler";
import { brandList } from "../utils/GetBrands";
import Phisherman from "../modules/Phisherman";
import { PhishermanDomainInfoEmbed } from "../utils/types";
import emojis from "../utils/emojis";

async function findBrandByName(str: string) {
	let brandSearchResponse = brandList.filter((brand: { name: string; value: string }) => brand.name.toLowerCase().indexOf(str) > -1);

	if (brandSearchResponse.length > 25) brandSearchResponse = brandSearchResponse.slice(0, 24);

	return brandSearchResponse ?? brandList.slice(0, 24);
}

export const data = new SlashCommandBuilder()
	.setName("report")
	.setDescription("Report a new Phish")
	.addStringOption(option => option.setName("link").setDescription("The full url you wish to report. eg https://domain.com/page").setRequired(true))
	.addStringOption(option => option.setName("brand").setDescription("The targeted brand of the Phish").setRequired(true).setAutocomplete(true))
	.addStringOption(option => option.setName("comment").setDescription("Optionally add any additional comments or info").setRequired(false));

export async function autocomplete(interaction: AutocompleteInteraction) {
	const searchQuery = interaction.options.getFocused()?.toLowerCase();
	if (!searchQuery) return interaction.respond(brandList.slice(0, 24).map((brand: { name: string; value: string }) => ({ name: brand.name, value: brand.name })));

	const brandListResponse = await findBrandByName(searchQuery);
	await interaction.respond(brandListResponse.map((brand: { name: string; value: string }) => ({ name: brand.name, value: brand.name })));
}

export async function execute(interaction: ChatInputCommandInteraction) {
	try {
		const link = interaction.options.getString("link");
		const comment = interaction.options.getString("comment");
		const brandName = interaction.options.getString("brand");
		const brandId = brandList.filter((brand: { id: string; name: string }) => brand.name == brandName)[0]?.id ?? null;

		// Validate URL/domain is valid
		if (!link) return interaction.reply({ content: "🚫 Invalid URL provided", ephemeral: true });
		if (!isValidUrl(link)) return interaction.reply({ content: "🚫 Invalid URL provided", ephemeral: true });
		const domain = new URL(link).hostname.replace("www.", "").toLowerCase();
		if (!isValidDomain(domain)) return interaction.reply({ content: "🚫 Domain validation failed. Please check provided URL", ephemeral: true });

		// Defer reply
		await interaction.deferReply();

		// Check if the domain is already known to Phisherman
		const domainLookup = (await new Phisherman().getDomainInfo(domain)) as PhishermanDomainInfoEmbed;

		// if domain is known, return that info in embed
		if (domainLookup.isKnownDomain) {
			return interaction.editReply({ embeds: [domainLookup.embed], components: domainLookup?.embedButtons ? [domainLookup.embedButtons] : [] });
		}

		// Domain wasn't known, so build data object for API submission

		// stringify data to JSON
		const interactionMessageId = await interaction.fetchReply().then(message => message.id);

		const phishReport = {
			url: link,
			domain: domain,
			target: { id: brandId ?? null, name: brandName ?? null },
			comment: comment,
			reportedBy: interaction.user.id ? interaction.user.id : null,
			created: new Date().toISOString().slice(0, 19).replace("T", " "),
			report_message: interaction.guild?.id ? { guild: interaction?.guild?.id, channel: interaction?.channel?.id, message: interactionMessageId } : undefined,
		};

		const { status, data } = await new Phisherman().submitPhishReport(phishReport);

		const { isUrlShortner, isProtectedDomain, isReportedDomain, domainInfo } = data ?? {};

		let submissionResponseMessage = `🐟 Phish \`${new URL(link).hostname}\` successfully reported`;
		let submissionResponseEmbed: APIEmbed|undefined;

		if (isUrlShortner) {
			submissionResponseMessage = `${emojis.fail} URL Shorteners are currently not accepted`;
		} else if (isProtectedDomain) {
			submissionResponseMessage = `${emojis.classificationSafe} \`${domain}\` is a protected domain and cannot be reported`;
		} else if (status === 201) {
			new Phisherman().postReviewEmbed(interaction, domainInfo);
		} else if (isReportedDomain === true) {
         new Phisherman().updateReportEmbed(interaction, domainInfo)
		}

		return interaction.editReply(submissionResponseEmbed ? { embeds: [submissionResponseEmbed] } : { content: submissionResponseMessage });
	} catch (error) {
		ErrorHandler("error", "TRAWLER", error);

		let message = `${emojis.fail} Error: Request Failed.`;

		if (interaction.deferred) {
			return interaction.editReply({ content: message });
		} else {
			return interaction.reply({ content: message, ephemeral: true });
		}
	}
}
