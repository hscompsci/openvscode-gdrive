export const ROOT = "vscode";

export function exists(filename: string): boolean {
	try {
		Deno.statSync(filename);
		return true;
	} catch {
		return false;
	}
}
