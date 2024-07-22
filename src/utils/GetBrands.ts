import { PhishermanBrandList } from "./types";
import { axiosPhisherman } from "../modules/Phisherman";
import ErrorHandler from "./ErrorHandler";

let brandList;
const brandListStatic = [
	{
		id: "CRYPTO",
		name: "Generic: Crypto",
	},
	{
		id: "CSGO",
		name: "Counter-Strike",
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

/**
 * Returns the list of brands from the Phisherman API
 */
export function populateBrandList() {
	try {
		// Return if we already have a populated brand list
		if (brandList?.length) {
			if (process.env?.NODE_ENV === "development") console.log(`[GetBrands] ${brandList.length} brands returned from API`);
			return brandList;
		}

		return axiosPhisherman.get(`/v2/brands`).then(response => {
			const { data } = response ?? {};

			// Validate response from API
			const apiResponse = PhishermanBrandList.safeParse(data);
			if (!apiResponse.success) return brandListStatic;

			if (!data) return brandListStatic;

			if (process.env?.NODE_ENV === "development") console.log(`[GetBrands] ${data.length} brands returned from API`);

			// Cache the list
			brandList = data;

			return data;
		});
	} catch (error) {
		ErrorHandler("error", "GET BRANDS", error);
		return brandListStatic;
	}
}

export { brandList };
