import axios from "axios";
import { APIEmbed, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, TextChannel, Message, ButtonInteraction } from "discord.js";
import { type PhishermanReportSubmissionResponseDomainInfo } from "../utils/types";
import emojis from "../utils/emojis";
import ErrorHandler from "../utils/ErrorHandler";

// Check we have required vars
const { PHISHERMAN_API_KEY, PHISHERMAN_API_URL, PHISH_REVIEW_CHANNEL } = process.env ?? {};
if (!PHISHERMAN_API_KEY) {
	ErrorHandler("error", "TRAWLER", "FATAL: Missing Phisherman API Key"), process.exit(1);
}
if (!PHISHERMAN_API_URL) {
	ErrorHandler("error", "TRAWLER", "FATAL: Missing Phisherman API URL"), process.exit(1);
}
if (!PHISH_REVIEW_CHANNEL) {
	ErrorHandler("error", "TRAWLER", "FATAL: Missing Phisherman PHISH_REVIEW_CHANNEL"), process.exit(1);
}

// Create Axios instant
const axiosPhisherman = axios.create({
	baseURL: process.env.PHISHERMAN_API_URL,
	headers: {
		"Content-Type": "application/json",
		Accept: "application/json",
		Authorization: `Bearer ${process.env.PHISHERMAN_API_KEY}`,
		"User-Agent": "Trawler (+https://phisherman.gg / 188032859276181504)",
	},
});

export default class Phisherman {
	/**
	 * Returns the specified domain details from the Phisherman API
	 */
	async getDomainInfo(domain: string): Promise<Object | undefined> {
		try {
			const phishInfo = await axiosPhisherman
				.get(`/v2/domains/info/${domain}`)
				.then(res => res?.data ?? null)
				.catch(error => ErrorHandler("error", "PHISHERMAN API", error));

			const { created, verifiedPhish, classification, firstSeen, lastSeen, targetedBrand, phishCaught, details } = phishInfo[domain] ?? {};

			let isKnownDomain = false;

			let embed = {
				color: 11184810,
				description: "`" + domain + "` not known to Phisherman",
			} as APIEmbed;
			let embedButtons: any;

			if (classification === "safe") {
				isKnownDomain = true;
				embed = {
					color: 5023065,
					description: "**Domain:** `" + domain + "`\n**Classification:** Safe",
				};
			} else if (/suspicious|malicious/i.test(classification) === true) {
				isKnownDomain = true;
				embed = {
					color: verifiedPhish ? 15157819 : verifiedPhish === false ? 16496712 : 11184810,
					title: domain,
					fields: [
						{
							name: "Detections:",
							value: phishCaught ?? 0,
							inline: true,
						},
						{
							name: "Verified:",
							value: verifiedPhish ? `${emojis.verified} Yes` : verifiedPhish === false ? `${emojis.notVerified} No` : "Unknown",
							inline: true,
						},
						{
							name: "Classification:",
							value: verifiedPhish ? `${emojis.classificationMalicious} Malicious` : verifiedPhish === false ? `${emojis.classificationSuspicious} Suspicious` : `${emojis.classificationUnknown} Unknown`,
							inline: true,
						},
						{
							name: "Date Added:",
							value: created ? `<t:${Math.floor(new Date(created).getTime() / 1000)}:D>` : "Unknown",
							inline: true,
						},
						{
							name: "First Detection:",
							value: firstSeen ? `<t:${Math.floor(new Date(firstSeen).getTime() / 1000)}:D>` : "Never",
							inline: true,
						},
						{
							name: "Last Detection:",
							value: lastSeen ? `<t:${Math.floor(new Date(lastSeen).getTime() / 1000)}:D>` : "Never",
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
					],
				};

				if (details?.websiteScreenshot) {
					embed.thumbnail = {
						url: details?.websiteScreenshot,
					};
				}

				embedButtons = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setLabel(`Google Safe Browsing`)
						.setStyle(ButtonStyle.Link)
						.setURL(`https://transparencyreport.google.com/safe-browsing/search?url=${encodeURIComponent(domain)}`)
				);

				if (details?.urlScanId) {
					embedButtons.addComponents(new ButtonBuilder().setLabel(`URL Scan`).setStyle(ButtonStyle.Link).setURL(`https://urlscan.io/result/${details?.urlScanId}/loading`));
				}
			}

			return { isKnownDomain, embed, embedButtons };
		} catch (error) {
			ErrorHandler("error", "GetDomainInfo", error);
		}
	}

	/**
	 * Submits a new report to Phisherman
	 */
	async submitPhishReport(phishReport: object): Promise<any> {
		const { status, data } = (await axiosPhisherman.post(`/trawler/report`, phishReport)) ?? {};

		return { status, data };
	}

	/**
	 * Builds the embed for the review message
	 */
	buildReviewMessageEmbed(report) {
		const { id, url, domain, target, comment, created, reportedBy, reported, reportedLast, urlscanId, reports, screenshotUrl } = report ?? {};

		const reviewEmbed = {
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
			image: urlscanId ? { url: `https://urlscan.io/screenshots/${urlscanId}.png` } : undefined,
			timestamp: new Date().toISOString(),
		};

		if (comment)
			reviewEmbed.fields.push({
				name: "Comment:",
				value: `\`\`\`${comment}\`\`\``,
				inline: false,
			});

		const reviewButtons = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setLabel("Suspicious").setCustomId("approve").setStyle(ButtonStyle.Success),
			new ButtonBuilder().setLabel("Malicious").setCustomId("approve_malicious").setStyle(ButtonStyle.Success),
			new ButtonBuilder().setLabel("Reject").setCustomId("reject").setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setLabel("Talos").setStyle(ButtonStyle.Link).setURL(`https://talosintelligence.com/reputation_center/lookup?search=${domain}#whois`),
			new ButtonBuilder()
				.setLabel(urlscanId ? `URLScan Result` : `URLScan Search`)
				.setStyle(ButtonStyle.Link)
				.setURL(urlscanId ? `https://urlscan.io/result/${urlscanId}/loading` : `https://urlscan.io/search/#domain%253A${domain}`)
		);

		return { reviewEmbed, reviewButtons };
	}

	/**
	 * Submits a new report to Phisherman
	 */
	async postReviewEmbed(interaction: ChatInputCommandInteraction, phishReport: PhishermanReportSubmissionResponseDomainInfo): Promise<any> {
		if (!interaction) throw ErrorHandler("error", "TRAWLER", "[postReviewEmbed] Missing Interaction Client");
		if (!PHISH_REVIEW_CHANNEL) throw ErrorHandler("error", "TRAWLER", "[postReviewEmbed] PHISH_REVIEW_CHANNEL Unset!");

		// Generate embed
		const { reviewEmbed, reviewButtons } = this.buildReviewMessageEmbed(phishReport) ?? {};

		const phishReviewChannel: TextChannel = interaction.client.channels.cache.get(PHISH_REVIEW_CHANNEL) as TextChannel;

		if (!phishReviewChannel) {
			interaction.editReply({ content: `${emojis.fail} Error: Unable to post review message` });
			throw ErrorHandler("error", "TRAWLER", "[postReviewEmbed] Unable to fetch phishReviewChannel from channel cache");
		}

		const message =
			(await phishReviewChannel.send({
				embeds: [reviewEmbed],
				components: [new ActionRowBuilder<ButtonBuilder>(reviewButtons)],
			})) ?? {};

		if (phishReport.id) {
			this.updateReport(phishReport.id, message) ?? {};
		} else {
			interaction.followUp({ content: `${emojis.alert} Unable to update database with review message ID` });
			ErrorHandler("warning", "TRAWLER", "[postReviewEmbed] Unable to update database with review message ID");
		}
	}

	/**
	 * Sets the review message details for the supplied report
	 */
	async updateReportEmbed(interaction: ChatInputCommandInteraction, report: PhishermanReportSubmissionResponseDomainInfo) {
		if (report.review_message) {
			const { channel: channelId, message: messageId } = report.review_message ?? {};

			const channel = interaction.client.channels.cache.get(channelId) as TextChannel;

			if (!channel) throw ErrorHandler("error", "TRAWLER", "[updateReportEmbed] Unable to fetch channel to update embed");

			const message = await channel.messages.fetch(messageId);

			if (!message) throw ErrorHandler("error", "TRAWLER", "[updateReportEmbed] Unable to fetch message to update embed");

			// Existing message was retrieved, so edit embed
			const embedBackup = message.embeds[0];
			let newEmbed = message.embeds[0];
			let components;

			// Missing embed, so build a new one
			if (!newEmbed) {
				const { reviewEmbed, reviewButtons } = this.buildReviewMessageEmbed(report);
				channel.send({
					embeds: [reviewEmbed],
					components: [new ActionRowBuilder<ButtonBuilder>(reviewButtons)],
				});
			} else {
				if (report?.reports) newEmbed.fields[2].value = report.reports.toString();
				if (report?.reported) newEmbed.fields[3].value = `<t:${Math.floor(new Date(report.reported).getTime() / 1000)}>`;
				if (report?.reportedLast) newEmbed.fields[4].value = `<t:${Math.floor(new Date(report.reportedLast).getTime() / 1000)}>`;
				if (report?.target) newEmbed.fields[5].value = report?.target ?? "Unknown";
				message.edit({ embeds: [newEmbed] });
			}
		} else {
			this.postReviewEmbed(interaction, report);
		}
	}

	/**
	 * Sets the review message details for the supplied report
	 */
	async updateReport(reportId: number | string, message: Message): Promise<object> {
		const payload = {
			id: reportId,
			review_message: { guild: message.guildId, channel: message.channelId, message: message.id },
		};
		const { status } = (await axiosPhisherman.put(`/trawler/report/${reportId}`, payload)) ?? {};

		const success = status === 200 ? true : false;

		return { success };
	}

	/**
	 * Rejects the specified report
	 */
	async rejectReport(interaction: ButtonInteraction, reportId: string) {
		const { status, data } = (await axiosPhisherman.delete(`/trawler/report/${reportId}`)) ?? {};

		if (status != 200) return interaction.followUp({ content: `${emojis.alert} Backend API Error` });

		if (interaction.deferred) {
			return interaction.message.edit({
				content: `${emojis.fail} \`${interaction.message.embeds[0].description}\` rejected by <@!${interaction.user.id}>`,
				embeds: [],
				components: [],
				allowedMentions: {
					parse: [],
				},
			});
		} else {
			return interaction.reply({ content: "Success" });
		}
	}

	/**
	 * Approves the specified report
	 */
	async approveReport(interaction: ButtonInteraction, reportId: string, classification: string) {
		const { status } = (await axiosPhisherman.post(`/trawler/report/${reportId}/approve`, { classification })) ?? {};

		if (status != 200) return interaction.followUp({ content: `${emojis.alert} Backend API Error` });

		if (interaction.deferred) {
			return interaction.message.edit({
				content: `${emojis.success} \`${interaction.message.embeds[0].description}\` approved (${classification}) by <@!${interaction.user.id}>`,
				embeds: [],
				components: [],
				allowedMentions: {
					parse: [],
				},
			});
		} else {
			return interaction.reply({ content: "Success" });
		}
	}
}

export { axiosPhisherman };
