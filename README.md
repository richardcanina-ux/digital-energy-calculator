# Energiae: Digital Energy Calculator

A mobile-first website for the Energiae PBL project, **"The Hidden Energy Cost of the Digital World"** (IDH 2003 Honors Leadership Seminar, Miami Dade College North Campus).

Students scan a QR code, enter their digital habits, see an estimate of the electricity those habits use in a year (with CO₂ on Florida's grid and personal tips), and pledge to change one habit. Anonymous responses are collected with Netlify Forms for our final presentation.

Team: Richard Canina (Leader + Website Builder), Isaac Suarez (Co-leader + Presentation maker), Lucas Alvarado (Researcher + Outreach).

## Files

| File | What it does |
|---|---|
| `index.html` | The calculator: welcome → habits (5 short sections) → results → pledge → thank you, all on one page ("Start over" returns to the welcome screen) |
| `about.html` | Every formula, assumption and source behind the calculator |
| `privacy.html` | Privacy policy, written out in English and Spanish (both on the page; the language button picks one). Linked in every footer and on the pledge step |
| `why-it-matters.html` | The bigger picture (data centers, Florida's electricity) and what *The Story of More* and *Before the Flood* taught us. Linked from the calculator's header, welcome screen and footer |
| `styles.css` | All styling (mobile-first) |
| `app.js` | Formulas, results, tips, pledges, form submission; also fills numbers on `about.html` and `why-it-matters.html` |
| `data/coefficients.js` | **Every energy and emissions number**, each with its source, year, URL, range and confidence |
| `data/strings.js` | **Every piece of text**, in English (`en`) and Spanish (`es`) |
| `images/welcome-illustration.webp` | Welcome screen illustration (1000×667, transparent background, ~100 KB). If it's missing, the welcome screen simply shows without it |
| `images/og-image.jpg` | Link preview picture (1200×630) shown when someone sends the site address in a text, WhatsApp, iMessage, LinkedIn or Discord |

Plain HTML, CSS and JavaScript. No framework, no build step, no npm packages.

## Run it locally

A local web server is best, so the pages behave the way they will on Netlify. From this folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

(You can also double-click `index.html`, or use the VS Code "Live Server" extension.)

**Form submissions don't work locally.** Netlify Forms only exist on the deployed site. On `localhost` the app skips sending and shows the thank-you screen with a "Local preview: nothing was sent" note.

## Deploy (GitHub → Netlify)

1. Push this folder to a GitHub repository (this folder is the repository root).
2. In Netlify: **Add new project → Import an existing project → GitHub**, and pick the repository.
3. Build settings: leave **Build command** empty and set **Publish directory** to `.` (the repository root).
4. Deploy.
5. Turn on form detection: open **Forms** in your project and click **Enable form detection**, then **redeploy** (Deploys → Trigger deploy). Netlify only finds the form during a deploy.
6. Test on the live URL: complete the calculator once. The response should appear under **Forms → pledge-responses**.

**Free plan tip:** on Netlify's credit-based Free plan, form submissions are free, but each production deploy uses 15 of your 300 monthly credits. Every push to GitHub triggers a deploy, so push finished batches of changes, not every small edit.

## Export the responses

Netlify dashboard → your project → **Forms** → **pledge-responses** → **Download as CSV**.

**Before you analyze or share the CSV:** Netlify Forms automatically adds `ip`, `user_agent`, `referrer` and `created_at` columns to every submission (it can't be turned off). `ip` is personal information, so **delete the `ip`, `user_agent` and `referrer` columns** from your copy first. The privacy policy (`privacy.html`) promises this.

Each row is one completed calculator. Columns:

| Column | Meaning |
|---|---|
| `video_hours_phone`, `video_hours_laptop`, `video_hours_tv`, `video_hours_monitor`, `video_quality`, `music_hours`, `social_hours`, `gaming_hours`, `gaming_platform`, `study_hours`, `work_hours`, `browse_hours`, `calls_hours`, `ai_prompts`, `ai_images`, `cloud_gb`, `phones`, `laptops`, `tablets` | What the student entered (hours are per day). Video is entered per screen: hours on a phone or tablet, a laptop, a TV and a monitor (0 for a screen they don't watch on). `study_hours` is studying online (Pearson, e-books, class sites); `work_hours` is working online at a job or internship (starts at 0; work video calls go in `calls_hours`); `browse_hours` is browsing and searching (Google, library databases). `ai_prompts` includes Google AI summaries. Older rows: model `2026-09-v2` has one `video_screen` column instead of the four per-screen columns, and `2026-09-v1` has neither |
| `video_hours` | Total video hours a day on all screens (the four per-screen columns added up), so it compares directly with older rows |
| `kwh_total`, `co2_kg_total` | Yearly total kWh and kg CO₂ |
| `kwh_video` … `kwh_devices` | Yearly kWh per category. `kwh_study` is studying and browsing together; `kwh_work` is working online |
| `top_category` | Their biggest category (`none` if every habit was 0) |
| `expectation` | RQ5: `higher`, `about-right`, `lower` or `no-idea` compared to what they expected |
| `pledge`, `pledge_kwh_saved` | The habit they chose and its yearly kWh saving. `pledge` is `none` and `pledge_kwh_saved` is 0 when none of the pledges fit their habits (for example, only device charging) |
| `heard_from` | Where they heard about the calculator. Codes: `Tabling – North Campus`, `Professor – in class`, `Professor – email or course page`, `Department or chairperson`, `Honors College`, `INIT meeting`, `Other club` (any club or student organization), `Campus event or presentation`, `Flyer or poster`, `Classmate or friend`, `Text or group chat`, `LinkedIn`, `Instagram`, `Other social media`, `Web search`, `Other` |
| `heard_details` | Optional text, up to 100 characters, only offered after a professor, department, club or event answer (for example the class or event name). Empty for every other answer. The box asks people not to include their own name or contact details; if one does anyway, delete that submission in Netlify |
| `habits_changed` | How many of the 19 habit answers they changed from where the form starts (0 to 19). Ticking a screen for video counts as a change. **0 means they clicked straight through**, so their numbers are just the starting values: leave those rows out of the analysis. (Before their first results, anyone who hasn't changed anything sees a note asking "Are these really your habits?" and has to tap again to continue.) Empty in rows sent before this column was added |
| `model_version` | Which version of `coefficients.js` produced the numbers. `2026-09-v1` didn't count TVs, monitors, studying, working or browsing; `2026-09-v2` adds the TV or monitor for video, a TV for console gaming, a monitor for PC gaming, and studying, working and browsing online; `2026-10-v3` asks for video hours on each screen (people can pick several) and takes the "1 hour less video" pledge from each screen in proportion. Compare the groups carefully |
| `language` | `en` or `es`: the language they used |

No names, emails, student IDs or other personal information are collected. A hidden `bot-field` catches spam bots; Netlify drops submissions that fill it in.

Typed numbers (AI prompts, AI images, cloud GB, devices) must be whole numbers within their range before anyone can move on, so the CSV never has values like `-5` that the calculation didn't use.

## Other features worth knowing

- **Picks up where you left off.** Answers and the current step are kept in the browser tab (`sessionStorage`) while someone reads `about.html`, so "Back to the calculator" returns them to the same place. Nothing leaves the phone, and it's cleared by **Start over**, after sending, or when the tab closes.
- **Share image.** On the results screen, **Download image** (and **Share my card** on phones that support it) saves a 1080×1350 picture of the card. It includes the "Estimate" label, the model version, and the address of `about.html`. The address comes from the `og:url` tag in `index.html`.
- **Running total.** Only after someone taps **Edit my habits** on the results screen does a live "Your total now" line appear, so it can't influence the "Compared to what you expected" question (RQ5).
- **"If 1,000 students…"** The thank-you screen multiplies the pledge's saving by 1,000. That's a round "what if" number set in `app.js` (`COLLECTIVE_STUDENTS`), not a count of real students.
- **Link previews.** The `og:` tags in `index.html` and `about.html` use the full address `https://energiae-calculator.netlify.app/`. If the site address ever changes, update those tags (apps don't run JavaScript, so they need it written out).

## Feedback responses

Feedback is a **separate** Netlify form called `site-feedback`, so it never mixes with the research data above. It shows on the thank-you screen, and the **Give feedback** link in the footer opens it from any page.

Export it the same way: **Forms** → **site-feedback** → **Download as CSV**.

| Column | Meaning |
|---|---|
| `usefulness` | "How useful was this calculator?" from 1 (not useful) to 5 (very useful) |
| `comment` | Optional comment, up to 500 characters |
| `came_from` | `thank-you` if they finished the calculator first, `footer` if they used the footer link without finishing |
| `language` | `en` or `es`: the language they used |

The form asks people not to type their name or contact details. If a comment includes personal information anyway, delete that submission in Netlify.

Netlify limits: on the credit-based Free plan, form submissions are free and unlimited. On the older (legacy) Starter plan, the 100 submissions a month count **both** forms together.

## Languages (English and Spanish)

- Every piece of text lives in `data/strings.js`, once in `en` and once in `es`. To change wording, edit **both** languages and keep the keys the same.
- The site picks the language in this order: a `?lang=es` (or `?lang=en`) link, then the visitor's last choice (saved in their browser), then their phone's language. The **Español / English** button switches at any time.
- For a Spanish QR code, point it at your site address with `?lang=es` at the end, for example `https://your-site.netlify.app/?lang=es`.
- Saved answers are always the same codes in both languages (for example `heard_from` is always the English option), so the CSV never splits by language. Only the `language` column tells them apart.
- `about.html` has a Spanish header, footer and note; its main text is English for now.

## Changing a number

1. Edit the value **only** in `data/coefficients.js` and update its comment (source, year, URL, range, confidence).
2. Change `modelVersion` in the same file (for example `2026-09-v2`), so old and new responses can be told apart in the CSV.
3. `about.html` updates automatically, because it reads from the same file.

Values tagged `VERIFY` in `coefficients.js` are the ones we are least sure about.
