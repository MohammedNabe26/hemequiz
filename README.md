# Hematology Quiz

An Android PWA with 591 MCQs built from the tables of 19 hematology chapters. It covers one chapter per day, uses spaced repetition (Leitner boxes), shows stats, sends optional hourly question notifications, and lets you view the original table after each answer.

## 1. Host the app (GitHub Pages)
1. Upload these files to the root of a public repo: `index.html`, `app.js`, `core.js`, `questions.js`, `style.css`, `sw.js`, `manifest.webmanifest`, and the 4 `.png` icons.
2. Go to **Settings → Pages → Deploy from a branch → main / (root) → Save**.
3. Open `https://<username>.github.io/<repo>/` in Chrome, then tap **⋮ → Add to Home screen**.

## 2. Table images (stay on your phone only)
The table images are **not** in this repo, because it is public and the tables are copyrighted.
In the app go to **Settings → Table images → Import tables file** and choose `hemequiz-tables.json`. You only need to do this once per phone.

## 3. Hourly notifications (optional)
1. Also upload `push/send.js`, `push/package.json` and `.github/workflows/hourly.yml` (keep the folder paths).
2. In the app, go to **Settings**, set your hours and tap **Save**. Then tap **1. Generate keys**, **2. Enable notifications** (Allow) and **3. Copy CONFIG**.
3. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret**, name it `HEMEQUIZ_CONFIG` and paste the CONFIG.
4. Go to **Actions → hourly-question → Run workflow** to send a test notification. GitHub may delay scheduled runs by 5–30 minutes.

## Notes
- Progress is stored in the browser on your phone. Clearing Chrome's site data erases it.
- To edit questions, change `data/*.js` and run `node build.js` to regenerate `questions.js`.
- About 70% of notification questions come from today's chapter and 30% from earlier chapters.

## Publishing an update
Bump `APP_VERSION` at the top of `app.js` **and** `"v"` in `version.json` to the same new value, and write a short `notes` line. Open apps will show an **Update available** banner within ~30 minutes, or the next time the app is opened.
