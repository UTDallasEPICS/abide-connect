import { definePlugin } from 'nitro'
import { runTask } from 'nitro/task'

/**
 * Preserve the old nuxt-cron `runOnInit` behavior while scheduled tasks are
 * handled by Nitro's built-in task runner.
 */
export default definePlugin(() => {
  if (process.env.NODE_ENV === 'prerender' || process.env.TEST) return

  void runTask('eventReminders').catch((error) => {
    console.error('[reminders] startup run failed', error)
  })
  void runTask('generateVolunteerLogs').catch((error) => {
    console.error('[volunteer-logs] startup run failed', error)
  })
})
