import { google } from 'googleapis';
import { config } from '../config.js';

export function createGmailAuth() {
  const oauth2Client = new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
  );

  oauth2Client.setCredentials({
    refresh_token: config.gmail.refreshToken,
  });

  return oauth2Client;
}
