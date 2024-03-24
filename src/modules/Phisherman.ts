import axios from "axios";
import ErrorHandler from "../utils/ErrorHandler";

// Create Axios instant
const axiosPhisherman = axios.create({
	baseURL: process.env.PHISHERMAN_API_URL,
	headers: {
		"Content-Type": "application/json",
		Authorization: `Bearer ${process.env.PHISHERMAN_API_KEY}`,
		"User-Agent": "Trawler (+https://phisherman.gg / 188032859276181504)",
	},
});

export default class Phisherman {
	async GetDomainInfo(domain: string) {
		try {
			const phishInfo = await axiosPhisherman
				.get(`/v2/domains/info/${domain}`)
				.then(res => res?.data ?? null)
				.catch(error => ErrorHandler("error", "PHISHERMAN API", error));

			if (!phishInfo) return null;
			const { created, verifiedPhish, classification, firstSeen, lastSeen, targetedBrand, phishCaught, details } =
				phishInfo[domain] ?? {};

			let embed: any;
			let message: any;

			if (/safe|suspicious|malicious/i.test(classification) === false) {
				embed = [
					{
						color: 11184810,
						description: "`" + domain + "` not known to Phisherman",
					},
				];
			} else if (classification === "safe") {
				embed = [
					{
						color: 5023065,
						description: "**Domain:** `" + domain + "`\n**Classification:** Safe",
					},
				];
			} else {
				embed = [
					{
						color: verifiedPhish ? 15157819 : verifiedPhish === false ? 16496712 : 11184810,
						fields: [
							{
								name: "Detections:",
								value: phishCaught ?? 0,
								inline: true,
							},
							{
								name: "Verified:",
								value: verifiedPhish
									? "<:verified:963911613654642708> Yes"
									: verifiedPhish === false
									? "<:not_verified:963909205239148558> No"
									: "Unknown",
								inline: true,
							},
							{
								name: "Classification:",
								value: verifiedPhish
									? "<:classification_malicious:963910982915227688> Malicious"
									: verifiedPhish === false
									? "<:classification_suspicious:963907967504232517> Suspicious"
									: "<:classification_unknown:923408156351168562> Unknown",
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
						],
					},
				];
			}

			return { embed, message };
		} catch (error) {
			ErrorHandler("error", "GetDomainInfo", error);
		}
	}
}
