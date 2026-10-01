/*
 * app.js — Energiae digital energy calculator
 *
 * Flow on index.html: welcome (step 0) → habits (step 1) → results (step 2) → pledge (step 3) → thank you.
 * about.html also loads this file to fill in numbers from coefficients.js.
 *
 * Every energy/emissions number comes from COEFFICIENTS (data/coefficients.js).
 * Every piece of text comes from STRINGS (data/strings.js), in English or Spanish.
 * This file only contains formulas and page logic.
 */

const C = COEFFICIENTS;
const DAYS_PER_YEAR = 365;
const HOURS_PER_DAY = 24;

// The 10 categories. Their names are in data/strings.js as "cat.<id>".
const CATEGORIES = ["video", "music", "social", "gaming", "study", "work", "calls", "ai", "cloud", "devices"].map((id) => ({ id }));

/* ================================================================== */
/* FORMULAS (the same ones listed on about.html)                        */
/* ================================================================== */

// 1 GB per hour = 8,000 megabits spread over 3,600 seconds.
function gbPerHourToMbps(gbPerHour) {
  return (gbPerHour * 8000) / 3600;
}

// Wh used by the network + data centers for ONE hour online (the power model).
function onlineWhPerHour(mbps) {
  const n = C.network;
  return n.accessAndCoreWattsPerUser + n.homeRouterWattsPerUser + n.extraWattsPerMbps * mbps + C.dataCenterWhPerHour;
}

// hours per day × 365 days × Wh per hour ÷ 1,000 = kWh per year
function yearlyKWh(hoursPerDay, whPerHour) {
  return (hoursPerDay * DAYS_PER_YEAR * whPerHour) / 1000;
}

// drive watts ÷ drive GB × hours in a year × copies × PUE ÷ 1,000 = kWh per GB per year
function cloudKWhPerGBYear() {
  const c = C.cloud;
  return (c.hddWatts / c.hddCapacityGB) * HOURS_PER_DAY * DAYS_PER_YEAR * c.copies * c.pue / 1000;
}

function kgCO2(kwh) {
  // lb per MWh → kg per kWh: × kg-per-lb ÷ 1,000
  return kwh * (C.floridaLbCO2ePerMWh * C.kgPerLb) / 1000;
}

function floridaHomeKWhPerDay() {
  return (C.comparisons.floridaHomeKWhPerMonth * 12) / DAYS_PER_YEAR;
}

// Average power: spreading a year's kWh evenly over every hour of the year.
// kWh × 1,000 ÷ 8,760 hours = watts, all day, every day.
function averageWatts(kwhPerYear) {
  return (kwhPerYear * 1000) / (HOURS_PER_DAY * DAYS_PER_YEAR);
}

// Wh for one hour of video: network + data centers, plus the TV or monitor if you watch on one.
function videoWhPerHour(quality, screen) {
  return onlineWhPerHour(gbPerHourToMbps(C.dataRates.videoGBPerHour[quality])) + C.screenWatts[screen];
}

// Wh for one hour of gaming: network, plus the console or PC, plus the screen it plays on.
function gamingWhPerHour(platform) {
  return onlineWhPerHour(C.dataRates.gamingMbps) + C.gamingDeviceWatts[platform] + C.screenWatts[C.gamingScreen[platform]];
}

// Takes the user's inputs and returns yearly kWh per category, the total, and CO2.
function calculate(i) {
  const r = C.dataRates;
  const kwh = {
    video: yearlyKWh(i.video_hours, videoWhPerHour(i.video_quality, i.video_screen)),
    music: yearlyKWh(i.music_hours, onlineWhPerHour(r.musicMbps)),
    social: yearlyKWh(i.social_hours, onlineWhPerHour(gbPerHourToMbps(r.socialGBPerHour))),
    gaming: yearlyKWh(i.gaming_hours, gamingWhPerHour(i.gaming_platform)),
    study: yearlyKWh(i.study_hours + i.browse_hours, onlineWhPerHour(r.browsingMbps)), // studying + browsing, same rate
    work: yearlyKWh(i.work_hours, onlineWhPerHour(r.browsingMbps)), // same rate as studying; video calls are counted in "calls"
    calls: yearlyKWh(i.calls_hours, onlineWhPerHour(r.callsMbps)),
    ai: ((i.ai_prompts * C.ai.textPromptWh + i.ai_images * C.ai.imageWh) * DAYS_PER_YEAR) / 1000,
    cloud: i.cloud_gb * cloudKWhPerGBYear(),
    devices:
      i.phones * C.devices.phoneKWhPerCharge * DAYS_PER_YEAR +
      i.laptops * C.devices.laptopKWhPerYear +
      i.tablets * C.devices.tabletKWhPerYear,
  };
  const total = Object.values(kwh).reduce((a, b) => a + b, 0);
  return { kwh, total, co2: kgCO2(total) };
}

/* ================================================================== */
/* PLEDGES: each one changes one input; savings = before − after        */
/* ================================================================== */

const minus = (value, amount) => Math.max(0, value - amount);

const PLEDGES = {
  video_less: (i) => ({ ...i, video_hours: minus(i.video_hours, 1) }),
  video_hd: (i) => (i.video_quality === "4K" ? { ...i, video_quality: "HD" } : i),
  music_less: (i) => ({ ...i, music_hours: minus(i.music_hours, 1) }),
  social_less: (i) => ({ ...i, social_hours: minus(i.social_hours, 1) }),
  gaming_less: (i) => ({ ...i, gaming_hours: minus(i.gaming_hours, 1) }),
  gaming_phone: (i) => ({ ...i, gaming_platform: "phone" }),
  calls_less: (i) => ({ ...i, calls_hours: minus(i.calls_hours, 0.5) }),
  ai_fewer: (i) => ({ ...i, ai_prompts: minus(i.ai_prompts, 5) }),
  ai_no_images: (i) => ({ ...i, ai_images: 0 }),
  cloud_half: (i) => ({ ...i, cloud_gb: i.cloud_gb / 2 }),
};

function pledgeSavings(inputs, pledgeId) {
  if (!PLEDGES[pledgeId]) return 0; // no pledge chosen, or none fits this person's habits
  return calculate(inputs).total - calculate(PLEDGES[pledgeId](inputs)).total;
}

/* ================================================================== */
/* TIPS: one per category; we show the user's top 3 categories          */
/* ================================================================== */

// The tip text is in data/strings.js as "tip.<category>". The AI tip includes a number from coefficients.js.
// Video gets a different tip when the TV or monitor uses more than the network and data centers.
function tipFor(category, inputs) {
  if (category === "video") {
    const screen = C.screenWatts[inputs.video_screen];
    const network = videoWhPerHour(inputs.video_quality, inputs.video_screen) - screen;
    if (screen > network) return t("tip.videoScreen");
  }
  const ratio = Math.round(C.ai.imageWh / C.ai.textPromptWh);
  return t(`tip.${category}`, { ratio });
}

/* ================================================================== */
/* FORMATTING                                                           */
/* ================================================================== */

function fmt(n, digits = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Small numbers get a decimal so they don't all show as "0".
function fmtKWh(n) {
  return n < 10 ? fmt(n, 1) : fmt(n);
}

// A tiny but real amount says "less than 0.1" instead of rounding to "0.0".
function fmtSmall(n) {
  return n > 0 && n < 0.05 ? t("small.lessThan") : fmtKWh(n);
}

/* ================================================================== */
/* LANGUAGE (English / Spanish) — all text lives in data/strings.js     */
/* ================================================================== */

const LANGUAGES = ["en", "es"];
const LANG_KEY = "energiae-lang"; // remembered in this browser only

// Order: a ?lang=es link (e.g. a Spanish QR code), then the saved choice, then the phone's language.
function pickLanguage() {
  const fromLink = new URLSearchParams(location.search).get("lang");
  if (LANGUAGES.includes(fromLink)) {
    saveLanguage(fromLink); // so the next page (about, Start over, reload) stays in this language
    return fromLink;
  }
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch (e) {
    // storage can be blocked (private mode); then we just don't remember the choice
  }
  return (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
}

function saveLanguage(value) {
  try {
    localStorage.setItem(LANG_KEY, value);
  } catch (e) {
    // not remembered, but the page still works
  }
}

let lang = pickLanguage();

// t("key") → the text in the current language. {name} placeholders are filled from vars.
function t(key, vars = {}) {
  const text = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
}

// Parts of the page that build text in JavaScript register here, so they redraw when the language changes.
const languageHooks = [];

function applyLanguage() {
  document.documentElement.lang = lang;
  document.title = t(document.body.dataset.titleKey || "doc.title");
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  document.querySelectorAll("[data-i18n-label]").forEach((el) => (el.label = t(el.dataset.i18nLabel))); // list group headings
  document.querySelectorAll("[data-show-lang]").forEach((el) => (el.hidden = el.dataset.showLang !== lang));
  const toggle = document.getElementById("lang-toggle");
  if (toggle) toggle.lang = lang === "en" ? "es" : "en"; // the button is written in the other language
  fillNumbers(); // numbers inside translated text (e.g. the welcome facts)
  languageHooks.forEach((hook) => hook());
  document.documentElement.classList.remove("i18n-pending"); // set by the small script in <head>
}

function setLanguage(next) {
  lang = next;
  saveLanguage(lang);
  // If the address has ?lang=, update it too, so reloading keeps the new choice.
  try {
    const url = new URL(location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", lang);
      history.replaceState(history.state, "", url);
    }
  } catch (e) {
    // some local file:// previews don't allow this; nothing else depends on it
  }
  applyLanguage();
}

// Checks one required choice (a group of radio buttons or a list). If it's missing, a short note appears
// right under the question, in the page's language, and the question scrolls into view.
// (The browser's own pop-up is easy to miss: it closes as the page scrolls, and some phones never show it.)
function checkChoice(field) {
  const box = field.closest("fieldset") || field.closest(".field");
  const inputs = box.querySelectorAll(`[name="${field.name}"]`);
  let note = box.querySelector(":scope > .choice-error");
  if (!note) {
    note = document.createElement("p");
    note.className = "field-error choice-error";
    note.id = `${field.name}-error`;
    note.hidden = true;
    const legend = box.querySelector(":scope > legend");
    if (legend) legend.after(note);
    else box.append(note);
    inputs.forEach((el) => el.setAttribute("aria-describedby", note.id));
    box.addEventListener("change", () => clearChoiceErrors(box)); // gone as soon as they choose
  }
  if (field.checkValidity()) return true;
  note.dataset.key = field.tagName === "SELECT" ? "valid.pickList" : "valid.pickOne"; // kept so it can be re-translated
  note.textContent = t(note.dataset.key);
  note.hidden = false;
  inputs.forEach((el) => el.setAttribute("aria-invalid", "true"));
  box.scrollIntoView({ block: "start" }); // scroll-padding keeps it clear of the sticky meter on the pledge step
  field.focus({ preventScroll: true });
  return false;
}

// Hides the "choose one" notes inside root (after choosing, and when a form is reset).
function clearChoiceErrors(root) {
  root.querySelectorAll(".choice-error").forEach((note) => {
    note.hidden = true;
    note.textContent = "";
  });
  root.querySelectorAll('[aria-invalid="true"]:not([type="number"])').forEach((el) => el.removeAttribute("aria-invalid"));
}

languageHooks.push(() => {
  document.querySelectorAll(".choice-error:not([hidden])").forEach((note) => (note.textContent = t(note.dataset.key)));
});

// Category icon from the icon set at the top of index.html.
function iconSvg(category) {
  return `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-${category}"></use></svg>`;
}

/* ================================================================== */
/* ANIMATION SETTINGS — visual only, NOT energy data                    */
/* ================================================================== */

// Timing of the results reveal (the CSS handles the digits and bars).
const REVEAL = {
  countUpDelayMs: 500, // CO2 and comparisons start counting while the digits roll
  countUpMs: 1000,
};

// Meter disk speed. A real meter disk turns far too slowly to see, so we speed it up:
// seconds per turn = wattSecondsPerTurn ÷ average watts (40 → 4 s per turn at 10 W); more watts = faster.
// It starts after startDelaySeconds and stops by maxMotionSeconds, so the results card never
// moves on its own for more than 5 s in total (WCAG 2.2.2).
const DISK = {
  wattSecondsPerTurn: 40,
  fastestSeconds: 0.8,
  slowestSeconds: 14,
  startDelaySeconds: 1.6,
  maxMotionSeconds: 5,
};

// The "what if" line on the thank-you screen multiplies one pledge by this round number.
// It is NOT a count of real students (display setting, not energy data).
const COLLECTIVE_STUDENTS = 1000;

/* ================================================================== */
/* SENDING TO NETLIFY (used by the calculator and the feedback form)    */
/* ================================================================== */

// On your own computer there is no Netlify, so nothing is sent.
function isLocalPreview() {
  return ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname) || location.protocol === "file:";
}

// Netlify Forms expects a URL-encoded POST to the site root, including the form-name field.
async function postToNetlify(formData) {
  if (isLocalPreview()) return;
  const response = await fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(formData).toString(),
  });
  if (!response.ok) throw new Error(`Server answered ${response.status}`);
}

/* ================================================================== */
/* FEEDBACK (a separate, anonymous Netlify form: "site-feedback")       */
/* ================================================================== */

// Returns { show, reset } on index.html, or null on pages without the feedback section.
const feedbackUI = (() => {
  const section = document.getElementById("feedback");
  if (!section) return null;
  const fbForm = document.getElementById("feedback-form");
  const comment = document.getElementById("feedback-comment");
  const count = document.getElementById("comment-count");
  const errorBox = document.getElementById("feedback-error");
  const submitBtn = document.getElementById("feedback-submit");
  const done = document.getElementById("feedback-thanks");

  function updateCount() {
    const left = comment.maxLength - comment.value.length;
    count.textContent = left === 1 ? t("fb.countOne") : t("fb.count", { n: left });
  }
  comment.addEventListener("input", updateCount);
  languageHooks.push(() => {
    updateCount();
    submitBtn.textContent = submitBtn.disabled ? t("fb.sending") : t("fb.send");
    if (!errorBox.hidden && errorBox.dataset.key) errorBox.textContent = t(errorBox.dataset.key);
  });

  // Shows the section; with focus = true it also scrolls to it (used by the footer link).
  function show({ focus = false } = {}) {
    section.hidden = false;
    if (focus) {
      section.scrollIntoView({ block: "start" });
      const heading = done.hidden ? "feedback-title" : "feedback-thanks-title";
      document.getElementById(heading).focus({ preventScroll: true });
    }
  }

  // A clean, hidden form for the next person (phones get passed around at tabling).
  function reset() {
    fbForm.reset();
    clearChoiceErrors(fbForm);
    updateCount();
    fbForm.hidden = false;
    done.hidden = true;
    errorBox.hidden = true;
    section.hidden = true;
  }

  fbForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    if (!checkChoice(fbForm.querySelector('input[name="usefulness"]'))) return;
    // Did they finish the calculator first? (Only the thank-you screen shows this section by itself.)
    const thanks = document.getElementById("step-thanks");
    fbForm.elements.came_from.value = thanks && !thanks.hidden ? "thank-you" : "footer";
    fbForm.elements.language.value = lang;

    submitBtn.disabled = true;
    submitBtn.textContent = t("fb.sending");
    try {
      await postToNetlify(new FormData(fbForm));
      fbForm.hidden = true;
      done.hidden = false;
      document.getElementById("feedback-preview-note").hidden = !isLocalPreview();
      document.getElementById("feedback-thanks-title").focus();
    } catch (err) {
      errorBox.dataset.key = "fb.failed"; // remembered so it can be re-translated
      errorBox.textContent = t("fb.failed");
      errorBox.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t("fb.send");
      if (!errorBox.hidden) errorBox.focus();
    }
  });

  // Footer link on this page, and arriving from about.html's footer link (index.html#feedback).
  document.getElementById("feedback-link").addEventListener("click", (event) => {
    event.preventDefault();
    show({ focus: true });
  });
  if (location.hash === "#feedback") {
    show(); // visible right away so the browser can jump to it
    // Move focus after loading finishes, or the browser's own page-load focus reset undoes it.
    window.addEventListener("load", () => show({ focus: true }), { once: true });
  }

  updateCount();
  return { show, reset };
})();

/* ================================================================== */
/* CALCULATOR PAGE                                                      */
/* ================================================================== */

const form = document.getElementById("calc-form");

if (form) {
  const steps = {
    welcome: document.getElementById("step-welcome"),
    habits: document.getElementById("step-habits"),
    results: document.getElementById("step-results"),
    pledge: document.getElementById("step-pledge"),
    thanks: document.getElementById("step-thanks"),
  };
  const progressBar = document.getElementById("progress");
  const progress = progressBar.querySelectorAll("li");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReducedMotion = () => motionQuery.matches; // re-checked each time, so a settings change applies right away
  let lastResult = null;

  /* ---------- reading inputs ---------- */

  function numberField(name) {
    const el = form.elements[name];
    const min = Number(el.min || 0);
    const max = Number(el.max || Infinity);
    const value = Number(el.value);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  }

  function readInputs() {
    return {
      video_hours: numberField("video_hours"),
      video_quality: form.elements.video_quality.value,
      video_screen: form.elements.video_screen.value,
      music_hours: numberField("music_hours"),
      social_hours: numberField("social_hours"),
      gaming_hours: numberField("gaming_hours"),
      gaming_platform: form.elements.gaming_platform.value,
      study_hours: numberField("study_hours"),
      work_hours: numberField("work_hours"),
      browse_hours: numberField("browse_hours"),
      calls_hours: numberField("calls_hours"),
      ai_prompts: numberField("ai_prompts"),
      ai_images: numberField("ai_images"),
      cloud_gb: numberField("cloud_gb"),
      phones: numberField("phones"),
      laptops: numberField("laptops"),
      tablets: numberField("tablets"),
    };
  }

  /* ---------- typed numbers: checked before moving on ---------- */

  // The typed boxes (AI prompts and images, cloud GB, devices). Sliders can't go out of range, but these can.
  const numberInputs = [...form.querySelectorAll('input[type="number"]')];

  // Each typed box gets an error line under it, empty until there's a problem.
  numberInputs.forEach((input) => {
    const error = document.createElement("p");
    error.className = "field-error";
    error.id = `${input.id}-error`;
    error.hidden = true;
    input.closest(".field").append(error);
    input.setAttribute("aria-describedby", error.id);
  });

  // Shows or clears one box's error. Empty, not a number, a decimal or out of range all count as a problem,
  // so we never quietly calculate (or send) a different number than the one on screen.
  function checkNumber(input) {
    const ok = input.value !== "" && input.checkValidity(); // checkValidity covers min, max and whole numbers (step="1")
    const error = document.getElementById(`${input.id}-error`);
    error.textContent = ok ? "" : t("valid.number", { min: fmt(Number(input.min)), max: fmt(Number(input.max)) });
    error.hidden = ok;
    if (ok) input.removeAttribute("aria-invalid");
    else input.setAttribute("aria-invalid", "true");
    return ok;
  }

  // Checks every typed box in these sections. On the first problem it opens that section and puts the cursor in the box.
  function sectionsAreValid(pages) {
    const bad = pages
      .flatMap((page) => [...page.querySelectorAll('input[type="number"]')])
      .filter((input) => !checkNumber(input)); // checks them all, so every problem shows at once
    if (!bad.length) return true;
    const k = habitPages.indexOf(bad[0].closest(".habit-page"));
    if (k !== habitPage) showHabitPage(k, { focus: false });
    bad[0].focus(); // scroll-padding keeps it above the pinned buttons
    return false;
  }

  // Messages appear only when moving forward (Next, a later dot, See my results). Showing them when the box
  // loses focus would push the buttons down in the middle of a tap, so the tap would miss.
  numberInputs.forEach((input) => {
    input.addEventListener("input", () => {
      if (input.hasAttribute("aria-invalid")) checkNumber(input); // the message goes away as soon as it's fixed
    });
  });

  /* ---------- running total, only while editing after seeing the results ---------- */

  // Hidden the first time through, so it can't spoil the reveal or the "Compared to what you expected" answer.
  const liveTotal = document.getElementById("habit-live");
  let editBaseline = null; // the total on the results card when they tapped "Edit my habits"; null = first time through

  function updateLiveTotal() {
    liveTotal.hidden = editBaseline === null;
    if (editBaseline === null) return;
    liveTotal.textContent = t("habits.live", { kwh: fmtKWh(calculate(readInputs()).total), was: fmtKWh(editBaseline) });
  }

  /* ---------- did they change anything? (to spot people who click straight through) ---------- */

  // The habits start filled in, so clicking straight through gives a real-looking total.
  // habits_changed (sent with the form) counts how many of the 17 habit answers differ from where they started;
  // 0 means they didn't change anything, so those rows can be left out of the analysis.
  const unchangedNote = document.getElementById("habit-unchanged");
  let unchangedWarned = false; // the gentle note shows once; tapping See my results again continues

  // The starting value from the HTML (not the current value), so a restored or edited form still compares correctly.
  function startValue(name) {
    const el = form.elements[name];
    if (el instanceof RadioNodeList) return [...el].find((radio) => radio.defaultChecked)?.value ?? "";
    return el.defaultValue;
  }

  function habitsChanged() {
    return HABIT_FIELDS.filter((name) => {
      const now = form.elements[name].value;
      const start = startValue(name);
      const same = now === start || (now !== "" && start !== "" && Number(now) === Number(start)); // "05" = "5"
      return !same;
    }).length;
  }

  function hideUnchangedNote() {
    unchangedNote.hidden = true;
  }

  /* ---------- keep answers while visiting about.html (this browser tab only) ---------- */

  // sessionStorage stays on this device, in this tab only, and is gone when the tab closes.
  // Only the answers are kept (nothing personal). "Start over" and sending clear it.
  const SAVE_KEY = "energiae-answers";
  const HABIT_FIELDS = ["video_hours", "video_quality", "video_screen", "music_hours", "social_hours", "gaming_hours", "gaming_platform",
    "study_hours", "work_hours", "browse_hours", "calls_hours", "ai_prompts", "ai_images", "cloud_gb", "phones", "laptops", "tablets"];
  const SAVED_FIELDS = [...HABIT_FIELDS, "expectation", "pledge", "heard_from", "heard_details"];

  function saveAnswers() {
    const step = Object.keys(steps).find((key) => !steps[key].hidden);
    try {
      if (step === "thanks") {
        sessionStorage.removeItem(SAVE_KEY); // finished: the next visit starts fresh
        return;
      }
      const values = Object.fromEntries(SAVED_FIELDS.map((name) => [name, form.elements[name].value]));
      sessionStorage.setItem(SAVE_KEY, JSON.stringify({ values, step, page: habitPage, baseline: editBaseline }));
    } catch (e) {
      // storage can be blocked (private mode); the calculator still works, it just can't pick up where it left off
    }
  }

  function clearAnswers() {
    try {
      sessionStorage.removeItem(SAVE_KEY);
    } catch (e) {
      // nothing was saved
    }
  }

  // Picks up where this tab left off, e.g. after reading about.html and tapping "Back to the calculator".
  // The Energiae logo links to index.html#home: answers come back, but the welcome screen shows.
  function restoreAnswers() {
    const goHome = location.hash === "#home";
    if (goHome) history.replaceState(history.state, "", location.pathname + location.search); // tidy the address
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(SAVE_KEY));
    } catch (e) {
      return;
    }
    if (!saved || !saved.values) return;
    SAVED_FIELDS.forEach((name) => {
      const value = saved.values[name];
      if (typeof value === "string" && value !== "") form.elements[name].value = value;
    });
    form.querySelectorAll('input[type="range"]').forEach(updateSlider);
    updateOverlapNote();
    updateHeardDetails();
    editBaseline = typeof saved.baseline === "number" ? saved.baseline : null;
    const step = !goHome && ["habits", "results", "pledge"].includes(saved.step) ? saved.step : "welcome";
    showHabitPage(step === "habits" ? Number(saved.page) || 0 : 0, { focus: false });
    updateLiveTotal();
    if (step === "results" || step === "pledge") renderResults();
    if (step === "pledge") renderPledges();
    if (step !== "welcome") showStep(step);
  }

  /* ---------- step 1 is split into 5 short sections ---------- */

  const habitPages = [...steps.habits.querySelectorAll(".habit-page")];
  const habitDots = [...document.querySelectorAll(".habit-dot")];
  const habitNext = document.getElementById("habit-next");
  const habitResults = document.getElementById("habit-results");
  let habitPage = 0; // 0 = first section

  const sectionName = (k) => habitPages[k].querySelector("legend").textContent;

  // Text that depends on the current section (also redrawn when the language changes).
  function updateHabitNav() {
    const total = habitPages.length;
    const last = habitPage === total - 1;
    habitNext.hidden = last;
    habitResults.hidden = !last; // "See my results" only on the last section
    if (!last) document.getElementById("habit-next-label").textContent = t("habits.nextTo", { section: sectionName(habitPage + 1) });
    document.getElementById("habit-count").textContent = t("habits.count", { n: habitPage + 1, total });
    habitDots.forEach((dot, k) => {
      dot.setAttribute("aria-label", t("habits.dotLabel", { section: sectionName(k), n: k + 1, total }));
      if (k === habitPage) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
  }

  // Shows one section. focus = true moves to the top and puts keyboard focus on the new section.
  function showHabitPage(k, { focus = true } = {}) {
    habitPage = Math.max(0, Math.min(habitPages.length - 1, k));
    habitPages.forEach((page, i) => (page.hidden = i !== habitPage));
    updateHabitNav();
    saveAnswers();
    if (focus) {
      window.scrollTo(0, 0);
      habitPages[habitPage].focus({ preventScroll: true }); // screen readers read the section's name
    }
  }

  // Going forward checks this section's typed numbers first; going back never does.
  habitNext.addEventListener("click", () => {
    if (sectionsAreValid([habitPages[habitPage]])) showHabitPage(habitPage + 1);
  });
  document.getElementById("habit-back").addEventListener("click", () => {
    if (habitPage === 0) showStep("welcome"); // Back from the first section returns to the welcome screen
    else showHabitPage(habitPage - 1);
  });
  habitDots.forEach((dot, k) =>
    dot.addEventListener("click", () => {
      if (k > habitPage && !sectionsAreValid([habitPages[habitPage]])) return;
      showHabitPage(k);
    })
  );

  /* ---------- step 1 controls: sliders and steppers ---------- */

  function updateSlider(slider) {
    const output = form.querySelector(`output[for="${slider.id}"]`);
    output.textContent = `${slider.value} ${t("unit.hPerDay")}`;
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty("--fill", `${pct}%`);
  }

  function updateOverlapNote() {
    const i = readInputs();
    const hours = i.video_hours + i.music_hours + i.social_hours + i.gaming_hours + i.study_hours + i.work_hours + i.browse_hours + i.calls_hours;
    document.getElementById("overlap-note").hidden = hours <= HOURS_PER_DAY;
  }

  form.querySelectorAll('input[type="range"]').forEach((slider) => {
    updateSlider(slider);
    slider.addEventListener("input", () => {
      updateSlider(slider);
      updateOverlapNote();
    });
  });

  form.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.stepFor);
      const next = Math.round(Number(input.value) || 0) + Number(btn.dataset.delta);
      input.value = Math.min(Number(input.max), Math.max(Number(input.min), next));
      input.dispatchEvent(new Event("input", { bubbles: true })); // clears an error, updates the running total, saves
    });
  });

  // Any change to an answer: update the running total and remember the answers for this tab.
  form.addEventListener("input", () => {
    updateLiveTotal();
    hideUnchangedNote(); // they're changing something, so the "nothing changed" note no longer fits
    saveAnswers();
  });
  form.addEventListener("change", saveAnswers);

  /* ---------- navigation between steps ---------- */

  function showStep(name) {
    Object.entries(steps).forEach(([key, section]) => (section.hidden = key !== name));
    progressBar.hidden = name === "welcome"; // the 1-2-3 steps start after "Find my digital footprint"
    progress.forEach((li) => {
      if (li.dataset.step === name) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0); // instant, so the results reveal plays fully in view
    const heading = steps[name].querySelector("h1, h2");
    if (heading) heading.focus({ preventScroll: true });
    if (name === "thanks" && feedbackUI) feedbackUI.show();
    saveAnswers();
  }

  // Checks the required fields inside one step; shows a note under the first question that's missing an answer.
  function stepIsValid(section) {
    const fields = section.querySelectorAll("input[required], select[required]");
    for (const field of fields) {
      if (!checkChoice(field)) return false;
    }
    return true;
  }

  // Buttons with data-go="step" move between steps (the welcome button is outside the form).
  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.go;
      if (target === "habits") {
        // "Edit my habits" (from the results) shows a running total; starting from the welcome screen doesn't.
        editBaseline = !steps.results.hidden && lastResult ? lastResult.result.total : null;
        showHabitPage(0, { focus: false });
        updateLiveTotal();
      }
      // "See my results": every typed number must be valid first.
      if (target === "results" && !steps.habits.hidden && !sectionsAreValid(habitPages)) return;
      // First time through with nothing changed: a gentle note first; tapping again continues.
      if (target === "results" && !steps.habits.hidden && editBaseline === null && !unchangedWarned && habitsChanged() === 0) {
        unchangedWarned = true;
        unchangedNote.textContent = t("habits.unchanged");
        unchangedNote.hidden = false;
        return;
      }
      if (target === "results") hideUnchangedNote();
      if (target === "results") {
        const unchanged = lastResult && JSON.stringify(readInputs()) === JSON.stringify(lastResult.inputs);
        if (unchanged) document.getElementById("result-card").classList.add("is-settled");
        else renderResults();
      }
      if (target === "pledge") {
        if (!stepIsValid(steps.results)) return;
        renderPledges();
      }
      showStep(target);
    });
  });

  /* ---------- meters (results card and pledge step) ---------- */

  const DIGIT_STRIP = "0123456789".split("").map((d) => `<span>${d}</span>`).join("");

  // Each digit box holds a 0–9 strip; moving the strip shows the right digit.
  // animate = false jumps straight to the value (no rolling).
  // decimals = 1 adds a tenths digit, like the red tenths wheel on a real meter.
  function setMeter(meter, value, animate, { decimals = 0, label = "" } = {}) {
    value = Math.max(0, value);
    const digits = String(Math.round(value * 10 ** decimals)).padStart(4 + decimals, "0").split("");
    meter.setAttribute("aria-label", label + t("meter.aria", { value: fmt(value, decimals) }));
    const layout = `${digits.length}.${decimals}`;
    if (meter.dataset.layout !== layout) {
      const box = (tenth) => `<span class="digit${tenth ? " digit-tenth" : ""}"><span class="digit-strip">${DIGIT_STRIP}</span></span>`;
      const whole = digits.slice(0, digits.length - decimals).map(() => box(false)).join("");
      const tenths = digits.slice(digits.length - decimals).map(() => box(true)).join("");
      meter.innerHTML = whole + (decimals ? `<span class="meter-point" aria-hidden="true">.</span>${tenths}` : "");
      meter.dataset.layout = layout;
    }
    const strips = meter.querySelectorAll(".digit-strip");
    const roll = () => strips.forEach((strip, k) => (strip.style.transform = `translateY(-${digits[k] * 10}%)`));

    if (!animate || prefersReducedMotion()) {
      meter.classList.add("no-anim"); // CSS turns transitions off while this class is on
      roll();
      void meter.offsetHeight; // apply the jump now, before transitions come back
      meter.classList.remove("no-anim");
    } else {
      // Wait two frames so the browser has drawn the starting position first.
      requestAnimationFrame(() => requestAnimationFrame(roll));
    }
  }

  // Counts a number up from 0 (used for CO2 and the comparisons).
  function countUp(el, to, digits, delayMs) {
    const run = (el.dataset.run = String(Number(el.dataset.run || 0) + 1)); // cancels older count-ups
    if (prefersReducedMotion()) {
      el.textContent = fmt(to, digits);
      return;
    }
    el.textContent = fmt(0, digits);
    let start = null;
    const tick = (now) => {
      if (el.dataset.run !== run) return;
      if (start === null) start = now + delayMs;
      const t = Math.min(1, Math.max(0, (now - start) / REVEAL.countUpMs));
      el.textContent = fmt(to * (1 - Math.pow(1 - t, 3)), digits); // ease-out
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // Safety net: if the browser pauses animation frames (e.g. a background tab), still show the final number.
    setTimeout(() => {
      if (el.dataset.run === run) el.textContent = fmt(to, digits);
    }, delayMs + REVEAL.countUpMs + 100);
  }

  /* ---------- step 2: results ---------- */

  function renderBars(kwh) {
    const sorted = CATEGORIES.map((c) => ({ ...c, value: kwh[c.id] })).sort((a, b) => b.value - a.value);
    const max = Math.max(...sorted.map((c) => c.value), 0.0001);
    document.getElementById("bars").innerHTML = sorted
      .map(
        (c, k) => `<li style="--i:${k}">
          <span class="bar-label">${iconSvg(c.id)}${t(`cat.${c.id}`)}</span>
          <span class="bar-value">${fmtSmall(c.value)}</span>
          <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${(c.value / max) * 100}%"></span></span>
        </li>`
      )
      .join("");
    return sorted;
  }

  // The meter disk spins faster when your average power is higher, then stops after a few seconds.
  function setDisk(totalKWh) {
    const watts = averageWatts(totalKWh);
    const shown = fmt(watts, watts < 10 ? 1 : 0);
    document.getElementById("avg-watts").textContent = shown;
    document.getElementById("avg-watts-sr").textContent = t("disk.sr", { watts: shown });

    const seconds = watts > 0 ? DISK.wattSecondsPerTurn / watts : DISK.slowestSeconds;
    const clamped = Math.min(DISK.slowestSeconds, Math.max(DISK.fastestSeconds, seconds));
    const spinSeconds = DISK.maxMotionSeconds - DISK.startDelaySeconds;
    const turns = Math.floor((spinSeconds / clamped) * 1000) / 1000; // as many turns as fit before the 5 s mark
    const card = document.getElementById("result-card");
    card.style.setProperty("--disk-delay", `${DISK.startDelaySeconds}s`);
    card.style.setProperty("--disk-seconds", `${clamped}s`);
    card.style.setProperty("--disk-turns", String(turns));
    card.classList.toggle("disk-still", Number(shown) === 0); // the caption says 0 W, so don't spin
  }

  // Tips for the biggest categories (up to 3). `sorted` comes from renderBars.
  function renderTips(sorted) {
    const top = sorted.filter((c) => c.value > 0).slice(0, 3);
    document.getElementById("tips-list").innerHTML = top
      .map((c) => `<li><strong>${iconSvg(c.id)}${t(`cat.${c.id}`)}</strong> <span class="tip-kwh">${t("tips.kwh", { kwh: fmtSmall(c.value) })}</span><p>${tipFor(c.id, lastResult.inputs)}</p></li>`)
      .join("");
    // With every habit at zero there is nothing to cut, so hide the tips instead of showing an empty list.
    document.getElementById("tips").hidden = top.length === 0;
    document.getElementById("tips-title").textContent = top.length === 3 ? t("tips.top3") : t("tips.some");
  }

  function renderResults() {
    const inputs = readInputs();
    const result = calculate(inputs);
    lastResult = { inputs, result };

    // Reset the card, fill it in, then play the reveal: digits roll → numbers count up → bars grow → disk spins.
    const card = document.getElementById("result-card");
    card.classList.remove("is-revealed", "is-settled");
    const meter = document.getElementById("meter");
    setMeter(meter, 0, false);

    setDisk(result.total);
    renderTips(renderBars(result.kwh));

    setMeter(meter, result.total, true);
    countUp(document.getElementById("co2-kg"), result.co2, 0, REVEAL.countUpDelayMs);
    countUp(document.getElementById("phone-charges"), result.total / C.comparisons.phoneChargeKWh, 0, REVEAL.countUpDelayMs);
    countUp(document.getElementById("home-days"), result.total / floridaHomeKWhPerDay(), 1, REVEAL.countUpDelayMs);
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("is-revealed")));
    prepareShareImage();
  }

  // Florida's power mix strip on the results card (numbers from coefficients.js).
  function renderGridMix() {
    const mix = C.context.floridaMixPct;
    const others = ["nuclear", "solar", "coal", "other"];
    const year = C.context.floridaMixYear;
    // Two segments that match the words: natural gas, and everything else.
    document.getElementById("mix-bar").innerHTML =
      `<span class="mix-gas" style="flex-grow:${mix.gas}"></span><span class="mix-rest" style="flex-grow:${100 - mix.gas}"></span>`;
    // Short on purpose so it fits on one line of the card; screen readers also hear the full mix (it is on about.html too).
    const rest = others.map((key) => `${fmt(mix[key])}% ${t(`mix.${key}`)}`).join(", ");
    document.getElementById("mix-label").innerHTML =
      `<span class="mix-key" aria-hidden="true"></span>${t("mix.label", { year, pct: fmt(mix.gas) })}` +
      `<span class="visually-hidden">, ${rest}</span>`;
  }

  /* ---------- share image: the results card drawn on a canvas (no libraries) ---------- */

  const shareActions = document.getElementById("share-actions");
  const shareBtn = document.getElementById("share-btn");
  const screenshotHint = document.getElementById("screenshot-hint");
  let shareFile = null; // made ahead of time: phones only allow sharing right after a tap, with no waiting
  let shareRun = 0;

  // Can this browser send an image to the phone's share sheet? If not, only "Download image" shows.
  const canShareFiles = (() => {
    try {
      return !!navigator.canShare && navigator.canShare({ files: [new File([""], "test.png", { type: "image/png" })] });
    } catch (e) {
      return false;
    }
  })();
  shareBtn.hidden = !canShareFiles;

  // The official site address comes from the og:url tag in index.html, so shared images always point to the
  // live site (not a local preview or a Netlify test link). siteAddress drops the "https://" for printing.
  const siteUrl = (path) => new URL(path, document.querySelector('meta[property="og:url"]')?.content || location.href).href;
  const siteAddress = (path) => siteUrl(path).replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Draws the card as a 1080 × 1350 image (4:5 portrait: fits a phone screen and an Instagram post).
  // Same numbers and wording as the card on screen, plus the estimate label, model version and methods address.
  function drawShareCard({ result }) {
    const W = 1080;
    const H = 1350;
    const pad = 72;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const cssVar = (name) => css.getPropertyValue(name).trim();
    const display = cssVar("--font-display");
    const body = cssVar("--font-body");
    const [white, volt, deep, ink, mist] = ["--white", "--volt", "--grid-deep", "--ink", "--mist"].map(cssVar);
    const soft = "rgba(255, 255, 255, 0.85)";

    // Writes one line of text, shrinking it if it would be wider than maxWidth. Returns its width.
    function text(str, x, y, { size, weight = 400, family = body, fill = white, align = "left", maxWidth = W - 2 * pad }) {
      ctx.fontStretch = family === display ? "condensed" : "normal";
      for (let s = size; s >= 12; s--) {
        ctx.font = `${weight} ${s}px ${family}`;
        if (ctx.measureText(str).width <= maxWidth) break;
      }
      ctx.fillStyle = fill;
      ctx.textAlign = align;
      ctx.fillText(str, x, y);
      return ctx.measureText(str).width;
    }
    function roundBox(x, y, w, h, r) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    }
    function fillBox(x, y, w, h, r, fill) {
      roundBox(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
    }
    function circle(x, y, r, fill) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    }

    ctx.fillStyle = cssVar("--grid");
    ctx.fillRect(0, 0, W, H);

    // Brand and the "ESTIMATE" label
    ctx.save();
    ctx.translate(pad, 78);
    ctx.scale(1.5, 1.5);
    ctx.fillStyle = volt;
    ctx.fill(new Path2D("M18 4 8 18h7l-2 10 11-15h-7z"));
    ctx.restore();
    text("Energiae", pad + 54, 118, { size: 46, weight: 700, family: display, fill: volt });
    const estimate = t("share.estimate");
    ctx.font = `700 26px ${body}`;
    const chipW = ctx.measureText(estimate).width + 44;
    roundBox(W - pad - chipW, 82, chipW, 46, 23);
    ctx.lineWidth = 3;
    ctx.strokeStyle = volt;
    ctx.stroke();
    text(estimate, W - pad - chipW / 2, 114, { size: 26, weight: 700, fill: volt, align: "center" });

    text(t("results.title"), pad, 218, { size: 76, weight: 700, family: display });

    // Meter digits, like the card
    const digits = String(Math.round(result.total)).padStart(4, "0").split("");
    const gap = 14;
    const bw = Math.min(124, (W - 2 * pad - 200 - gap * (digits.length - 1)) / digits.length);
    const bh = bw * 1.4;
    const top = 262;
    digits.forEach((d, k) => {
      const x = pad + k * (bw + gap);
      fillBox(x, top, bw, bh, 14, deep);
      text(d, x + bw / 2, top + bh * 0.77, { size: Math.round(bw * 1.25), weight: 700, family: display, fill: volt, align: "center" });
    });

    // Meter disk and average watts, like the card
    const cx = W - pad - 80;
    const cy = top + bh / 2 - 16;
    circle(cx, cy, 64, deep);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.stroke();
    circle(cx, cy, 49, mist);
    fillBox(cx - 9, cy - 43, 18, 13, 3, ink);
    circle(cx, cy, 7.5, deep);
    const watts = averageWatts(result.total);
    text(`${fmt(watts, watts < 10 ? 1 : 0)} W, 24/7`, cx, cy + 104, { size: 26, weight: 600, align: "center", maxWidth: 200 });

    text(t("meter.unit"), pad, top + bh + 52, { size: 34, weight: 600 });

    // Three comparisons
    const stats = [
      [t("stat.co2"), `${fmt(result.co2)} kg`],
      [t("stat.phone"), `${fmt(result.total / C.comparisons.phoneChargeKWh)} ${t("unit.times")}`],
      [t("stat.home"), `${fmt(result.total / floridaHomeKWhPerDay(), 1)} ${t("unit.days")}`],
    ];
    stats.forEach(([label, value], k) => {
      const y = 530 + k * 74;
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(pad, y, W - 2 * pad, 2);
      const valueWidth = text(value, W - pad, y + 50, { size: 40, weight: 700, align: "right", maxWidth: 380 });
      text(label, pad, y + 48, { size: 30, maxWidth: W - 2 * pad - valueWidth - 24 });
    });

    // Biggest categories (up to 5, so the image stays readable)
    text(t("results.where"), pad, 824, { size: 38, weight: 700, family: display });
    const sorted = CATEGORIES.map((c) => ({ id: c.id, value: result.kwh[c.id] }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const max = Math.max(...sorted.map((c) => c.value), 0.0001);
    sorted.forEach((c, k) => {
      const y = 852 + k * 66;
      const valueWidth = text(fmtSmall(c.value), W - pad, y + 32, { size: 30, weight: 600, align: "right", maxWidth: 300 });
      text(t(`cat.${c.id}`), pad, y + 32, { size: 30, maxWidth: W - 2 * pad - valueWidth - 24 });
      fillBox(pad, y + 44, W - 2 * pad, 10, 5, "rgba(255, 255, 255, 0.18)");
      fillBox(pad, y + 44, Math.max(10, ((W - 2 * pad) * c.value) / max), 10, 5, volt);
    });

    // Who made it, and where the methods are
    text(`${t("card.foot")} · ${t("share.model", { version: C.modelVersion })}`, pad, 1250, { size: 24, fill: soft });
    text(t("share.how", { url: siteAddress("about.html") }), pad, 1292, { size: 26, weight: 700, fill: volt });
    return canvas;
  }

  // Makes the image for the current results and language (after the results render, and when the language changes).
  function prepareShareImage() {
    if (!lastResult) return;
    const run = ++shareRun;
    const done = (blob) => {
      if (run !== shareRun) return; // an older image finished late
      shareFile = blob ? new File([blob], "energiae-digital-year.png", { type: "image/png" }) : null;
      shareActions.hidden = !shareFile;
      screenshotHint.hidden = !!shareFile; // if the image can't be made, the old "take a screenshot" tip shows instead
    };
    try {
      drawShareCard(lastResult).toBlob(done, "image/png");
    } catch (e) {
      done(null);
    }
  }

  function downloadShareImage() {
    if (!shareFile) return;
    const url = URL.createObjectURL(shareFile);
    const link = document.createElement("a");
    link.href = url;
    link.download = shareFile.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  shareBtn.addEventListener("click", async () => {
    if (!shareFile) return;
    try {
      await navigator.share({
        files: [shareFile],
        text: t("share.text", { kwh: fmt(lastResult.result.total), url: siteUrl("./") }),
      });
    } catch (err) {
      if (err.name !== "AbortError") downloadShareImage(); // closing the share sheet does nothing; any other problem saves it instead
    }
  });
  document.getElementById("download-btn").addEventListener("click", downloadShareImage);

  /* ---------- step 3: pledges ---------- */

  const pledgeList = document.getElementById("pledge-list");
  const pledgeGroup = document.getElementById("pledge-group");
  const pledgeMeter = document.getElementById("pledge-meter");
  const pledgeMeterLabel = document.getElementById("pledge-meter-label");
  const pledgeChange = document.getElementById("pledge-change");
  let noPledgeFits = false;

  let sentPledgeId = null; // set after a successful send, so the thank-you text can be redrawn in another language

  // Wording for the pledge step. The "none" wording is used when no pledge fits the person's habits.
  const pledgeCopy = () =>
    noPledgeFits
      ? { title: t("pledge.titleNone"), button: t("pledge.sendNone"), thanks: t("thanks.titleNone"), failedKey: "pledge.failedNone" }
      : { title: t("pledge.title"), button: t("pledge.send"), thanks: t("thanks.title"), failedKey: "pledge.failed" };

  // Rolls the mini meter from the current total down to the total after the chosen pledge.
  function updatePledgeMeter(animate) {
    const { inputs, result } = lastResult;
    const chosen = pledgeList.querySelector("input:checked");
    if (!chosen) {
      setMeter(pledgeMeter, result.total, false, { decimals: 1, label: t("pledgeMeter.ariaNow") });
      pledgeMeterLabel.textContent = t("pledgeMeter.now");
      pledgeChange.textContent = noPledgeFits ? t("pledge.none") : t("pledge.pick");
      return;
    }
    const saved = pledgeSavings(inputs, chosen.value);
    const share = result.total > 0 ? saved / result.total : 0;
    const pctText = share > 0 && share < 0.01 ? t("pledge.underOnePct") : `${Math.round(share * 100)}%`;
    if (animate) setMeter(pledgeMeter, result.total, false, { decimals: 1 }); // always roll down from today's total
    setMeter(pledgeMeter, result.total - saved, animate, { decimals: 1, label: t("pledgeMeter.ariaWith") });
    pledgeMeterLabel.textContent = t("pledgeMeter.with");
    pledgeChange.textContent = t("pledge.change", { kwh: fmtSmall(saved), pct: pctText });
  }

  pledgeList.addEventListener("change", () => updatePledgeMeter(true));

  // The sticky meter covers the top of the screen, so tell the browser to scroll focused items below it.
  const pledgeMeterBox = document.querySelector(".pledge-meter");
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (pledgeMeterBox.offsetHeight) {
        document.documentElement.style.setProperty("--sticky-h", `${pledgeMeterBox.offsetHeight + 24}px`);
      }
    }).observe(pledgeMeterBox);
  }

  function renderPledges() {
    const { inputs } = lastResult;
    const options = [...pledgeList.querySelectorAll(".pledge")].map((label) => ({
      label,
      saved: pledgeSavings(inputs, label.dataset.pledge),
    }));

    options.sort((a, b) => b.saved - a.saved);
    options.forEach(({ label, saved }) => {
      const applies = saved > 0.005;
      const radio = label.querySelector("input");
      label.hidden = !applies;
      radio.disabled = !applies;
      if (!applies) radio.checked = false;
      label.querySelector(".pledge-save").textContent = applies
        ? t("pledge.saves", { kwh: fmtSmall(saved), kg: fmtSmall(kgCO2(saved)) })
        : "";
      pledgeList.appendChild(label); // re-append in sorted order
    });
    noPledgeFits = options.every(({ saved }) => saved <= 0.005);
    pledgeGroup.hidden = noPledgeFits; // no empty box when nothing fits
    document.getElementById("pledge-lede").hidden = noPledgeFits;
    document.getElementById("pledge-title").textContent = pledgeCopy().title;
    const sendBtn = document.getElementById("submit-btn");
    sendBtn.textContent = sendBtn.disabled ? t("pledge.sending") : pledgeCopy().button; // don't overwrite "Sending…"
    updatePledgeMeter(false);
  }

  /* ---------- optional details for some "Where did you hear about this?" answers ---------- */

  // Professors, the department, clubs and events (options marked data-details in index.html) show an
  // optional text box. Picking any other answer hides it and clears it, so details never go with the wrong answer.
  const heardSelect = form.elements.heard_from;
  const heardDetailsField = document.getElementById("heard-details-field");

  function updateHeardDetails() {
    const show = Boolean(heardSelect.selectedOptions[0]?.hasAttribute("data-details"));
    if (!show) form.elements.heard_details.value = "";
    heardDetailsField.hidden = !show;
  }
  heardSelect.addEventListener("change", updateHeardDetails);

  /* ---------- submitting ---------- */

  function fillHiddenFields(pledgeId) {
    const { inputs, result } = lastResult;
    const set = (name, value) => (form.elements[name].value = value);
    const round2 = (n) => Math.round(n * 100) / 100;

    set("kwh_total", round2(result.total));
    set("co2_kg_total", round2(result.co2));
    CATEGORIES.forEach((c) => set(`kwh_${c.id}`, round2(result.kwh[c.id])));
    const top = CATEGORIES.reduce((best, c) => (result.kwh[c.id] > result.kwh[best.id] ? c : best));
    set("top_category", result.kwh[top.id] > 0 ? top.id : "none"); // "none" when every habit is 0
    set("pledge_kwh_saved", round2(pledgeSavings(inputs, pledgeId)));
    set("habits_changed", habitsChanged()); // 0 = clicked straight through without changing any habit
    set("heard_details", form.elements.heard_details.value.trim());
    set("model_version", C.modelVersion);
    set("language", lang); // "en" or "es": which language they used
  }

  // Everything the form sends. When no pledge fit, the disabled radios send nothing, so we add pledge=none.
  function formData() {
    const data = new FormData(form);
    if (!data.get("pledge")) data.set("pledge", "none");
    return data;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (steps.pledge.hidden) return;
    const errorBox = document.getElementById("form-error");
    errorBox.hidden = true;
    if (!stepIsValid(steps.pledge)) return;

    const pledgeId = form.elements.pledge.value;
    if (!pledgeId && !noPledgeFits) {
      // Backup check (the required radios normally catch this first).
      errorBox.dataset.key = "pledge.pickFirst";
      errorBox.textContent = t("pledge.pickFirst");
      errorBox.hidden = false;
      errorBox.focus();
      return;
    }
    fillHiddenFields(pledgeId);

    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = t("pledge.sending");

    try {
      await postToNetlify(formData());
      sentPledgeId = pledgeId;
      renderThanks();
      document.getElementById("preview-note").hidden = !isLocalPreview();
      showStep("thanks");
    } catch (err) {
      errorBox.dataset.key = pledgeCopy().failedKey;
      errorBox.textContent = t(errorBox.dataset.key);
      errorBox.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = pledgeCopy().button;
      if (!errorBox.hidden) errorBox.focus(); // the button was disabled while sending, so focus may have been lost
    }
  });

  // Thank-you heading and summary (in the current language).
  function renderThanks() {
    const pledgeEl = sentPledgeId && form.querySelector(`.pledge[data-pledge="${sentPledgeId}"] .pledge-text`);
    const summary = document.getElementById("thanks-summary");
    const collective = document.getElementById("thanks-collective");
    if (pledgeEl) {
      const text = pledgeEl.textContent.trim();
      const saved = pledgeSavings(lastResult.inputs, sentPledgeId);
      const amount = saved < 0.05 ? t("small.lessThan") : t("thanks.about", { kwh: fmtKWh(saved) });
      summary.textContent = t("thanks.summary", { pledge: text, amount }); // quoted in the student's own words
      // "What if" line: the same pledge made by COLLECTIVE_STUDENTS people (a round number, not real data)
      const together = saved * COLLECTIVE_STUDENTS;
      collective.textContent = t("thanks.collective", {
        students: fmt(COLLECTIVE_STUDENTS),
        kwh: fmtKWh(together),
        kg: fmtKWh(kgCO2(together)),
        days: fmtKWh(together / floridaHomeKWhPerDay()),
      });
    } else {
      summary.textContent = t("thanks.summaryNone");
    }
    collective.hidden = !pledgeEl;
    document.getElementById("thanks-title").textContent = pledgeCopy().thanks;
  }

  // "Start over" clears everything for the next person and goes back to the welcome screen.
  document.getElementById("restart-btn").addEventListener("click", () => {
    form.reset();
    lastResult = null;
    sentPledgeId = null;
    if (feedbackUI) feedbackUI.reset();
    form.querySelectorAll('input[type="range"]').forEach(updateSlider);
    updateOverlapNote();
    numberInputs.forEach(checkNumber); // the reset values are valid, so this clears any error lines
    clearChoiceErrors(form);
    updateHeardDetails(); // the list is back to "Choose one", so the details box hides
    unchangedWarned = false;
    hideUnchangedNote();
    editBaseline = null;
    updateLiveTotal();
    showHabitPage(0, { focus: false });
    showStep("welcome");
    clearAnswers();
  });

  // The Energiae logo shows the welcome screen without reloading. Answers are kept (like Back from the first
  // section); after sending, it starts fresh instead, like "Start over".
  document.getElementById("home-link").addEventListener("click", (event) => {
    event.preventDefault();
    if (!steps.thanks.hidden) document.getElementById("restart-btn").click();
    else showStep("welcome");
  });

  // When the language changes, redraw every piece of text that JavaScript built (no animations replay).
  languageHooks.push(() => {
    form.querySelectorAll('input[type="range"]').forEach(updateSlider);
    updateHabitNav();
    updateLiveTotal();
    if (!unchangedNote.hidden) unchangedNote.textContent = t("habits.unchanged");
    numberInputs.forEach((input) => {
      if (input.hasAttribute("aria-invalid")) checkNumber(input);
    });
    renderGridMix();
    const errorBox = document.getElementById("form-error");
    if (!errorBox.hidden && errorBox.dataset.key) errorBox.textContent = t(errorBox.dataset.key);
    if (!lastResult) return;
    document.getElementById("meter").setAttribute("aria-label", t("meter.aria", { value: fmt(lastResult.result.total) }));
    setDisk(lastResult.result.total);
    renderTips(renderBars(lastResult.result.kwh));
    renderPledges();
    prepareShareImage();
    if (sentPledgeId !== null) renderThanks();
  });

  restoreAnswers();
}

/* ================================================================== */
/* HERO POWER LINE (decoration)                                         */
/* ================================================================== */

// Draws a wire that sags between poles, sized to the screen in real pixels
// (so the lines never stretch). CSS sends a pulse of "current" along it every few seconds.
const powerLine = document.getElementById("power-line");

function drawPowerLine() {
  const width = powerLine.clientWidth;
  if (!width) return; // hidden
  const height = 44;
  const top = 8; // where the wire meets each pole
  const sag = 16; // how far the wire droops in the middle of a span
  const spans = width > 700 ? 3 : 2;
  const span = width / spans;

  let wire = `M0 ${top}`;
  let poles = "";
  for (let k = 1; k <= spans; k++) {
    const x = k * span;
    // Quadratic curve: the control point sits at 2 × sag, so the lowest point is exactly `sag` below.
    wire += ` Q ${x - span / 2} ${top + 2 * sag} ${x} ${top}`;
    if (k < spans) {
      poles += `<path class="pole" d="M${x} ${top - 4}V${height}M${x - 9} ${top + 2}H${x + 9}"/><circle class="insulator" cx="${x}" cy="${top}" r="3.5"/>`;
    }
  }

  powerLine.setAttribute("viewBox", `0 0 ${width} ${height}`);
  powerLine.querySelector(".poles").innerHTML = poles;
  powerLine.querySelector(".wire").setAttribute("d", wire);
  powerLine.querySelector(".pulse").setAttribute("d", wire);
}

if (powerLine && "ResizeObserver" in window) {
  // Fires on first observe and whenever the line's width changes (also when it goes from hidden to shown).
  new ResizeObserver(() => drawPowerLine()).observe(powerLine);
} else if (powerLine) {
  drawPowerLine();
  let pending = false;
  window.addEventListener("resize", () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      drawPowerLine();
    });
  });
}

/* ================================================================== */
/* ABOUT PAGE: fill numbers straight from coefficients.js               */
/* ================================================================== */

// <span data-c="network.homeRouterWattsPerUser"></span> shows that coefficient.
// <span data-calc="videoHD"></span> shows a value calculated from coefficients.
const CALCULATED = {
  mbpsSD: () => gbPerHourToMbps(C.dataRates.videoGBPerHour.SD),
  mbpsHD: () => gbPerHourToMbps(C.dataRates.videoGBPerHour.HD),
  mbps4K: () => gbPerHourToMbps(C.dataRates.videoGBPerHour["4K"]),
  mbpsSocial: () => gbPerHourToMbps(C.dataRates.socialGBPerHour),
  networkBase: () => C.network.accessAndCoreWattsPerUser + C.network.homeRouterWattsPerUser,
  whSD: () => onlineWhPerHour(gbPerHourToMbps(C.dataRates.videoGBPerHour.SD)),
  whHD: () => onlineWhPerHour(gbPerHourToMbps(C.dataRates.videoGBPerHour.HD)),
  wh4K: () => onlineWhPerHour(gbPerHourToMbps(C.dataRates.videoGBPerHour["4K"])),
  whMusic: () => onlineWhPerHour(C.dataRates.musicMbps),
  whSocial: () => onlineWhPerHour(gbPerHourToMbps(C.dataRates.socialGBPerHour)),
  whCalls: () => onlineWhPerHour(C.dataRates.callsMbps),
  whHDTV: () => videoWhPerHour("HD", "tv"),
  whHDMonitor: () => videoWhPerHour("HD", "monitor"),
  tvVsNetworkHD: () => C.screenWatts.tv / videoWhPerHour("HD", "phone"),
  whGaming: () => onlineWhPerHour(C.dataRates.gamingMbps),
  whBrowsing: () => onlineWhPerHour(C.dataRates.browsingMbps),
  whGamingPhone: () => gamingWhPerHour("phone"),
  whGamingConsole: () => gamingWhPerHour("console"),
  whGamingPC: () => gamingWhPerHour("pc"),
  oldMethodHD: () => C.dataRates.videoGBPerHour.HD * C.network.oldMethodKWhPerGB * 1000, // the method we do NOT use
  cloudPerGB: () => cloudKWhPerGBYear(),
  phonePerYear: () => C.devices.phoneKWhPerCharge * DAYS_PER_YEAR,
  kgPerKWh: () => kgCO2(1),
  homePerDay: () => floridaHomeKWhPerDay(),
  imageVsText: () => C.ai.imageWh / C.ai.textPromptWh,
  hoursPerYear: () => HOURS_PER_DAY * DAYS_PER_YEAR,
};

function lookup(path) {
  return path.split(".").reduce((obj, key) => obj[key], C);
}

// Fills every data-c / data-calc span. Runs again after a language change,
// because translated text (like the welcome facts) brings new, empty spans.
function fillNumbers() {
  document.querySelectorAll("[data-c], [data-calc]").forEach((el) => {
    const value = el.dataset.c ? lookup(el.dataset.c) : CALCULATED[el.dataset.calc]();
    const digits = el.dataset.digits ? Number(el.dataset.digits) : null;
    if (el.hasAttribute("data-raw")) {
      el.textContent = String(value);
      return;
    }
    el.textContent = typeof value === "number"
      ? value.toLocaleString("en-US", digits === null ? { maximumFractionDigits: 4 } : { minimumFractionDigits: digits, maximumFractionDigits: digits })
      : value;
  });
}

/* ================================================================== */
/* START: show the page in the chosen language                          */
/* ================================================================== */

const langToggle = document.getElementById("lang-toggle");
if (langToggle) langToggle.addEventListener("click", () => setLanguage(lang === "en" ? "es" : "en"));

applyLanguage();
