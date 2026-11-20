import { defineTask } from 'nitro/task'
import { sendDueEventReminders } from '#server/utils/eventReminders'

/**
 * Delivers the 24-hour and 1-hour event reminders (see
 * `server/utils/eventReminders.ts` for the schedule and dedup rules).
 *
 * Runs every 15 minutes: fine-grained enough that a "1 hour before" reminder
 * lands within a quarter hour of the mark, and well inside the slack the due
 * windows allow. A small startup plugin also runs this once on boot, which is
 * harmless — anything already sent is skipped.
 */
export default defineTask({
  meta: {
    name: 'eventReminders',
    description: 'Send due event RSVP reminders',
  },
  async run() {
    try {
      const { push, email } = await sendDueEventReminders()
      if (push > 0 || email > 0) {
        console.log(`[reminders] sent ${push} push notification(s) and ${email} email(s)`)
      }
      return { result: { push, email } }
    }
    catch (error) {
      // A throw here would surface as an unhandled rejection in the scheduler;
      // the next tick retries whatever wasn't claimed.
      console.error('[reminders] run failed', error)
      return { result: { push: 0, email: 0 } }
    }
  },
})
