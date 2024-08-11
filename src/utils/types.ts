import { z } from "zod";
import { APIActionRowComponent, APIEmbed } from "discord.js";

export type PhishermanBrandListPayload = z.infer<typeof PhishermanBrandList>;
export const PhishermanBrandList = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
	})
);

export type PhishermanDomainInfoPayload = z.infer<typeof PhishermanDomainInfoEmbed>;
export const PhishermanDomainInfoEmbed = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
	})
);

export type PhishermanDomainInfoEmbed = {
	isKnownDomain?: Boolean;
	embed: APIEmbed;
	embedButtons?: any;
};

export type PhishermanReportSubmissionResponse = {
	isUrlShortner: Boolean;
	isProtectedDomain: Boolean;
	isReportedDomain: Boolean;
	isKnownDomain: Boolean;
	domainInfo?: PhishermanReportSubmissionResponseDomainInfo;
};

export type PhishermanReportSubmissionResponseDomainInfo = {
	id: number;
	url: string;
	domain: string;
	target: string;
	source: string;
	reports: number;
	reported: string;
	review_message: null;
	reportedBy: string;
	urlscanId: string;
	reportedLast: string;
	screenshotUrl?: string;
	comment?: string;
};
