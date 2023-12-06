import * as Sentry from "@sentry/node";
import { SlashCommandBuilder } from "@discordjs/builders";
import isValidUrl from "is-valid-http-url";
import axios from "axios";

axios.defaults.headers.common["authorization"] = `Bearer ${process.env.PHISHERMAN_TOKEN}`; // for all requests

async function getScreenshot(url) {
	let data = { url: url };
	return axios
		.post(process.env.PHISHERMAN_SCREENSHOT_URL, data, {
			headers: {
				Accept: `application/json`,
				Authorization: `Bearer ${process.env.PHISHERMAN_SCREENSHOT_KEY}`,
			},
		})
		.then(res => res.data)
		.catch(err => {
			console.error(err);
			Sentry.captureException(err);
		});
}

export default {
	data: new SlashCommandBuilder()
		.setName("screenshot")
		.setDescription("Attempts to browse to and screenshot the provided URL")
		.addStringOption(option => option.setName("link").setDescription("The full url you wish to check. eg https://domain.com/page").setRequired(true)),

	async execute(interaction) {
		const url = interaction.options.getString("link");
		if (typeof url != "string") return interaction.reply({ content: "🚫 Invalid or malformed URL specified", ephemeral: true });
		if (!isValidUrl(url)) return interaction.reply({ content: "🚫 Invalid or malformed URL specified", ephemeral: true });

		// defer reply
		await interaction.deferReply();

		try {
			const screenshot = await getScreenshot(url).catch(err => {
				return interaction.editReply({ content: "🚫 There was an error while executing this command!", ephemeral: true });
			});

			const screenshotExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
			let screenshotEmbed = {
				title: "📷 Screenshot Request",
				color: 5814783,
				description: `**Requested URL:**\n\`\`\`${url}\`\`\``,
				footer: {
					text: `Screenshot Expires: ${screenshotExpiry}`,
					icon_url: interaction.user.displayAvatarURL({ dynamic: true }),
				},
			};

			let status = `<:http2xx:1140676689031073993> \`${screenshot.response.status}\``;
			if (/4\d\d/.test(screenshot.response.status)) status = `<:http4xx:1140676693510602982> \`${screenshot.response.status}\``;
			if (/5\d\d/.test(screenshot.response.status) || !screenshot) status = `<:http5xx:1140676692097122404> \`${screenshot.response.status ?? 500}\``;

			// Add screenshot, if we have it
			if (screenshot) {
				screenshotEmbed.image = { url: screenshot.url };

				if (screenshot.response.wasRedirect) {
					screenshotEmbed.description = `**Requested URL:**\n\`\`\`${url}\`\`\`\n**Final URL:**\`\`\`${screenshot.response.urls.taskUrl}\`\`\``;
				}

				screenshotEmbed.fields = [
					{
						name: "HTTP Status:",
						value: screenshot ? status : "Unknown",
						inline: true,
					},
					{
						name: "Redirected:",
						value: !screenshot ? "<:httpRedirect:1140705024343806104> Unknown" : screenshot.response.wasRedirect ? `<:httpRedirect:1140705024343806104> Yes` : `<:httpRedirect:1140705024343806104> No`,
						inline: true,
					},
				];
			}

			return interaction.editReply({ embeds: [screenshotEmbed] });
		} catch (err) {
			Sentry.captureException(err);
			return interaction.editReply({
				content: "There was an error while executing this command!",
				ephemeral: true,
			});
		}
	},
};
