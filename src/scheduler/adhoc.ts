import schedule from 'node-schedule';
import { DateTime } from 'luxon';
import { type Telegraf } from 'telegraf';
import { type Auth } from 'googleapis';
import { config } from '../config.js';
import { enableVacation } from '../gmail/vacation.js';

interface PendingJob {
  job: schedule.Job;
  description: string;
  time: Date;
}

let pendingJob: PendingJob | null = null;

export function scheduleOutAt(
  bot: Telegraf,
  time: DateTime,
  chatId: number,
  auth: Auth.OAuth2Client,
): void {
  // Cancel any existing pending job
  if (pendingJob) {
    pendingJob.job.cancel();
    pendingJob = null;
  }

  const jsDate = time.toJSDate();
  const description = `OOO enable at ${time.toFormat('HH:mm')}`;

  const job = schedule.scheduleJob(jsDate, async () => {
    try {
      await enableVacation(auth, {
        subject: config.messages.subject,
        message: config.messages.out,
      });
      await bot.telegram.sendMessage(
        chatId,
        `OOO is now active (scheduled from earlier). Auto-reply is on.`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await bot.telegram.sendMessage(
        chatId,
        `Failed to enable scheduled OOO: ${errMsg}`,
      );
    }
    pendingJob = null;
  });

  pendingJob = { job, description, time: jsDate };
}

export function cancelPendingSchedule(): { cancelled: boolean; description: string | null } {
  if (!pendingJob) {
    return { cancelled: false, description: null };
  }
  const { description } = pendingJob;
  pendingJob.job.cancel();
  pendingJob = null;
  return { cancelled: true, description };
}

export function getPendingSchedule(): {
  scheduled: boolean;
  description: string | null;
  time: Date | null;
} {
  if (!pendingJob) {
    return { scheduled: false, description: null, time: null };
  }
  return {
    scheduled: true,
    description: pendingJob.description,
    time: pendingJob.time,
  };
}
