# Energiae: Digital Energy Calculator

A mobile-first website for the Energiae PBL project, **"The Hidden Energy Cost of the Digital World"** (IDH 2003 Honors Leadership Seminar, Miami Dade College North Campus).

Students scan a QR code, enter their digital habits, see an estimate of the electricity those habits use in a year (with CO₂ on Florida's grid and personal tips), and pledge to change one habit. Anonymous responses are collected with Netlify Forms for our final presentation.

Team: Richard Canina Miranda (Leader + Website Builder), Isaac Suarez (Co-leader + Presentation maker), Lucas Alvarado (Researcher + Outreach).

## Files

| File | What it does |
|---|---|
| `index.html` | The calculator: welcome → habits → results → pledge → thank you, all on one page ("Start over" returns to the welcome screen) |
| `about.html` | Every formula, assumption and source, plus "Why this matters" |
| `styles.css` | All styling (mobile-first) |
| `app.js` | Formulas, results, tips, pledges, form submission; also fills numbers on `about.html` |
| `data/coefficients.js` | **Every energy and emissions number**, each with its source, year, URL, range and confidence |
| `data/strings.js` | **Every piece of text**, in English (`en`) and Spanish (`es`) |
| `images/welcome-illustration.webp` | Welcome screen illustration (1000×667, transparent background, ~100 KB). If it's missing, the welcome screen simply shows without it |

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

Each row is one completed calculator. Columns:

| Column | Meaning |
|---|---|
| `video_hours`, `video_quality`, `music_hours`, `social_hours`, `gaming_hours`, `gaming_platform`, `calls_hours`, `ai_prompts`, `ai_images`, `cloud_gb`, `phones`, `laptops`, `tablets` | What the student entered (hours are per day) |
| `kwh_total`, `co2_kg_total` | Yearly total kWh and kg CO₂ |
| `kwh_video` … `kwh_devices` | Yearly kWh per category |
| `top_category` | Their biggest category (`none` if every habit was 0) |
| `expectation` | RQ5: `higher`, `about-right`, `lower` or `no-idea` compared to what they expected |
| `pledge`, `pledge_kwh_saved` | The habit they chose and its yearly kWh saving. `pledge` is `none` and `pledge_kwh_saved` is 0 when none of the pledges fit their habits (for example, only device charging) |
| `heard_from` | Where they heard about the calculator |
| `model_version` | Which version of `coefficients.js` produced the numbers |
| `language` | `en` or `es`: the language they used |

No names, emails, student IDs or other personal information are collected. A hidden `bot-field` catches spam bots; Netlify drops submissions that fill it in.

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
