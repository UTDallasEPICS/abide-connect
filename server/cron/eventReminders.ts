import { defineCronHandler } from '#nuxt/cron'
import { sendDueEventReminders } from '#server/utils/eventReminders'

/**
 * Delivers the 24-hour and 1-hour event reminders (see
 * `server/utils/eventReminders.ts` for the schedule and dedup rules).
 *
 * Runs every 15 minutes: fine-grained enough that a "1 hour before" reminder
 * lands within a quarter hour of the mark, and well inside the slack the due
 * windows allow. `runOnInit: true` in nuxt.config.ts means it also fires on
 * boot, which is harmless — anything already sent is skipped.
 */
export default defineCronHandler(() => '*/15 * * * *', async () => {
  try {
    const { push, email } = await sendDueEventReminders()
    if (push > 0 || email > 0) {
      console.log(`[reminders] sent ${push} push notification(s) and ${email} email(s)`)
    }
  }
  catch (error) {
    // A throw here would surface as an unhandled rejection in the cron runner;
    // the next tick retries whatever wasn't claimed.
    console.error('[reminders] run failed', error)
  }
})
