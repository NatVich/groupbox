# Firebase setup for GroupBox

GroupBox saves each player's progress in **Cloud Firestore**, grouped by a family code
(like `PEAR-4821`). Each device signs in **anonymously**, so nobody needs an account.

You already have a Firebase project. These steps finish the setup. They take about 5 minutes.

## 1. Add a web app and copy its config
1. Open the [Firebase console](https://console.firebase.google.com/) and pick the project.
2. Click the **⚙️ gear → Project settings**.
3. Under **Your apps**, click the **`</>` (Web)** icon. Name it `GroupBox` and click **Register app**.
   You don't need Firebase Hosting.
4. Copy the `firebaseConfig = { ... }` values into [`src/firebase-config.ts`](../src/firebase-config.ts).
   These values are public by design. Access is controlled by the security rules in step 4.

## 2. Turn on anonymous sign-in
1. Go to **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, choose **Anonymous**, switch it **on** and click **Save**.
3. On the **Settings** tab, open **Authorized domains** and click **Add domain**. Add `natvich.github.io`.

## 3. Create the database
1. Go to **Build → Firestore Database → Create database**.
2. Pick a location close to your family (it can't be changed later).
3. Start in **production mode**.

## 4. Publish the security rules
1. In **Firestore Database**, open the **Rules** tab.
2. Replace everything with the contents of [`firestore.rules`](../firestore.rules).
3. Click **Publish**.

## What the rules allow
- A device has to know a family's exact code to open it. Families can't be listed or searched.
- Inside a family, players can be added, updated and deleted, and their data is checked:
  name up to 20 characters, avatar 0–5, and number fields for stars and scores.
- Anyone who has a family's code can see and change that family's profiles. Share the code
  only with family.

## Without Firebase
While `apiKey` in `src/firebase-config.ts` is empty (or the build sets `VITE_STORAGE=local`),
the game saves profiles in the browser only. The Claude artifact version uses this mode,
because artifacts can't connect to outside servers.
