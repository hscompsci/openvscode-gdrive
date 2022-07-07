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

// OAuth documentation: https://developers.google.com/identity/protocols/oauth2/web-server
// OpenID documentation: https://developers.google.com/identity/protocols/oauth2/openid-connect

export function authUrl(
	config: Readonly<AuthCodeConfig>,
	scope: string,
	prompt: AuthPrompt = "none",
	offline = false,
	state?: string,
): string {
	let accessType = "";
	if(offline)
		accessType = "&access_type=offline";
	if(state)
		accessType += "&state=" + state;
	return config.auth_uri
		+ "?response_type=code"
		+ "&client_id=" + config.client_id
		+ "&scope=email " + scope
		+ "&redirect_uri=" + config.redirect_uris[0]
		+ "&prompt=" + prompt
		+ accessType
	;
}

export async function obtainToken(
	config: Readonly<AuthTokenConfig>,
	authCode: string,
): Promise<AuthToken | AuthTokenError> {
	const {client_id, client_secret} = config;
	const request = new Request(config.token_uri, {
		method: "POST",
		body: new URLSearchParams({
			grant_type: "authorization_code",
			client_id,
			client_secret,
			code: authCode,
			redirect_uri: config.redirect_uris[0],
		}),
	});
	const response = await fetch(request);
	const payload = await response.json();
	payload.success = !payload.error;
	return payload;
}

export type AuthPrompt = "none" | "consent" | "select_account";

export type AuthCodeConfig = {
	client_id: string,
	auth_uri: string,
	redirect_uris: string[],
};

export type AuthTokenConfig = AuthCodeConfig & {
	client_id: string,
	client_secret: string,
	token_uri: string,
	redirect_uris: string[],
};

export type AuthToken = {
	success: true,
	id_token: string,
	scope: string,
	token_type: "Bearer",
	access_token: string,
	expires_in: number,
	refresh_token?: string,
};

export type AuthTokenError = {
	success: false,
	error: string,
	error_description: string,
};
