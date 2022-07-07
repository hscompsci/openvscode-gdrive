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
import { mutex } from "./mutex.ts";

export const BACKING_FILE = "refresh_tokens.json";

let tokens: {[_: string]: string} | null = null;
const lock = mutex();

export async function getToken(username: string): Promise<string | null> {
	if(!tokens)
		await loadOrInit(username);
	return tokens![username];
}

export async function setToken(username: string, token: string) {
	await lock.lock(username);
	if(!tokens)
		await loadOrInit();

	tokens![username] = token;

	await Deno.writeTextFile(BACKING_FILE, JSON.stringify(tokens));
	lock.unlock(username);
}

async function loadOrInit(takeLock?: string) {
	if(takeLock)
		await lock.lock(takeLock);

	if(await exists(BACKING_FILE))
		tokens = JSON.parse(await Deno.readTextFile(BACKING_FILE));
	else
		tokens = {};

	if(takeLock)
		lock.unlock(takeLock);
}
