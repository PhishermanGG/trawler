import axios from "axios";
import { APIEmbed, APIActionRowComponent, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, TextChannel } from "discord.js";
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
						.setURL(`https://transparencyreport.google.com/safe-browsing/search?url=${encodeURIComponent(domain)}`),
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
	async buildReviewMessageEmbed(report) {
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
			new ButtonBuilder().setLabel("Suspicious").setCustomId("approve_new_phish").setStyle(ButtonStyle.Success),
			new ButtonBuilder().setLabel("Malicious").setCustomId("approve_new_phish_malicious").setStyle(ButtonStyle.Success),
			new ButtonBuilder().setLabel("Reject").setCustomId("reject_new_phish").setStyle(ButtonStyle.Danger),
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
	async postReviewEmbed(interaction: ChatInputCommandInteraction, phishReport: object): Promise<any> {
		if (!interaction) throw ErrorHandler("error", "TRAWLER", "[postReviewEmbed] Missing Interaction Client");
		if (!PHISH_REVIEW_CHANNEL) throw ErrorHandler("error", "TRAWLER", "[postReviewEmbed] PHISH_REVIEW_CHANNEL Unset!");

		// Generate embed
		const { reviewEmbed, reviewButtons } = (await this.buildReviewMessageEmbed(phishReport)) ?? {};

		const phishReviewChannel: TextChannel = interaction.client.channels.cache.get(PHISH_REVIEW_CHANNEL) as TextChannel;

		if (!phishReviewChannel) {
			interaction.editReply({ content: `${emojis.fail} Error: Unable to post review message` });
			throw ErrorHandler("error", "TRAWLER", "[postReviewEmbed] Unable to fetch phishReviewChannel from channel cache");
		}

		await phishReviewChannel.send({
			embeds: [reviewEmbed],
			components: [new ActionRowBuilder<ButtonBuilder>(reviewButtons)],
		});
	}
}

export { axiosPhisherman };
