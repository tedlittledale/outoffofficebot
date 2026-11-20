import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

export function createGmailAuth() {
  const oauth2Client = new OAuth2Client(
    config.gmail.clientId,
    config.gmail.clientSecret,
  );

  oauth2Client.setCredentials({
    refresh_token: config.gmail.refreshToken,
  });

  return oauth2Client;
}
