import * as Sentry from "@sentry/node";
import { SlashCommandBuilder } from "@discordjs/builders";
import isValidDomain from "is-valid-domain";
import isValidUrl from "is-valid-http-url";
import { axiosPhisherman } from "../modules/phisherman.js";
import { newPhishReport, updateExistingReport } from "../modules/phisherman.js";

let brandListFull;
const brandListStatic = [
	{
		id: "CRYPTO",
		name: "Generic: Crypto",
	},
	{
		id: "CSGO",
		name: "Valve Corp. (Counter-Strike)",
	},
	{
		id: "DISCORD",
		name: "Discord Inc.",
	},
	{
		id: "ROBLOX",
		name: "Roblox Corporation",
	},
	{
		id: "STEAM",
		name: "Steam",
	},
	{
		id: "TWITCH",
		name: "Twitch Interactive, Inc.",
	},
	{
		id: "OTHER",
		name: "Other",
	},
];

async function findBrandByName(str) {
	let brandList;

	if (brandListFull.length > 10) {
		brandList = brandListFull.filter(brand => brand.name.toLowerCase().indexOf(str) > -1);

		if (brandList.length > 25) brandList = brandList.slice(0, 24);
	} else {
		return axiosPhisherman
			.get(`/v2/brands`)
			.then(response => {
				const { data } = response ?? {};

				if (!data) return brandListStatic;

				brandListFull = data.map(item => ({ id: item.id, name: item.name }));
				brandList = brandListFull.filter(brand => brand.name.toLowerCase().indexOf(str) > -1);

				if (brandList.length > 25) brandList = brandList.slice(0, 24);

				return brandList;
			})
			.catch(err => {
				console.error("[findBrandByName]", err.message);
				Sentry.captureException(err);
			});
	}

	return brandList ?? null;
}

export async function populateBrandList() {
	axiosPhisherman
		.get(`/v2/brands`)
		.then(response => {
			if (response.data) console.log("Populated brand list with", response.data.length, "items");
			response.data ? (brandListFull = response.data) : null;
		})
		.catch(err => {
			console.error("[populateBrandList]", err.message);
			Sentry.captureException(err);
		});
}

export default {
	data: new SlashCommandBuilder()
		.setName("report")
		.setDescription("Report a new phish")
		.addStringOption(option => option.setName("link").setDescription("The FULL phish url you wish to report").setRequired(true))
		.addStringOption(option => option.setName("brand").setDescription("The targeted brand of the Phish").setRequired(true).setAutocomplete(true))
		.addStringOption(option => option.setName("comment").setDescription("Optionally add any additional comments or info").setRequired(false)),
	async autocomplete(interaction) {
		const searchQuery = interaction.options.getFocused();
		if (!searchQuery) return interaction.respond(brandListStatic.map(brand => ({ name: brand.name, value: brand.name })));

		const brandList = await findBrandByName(searchQuery);
		await interaction.respond(brandList.map(brand => ({ name: brand.name, value: brand.name })));
	},

	async execute(interaction) {
		try {
			let url = interaction.options.getString("link");
			const comment = interaction.options.getString("comment");
			const brand = interaction.options.getString("brand");

			// validate URL/domain is valid
			if (!url) return interaction.reply({ content: "🚫 Invalid URL specified", ephemeral: true });
			if (typeof url != "string") return interaction.reply({ content: "🚫 Invalid URL specified", ephemeral: true });
			if (!isValidUrl(url)) return interaction.reply({ content: "🚫 Invalid URL specified", ephemeral: true });

			const domain = new URL(url).hostname.replace("www.", "").toLowerCase();
			if (!isValidDomain(domain)) return interaction.reply({ content: "🚫 Domain validation failed. Please check provided URL", ephemeral: true });

			// block reporting of test/debug domains
			if (process.env.NODE_ENV === "production") {
				if (domain.match(/phisherman-test-domain.zeppelin.gg|.test.phisherman.gg/i)) return interaction.reply({ content: `🛡️ \`${domain}\` is a protected domain and cannot be reported`, ephemeral: true });
			}

			// Trim URL longer than 255
			if (url.length > 255) url = new URL(url).origin;

			// defer reply
			console.log("deferReply", new Date().toISOString().slice(0, 19).replace("T", " "));
			await interaction.deferReply();

			if (!brandListFull) await populateBrandList().catch();
			if (!brandListFull) return interaction.editReply({ content: "<:alert:883027468452257852> Backend API returned an error, please try again. Contact <@188032859276181504> if this happens again.", ephemeral: true });

			// Check if we already know about this domain
			const isKnownDomain = await axiosPhisherman.get(`/v2/domains/info/${domain}`).then(async res => {
				const { created, verifiedPhish, classification, firstSeen, lastSeen, targetedBrand, phishCaught, details } = res.data[domain] ?? {};

				let phishermanEmbed;
				if (!res.data) {
					return;
				} else if (classification === "safe") {

					phishermanEmbed = {
						title: domain,
						timestamp: new Date().toISOString(),
					};

					(phishermanEmbed.color = 5023065),
						(phishermanEmbed.fields = [
							{
								name: "Classification:",
								value: "<:classification_safe:923409141580566539> Safe",
								inline: true,
							},
						]);
				} else if (/suspicious|malicious/i.test(classification)) {

					phishermanEmbed = {
						title: domain,
						timestamp: new Date().toISOString(),
					};

					(phishermanEmbed.color = verifiedPhish ? 15157819 : verifiedPhish === false ? 16496712 : 11184810),
						(phishermanEmbed.fields = [
							{
								name: "Detections:",
								value: phishCaught ?? 0,
								inline: true,
							},
							{
								name: "Verified:",
								value: verifiedPhish ? "<:verified:963911613654642708> Yes" : verifiedPhish === false ? "<:not_verified:963909205239148558> No" : "Unknown",
								inline: true,
							},
							{
								name: "Classification:",
								value: verifiedPhish ? "<:classification_malicious:963910982915227688> Malicious" : verifiedPhish === false ? "<:classification_suspicious:963907967504232517> Suspicious" : "<:classification_unknown:923408156351168562> Unknown",
								inline: true,
							},
							{
								name: "Date Added:",
								value: created ? `<t:${Math.floor(new Date(created).getTime() / 1000)}>` : "Unknown",
								inline: true,
							},
							{
								name: "First Seen:",
								value: firstSeen ? `<t:${Math.floor(new Date(firstSeen).getTime() / 1000)}>` : "Never",
								inline: true,
							},
							{
								name: "Last Seen:",
								value: lastSeen ? `<t:${Math.floor(new Date(lastSeen).getTime() / 1000)}>` : "Never",
								inline: true,
							},
							{
								name: "Targeted Brand:",
								value: targetedBrand ?? "-",
								inline: true,
							},
							{
								name: "Country:",
								value: details?.country?.code ? `:flag_${details?.country.code.toLowerCase()}: ${details?.country?.name ?? details.country.code}` : "-",
								inline: true,
							},
						]);
					// Add screenshot, if we have it
					if (details.websiteScreenshot) phishermanEmbed.thumbnail = { url: details.websiteScreenshot };
				}

				return phishermanEmbed

			})
			.catch(err => {
				console.error(err);
				Sentry.captureException(err);

				return interaction.editReply({
					content: "<:fail:914177905603543040> An error occured, please try again",
					ephemeral: true,
				});
			});

			// Domain already known, so return this info
			if (isKnownDomain) return interaction.editReply({ embeds: [isKnownDomain], ephemeral: false });

			// Domain wasn't known, so we'll continue to submission
			const brandId = brandListFull?.filter(brand => brand.name == interaction?.options.get("brand")?.value)[0]?.id ?? null;

			// stringify data to JSON
			const interactionMessageId = await interaction.fetchReply().then(message => message.id);

			const data = {
				url: url,
				domain: domain,
				target: { id: brandId ?? null, name: brand ?? null },
				comment: comment,
				reportedBy: interaction.user.id ? interaction.user.id : null,
				created: new Date().toISOString().slice(0, 19).replace("T", " "),
				report_message: { guild: interaction.guild.id, channel: interaction.channel.id, message: interactionMessageId },
			};

			const newReport = await axiosPhisherman.post(`/trawler/report`, data).catch(err => {
				console.error(err.response.data ? JSON.stringify(err.response.data) : err.message);
				Sentry.captureException(err);
				return interaction.editReply({
					content: /could not be resolved to a valid IPv4\/IPv6 address/.test(err.message) ? `<:fail:914177905603543040> \`${domain}\` could not be resolved to a valid IPv4/IPv6 address. We won't try and process it any further.` : "<:fail:914177905603543040> An error occurred, please try again",
					ephemeral: true,
				});
			});

			let submissionResponseMessage = `🐟 Phish \`${url}\` successfully reported`;
			let submissionResponseEmbed;
			const { isUrlShortner, isProtectedDomain, isReportedDomain, domainInfo } = newReport?.data ?? {};

			if (isUrlShortner) {
				submissionResponseMessage = `<:fail:914177905603543040> URL Shorteners are currently not accepted`;
			} else if (isProtectedDomain) {
				submissionResponseMessage = `<:classification_safe:923409141580566539> \`${domain}\` is a protected domain and cannot be reported`;
			} else if (newReport.status === 201) {
				await newPhishReport(interaction, domainInfo);
			} else if (isReportedDomain === true) {
				// Update existing report
				await updateExistingReport(interaction, domainInfo);
			}

			return interaction.editReply(submissionResponseEmbed ? { embeds: [submissionResponseEmbed] } : { content: submissionResponseMessage });

		} catch (err) {
			console.error(err);
			Sentry.captureException(err);
			return interaction.reply({
				content: "There was an error while executing this command!",
				ephemeral: true,
			});
		}
	},
};
