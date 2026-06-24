# ADSA Media & Computer Lab Portal — Setup Guide

ഈ starter project-ൽ ഉള്ളത്:

- Public tutorials section
- YouTube thumbnail auto display
- Public print upload and download
- Print files 24 hours കഴിഞ്ഞാൽ auto-delete ചെയ്യാനുള്ള Cloud Function
- Student works upload
- Admin approval gallery
- Workshop student login
- Workshop advanced materials
- Workshop assignment upload and feedback

## Files

1. `index.html` — website structure
2. `style.css` — full design
3. `app.js` — Firebase + upload + admin + workshop logic
4. `firebase-config.js` — നിങ്ങളുടെ Firebase config paste ചെയ്യേണ്ട file
5. `firestore.rules` — Firestore security rules
6. `storage.rules` — Storage security rules
7. `functions/index.js` — 24-hour cleanup function
8. `functions/package.json` — Cloud Function dependencies

---

## Step 1 — Firebase Project Create ചെയ്യുക

1. Firebase Console open ചെയ്യുക.
2. Add project.
3. Project name: `adsa-digital-hub` പോലൊന്ന്.
4. Web app add ചെയ്യുക.
5. Web app config copy ചെയ്യുക.
6. `firebase-config.js` file-ൽ paste ചെയ്യുക.

---

## Step 2 — Firebase Services Enable ചെയ്യുക

Firebase Console-ൽ:

1. Authentication > Sign-in method > Email/Password enable ചെയ്യുക.
2. Firestore Database create ചെയ്യുക.
3. Storage create ചെയ്യുക.

Important: Firebase Cloud Storage ഇപ്പോൾ Blaze/pay-as-you-go plan ആവശ്യപ്പെടാം. Billing alert set ചെയ്യുക.

---

## Step 3 — Security Rules Paste ചെയ്യുക

### Firestore Rules

Firebase Console > Firestore Database > Rules > `firestore.rules` ഉള്ള code paste > Publish.

### Storage Rules

Firebase Console > Storage > Rules > `storage.rules` ഉള്ള code paste > Publish.

---

## Step 4 — First Admin Create ചെയ്യുക

1. Firebase Console > Authentication > Users > Add user.
2. Admin email/password create ചെയ്യുക.
3. ആ user-ന്റെ UID copy ചെയ്യുക.
4. Firestore > `users` collection create ചെയ്യുക.
5. Document ID ആയി admin UID paste ചെയ്യുക.
6. Fields add ചെയ്യുക:

```text
name: ADSA Admin
role: admin
workshopAccess: false
workshopId: illustrator-2026
```

---

## Step 5 — Workshop Students Create ചെയ്യുക

Example student ID: `ADSA-IL-001`

Authentication user email ഇങ്ങനെ create ചെയ്യുക:

```text
adsa-il-001@adsa.workshop
```

Password: student-ന് കൊടുക്കേണ്ട password.

ശേഷം UID copy ചെയ്ത് Firestore > `users` collection-ൽ UID document create ചെയ്യുക:

```text
name: Student Name
role: workshopStudent
workshopAccess: true
workshopId: illustrator-2026
studentId: ADSA-IL-001
```

Website login form-ൽ student `ADSA-IL-001` + password മാത്രം type ചെയ്താൽ മതി.

---

## Step 6 — Website Run ചെയ്യുക

VS Code-ൽ folder open ചെയ്യുക.

Simple way:

1. VS Code extension: Live Server install ചെയ്യുക.
2. `index.html` right click > Open with Live Server.

---

## Step 7 — Admin Panel Use ചെയ്യുക

Website > Admin section:

- Admin email/password login.
- Common public tutorials add ചെയ്യാം.
- Workshop advanced tutorials add ചെയ്യാം.
- Workshop materials add ചെയ്യാം.
- Pending student works approve/reject ചെയ്യാം.
- Print files download/mark printed/delete ചെയ്യാം.
- Workshop submissions കാണാം, feedback add ചെയ്യാം.

---

## Step 8 — Auto Delete Function Deploy ചെയ്യുക

ഈ step ചെയ്യാൻ Firebase CLI വേണം.

```bash
npm install -g firebase-tools
firebase login
firebase init functions
```

Functions folder already ഈ project-ൽ ഉണ്ടെങ്കിൽ അതിലെ code use ചെയ്യുക.

Deploy:

```bash
firebase deploy --only functions
```

`cleanupPrintFiles` function every 60 minutes run ചെയ്ത് expired print files delete ചെയ്യും.

---

## Important Notes

- Public print upload/download intentionally login ഇല്ലാതെ open ആണ്.
- 1GB upload allowed ആണ്, പക്ഷേ bandwidth/storage cost ശ്രദ്ധിക്കണം.
- Production use ചെയ്യുമ്പോൾ Firebase billing budget alert set ചെയ്യുക.
- Print files sensitive ആണെങ്കിൽ public download ഒഴിവാക്കി admin-only download ആക്കുന്നത് safer ആണ്.
