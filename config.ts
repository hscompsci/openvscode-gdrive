// Copyright (C) 2022, Sol Boucher
//
// This file is part of OpenVSCode GDrive.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

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
