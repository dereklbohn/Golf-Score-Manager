# Golf Score Manager Firebase setup

The app uses Firebase project `golf-score-3c0a6` through the Firebase JavaScript SDK.

## Console setup

1. Open https://console.firebase.google.com/project/golf-score-3c0a6/authentication/providers and enable **Email/Password**.
2. Open **Firestore Database** and create a **Cloud Firestore Standard edition database**, using the default database ID `(default)`, if it does not exist.
3. In Firestore's **Rules** tab, apply the rules in `firestore.rules`. If you already have rules for other collections, merge the `/users/{userId}` match into your existing rules instead of replacing them. These local rules have not been deployed automatically.
4. In **Project settings > General > Your apps**, verify that the web app configuration matches `screens/FirebaseConfig.ts`.

## Verify on a device

Run `npx.cmd expo start --clear` from PowerShell, then open the app on your device.

Create an account with an email you control. Confirm that the account appears in **Authentication > Users** and that **Firestore > users > the account UID** contains `displayName`, `email`, and `createdAt`. Close and reopen the app to check session persistence, then sign out and log in again.

The signup form creates a user profile. After login, the dashboard lets you name your team, add members, and record dated games with a total strokes score for each participating player. Blank scores mean the player did not participate. The dashboard shows two games, and More opens scrollable history, newest first, loading 20 games at a time. Dates use YYYY-MM-DD and are stored as calendar dates so time zones do not shift the day played.

## Team and game permissions

**Publish the updated `firestore.rules` in the Console before using these features.** Existing profile-only rules will reject team and game requests. Merge these rules with any unrelated existing collection rules.

Each login manages one private team stored at `teams/{uid}`, members at `teams/{uid}/members/{memberId}`, and games at `teams/{uid}/games/{gameId}`. Member names are roster entries, not separate login accounts or invitations. Game records keep the participating players' names and scores as they were when saved. Scorecard scans support recognition, editable review, roster matching, and confirmed game saving. See deployment steps below.

To verify: rename your team, add two players, record three games with different dates (including one entered out of order), and check that only the newest two appear on the dashboard. Open More to see all three in descending date order. Restart the app to confirm saved details persist. Check a second account to confirm it cannot see the first account's team.

If you see **Profile setup incomplete**, the login account already exists. Do not keep signing up with that email; check the Firestore configuration and rules, and use Log In for that account. The error includes the underlying Firebase message.

Common errors:

- `auth/operation-not-allowed`: enable Email/Password sign-in.
- `auth/email-already-in-use`: use Log In for the existing account.
- `auth/invalid-credential`: check the email and password.
- `permission-denied`: check that the Firestore rules permit the signed-in user to write their own `users/{uid}` profile.
- `auth/network-request-failed`: check the device's internet connection.

Reference: https://docs.expo.dev/guides/using-firebase/

## Deploy scorecard recognition

The camera and review UI are implemented locally. Automatic recognition requires deploying `functions/index.js` to this Firebase project. No API key belongs in the mobile app.

1. Enable billing for Cloud Functions and obtain a Gemini API key from Google AI Studio with access to `gemini-2.5-flash`.
2. From `functions`, run `npm install` (these are server dependencies, separate from Expo).
3. From the project root, run `npx.cmd firebase-tools login`, then `npx.cmd firebase-tools functions:secrets:set GEMINI_API_KEY --project golf-score-3c0a6`. Enter the key at the prompt.
4. Deploy with `npx.cmd firebase-tools deploy --only functions:scanScorecard --project golf-score-3c0a6`. Publish the existing Firestore rules if they are not already applied. The function uses us-central1, matching the client.
5. Rebuild the mobile app to apply the camera permission configuration, or test the camera in Expo Go on a physical device.

After login, select Scan a Scorecard, take a photo, and select Scan Names and Scores. The photo is sent to Google for recognition; it is not stored in Firestore or Cloud Storage. Review the photo alongside every extracted name, hole score, and gross total. Resolve partial rounds and net/gross confusion manually. Select an existing roster name to correct a name mismatch, remove unwanted rows, or add missed players. Confirm and save writes new roster members and the game in one batch. Game players contain `memberId`, `name`, `strokes`, and 18 nullable `holes` entries. Printed blank cards should return no players. Never infer the missing back nine from the first nine.

The authenticated function limits scans to one per 10 seconds and 50 per UTC day per account. Usage is kept in `scanUsage/{uid}`, with no client access under the supplied rules. Failed recognition also consumes a scan attempt. Review edits are kept while a save fails; leaving the review discards them. Saved games appear in Latest Games and Game History.

Device acceptance checks: completed handwritten card, blank card, rotated card, unclear names, incomplete nine-hole card, denied camera permission, offline recognition, and failed Firestore save. Confirm recognition creates no records until confirmation, roster matches reuse IDs, and cancel/retake creates no game. Recognition quality on the supplied reference photos still needs verification against a deployed function.
