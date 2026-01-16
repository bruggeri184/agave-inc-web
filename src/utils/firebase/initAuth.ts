import { init } from "next-firebase-auth";
import type { ConfigInput, CustomInitConfig } from "next-firebase-auth";
import { getPrivateKey } from "./getPrivateKey";

const TWELVE_DAYS_IN_MS = 12 * 60 * 60 * 24 * 1000;

// Module augmentation for custom InitConfig
declare module "next-firebase-auth" {
	interface CustomInitConfig extends ConfigInput {
		firebaseAdminInitConfig?: {
			credential: {
				projectId: string;
				clientEmail: string;
				privateKey: string;
			};
			databaseURL: string;
			storageBucket?: string; // storageBucket is now an optional string
		};
	}
}

const initConfig: CustomInitConfig = {
	// debug: true,
	authPageURL: "/log-in",
	appPageURL: "/",
	loginAPIEndpoint: "/api/log-in",
	logoutAPIEndpoint: "/api/log-out",
	onLoginRequestError: (err: unknown) => {
		console.error(err);
	},
	onLogoutRequestError: (err: unknown) => {
		console.error(err);
	},
	firebaseAdminInitConfig: {
		credential: {
			projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
			clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,

			privateKey: getPrivateKey(),
		},
		databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL as string,
		storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET as string,
	},
	firebaseClientInitConfig: {
		apiKey: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_API_KEY as string, // required
		authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
		databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
		projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
		storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
		messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
	},
	cookies: {
		name: "AgaveAuth", // required
		// Keys are required unless you set `signed` to `false`.
		// The keys cannot be accessible on the client side.
		keys: [process.env.COOKIE_SECRET_CURRENT, process.env.COOKIE_SECRET_PREVIOUS],
		httpOnly: true,
		maxAge: TWELVE_DAYS_IN_MS,
		overwrite: true,
		path: "/",
		sameSite: "Strict",
		secure: process.env.NEXT_PUBLIC_COOKIE_SECURE === "true", // set this to false in local (non-HTTPS) development
		signed: true,
	},
	onVerifyTokenError: (err: unknown) => {
		console.error(err);
	},
	onTokenRefreshError: (err: unknown) => {
		console.error(err);
	},
};

let hasInitialized = false;

const initAuth = () => {
	if (hasInitialized) return;

	// next-firebase-auth validates config during init(). When env vars are missing
	// (common in fresh dev setups or CI), we prefer a clear warning over a hard crash.
	const apiKey = process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_API_KEY;
	if (!apiKey) {
		console.warn(
			"next-firebase-auth not initialized: missing NEXT_PUBLIC_FIREBASE_PUBLIC_API_KEY. See .env.local.example."
		);
		return;
	}

	// If we're on the server and admin creds are missing, skip init to avoid runtime crashes.
	// API routes that depend on token verification will not work until these are provided.
	if (typeof window === "undefined") {
		const missingAdmin =
			!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
			!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
			!process.env.FIREBASE_CLIENT_EMAIL ||
			!process.env.FIREBASE_PRIVATE_KEY ||
			!process.env.COOKIE_SECRET_CURRENT ||
			!process.env.COOKIE_SECRET_PREVIOUS;

		if (missingAdmin) {
			console.warn(
				"next-firebase-auth not initialized on server: missing Firebase Admin / cookie env vars. See .env.local.example."
			);
			return;
		}
	}

	init(initConfig);
	hasInitialized = true;
};

export default initAuth;
