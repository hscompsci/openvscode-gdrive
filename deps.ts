#!/usr/bin/env -S deno run --allow-net --allow-read=. --allow-write=. --allow-run --check

import { ROOT, exists } from "./filesystem.ts";

Deno.chdir(dirname(Deno.mainModule));
if(await exists(ROOT)) {
	console.error(ROOT + "/ already exists!");
	console.error("If you want to replace it, delete it and rerun this script.");
	console.error("You might first need to run: $ chroot/unprotect " + ROOT);
	Deno.exit(1);
}

const vscode = await releaseUrl("gitpod-io", "openvscode-server", "-linux-x64.tar.gz");
await download(vscode);
await unpack(basename(vscode), ["tar", "xf"]);

const rclone = await releaseUrl("rclone", "rclone", "-linux-amd64.zip");
await download(rclone);
await unpack(basename(rclone), ["unzip"]);

console.log("Vendoring TypeScript dependencies...");
if(!await exists("vendor"))
	await Deno.run({cmd: ["deno", "vendor", "main.ts"]}).status();

console.log("Downloading container management tools...")
if(!await exists("chroot/jail"))
	await Deno.run({cmd: ["git", "submodule", "update", "--init"]}).status();

console.log("Preparing root directory for jails...");
Deno.renameSync(dropExtension(vscode), ROOT);
Deno.renameSync(dropExtension(rclone) + "/rclone", ROOT + "/bin/rclone");
Deno.linkSync("plugins/openvscode-drive", ROOT + "/bin/openvscode-drive");
Deno.remove(dropExtension(rclone), {recursive: true});

console.log("All dependencies fetched!");

async function releaseUrl(org: string, repo: string, suffix?: string): Promise<string> {
	const info = await promptVersion(org, repo);
	if(suffix) {
		// Download binary release.
		const file = info.assets.find(function(each) {
			return each.name.endsWith(suffix);
		});
		if(!file) {
			console.error("Release " + info.tag_name + " of " + repo + " not available for Linux!");
			Deno.exit(3);
		}
		return file.browser_download_url;
	} else
		// Download source release.
		return "https://github.com/" + org + "/" + repo + "/archive/refs/tags/" + info.tag_name + ".tar.gz";
}

async function promptVersion(org: string, repo: string): Promise<ReleaseInfo> {
	let info = await releaseInfo(org, repo);
	const tag = info.tag_name.match(/([^0-9]+)(.+)/);
	if(!tag) {
		console.error("Unexpected error parsing latest " + repo + " tag name!");
		Deno.exit(2);
	}

	const version = prompt(repo + " version to download?", tag[2]);
	if(version != tag[2])
		info = await releaseInfo(org, repo, tag[1] + version);

	return info;
}

async function releaseInfo(org: string, repo: string, tag = ""): Promise<ReleaseInfo> {
	let release = "latest";
	if(tag)
		release = "tags/" + tag;

	const request = await fetch(
		"https://api.github.com/repos/" + org + "/" + repo + "/releases/" + release,
	);
	return request.json();
}

function dirname(url: string): string {
	const hierarchy = url.replace("file://", "").split("/");
	hierarchy.pop();
	return hierarchy.join("/");
}

function basename(url: string): string {
	return url.split("/").pop() ?? url;
}

function dropExtension(url: string): string {
	return basename(url).replace(/\.[^0-9].+/, "");
}

async function download(url: string) {
	const filename = basename(url);
	if(await exists(filename))
		console.warn("Skipping download of " + filename + " that already exists.");
	else {
		console.log("Downloading " + filename + "...");

		const body = await fetch(url);
		await Deno.writeFile(filename, new Uint8Array(await body.arrayBuffer()));
	}
}

async function unpack(filename: string, cmd: Readonly<string[]>): Promise<boolean> {
	if(await exists(dropExtension(filename)))
		return true;

	console.log("Unpacking " + filename + "...");
	return (await Deno.run({cmd: [...cmd, filename]}).status()).success;
}

type ReleaseInfo = {
	tag_name: string,
	assets: ReleaseAsset[],
};

type ReleaseAsset = {
	name: string,
	browser_download_url: string,
};
