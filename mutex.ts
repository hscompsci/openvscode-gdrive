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
