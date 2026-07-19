# OpenScrim Distribution Strategy

*Market research and go-to-market recommendation — July 2026*

## TL;DR — Recommendation

**Don't build the "YouTube of scrims" platform first, and don't plan around selling to Udemy.** The winning wedge is what's already built: **an open format + embeddable recorder/player SDK** — position OpenScrim as *"asciinema for code editors"*. Open-source the engine to get distribution for free, then monetize with a hosted cloud (openscrim.com) for teachers who don't want to self-host. The multi-tenant teacher platform comes *second*, built on top of the SDK's adoption. The marketplace is a year-3 option, not a year-1 strategy.

---

## Key findings

### 1. Scrimba's own numbers are the most important data point — and they're a warning

Scrimba, after ~9 years, is at roughly [$1.9M ARR with 500K customers](https://getlatka.com/companies/scrimba) and raised only [~$400–570K total](https://tracxn.com/d/companies/scrimba/__Nh5I-6Pdq6V6_btosW0_z_yTeuz0ofpKQ-PQplfTnbM) ([PitchBook](https://pitchbook.com/profiles/company/179310-79)). The scrim *format* is beloved; the *content-platform business* built on it is small. Competing with free (freeCodeCamp, Odin Project, YouTube) caps B2C learn-to-code revenue.

**Implication:** cloning their business model inherits their ceiling. Opening up their *format* attacks their moat instead.

### 2. Nobody owns the open-source version of this format — the seat is empty

Searches for open-source Scrimba alternatives return [asciinema (terminal only) and step-based tools like Microsoft's CodeTour](https://alternativeto.net/software/scrimba/), plus [CodeMic](https://github.com/microsoft/vscode-discussions/discussions/2022), a VS Code experiment that isn't a product. There is **no established open-source, embeddable "editable code screencast" engine**. Scrimba's format is proprietary and locked to their site.

**Positioning in one sentence:** the open, embeddable scrim format.

### 3. Embedding is proven demand — Scrimba itself grows through it

[MDN, Coursera, and freeCodeCamp embed scrims](https://scrimba.com/articles/how-scrimba-came-to-be/) as Scrimba partners. Tools like [LiveCodes](https://livecodes.io/docs/features/embeds/) and [Codapi](https://codapi.org/python/) exist precisely because docs sites, blogs, and courses want interactive code embeds — but none of them do *recorded, forkable lessons*.

Also: **devtool companies pay real money for interactive onboarding in their docs.** That's a B2B buyer worth targeting alongside teachers.

### 4. The open-core playbook for this is well-trodden

[Cal.com and Plausible](https://www.getmonetizely.com/articles/monetizing-open-source-software-pricing-strategies-for-open-core-saas) show the pattern: free self-hostable core (AGPL is common for the server), paid cloud for hosting/teams/analytics. People pay for *not having to run servers*, even when the code is free.

Sober expectation: [median 3–5 years from OSS launch to $1M ARR](https://www.getmonetizely.com/articles/monetizing-open-source-software-pricing-strategies-for-open-core-saas) — but the asciinema-style model builds adoption long before revenue.

### 5. If selling to schools/bootcamps later, LTI 1.3 is table stakes

[Codio](https://www.codio.com/features/lms), [Code Workout, and others](https://cssplice.org/lti/) integrate with Canvas/Moodle via LTI 1.3 (SSO + grade passback). Institutional sales are slow and compliance-heavy — a later-stage channel, not a starting point. The [EdTech B2B guides](https://salesup.club/blog/how-edtech-companies-acquire-b2b-clients) consistently advise: design one-semester pilots, lead with integration.

### 6. Watch out: in-browser code execution licensing

Adding "run the code" (terminal/preview) via [StackBlitz WebContainers requires a commercial license for production use](https://webcontainers.io/enterprise). Open alternatives exist (Pyodide, sandboxed iframes like LiveCodes uses, or a self-run container backend) — decide this before betting the product on WebContainers.

---

## The four paths, scored

| Path | Verdict | Why |
|---|---|---|
| **Embeddable SDK + open format** | ✅ **Do first** | Empty market seat, matches existing architecture, distribution is free (devs embed → every embed advertises you), no cold-start problem |
| **Multi-tenant teacher platform (hosted cloud)** | ✅ **Do second** | This is the monetization of the SDK, not a separate strategy. "Multi-tenant" ≠ database-per-teacher — the existing MongoDB with `userId`-scoped recordings *is* multi-tenancy; add orgs/workspaces later |
| **Marketplace / "YouTube of scrims"** | ⏸️ Year 3+, maybe | Two-sided cold start, and Scrimba's numbers prove the content platform is the weak business. Only viable after the SDK creates thousands of scrim authors |
| **Sell to Udemy** | ❌ Not a strategy | Acquisitions happen *to* products with traction; you can't plan for one. Better framing: Udemy/Coursera/bootcamps as *embed customers* of the cloud, like MDN is for Scrimba |

---

## Concrete sequencing

### Phase 1 (now → ~6 months): own the format

- **Publish the `.tantrica` format as an open spec** — and rename it: one name everywhere. Tantrica remnants will confuse adopters.
- **License split:**
  - `openscrim-core` + `openscrim-monaco`: **MIT or Apache-2.0** (maximize embedding — AGPL scares embedders away)
  - Server/webapp: **AGPL** (prevents someone cloud-hosting the platform against you)
  - This is exactly the Cal.com/Plausible structure.
- **Ship a drop-in `<openscrim-player>` embed** (script tag + React wrapper) so a scrim plays on any blog/docs page. This is the growth loop.
- **Launch:** Show HN, r/webdev, dev.to. The pitch "open-source Scrimba format you can embed anywhere" is genuinely Show-HN-shaped.
- **Prerequisite:** the repo has zero tests. An embeddable player is infrastructure other people's sites depend on — playback determinism needs a test suite before inviting embedders.

### Phase 2 (~6–18 months): hosted cloud for teachers

- **Free tier:** record + share links (like asciinema.org).
- **Paid ($10–20/mo creator tier, plus team tier):** custom domains, private scrims, org workspaces, and **analytics** (watch time, drop-off points, fork counts — teachers love this).
- **Target creators first** (YouTube coding teachers who want interactivity), then bootcamps.

### Phase 3 (later): B2B expansion

- **Devtool companies** for interactive docs/onboarding — high willingness to pay, short sales cycle vs. schools.
- **LTI 1.3** for bootcamps/universities once there's pilot demand.
- **Canvas/whiteboard/collab features** — only once the core loop is monetizing.

---

## Risks and caveats

- **AI is the wildcard, and it cuts in OpenScrim's favor:** a scrim is timestamped text events, which means an LLM can plausibly *generate* one — video can't be cheaply authored by AI. An open format that AI tools can write to is a 2026-shaped moat Scrimba doesn't have. But it also means someone else could ship this fast — being first with the open spec matters.
- **Scrimba could open-source their format** in response. Defense: be the neutral, embeddable, MIT-licensed option from day one.
- **Data quality:** revenue and funding figures are third-party estimates from [GetLatka](https://getlatka.com/companies/scrimba)/[Tracxn](https://tracxn.com/d/companies/scrimba/__Nh5I-6Pdq6V6_btosW0_z_yTeuz0ofpKQ-PQplfTnbM) and conflict slightly across sources — directionally reliable ("beloved format, small business"), not precise.
- **Timeline:** open-core revenue is slow (3–5 years to $1M ARR is the median). The SDK path buys adoption cheaply, but monetization patience is required.

---

## Bottom line

The SDK/embed paradigm and the teacher platform aren't competitors: **the SDK is the distribution engine and the hosted platform is the business.** Do them in that order, and skip the marketplace and the Udemy exit fantasy until the format has won.

---

## Sources

- [GetLatka — Scrimba revenue](https://getlatka.com/companies/scrimba)
- [Tracxn — Scrimba funding](https://tracxn.com/d/companies/scrimba/__Nh5I-6Pdq6V6_btosW0_z_yTeuz0ofpKQ-PQplfTnbM)
- [PitchBook — Scrimba profile](https://pitchbook.com/profiles/company/179310-79)
- [How Scrimba came to be](https://scrimba.com/articles/how-scrimba-came-to-be/)
- [Becoming a Scrimba instructor](https://medium.com/scrimba/how-to-create-a-scrimba-screencast-e5ca244bc531)
- [AlternativeTo — Scrimba alternatives](https://alternativeto.net/software/scrimba/)
- [CodeMic discussion (VS Code)](https://github.com/microsoft/vscode-discussions/discussions/2022)
- [Microsoft CodeTour](https://github.com/microsoft/codetour)
- [LiveCodes embeds](https://livecodes.io/docs/features/embeds/)
- [Codapi](https://codapi.org/python/)
- [WebContainers commercial licensing](https://webcontainers.io/enterprise)
- [Open-core pricing strategies](https://www.getmonetizely.com/articles/monetizing-open-source-software-pricing-strategies-for-open-core-saas)
- [Open Core Ventures pricing handbook](https://handbook.opencoreventures.com/pricing/)
- [Codio LMS/LTI](https://www.codio.com/features/lms)
- [LTI for coding exercises](https://cssplice.org/lti/)
- [EdTech B2B sales](https://salesup.club/blog/how-edtech-companies-acquire-b2b-clients)
