import { exists } from "./filesystem.ts";
import { AuthCodeConfig, AuthTokenConfig } from "./oauth.ts";

const VALIDATE: Readonly<[string, ((_: unknown) => boolean)?][]> = [
	["client_id"],
	["client_secret"],
	["auth_uri"],
	["token_uri"],
	["redirect_uris", Array.isArray],
];

export function loadConfig(filename: string): Config | null {
	if(!exists(filename))
		return null;

	const contents = Deno.readTextFileSync(filename);
	const wrappedConfig: {web: Config & {[_: string]: string}} = JSON.parse(contents);
	if(!wrappedConfig.web)
		return null;

	const config = wrappedConfig.web;
	for(const [field, isA] of VALIDATE)
		if(!(isA ?? isString)(config[field]))
			return null;
	return config;
}

function isString(thing: Readonly<unknown>): boolean {
	return typeof thing == "string";
}

export type Config = AuthCodeConfig & AuthTokenConfig;
