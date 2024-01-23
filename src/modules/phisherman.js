import * as Sentry from "@sentry/node";
import axios from "axios";
import isValidUrl from "is-valid-http-url";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } from "discord.js";

// Create Axios instant
const axiosPhisherman = axios.create({
	baseURL: process.env.PHISHERMAN_API_URL,
	headers: {
		"Content-Type": "application/json",
		Authorization: `Bearer ${process.env.PHISHERMAN_API_KEY}`,
		"User-Agent": "Trawler (+https://phisherman.gg / 188032859276181504)",
	},
});

async function getScreenshot(url) {
	if (!isValidUrl(url)) return new Error("Invalid URL");
	return axios
		.post(
			process.env.PHISHERMAN_SCREENSHOT_URL,
			{ url },
			{
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: `Bearer ${process.env.PHISHERMAN_SCREENSHOT_KEY}`,
				},
			}
		)
		.then(res => {
			return res?.data?.url ?? null;
		})
		.catch(err => {
			console.error("[PHISHERMAN SCREENSHOT]", err.message);
			if (process.env.NODE_ENV === "production") {
				Sentry.captureException(err);
			}
		});
}

async function buildEmbed(report) {
	const { id, url, domain, target, comment, reportedBy, reported, reportedLast, urlscanId, reports, screenshotUrl } = report ?? {};

	const embed = {
		title: "🎣 New Phish Reported",
		description: domain,
		color: 5814783,
		fields: [
			{
				name: "Reporter:",
				value: reportedBy ? `<@${reportedBy}>` : "Unknown",
				inline: true,
			},
			{
				name: "Report ID:",
				value: id ?? "Unknown",
				inline: true,
			},
			{
				name: "Report Count:",
				value: reports ?? 1,
				inline: true,
			},
			{
				name: "First Reported:",
				value: reported ? `<t:${Math.floor(new Date(reported).getTime() / 1000)}>` : "Unknown",
				inline: true,
			},
			{
				name: "Last Reported:",
				value: `<t:${Math.floor(new Date(reportedLast ?? created).getTime() / 1000)}>`,
				inline: true,
			},
			{
				name: "Targeted Brand:",
				value: target ?? "Unknown",
				inline: true,
			},
			{
				name: "URL:",
				value: `\`\`\`${url}\`\`\``,
				inline: false,
			},
		],
		timestamp: new Date().toISOString(),
	};

	if (comment)
		embed.fields.push({
			name: "Comment:",
			value: `\`\`\`${comment}\`\`\``,
			inline: false,
		});
	if (screenshotUrl) embed.image = { url: screenshotUrl };

	const reportButtons = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setLabel("Suspicious").setCustomId("approve_new_phish").setStyle(ButtonStyle.Success),
		new ButtonBuilder().setLabel("Malicious").setCustomId("approve_new_phish_malicious").setStyle(ButtonStyle.Success),
		new ButtonBuilder().setLabel("Reject").setCustomId("reject_new_phish").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setLabel("Talos").setStyle(ButtonStyle.Link).setURL(`https://talosintelligence.com/reputation_center/lookup?search=${domain}#whois`),
		new ButtonBuilder()
			.setLabel(urlscanId ? `URLScan Result` : `URLScan Search`)
			.setStyle(ButtonStyle.Link)
			.setURL(urlscanId ? `https://urlscan.io/result/${urlscanId}/loading` : `https://urlscan.io/search/#domain%253A${domain}`)
	);

	return { embed, reportButtons };
}

async function postEmbed(interaction, report, reportEmbed) {
	if (report.id) {
		return interaction.client.channels.cache
			.get(process.env.PHISH_REVIEW_CHANNEL)
			.send({ embeds: [reportEmbed.embed], components: [reportEmbed.reportButtons] })
			.then(async message => {
				report.review_message = { guild: message.guild.id, channel: message.channelId, message: message.id };

				axiosPhisherman.put(`/trawler/report/${report.id}`, report).catch(err => {
					console.error(err);
					if (process.env.NODE_ENV === "production") {
						Sentry.captureException(err);
					}
				});

				getScreenshot(report.url)
					.then(async response => {
						if (!response) return;

						// Add thumbnail to existing embed and edit
						report.screenshotUrl = response;
						await buildEmbed(report).then(async embed => {
							const channel = await interaction.client.channels.cache.get(message.channelId);
							const reviewMessage = await channel.messages.fetch(message.id);

							if (!reviewMessage.components) return;

							message.edit({ embeds: [embed.embed], components: [embed.reportButtons] });
						});
					})
					.catch(err => {
						console.error(err);
						if (process.env.NODE_ENV === "production") {
							Sentry.captureException(err);
						}
					});
			})
			.catch(err => {
				console.error(err);
				if (process.env.NODE_ENV === "production") {
					Sentry.captureException(err);
				}
			});
	} else {
		interaction.followUp("<:fail:914177905603543040> API Error [Code: Salmon]. Please try again.");
	}
}

export async function newPhishReport(interaction, report) {
	// BUILD EMBED
	const reportEmbed = await buildEmbed(report);

	await postEmbed(interaction, report, reportEmbed).catch(async err => {
		console.error(err);
		if (process.env.NODE_ENV === "production") {
			Sentry.captureException(err);
		}
		interaction.followUp({ content: "<:alert:883027468452257852> Backend API returned an error, this shouldn't happen. Please contact <@188032859276181504>", ephemeral: true });
	});
}

export async function updateExistingReport(interaction, report) {
	if (report.review_message) {
		const { channel: channelId, message: messageId } = report.review_message ?? {};

		try {
			const channel = await interaction.client.channels.cache.get(channelId);
			const message = await channel.messages.fetch(messageId);

			// Existing message was retrieved, so edit embed
			const newEmbed = message.embeds[0];

			if (report?.reports) newEmbed.fields[2].value = report.reports;
			if (report?.reported) newEmbed.fields[3].value = `<t:${Math.floor(new Date(report.reported).getTime() / 1000)}>`;
			if (report?.reportedLast) newEmbed.fields[4].value = `<t:${Math.floor(new Date(report.reportedLast).getTime() / 1000)}>`;
			if (report?.target) newEmbed.fields[5].value = report?.target ?? "Unknown";

			await message.edit({ embeds: [newEmbed] }).catch(err => {
				console.error(err);
				if (process.env.NODE_ENV === "production") Sentry.captureException(err);
			});
		} catch (err) {
			if (err.code === 10008) {
				// Unable to retrieve original message, so we'll build a new one
				buildEmbed(report).then(reportEmbed => postEmbed(interaction, report, reportEmbed));
			} else {
				console.error(err);
				if (process.env.NODE_ENV === "production") Sentry.captureException(err);
			}
		}
	} else {
		// Unable to retrieve original message, so we'll build a new one
		buildEmbed(report).then(reportEmbed => postEmbed(interaction, report, reportEmbed));
	}
}

export async function reviewReport(interaction, reportAction, reportId) {
	if (!reportAction.match(/approve|reject/i)) return interaction.followUp({ content: "<:fail:914177905603543040> Invalid action specified", ephemeral: true });

	// Make a copy of the old components
	const oldEmbedComponents = interaction.message.components;

	// Remove buttons
	await interaction.message.edit({ components: []}).catch(() => {
		// Restore buttons if something fails
		interaction.message.edit({ components: oldEmbedComponents})
	});

	let classification;

	if (reportAction === "approve") {
		classification = interaction.customId === "approve_new_phish_malicious" ? "malicious" : "suspicious";
	}

	const approvedMessage = `<:success:914177905632890880> Phish report \`${interaction.message.embeds[0].description}\` approved`;
	const rejectMessage = `<:fail:914177905603543040> Phish report \`${interaction.message.embeds[0].description}\` rejected`;
	const approvedMessageReviewer = `<:success:914177905632890880> Phish report \`${interaction.message.embeds[0].description}\` approved (${classification}) by \`${interaction.user.tag}\``;
	const rejectMessageReviewer = `<:fail:914177905603543040> \`${interaction.message.embeds[0].description}\` rejected by \`${interaction.user.tag}\``;

	return axiosPhisherman
		.put(`/trawler/report/${reportId}/${reportAction}`, {
			classification,
		})
		.then(async res => {
			if (!res.data) return;

			if (res.status === 404) {
				// For some reason report was already gone, so just clear the message
				await interaction.followUp({ content: "API returned 'Not Found', this shouldn't happen", ephemeral: true }).catch(err => {
					console.error(err);
					Sentry.captureException(err);
				});
			} else {
				const { report_messages } = res.data.data ?? {};

				// Update reviewer channel message
				await interaction.message.edit({ content: reportAction === "approve" ? approvedMessageReviewer : rejectMessageReviewer, embeds: [], components: [] }).catch(err => {
					console.error(err);
					Sentry.captureException(err);
				});

				// Update reporter messages (public facing)
				if (!report_messages.length) return;
				for (const report of report_messages) {
					try {
						const channel = await interaction.client.channels.cache.get(report.channel);
						const message = await channel.messages.fetch(report.message);
						await message.edit({ content: reportAction === "approve" ? approvedMessage : rejectMessage }).catch();

						await new Promise(resolve => setTimeout(resolve, 1000));
					} catch {}
				}
			}
		})
		.catch(async err => {
			if (err?.response?.status === 404) {
				// For some reason report was already gone, so just clear the message
				await interaction.followUp({ content: "<:alert:883027468452257852> API returned `HTTP404` for the report. This shouldn't happen", ephemeral: true }).catch(err => {
					console.error(err);
					Sentry.captureException(err);
				});
			} else {
				console.error(err.message);
				Sentry.captureException(err);
			}
		});
}

export { axiosPhisherman };
