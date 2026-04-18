// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  vite: {
    optimizeDeps: {
      include: ['yjs', 'y-webrtc']
    }
  },
  // ... existing config
  nitro: {
    storage: {
      polls: {
        driver: 'fs',
        base: './.data/polls'
      },
      users: {
        driver: 'fs',
        base: './.data/users'
      }
    }
  }
})
