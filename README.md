## Agave Web Portal

Next.js app using Firebase (client + Admin SDK) and `next-firebase-auth`.

## Local development

### 1) Install dependencies

```bash
npm ci
```

### 2) Configure environment variables

- Copy `.env.local.example` to `.env.local`
- Fill in the values

Notes:
- `.env.local` is gitignored (do not commit secrets).
- Some pages/API routes require Firebase Admin credentials and cookie secrets.

### 3) Run the dev server

```bash
npm run dev
```

### 4) Production build

```bash
npm run build
npm start
```

## Required environment variables

At minimum, a build requires Firebase client configuration:
- `NEXT_PUBLIC_FIREBASE_PUBLIC_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_STORAGE_BUCKET`
- `NEXT_PUBLIC_MESSAGING_SENDER_ID`

For authenticated API routes / server-side token verification:
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `COOKIE_SECRET_CURRENT`
- `COOKIE_SECRET_PREVIOUS`
- `NEXT_PUBLIC_COOKIE_SECURE` (set `false` for local dev)

Additional integrations used in the UI/API:
- Google Maps: `NEXT_PUBLIC_MAPS_JS_API_KEY`, `NEXT_PUBLIC_MAPS_EMBED_API_KEY`
- GoFormz API routes: `GOFORMZ_LOGIN`, `GOFORMZ_PASS`
