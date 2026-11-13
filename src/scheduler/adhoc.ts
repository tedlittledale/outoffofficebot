import schedule from 'node-schedule';
import { DateTime } from 'luxon';
import { type Telegraf } from 'telegraf';
import { type Auth } from 'googleapis';
import { config } from '../config.js';
import { enableVacation } from '../gmail/vacation.js';
import {
  isSlackConfigured,
  setSlackPresence,
  setSlackSnooze,
  setSlackStatus,
} from '../slack/status.js';

interface PendingJob {
  job: schedule.Job;
  description: string;
  time: Date;
}

let pendingJob: PendingJob | null = null;

// Runs `change` at `time` and sends its result to the chat. Only one change
// can be pending at once; scheduling another replaces it.
export function scheduleChange(
  bot: Telegraf,
  time: DateTime,
  chatId: number,
  description: string,
  change: () => Promise<string>,
): void {
  // Cancel any existing pending job
  if (pendingJob) {
    pendingJob.job.cancel();
    pendingJob = null;
  }

  const jsDate = time.toJSDate();
  const job = schedule.scheduleJob(jsDate, async () => {
    pendingJob = null;
    try {
      await bot.telegram.sendMessage(chatId, await change());
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await bot.telegram.sendMessage(chatId, `Failed: ${description}: ${errMsg}`);
    }
  });

  pendingJob = { job, description, time: jsDate };
}

export function scheduleOutAt(
  bot: Telegraf,
  time: DateTime,
  chatId: number,
  auth: Auth.OAuth2Client,
): void {
  scheduleChange(bot, time, chatId, `OOO enable at ${time.toFormat('HH:mm')}`, async () => {
    await enableVacation(auth, {
      subject: config.messages.subject,
      message: config.messages.out,
    });

    let slackSuffix = '';
    if (isSlackConfigured() && config.slack) {
      try {
        await setSlackStatus(config.slack.out.text, config.slack.out.emoji);
        await setSlackPresence('away');
        const now = DateTime.now().setZone(config.timezone);
        const minutes = Math.max(
          1,
          Math.ceil(now.endOf('day').diff(now, 'minutes').minutes),
        );
        await setSlackSnooze(minutes);
        slackSuffix = '\nSlack status updated.';
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        slackSuffix = `\n(Slack status update failed: ${errMsg})`;
      }
    }

    return `OOO is now active (scheduled from earlier). Auto-reply is on.${slackSuffix}`;
  });
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
