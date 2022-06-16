import { decode } from "https://deno.land/std@0.136.0/encoding/base64.ts";

export function decodeId(id: string): Identification {
	return JSON.parse(new TextDecoder().decode(decode(id.split(".")[1])));
}

export type Identification = {
	email: string,
};
