export const ROOT = "vscode";

export async function exists(filename: string): Promise<boolean> {
	try {
		await Deno.stat(filename);
		return true;
	} catch {
		return false;
	}
}
