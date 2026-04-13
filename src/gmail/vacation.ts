import { google, type Auth } from 'googleapis';
import { config } from '../config.js';

export interface VacationStatus {
  enabled: boolean;
  subject: string | null;
  message: string | null;
  startTime: number | null;
  endTime: number | null;
}

export class GmailApiError extends Error {
  constructor(
    message: string,
    public readonly code: number | undefined,
    public readonly reason: string | undefined,
  ) {
    super(message);
    this.name = 'GmailApiError';
  }
}

function gmail(auth: Auth.OAuth2Client) {
  return google.gmail({ version: 'v1', auth });
}

function wrapError(err: unknown): never {
  if (err instanceof Error && 'code' in err) {
    const gaxiosErr = err as Error & { code: number; errors?: Array<{ reason: string }> };
    throw new GmailApiError(
      err.message,
      gaxiosErr.code,
      gaxiosErr.errors?.[0]?.reason,
    );
  }
  throw err;
}

export async function getVacationStatus(auth: Auth.OAuth2Client): Promise<VacationStatus> {
  try {
    const res = await gmail(auth).users.settings.getVacation({ userId: 'me' });
    const v = res.data;
    return {
      enabled: v.enableAutoReply ?? false,
      subject: v.responseSubject ?? null,
      message: v.responseBodyHtml ?? null,
      startTime: v.startTime ? Number(v.startTime) : null,
      endTime: v.endTime ? Number(v.endTime) : null,
    };
  } catch (err) {
    wrapError(err);
  }
}

export async function enableVacation(
  auth: Auth.OAuth2Client,
  options?: {
    subject?: string;
    message?: string;
    endTime?: Date;
  },
): Promise<VacationStatus> {
  const subject = options?.subject ?? config.messages.subject;
  const message = options?.message ?? config.messages.out;

  try {
    const res = await gmail(auth).users.settings.updateVacation({
      userId: 'me',
      requestBody: {
        enableAutoReply: true,
        responseSubject: subject,
        responseBodyHtml: message,
        restrictToContacts: false,
        restrictToDomain: false,
        ...(options?.endTime && {
          endTime: String(options.endTime.getTime()),
        }),
      },
    });
    const v = res.data;
    return {
      enabled: v.enableAutoReply ?? false,
      subject: v.responseSubject ?? null,
      message: v.responseBodyHtml ?? null,
      startTime: v.startTime ? Number(v.startTime) : null,
      endTime: v.endTime ? Number(v.endTime) : null,
    };
  } catch (err) {
    wrapError(err);
  }
}

export async function disableVacation(auth: Auth.OAuth2Client): Promise<VacationStatus> {
  try {
    const res = await gmail(auth).users.settings.updateVacation({
      userId: 'me',
      requestBody: {
        enableAutoReply: false,
      },
    });
    const v = res.data;
    return {
      enabled: v.enableAutoReply ?? false,
      subject: v.responseSubject ?? null,
      message: v.responseBodyHtml ?? null,
      startTime: v.startTime ? Number(v.startTime) : null,
      endTime: v.endTime ? Number(v.endTime) : null,
    };
  } catch (err) {
    wrapError(err);
  }
}
