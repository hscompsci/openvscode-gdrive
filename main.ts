#!/usr/bin/env -S deno run --import-map vendor/import_map.json --allow-net --allow-read=. --allow-write=refresh_tokens.json --allow-run --check

import { deferred } from "https://deno.land/std@0.136.0/async/mod.ts";
import { decode, encode } from "https://deno.land/std@0.136.0/encoding/base64.ts";
import { Status, serve } from "https://deno.land/std@0.136.0/http/mod.ts";
import { BufReader } from "https://deno.land/std@0.136.0/io/mod.ts";
import { basename } from "https://deno.land/std@0.136.0/path/mod.ts";
import { TextProtoReader } from "https://deno.land/std@0.136.0/textproto/mod.ts";
import { ROOT, exists } from "./filesystem.ts";
import { loadConfig } from "./config.ts";
import { authUrl, obtainToken } from "./oauth.ts";
import { decodeId } from "./openid.ts";
import { BACKING_FILE, getToken, setToken } from "./refresh_tokens.ts";

const CONFIG_FILE = "config.json";
const SHUTDOWN_TIMEOUT_S = 90;

const emailToToken: {[_: string]: string} = {};
const tokenToEditor: {[_: string]: Editor} = {};

type Editor = {
	port: number,
	process: Deno.Process,
	refCount: number,
	shutdownHandle?: number,
	queryString?: string,
};

async function handler(request: Request): Promise<Response> {
	const url = new URL(request.url);

	let token = request.headers.get("Cookie")?.split(", ").find(function(each) {
		return each.startsWith("vscode-tkn=");
	})?.split("=")[1] ?? null;
	if(token && tokenToEditor[token]?.queryString) {
		url.search = tokenToEditor[token].queryString!;
		delete tokenToEditor[token].queryString;
		return Response.redirect(String(url));
	}
	if(!token)
		token = url.searchParams.get("tkn");
	if(token && Object.hasOwn(tokenToEditor, token))
		return proxy(request, token);

	if(url.pathname != "/") {
		url.pathname = "/";
		return Response.redirect(String(url));
	}

	const code = url.searchParams.get("code");
	if(!code)
		return Response.redirect(authUrl(
			config!,
			"https://www.googleapis.com/auth/drive",
			"select_account",
			true,
			encode(url.search),
		));

	const tokens = await obtainToken(config!, code);
	if(!tokens.success)
		return new Response(
			"OAuth error: " + tokens.error_description
				+ " (" + tokens.error + ")"
			,
			{status: Status.InternalServerError},
		);

	const expiry = new Date(Date.now() + tokens.expires_in * 1000);
	const email = decodeId(tokens.id_token).email;
	let newUser = "";
	if(tokens.refresh_token) {
		await setToken(email, tokens.refresh_token);
		newUser = " for the first time";
	} else {
		const stored = await getToken(email);
		if(!stored) {
			console.warn("User " + email + " missing from " + BACKING_FILE + "!");
			return new Response(
				"User is banned: " + email,
				{status: Status.Forbidden},
			);
		}
		tokens.refresh_token = stored;
	}
	console.log("User " + email + " logged in" + newUser);

	let vsCodeToken = emailToToken[email];
	if(vsCodeToken && Object.hasOwn(tokenToEditor, vsCodeToken))
		console.log(
			"Reusing user "
				+ email
				+ "'s existing VSCode instance at port "
				+ tokenToEditor[vsCodeToken].port
		);
	else {
		const process = Deno.run({
			cmd: ["chroot/jail", "vscode", "-c", "openvscode-drive", "--port", "0"],
			stdin: "piped",
			stdout: "piped",
		});
		const stdin = new TextEncoder();
		process.stdin.write(stdin.encode(tokens.access_token + "\n"));
		process.stdin.write(stdin.encode(tokens.refresh_token + "\n"));
		process.stdin.write(stdin.encode(expiry.toISOString() + "\n"));

		const {port, token} = await parsePortAndToken(process.stdout);
		tokenToEditor[token] = {
			port,
			process,
			refCount: 0,
		};
		emailToToken[email] = token;
		vsCodeToken = token;
		console.log("Started new VSCode instance for user " + email + " on port " + port);
	}

	const state = url.searchParams.get("state");
	if(state)
		tokenToEditor[vsCodeToken].queryString = new TextDecoder().decode(decode(state));
	url.search = "?tkn=" + vsCodeToken;
	return Response.redirect(String(url));
}

function proxy(request: Request, token: string): Promise<Response> {
	const editor = tokenToEditor[token];
	const url = new URL(request.url);
	url.hostname = "localhost";
	url.port = String(editor.port);

	if(request.headers.get("upgrade") != "websocket")
		return fetch(new Request(String(url), request), {redirect: "manual"});
	else
		url.protocol = "ws";

	const serverSocket = new WebSocket(String(url));
	const {response, socket} = Deno.upgradeWebSocket(request);
	const shutdown = function() {
		console.log("Shutting down port " + editor.port + " VSCode instance");
		delete tokenToEditor[token];
		editor.process.kill("SIGINT");
	};
	const decrRefCount = function() {
		--editor.refCount;
		if(editor.refCount == 0) {
			console.log("Last client closed for port " + editor.port + " VSCode instance");
			editor.shutdownHandle = setTimeout(shutdown, SHUTDOWN_TIMEOUT_S * 1000);
		}
	};
	const incrRefCount = function() {
		if(editor.refCount == 0 && editor.shutdownHandle) {
			console.log("Client reopened for port " + editor.port + " VSCode instance");
			clearTimeout(editor.shutdownHandle);
			delete editor.shutdownHandle;
		}
		++editor.refCount;
	};

	const serverBootstrap = deferred();
	serverSocket.onopen = function() {
		incrRefCount();
		serverBootstrap.resolve();
	};

	const bootstrap = deferred();
	socket.onopen = function() {
		incrRefCount();
		bootstrap.resolve();
	};

	serverSocket.onmessage = async function(message) {
		await bootstrap;
		socket.send(message.data);
	};
	socket.onmessage = async function(message) {
		await serverBootstrap;
		serverSocket.send(message.data);
	};

	serverSocket.onclose = function() {
		socket.onmessage = null;
		socket.close();
		decrRefCount();
	};
	socket.onclose = function() {
		serverSocket.onmessage = null;
		serverSocket.close();
		decrRefCount();
	};

	return Promise.resolve(response);
}

async function parsePortAndToken(stdout: Deno.Reader): Promise<{port: number, token: string}> {
	const lines = new TextProtoReader(new BufReader(stdout));
	let line;
	while(!(line = (await lines.readLine())?.match(
		/^Web UI available at http:\/\/localhost:([0-9]+)\/\?tkn=(.+)$/
	)));
	return {
		port: Number(line[1]),
		token: line[2],
	};
}

const address: Partial<Deno.ListenOptions> = {
	hostname: "localhost",
};
if(Deno.args.length > 2 || (Deno.args.length && Deno.args[0].startsWith("-"))) {
	console.log("USAGE: " + basename(import.meta.url) + " [hostname] [port]");
	console.log();
	console.log("[hostname] defaults to 'localhost' (loopback only)");
	console.log("[port] defaults to 8000");
	Deno.exit(1);
}
if(Deno.args.length >= 1)
	address.hostname = Deno.args[0];
if(Deno.args.length >= 2)
	address.port = Number(Deno.args[1]);
if(!exists(ROOT)) {
	console.error("Missing " + ROOT + "/ directory.  Did you run ./deps.ts?");
	Deno.exit(2);
}

const config = loadConfig(CONFIG_FILE);
if(!config) {
	console.error("Missing or malformed " + CONFIG_FILE + " file!");
	Deno.exit(3);
}
serve(handler, address);
console.log("Started Web server at http://" + address.hostname + ":" + (address.port ?? 8000));
