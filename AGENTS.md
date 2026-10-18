# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Cloud Agent

- Use Node.js 20.19 or newer. Install dependencies with `npm ci`.
- This VM has no iOS simulator or Android SDK. Run the app on web: `npx expo start --web --lan --port 8081` (http://127.0.0.1:8081). `npm run web` starts the same server without those host flags.
- Live family data needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in a gitignored `.env`, copied from `.env.example`. Without them the shell still loads and public screens show a connection error.
- `npm run verify:news-expiry` and `npm run verify:push` read the sibling web repo and are not runnable from this checkout alone. The other `verify:*` scripts are.
