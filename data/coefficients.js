/*
 * coefficients.js — every energy and emissions number used by the calculator.
 *
 * RULE: no other file may contain an energy/emissions number. app.js and
 * about.html read everything from COEFFICIENTS below.
 *
 * Each factor has a comment with: source name, year, URL, a confidence note, and a
 * published range where one exists. Anything we are not fully sure about is tagged VERIFY.
 *
 * Units used throughout:
 *   W   = watts (power)          Wh  = watt-hours (energy)
 *   kWh = 1,000 Wh               Mbps = megabits per second
 *   GB  = gigabytes              1 GB per hour = 8,000 megabits / 3,600 s = 2.22 Mbps
 *
 * THE BIG MODELING CHOICE (read this before changing anything):
 * Old headlines multiplied "GB of data" by a "kWh per GB" factor. The IEA
 * (Kamiya 2020) and the Carbon Trust (2021) showed that this overstates network
 * energy, because network equipment uses most of its power just being switched
 * on. So we use the "power model": each hour online gets a fixed share of the
 * network's always-on power, plus a small extra amount that grows with data.
 * Result: video quality (SD vs 4K) barely changes the hidden energy, but the
 * number of HOURS does. The Carbon Trust reached the same conclusion.
 *
 * To avoid counting the same energy twice, the energy that charges a phone,
 * laptop or tablet is counted ONLY in the "devices" category. The streaming,
 * music, social, calls and phone-gaming categories count only the hidden part:
 * network plus data centers. A TV or computer monitor is plugged in, so it is NOT in
 * "devices": its power is added to video (and to console or PC gaming), see section 4b.
 */

const COEFFICIENTS = {
  // Bump this whenever a number changes, so submitted data can be grouped by model.
  // v2 (2026-09-30): added the TV or monitor you watch or game on (section 4b), studying, working
  // and browsing online (browsingMbps), and Google AI summaries counted as AI text prompts.
  // v3 (2026-10-01): video hours are entered per screen (people can pick several), and the
  // "1 hour less video" pledge takes the hour from each screen in proportion to its hours.
  // No energy numbers changed.
  modelVersion: "2026-10-v3",

  /* ------------------------------------------------------------------ */
  /* 1. NETWORK: the power model (applies to every hour spent online)    */
  /* ------------------------------------------------------------------ */
  network: {
    // Fixed-line access + core network, always-on share per user.
    // 6.5 W per household (5 W access line + 1.5 W core), divided by 2 users = 3.25 W.
    // Source: Carbon Trust, "Carbon impact of video streaming" white paper (2021),
    //   power model based on Malmodin (2020).
    //   https://www.carbontrust.com/our-work-and-impact/guides-reports-and-tools/carbon-impact-of-video-streaming
    //   Parameters as documented by Scope3 methodology (2025): https://methodology.scope3.com/data_transfer
    // Confidence: MEDIUM. Numbers come from a secondary write-up of the white paper.
    // VERIFY against the white paper's appendix (the PDF is in the PBL Project folder).
    accessAndCoreWattsPerUser: 3.25,

    // Home Wi-Fi router: about 10 W, shared by 2 users = 5 W per user-hour.
    // Source: same Carbon Trust (2021) power model / Scope3 (2025) as above.
    // Confidence: MEDIUM. Router power varies roughly 5 to 20 W by model. VERIFY.
    homeRouterWattsPerUser: 5,

    // Extra network power per Mbps of streaming (the part that grows with data).
    // Source: same Carbon Trust (2021) power model / Scope3 (2025) as above.
    // Confidence: MEDIUM. The value is tiny, which is the paper's main point.
    // For comparison, the old average approach ("kWh per GB") would give 0.1 kWh per GB,
    // or about 300 Wh for one HD hour. The IEA calls that approach unsuitable for
    // high-bitrate video. We do NOT use it.
    extraWattsPerMbps: 0.03,

    // NOT USED in the calculator. Shown on about.html only, to explain why headline numbers are bigger.
    // The older "average" method multiplies GB by 0.1 kWh per GB (published range 0.1–1.0 kWh/GB, 2020).
    // Source: Carbon Trust (2021) white paper, conventional approach (same URL as above).
    // Confidence: HIGH that this is the published value; LOW that it fits streaming (per the IEA 2020).
    oldMethodKWhPerGB: 0.1,
  },

  /* ------------------------------------------------------------------ */
  /* 2. DATA CENTERS: servers that store and send the content            */
  /* ------------------------------------------------------------------ */
  // Data centers (hosting + encoding + content delivery), per hour of streaming.
  // Source: Carbon Trust (2021), results summary: data centres are "approximately 1Wh/hour".
  //   https://www.carbontrust.com/our-work-and-impact/guides-reports-and-tools/carbon-impact-of-video-streaming
  // Published range: about 1 Wh/h (Carbon Trust 2021) to 3.9 Wh/h (IEA 2020: 5% of 77 Wh/h).
  //   IEA: https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines
  // Confidence: MEDIUM for video. We reuse the same value for music, social media and
  // video calls because we found no separate published figure for them. Audio probably
  // needs less. VERIFY.
  dataCenterWhPerHour: 1.0,

  /* ------------------------------------------------------------------ */
  /* 3. DATA RATES: how much data each activity moves                    */
  /* ------------------------------------------------------------------ */
  // Only used for the small extraWattsPerMbps term above.
  dataRates: {
    // Netflix data use per hour: SD up to 1 GB, HD up to 3 GB, 4K up to 7 GB.
    // Source: Netflix Help Center, "How to control how much data Netflix uses" (accessed 2026).
    //   https://help.netflix.com/en/node/87
    // Confidence: HIGH (these are the service's own maximums; real use is often lower).
    videoGBPerHour: { SD: 1, HD: 3, "4K": 7 },

    // Spotify "High" quality is about 160 kbit/s = 0.16 Mbps.
    // Published range: 0.024 Mbps (Low) to 0.32 Mbps (Very high).
    // Source: Spotify Support, "Audio quality" (accessed 2026).
    //   https://support.spotify.com/us/article/audio-quality/
    // Confidence: HIGH for the bitrate itself.
    musicMbps: 0.16,

    // Social media feeds are mostly phone-sized video. There is no official figure, so we
    // use Netflix "Medium" quality (up to 0.7 GB/h) as a stand-in.
    // Source: Netflix Help Center (accessed 2026). https://help.netflix.com/en/node/87
    // Confidence: LOW. This is a proxy. It barely matters because the per-Mbps term is tiny. VERIFY.
    socialGBPerHour: 0.7,

    // Group video call at 720p: 2.6 Mbps up + 1.8 Mbps down = 4.4 Mbps total.
    // Published range: 2.4 Mbps (1:1 at 720p) to 6.8 Mbps (1080p).
    // Source: Zoom Support, "Zoom system requirements: bandwidth" (accessed 2026).
    //   https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060748
    // Confidence: HIGH for the bitrate.
    callsMbps: 4.4,

    // Online game traffic is small compared with video. We set the extra data term to 0
    // and count only the always-on network share for each hour of gaming.
    // Confidence: MEDIUM (an assumption). VERIFY.
    gamingMbps: 0,

    // Studying online (homework sites, e-books), working online (email, documents; video calls are
    // counted separately with callsMbps) and browsing (Google, library databases):
    // web pages move little data compared with video, so, as for gaming, we set the extra data
    // term to 0 and count only the always-on network share plus data centers for each hour.
    // Confidence: MEDIUM (an assumption). Pages with video would add a little. VERIFY.
    browsingMbps: 0,
  },

  /* ------------------------------------------------------------------ */
  /* 4. GAMING HARDWARE (plugged in, so not in the "devices" category)   */
  /* ------------------------------------------------------------------ */
  gamingDeviceWatts: {
    // Phone gaming uses battery energy, which is already counted in devices.phone.
    phone: 0,

    // Current consoles (PS5, Xbox Series X|S) use 160 to 200 W during 4K gameplay; we use the midpoint.
    // Published range: 112 W (Xbox One) to about 220 W (Xbox Series X, demanding games).
    // Source: Hydro-Québec, "Your game console is power-hungry!" (accessed 2026).
    //   https://www.hydroquebec.com/residential/energy-wise/tips/electronics/game-consoles.html
    // Confidence: MEDIUM. Console only; the TV it plays on is added separately (section 4b).
    console: 180,

    // A typical gaming PC system is about 600 W nameplate, and real measured power is
    // about 50% of nameplate, so about 300 W while gaming.
    // Published range: about 150 W (efficient builds) to 450 W (inefficient builds).
    // Source: Mills & Mills, "Taming the energy use of gaming computers",
    //   Energy Efficiency (2016), Lawrence Berkeley National Laboratory Green Gaming project.
    //   https://link.springer.com/article/10.1007/s12053-015-9371-1
    //   Summary: https://sites.google.com/site/greeningthebeast/energy/taming-the-energy-use-of-gaming-computers
    // Confidence: MEDIUM-LOW. The figure is from 2016, and modern high-end GPUs can draw more. VERIFY.
    // It is the computer itself (power-supply rating); the study counts displays separately,
    // so the monitor is added from section 4b.
    pc: 300,
  },

  /* ------------------------------------------------------------------ */
  /* 4b. SCREENS you watch or play on (plugged in, so not in "devices")  */
  /* ------------------------------------------------------------------ */
  screenWatts: {
    // Phones, tablets and laptops run on battery energy that is already counted in "devices".
    phone: 0,
    laptop: 0,

    // TV: median on-mode power of the 179 ENERGY STAR certified consumer TVs = 102.4 W,
    // as reported under the U.S. federal (DOE) test procedure. Median screen size: about 55 in.
    // 10th to 90th percentile of the same models: 35.6 to 171.7 W.
    // Source: U.S. EPA ENERGY STAR Certified Televisions dataset (queried 2026-09-30).
    //   https://data.energystar.gov/Active-Specifications/ENERGY-STAR-Certified-Televisions/pd96-rr3d
    // Size matters: in the same data, TVs under 40 in have a median of 28 W; 70 in and up, 166 W.
    // Confidence: MEDIUM. It's a median of models, not weighted by sales, and certified models are
    // more efficient than average.
    tv: 102.4,

    // Computer monitor: median on-mode power of the 1,592 ENERGY STAR certified monitors = 14.2 W.
    // Median screen size: about 27 in. 10th to 90th percentile: 10.0 to 29.0 W.
    // Source: U.S. EPA ENERGY STAR Certified Displays dataset, "Monitor" type (queried 2026-09-30).
    //   https://data.energystar.gov/Active-Specifications/ENERGY-STAR-Certified-Displays/qbg3-d468
    // Confidence: MEDIUM. Screen only: a desktop computer plugged into it is not counted.
    monitor: 14.2,
  },

  // Which screen each gaming platform adds. An assumption, not a measurement: consoles are
  // played on a TV, gaming PCs on one monitor, and phone games on the phone itself.
  // Confidence: MEDIUM. Some console players use a monitor, and some PC gamers use two. VERIFY.
  gamingScreen: { phone: "phone", console: "tv", pc: "monitor" },

  /* ------------------------------------------------------------------ */
  /* 5. AI                                                               */
  /* ------------------------------------------------------------------ */
  ai: {
    // One typical chatbot text prompt: about 0.3 Wh, including data-center overhead.
    // Sources: Epoch AI, "How much energy does ChatGPT use?" (Feb 2025): about 0.3 Wh for GPT-4o.
    //   https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use
    //   Google, "Measuring the environmental impact of delivering AI at Google scale" (Aug 2025):
    //   median Gemini text prompt 0.24 Wh. https://arxiv.org/abs/2508.15734
    // Published range: 0.24 Wh (Google 2025) to about 3 Wh (widely cited 2023 estimate).
    //   Very long inputs or "reasoning" modes can reach 2.5 to 40 Wh (Epoch 2025).
    // Confidence: MEDIUM. Recent measured and disclosed figures agree at about 0.24 to 0.34 Wh.
    // Also used as a STAND-IN for one Google AI summary (AI Overview) in search results: we found no
    // published energy figure for those, so each one counts as one text prompt.
    // Confidence for that use: LOW. VERIFY.
    textPromptWh: 0.3,

    // One AI-generated image: 2.9 kWh per 1,000 images = 2.9 Wh per image
    // (average of the image models tested).
    // Source: Luccioni, Jernite & Strubell, "Power Hungry Processing: Watts Driving the Cost
    //   of AI Deployment?", ACM FAccT (2024). https://arxiv.org/abs/2311.16863
    // Published range: very wide across models (standard deviation 3.31 kWh per 1,000).
    //   Measured on GPUs only, without data-center overhead, so the real figure is probably higher.
    // Confidence: LOW-MEDIUM. VERIFY.
    imageWh: 2.9,
  },

  /* ------------------------------------------------------------------ */
  /* 6. CLOUD STORAGE (calculated from sourced parts, shown step by step)*/
  /* ------------------------------------------------------------------ */
  cloud: {
    // Average data-center hard drive power: 6.4 W per drive (2025).
    // Source: Shehabi et al., "2024 United States Data Center Energy Usage Report",
    //   Lawrence Berkeley National Laboratory (Dec 2024), section 3 (citing Monroe & Johns 2024).
    //   https://eta-publications.lbl.gov/sites/default/files/2024-12/lbnl-2024-united-states-data-center-energy-usage-report_1.pdf
    // Confidence: HIGH (national lab).
    hddWatts: 6.4,

    // Typical cloud hard drive size: 16 TB = 16,000 GB. Drives of 14 to 16 TB are 52% of the
    // fleet at Backblaze, a cloud storage company.
    // Source: Backblaze, "Drive Stats for 2025" (2026). https://www.backblaze.com/blog/backblaze-drive-stats-for-2025/
    // Confidence: MEDIUM (one company's fleet).
    hddCapacityGB: 16000,

    // Cloud providers keep several copies of your file. We assume 3 copies.
    // Confidence: LOW. This is an assumption; real schemes use about 1.2 to 3 times the space. VERIFY.
    copies: 3,

    // PUE (Power Usage Effectiveness): total data-center power ÷ IT power.
    // It covers cooling and other building overhead. U.S. average in 2023 = 1.4.
    // Source: LBNL 2024 report (above), Figure 4.6.
    // Confidence: HIGH.
    pue: 1.4,

    // Result, calculated in app.js:
    // 6.4 W ÷ 16,000 GB × 8,760 h × 3 copies × 1.4 ≈ 0.0147 kWh per GB per year.
    // Published range: about 0.005 (drive only) to 0.1 kWh per GB per year (older top-down estimates).
    // Confidence in the final number: LOW. It ignores storage servers and networking. VERIFY.
  },

  /* ------------------------------------------------------------------ */
  /* 7. DEVICES CHARGED EVERY DAY (yearly kWh per device)                */
  /* ------------------------------------------------------------------ */
  devices: {
    // Smartphone: 0.019 kWh per full charge, times 365 charges ≈ 6.9 kWh per year.
    // Source: U.S. EPA, "Greenhouse Gas Equivalencies Calculator: Calculations and References"
    //   (page updated Aug 2026), based on U.S. DOE data (2024).
    //   https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references
    // Confidence: HIGH.
    phoneKWhPerCharge: 0.019,

    // Laptop: median "Typical Energy Consumption" (TEC) of 1,191 ENERGY STAR v9 certified
    // notebooks = 13.4 kWh/yr (10th to 90th percentile: 9.2 to 18.6).
    // Source: U.S. EPA ENERGY STAR Certified Computers V9.0 dataset (queried 2026-09-28).
    //   https://data.energystar.gov/Active-Specifications/ENERGY-STAR-Certified-Computers-V9-0/rxdj-2c88
    // Confidence: MEDIUM-HIGH. Certified models are more efficient than average, so this may run low.
    laptopKWhPerYear: 13.4,

    // Tablet: median TEC of 106 ENERGY STAR v9 certified slates/tablets = 8.35 kWh/yr
    // (10th to 90th percentile: 4.4 to 15.0).
    // Source: same ENERGY STAR dataset as above (queried 2026-09-28).
    // Confidence: MEDIUM-HIGH.
    tabletKWhPerYear: 8.35,
  },

  /* ------------------------------------------------------------------ */
  /* 8. FLORIDA GRID (turns kWh into CO2)                                */
  /* ------------------------------------------------------------------ */
  // Florida state total output emission rate: 789.1 lb CO2e per MWh.
  // Source: U.S. EPA eGRID2023 (released Jan 2025, rev. 2 June 2025), Table 3, state output emission rates.
  //   https://www.epa.gov/egrid/summary-data
  //   (FRCC subregion = 784.8; U.S. average = 770.9 lb CO2e/MWh.)
  // Confidence: HIGH. Simplification: the data centers that serve you are often outside
  // Florida, but we apply Florida's rate to everything because this is a Florida project (RQ4).
  floridaLbCO2ePerMWh: 789.1,
  kgPerLb: 0.45359237, // exact definition of the pound

  // NOT USED in the calculator. Shown on about.html only (Assumptions list).
  // Electricity lost in transmission and distribution before it reaches you ("grid gross loss").
  // Source: U.S. EPA eGRID2023, Table 1, FRCC subregion (U.S. average is also 4.2%). https://www.epa.gov/egrid/summary-data
  // Published range: 4.1% to 4.4% across eGRID2023 subregions (Table 1).
  // Confidence: HIGH. Because we don't add it, CO2 estimates are slightly low.
  gridLossPct: 4.2,

  /* ------------------------------------------------------------------ */
  /* 9. COMPARISONS shown on the results screen                          */
  /* ------------------------------------------------------------------ */
  comparisons: {
    // One smartphone charge = 0.019 kWh (same EPA source as devices.phoneKWhPerCharge).
    phoneChargeKWh: 0.019,

    // Average Florida home: 1,104 kWh per month (2024), which is about 36.3 kWh per day.
    // Source: U.S. EIA, Electric Sales, Revenue, and Average Price, Table 5A (2024 data, released Oct 2025).
    //   https://www.eia.gov/electricity/sales_revenue_price/
    // Confidence: HIGH.
    floridaHomeKWhPerMonth: 1104.135,
  },

  /* ------------------------------------------------------------------ */
  /* 10. CONTEXT FACTS for about.html (research questions 1 and 4)       */
  /* ------------------------------------------------------------------ */
  context: {
    // Global data centers: 485 TWh in 2025 (+17%), about 950 TWh by 2030. AI-focused data centers +50% in 2025.
    // Source: IEA, "Key Questions on Energy and AI" (2026).
    //   https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary
    // Confidence: HIGH (projections are the IEA's central case).
    globalDataCentersTWh2025: 485,
    globalDataCentersTWh2030: 950,
    aiDataCenterGrowth2025Pct: 50,

    // U.S. data centers: 176 TWh in 2023 = 4.4% of U.S. electricity; 6.7% to 12% by 2028.
    // Source: LBNL 2024 United States Data Center Energy Usage Report (above).
    // Confidence: HIGH.
    usDataCentersTWh2023: 176,
    usDataCentersSharePct2023: 4.4,
    usDataCentersSharePct2028Low: 6.7,
    usDataCentersSharePct2028High: 12.0,

    // Florida electricity generation mix, 2023 (% of net generation).
    // "other" = oil 0.5 + other fossil 0.6 + biomass 1.2 + hydro 0.1 + other 0.4.
    // Parts add up to 100.1% because of rounding in the source.
    // Source: U.S. EPA eGRID2023, Table 4, state resource mix. https://www.epa.gov/egrid/summary-data
    // Confidence: HIGH.
    floridaMixPct: { gas: 75.9, nuclear: 11.6, solar: 5.4, coal: 4.4, other: 2.8 },
    floridaMixYear: 2023, // the data year of the eGRID numbers above
  },
};
