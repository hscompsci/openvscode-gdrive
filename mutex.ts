import { Deferred, deferred } from "https://deno.land/std@0.136.0/async/mod.ts";

export function mutex<T>(): Mutex<T> {
	const mutex: PrivateMutex<T> = {
		promise: deferred(),
		release: null,
		lock,
		unlock,
	};
	return mutex;
}

async function lock<T>(this: PrivateMutex<T>, id: T) {
	do
		this.promise.resolve(id);
	while(await this.promise != id);

	const promise: Deferred<T> = deferred();
	this.release = promise.resolve;
	promise.resolve = nop;
	this.promise = promise;
}

function unlock<T>(this: PrivateMutex<T>, id: T) {
	const release = this.release!;
	this.release = null;
	this.promise = deferred();
	release(id);
}

function nop() {}

export type Mutex<T> = {
	lock: (_: T) => Promise<void>,
	unlock: (_: T) => void,
};

type PrivateMutex<T> = Mutex<T> & {
	promise: Deferred<T>,
	release: ((_: T) => void) | null,
};
