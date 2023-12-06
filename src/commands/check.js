import * as Sentry from "@sentry/node";
import { SlashCommandBuilder } from "@discordjs/builders";
import isValidUrl from "is-valid-http-url";
import isValidDomain from "is-valid-domain";
import { axiosPhisherman } from "../modules/phisherman.js";

export default {
	data: new SlashCommandBuilder()
		.setName("check")
		.setDescription("Checks the supplied URL against our database.")
		.addStringOption(option => option.setName("link").setDescription("The full url you wish to check. eg https://domain.com/page").setRequired(true)),

	async execute(interaction, transaction) {
		const span = transaction.startChild({ op: "function" }); // This function returns a Span

		try {
			const url = interaction.options.getString("link");

			// validate URL/domain is valid
			if (!url) return interaction.reply({ content: "🚫 Invalid URL provided", ephemeral: true });
			if (!isValidUrl(url)) return interaction.reply({ content: "🚫 Invalid URL provided", ephemeral: true });

			const domain = new URL(url).hostname.replace("www.", "").toLowerCase();
			if (!isValidDomain(domain)) return interaction.reply({ content: "🚫 Domain validation failed. Please check provided URL", ephemeral: true });

			// defer reply
			await interaction.deferReply().catch(err => {
				console.error(err);
				Sentry.captureException(err);
			});

			return axiosPhisherman
				.get(`/v2/domains/info/${domain}`)
				.then(async res => {
					const { created, verifiedPhish, classification, firstSeen, lastSeen, targetedBrand, phishCaught, details } = res.data[domain] ?? {};

					let phishermanEmbed = {
						title: domain,
						timestamp: new Date().toISOString(),
					};

					if (!res.data) {
						return interaction.editReply({ content: "<:fail:914177905603543040> Invalid response from API. Please try again.", ephemeral: true });
					} else if (/safe|suspicious|malicious/i.test(classification) === false) {
						(phishermanEmbed.color = 11184810), (phishermanEmbed.description = "Domain not known to phisherman");
					} else if (classification === "safe") {
						(phishermanEmbed.color = 5023065),
							(phishermanEmbed.fields = [
								{
									name: "Classification:",
									value: "<:classification_safe:923409141580566539> Safe",
									inline: true,
								},
							]);
					} else if (/suspicious|malicious/i.test(classification)) {
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

					span.setStatus("ok");

					return interaction.editReply({ embeds: [phishermanEmbed], ephemeral: false });
				})
				.catch(err => {
					console.error(err);

					span.setStatus("unknown_error");
					Sentry.captureException(err);

					return interaction.editReply({
						content: err.message.match(/could not be resolved to a valid IPv4\/IPv6 address/i) ? `<:fail:914177905603543040> \`${domain}\` could not be resolved to a valid IPv4/IPv6 address. We won't try and process it any further.` : "<:fail:914177905603543040> An error occured, please try again",
						ephemeral: true,
					});
				});
		} catch (err) {
			console.error(err);

			span.setStatus("unknown_error");
			Sentry.captureException(err);

			return interaction.reply({
				content: "<:fail:914177905603543040> There was an error while executing this command!",
				ephemeral: true,
			});
		}
	},
};
