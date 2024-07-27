const { NODE_ENV } = process.env ?? {};

const emojis = {
	verified: NODE_ENV === "development" ? "<:Verified:1264686799247118458>" : "<:Verified:1264353908705464321>",
	notVerified: NODE_ENV === "development" ? "<:not_verified:1264686790120444060>" : "<:not_verified:1264354080176996412>",
	httpRedirect: NODE_ENV === "development" ? "<:httpRedirect:1264686783791108189>" : "<:httpRedirect:1264353295489695836>",
	http5xx: NODE_ENV === "development" ? "<:http5xx:1264686777994842142>" : "<:http5xx:1264353288544063568>",
	http4xx: NODE_ENV === "development" ? "<:http4xx:1264686772538048593>" : "<:http4xx:1264353283032485951>",
	http2xx: NODE_ENV === "development" ? "<:http2xx:1264686766535868576>" : "<:http2xx:1264353276938158180>",
	fail: NODE_ENV === "development" ? "<:fail:1264686759414071297>" : "<:fail:1264353271217131531>",
   success: NODE_ENV === "development" ? "<:success:1266890916757766194>" : "<:success:1266890781734735923>",
	classificationUnknown: NODE_ENV === "development" ? "<:unknown:1264686751880843275>" : "<:unknown:1264353915114229850>",
	classificationSuspicious: NODE_ENV === "development" ? "<:suspicious:1264686745782583407>" : "<:suspicious:1264353265504485486>",
	classificationSafe: NODE_ENV === "development" ? "<:safe:1264686739038015660>" : "<:safe:1264353258894266420>",
	classificationMalicious: NODE_ENV === "development" ? "<:malicious:1264686732050170018>" : "<:malicious:1264353252867051570>",
	alert: NODE_ENV === "development" ? "<:alert:1264686722571309178>" : "<:alert:1264353243773800609>",
};

export default emojis;
