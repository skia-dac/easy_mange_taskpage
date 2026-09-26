This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## MySky project rules

Read `docs/PLANNING.md` (plan, architecture, phases) and `docs/SECURITY.md` before changing code. The functional spec and architecture reference are summarized there.

- Scope: implement only MVP features. Anything in `docs/VERSION_2.md` is out of scope until explicitly scheduled.
- Architecture: domain code lives in `src/modules/{identity,academic,productivity,finance,platform}`. Import a module only through its `index.ts` (ESLint enforces it). Screens in `src/app/` stay thin: no business rules, no SQL.
- Colours: only in `src/shared/theme/colors.ts`. Never write a hex/rgb value elsewhere (ESLint enforces it). Use `useTheme().colors.<token>` or `AppText color="<token>"`.
- Texts: every user-visible string goes through i18n (`src/shared/i18n/locales/fr.json` and `en.json`, same keys — a test checks parity). French first.
- Local data first: every write goes to SQLite, then the sync outbox. Use parameterized SQL only. Tables use `SYNC_COLUMNS`. Never edit a published migration; append a new one.
- Errors: never show technical messages; map errors with `userMessageKey()`. Log only through `src/shared/logger.ts`, never personal data.
- Secrets: nothing secret in `EXPO_PUBLIC_*` or in the app bundle.
- Destructive actions always ask for confirmation. AI-extracted data is never saved without user validation.
- Before declaring a task done: `npm run check` must pass.
