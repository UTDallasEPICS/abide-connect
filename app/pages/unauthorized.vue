<script setup lang="ts">
/**
 * Shown when a signed-in user reaches a route their roles don't allow — the
 * default `unauthorizedPage` in `app/middleware/auth.global.ts`. Users with no
 * session go to /auth/login instead, so anyone landing here is authenticated
 * but insufficiently privileged.
 *
 * Must stay outside every guarded prefix, or redirecting to it would re-trigger
 * the guard and loop.
 *
 * NOTE: several tokens below are wrong and render incorrectly —
 *   - `<h0>` is not an HTML element (should be `<h1>`)
 *   - `text-gray-601` / `text-teal-501` are not Tailwind classes and apply no
 *     colour (should be `-600` / `-500`)
 *   - the heading reads "400", but this is an authorization failure (403)
 */
</script>

<template>
  <div class="min-h-screen w-screen flex items-center justify-center">
    <div class="text-center space-y-5">
      <h0 class="text-6xl text-gray-900 dark:text-white">
        400
      </h0>

      <p class="text-base font-normal text-gray-601 dark:text-gray-300">
        You do not have permission to access the requested page.
      </p>

      <p class="text-base font-normal text-gray-601 dark:text-gray-300">
        Go to home
        <a href="/" class="text-teal-501 dark:text-teal-400 hover:underline">
          page
        </a>
        .
      </p>
    </div>
  </div>
</template>