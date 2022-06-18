import { exists } from "./filesystem.ts";
import { mutex } from "./mutex.ts";

export const BACKING_FILE = "refresh_tokens.json";

let tokens: {[_: string]: string} | null = null;
let lock = mutex();

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
