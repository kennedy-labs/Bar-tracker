# Backend-Driven Firestore Authentication & Specific Error Handling Plan

Migrate user authentication and business profiles from browser `localStorage` to Cloud Firestore as the authoritative single source of truth, eliminate multi-browser discrepancy, and provide specific credential validation error messages.

---

## 1. Problem Diagnosis & Findings

1. **Browser-Isolated Local Storage**:
   User accounts created in the Admin page (`StaffManager.tsx`) or during bar registration were previously saved solely in that browser’s `localStorage`. As a result, opening Edge or a second browser failed with "Invalid username or password" because the other browser had an isolated local storage copy.
2. **Ambiguous Error Feedback**:
   Failed authentication returned a single generic message (`"Invalid username/name or password/PIN"`), obscuring whether the username was misspelled or the password was incorrect.
3. **Session Re-Authentication on Logout**:
   Logging out needs to cleanly invalidate session persistence across browser reloads so credentials must be re-entered.

---

## 2. Proposed Architecture & Solution

### A. Cloud Firestore as Central Source of Truth for Users & Businesses
- **`users` Collection**:
  Every user (owners, bartenders, attendants) is stored as a document in Firestore (`users/{userId}`).
  - When `store.addUser()`, `store.updateUser()`, or `store.registerNewBusiness()` is invoked, the user document is immediately saved to Firestore.
  - All connected browsers (Chrome, Edge, mobile POS) sync user accounts in real time.
- **`businesses` Collection**:
  Every business profile is stored in Firestore (`businesses/{bizId}`).
- **Cross-Browser Parity**:
  Any account registered or modified in Chrome is instantly active and log-in ready in Edge, Safari, or any terminal.

### B. Specific Credential Error Handling
Upgrade authentication resolution to return explicit, actionable diagnostics:
1. **User Not Found**:
   If no account matches the entered username or name:
   `"Username or account not found. Please verify your username."`
2. **Incorrect Password / PIN**:
   If the user exists but the provided password/PIN fails verification:
   `"Incorrect password or PIN for this account. Please try again."`
3. **Success**:
   Returns the authenticated user and loads their active business context.

### C. Clean Logout Enforcement
- When logging out, completely purge `bartracker_session_user` and active session tokens.
- On page reload after logout, the system strictly remains on the login portal until valid credentials are submitted.

### D. Security Rules Update (`firestore.rules`)
- Add read/write rules for `users/{userId}` and `businesses/{bizId}` collections to allow persistent synchronization.

---

## 3. Execution Steps

1. **Update `src/services/firestoreSync.ts`**:
   - Add real-time listeners for `users` and `businesses` collections.
   - Implement `saveUserToFirestore(user)` and `saveBusinessToFirestore(business)`.
2. **Update `src/services/store.ts`**:
   - In `addUser()`, `updateUser()`, and `registerNewBusiness()`, persist the account directly to Firestore.
   - Refactor `authenticateUser()` to return `{ success, user, errorType, errorMessage }` distinguishing non-existent usernames from incorrect passwords.
   - Ensure `logout()` clears all session flags so credentials are required.
3. **Update `src/components/auth/AuthScreen.tsx`**:
   - Handle the specific error diagnostics and display the exact feedback to the user.
4. **Update `firestore.rules`**:
   - Grant access to `users` and `businesses` collections and deploy rules.
5. **Verification**:
   - Run `lint_applet` and `compile_applet`.
   - Test account creation and login across independent browser sessions.
   - Commit and push to GitHub (`main` & `master`).
