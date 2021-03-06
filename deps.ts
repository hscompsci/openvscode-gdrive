#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-run --check

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

import { ROOT, exists } from "./filesystem.ts";

Deno.chdir(dirname(Deno.mainModule));
if(await exists(ROOT)) {
	console.error(ROOT + "/ already exists!");
	console.error("If you want to replace it, delete it and rerun this script.");
	console.error("You might first need to run: $ chroot/unprotect " + ROOT);
	Deno.exit(1);
}

console.log("Downloading container management tools...")
if(!await exists("chroot/jail"))
	await Deno.run({cmd: ["git", "submodule", "update", "--init"]}).status();

console.log("Vendoring TypeScript dependencies...");
if(!await exists("vendor"))
	await Deno.run({cmd: ["deno", "vendor", "main.ts"]}).status();

const vscode = await releaseUrl("gitpod-io", "openvscode-server", "-linux-x64.tar.gz");
await download(vscode);
await unpack(basename(vscode), ["tar", "xf"]);

const rclone = await releaseUrl("rclone", "rclone", "-linux-amd64.zip");
await download(rclone);
await unpack(basename(rclone), ["unzip"]);

console.log("Preparing root directory for jails...");
Deno.renameSync(dropExtension(vscode), ROOT);
Deno.renameSync(dropExtension(rclone) + "/rclone", ROOT + "/bin/rclone");
Deno.linkSync("plugins/openvscode-drive", ROOT + "/bin/openvscode-drive");
Deno.remove(dropExtension(rclone), {recursive: true});

if(confirm("Enable support for GUI applications via VNC?")) {
	let tigervnc = await sourceForgeFileUrl("tigervnc", "tigervnc", ".x86_64.tar.gz");
	tigervnc = await download(tigervnc);
	await unpack(tigervnc, ["tar", "xf"]);
	Deno.renameSync(dropExtension(tigervnc) + "/usr/bin/Xvnc", ROOT + "/bin/Xvnc");
	Deno.remove(dropExtension(tigervnc), {recursive: true});

	let novnc = await releaseUrl("novnc", "novnc");
	novnc = await download(novnc, "noVNC");
	await unpack(novnc, ["tar", "xf"]);
	Deno.renameSync(dropExtension(novnc), ROOT + "/opt");

	let websockify = await releaseUrl("novnc", "websockify");
	websockify = await download(websockify, "websockify");
	await unpack(websockify, ["tar", "xf"]);
	Deno.renameSync(dropExtension(websockify), ROOT + "/opt/utils/websockify");

	await Deno.run({cmd: ["patch", ROOT + "/opt/vnc_lite.html", "vnc_lite.html.patch"]}).status();
	Deno.symlinkSync("../opt/utils/novnc_proxy", ROOT + "/bin/novnc_proxy");
}

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

async function sourceForgeFileUrl(org: string, repo: string, suffix: string): Promise<string> {
	const info = await promptVersion(org, repo);
	const listingUrl = info.body.match(/^https:\/\/.+/m);
	if(!listingUrl) {
		console.error("Unexpected error parsing latest " + repo + " release description!");
		Deno.exit(4);
	}

	const listing = await (await fetch(listingUrl[0])).text();
	const fileUrl = listing.match(new RegExp("https://[^\"]+" + suffix));
	if(!fileUrl) {
		console.error("Unexpected error parsing " + repo + " SourceForge files listing!");
		Deno.exit(5);
	}
	return fileUrl[0];
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
	return basename(url).replace(/\.[^0-9]+$/, "");
}

async function download(url: string, product?: string): Promise<string> {
	let filename = basename(url);
	if(product)
		filename = product + "-" + filename.slice(1);
	if(await exists(filename))
		console.warn("Skipping download of " + filename + " that already exists.");
	else {
		console.log("Downloading " + filename + "...");

		const body = await fetch(url);
		await Deno.writeFile(filename, new Uint8Array(await body.arrayBuffer()));
	}
	return filename;
}

async function unpack(filename: string, cmd: Readonly<string[]>): Promise<boolean> {
	if(await exists(dropExtension(filename)))
		return true;

	console.log("Unpacking " + filename + "...");
	return (await Deno.run({cmd: [...cmd, filename]}).status()).success;
}

type ReleaseInfo = {
	tag_name: string,
	body: string,
	assets: ReleaseAsset[],
};

type ReleaseAsset = {
	name: string,
	browser_download_url: string,
};
