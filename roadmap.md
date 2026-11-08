# Roadmap - Lindström Customer Value & Sustainability Review

## Photo and selector fixes (Keylon6, 8 Nov)
- [x] Remove blanket LinkedIn photo exclusion; verify public-page image provenance, add dedicated portrait search and saved-person photo retry; 17 tests pass and real research/retry verified
- [x] Separate the header person icon from the selector border; desktop/mobile screenshots and opening the menu verified
- [ ] Retrieve Hannamari Lindström's actual portrait - LinkedIn returns HTTP 999 without login, and no alternative public portrait was found; the app now reports this instead of silently failing

## Interrupted-task completion audit (Keylon6, 8 Nov)
- [x] Verify People input formats, research/photo, cancellation and generate-to-download lifecycle; add Office parser and zero-weight regression tests
- [x] Verify all 18 Recap destinations and Presentation preview/PDF/converted PowerPoint; notes and section exclusions verified in downloaded XML
- [x] Verify start-over persistence and desktop/mobile presentation; fix wrapping of baseline/sensitivity controls on phones
- [ ] Confirm newly converted file in Windows PowerPoint - Windows PowerPoint is unavailable in the sandbox; converted files open and render in LibreOffice
- [ ] Confirm reload during conversion on the published site - uploaded data stays browser-local; preview reproduces a framework development-server abort/restart, not an application error

## Lindström look, new onboarding and Recap (Keylon3, 7 Nov)
- [x] Lindström visual system: light pages, navy/red brand colours, Libre Franklin, readable sizes, no glow/beam effects
- [x] Shared header + tab navigation in Lindström style; studio and dashboard use it
- [x] Restyle dashboard pages for the light theme (palette mapping, controls, priority box, assistant icon)
- [x] Step 1: upload up to 3 data files (Excel main, PDF optional) and combine them
- [x] Step 2: company → suggested/own role → data locations/own locations (multi-select)
- [x] Step 3: generate the report from the chosen company, role and locations; land on Recap
- [x] Remove the AI interview from onboarding and the header; new reports start in the studio
- [x] Recap engine: 5 questions (3 common: results/money, risks, next steps; 2 role/company-specific)
- [x] Everyday comparisons for key numbers (families' water, homes' electricity, car trips round the Earth) with sources
- [x] Recap page: GSAP ScrollTrigger pinned full-screen chapters with scroll-scrubbed visuals; reduced-motion fallback
- [x] Recap first in navigation and in the dashboard guide
- [x] Verify upload → audience → generate → Recap scroll end-to-end (desktop + phone); tests for multi-file merge, role mapping, recap rules

## Workspace move (Keylon5, 7 Nov)
- [x] Connect Logo.dev in the new workspace and confirm real logos load

## Workspace move (Keylon6, 8 Nov)
- [x] Connect CloudConvert in the new workspace and confirm a PowerPoint converts
- [x] Connect ElevenLabs and confirm rehearsal voicing plays
- [x] Connect Logo.dev and confirm real logos load

## Next up (ready)
- [ ] People: let the KAM replace or remove a found photo and re-run research for an existing person
- [ ] Preview server restarts if the page is reloaded while a PowerPoint is still being prepared (framework development-mode issue; check whether the published site is affected)
- [x] Recap "present" mode: arrow keys / clicker move answer by answer for meeting rooms
- [ ] Multi-file merge: replace versioned rows that share an identity but changed values (today only exact duplicates are merged)
- [ ] Restyle remaining dialogs in detail (research progress, rehearsal chat) and check the site map colours on the light theme
- [ ] Wearer counts: show one clearly defined "people" figure across Sites, Overview and Recap

## People, clickable Recap and Recap deck (Keylon4, 8 Nov)
- [x] Onboarding person shows "Anonym" on People with an empty name field; question-mark picture for every person without a photo
- [x] "New report for another person" opens a pop-up: LinkedIn link, CRM file, meeting/private notes, write it yourself; one upload button for Office/PDF files
- [x] AI web research of the new person: name, role, locations, interests, "What they value" weights, three "wants to see" bullets, two Recap questions, web photo when the name is found
- [x] "Generate report" per person: switch the dashboard/Recap to that person (questions 4-5 from the AI), keep the "What matters most" block untouched, auto-download the PowerPoint when ready
- [x] Header "New report" asks first, then erases saved reports and people and returns to the studio
- [x] People page redesign: picture-first person cards, icon-led actions, no explanatory text
- [x] Recap: many elements open the matching dashboard place (sites, site pages, impact, insights, rules, trust) with subtle hover affordances; target highlighted on arrival
- [x] Presentation deck = only the Recap (cover, five questions with their visuals, next steps, sources) plus KAM notes, visually enhanced in preview, PowerPoint and PDF
- [x] Presentation sidebar: downloads, sections and KAM notes only (Audience and Executive summary removed)
- [x] Tests for Anonym naming, AI-picked Recap questions, deck = Recap; end-to-end browser check

## Current fixes (7 Nov)
- [x] Show saved onboarding cities in the People location editor, retain multi-selection and add spacing between location labels and checkmarks
- [x] Remove People-page comparison/preview panels and the marked profile detail, tone, units, money, toughness and questions controls
- [x] Prepare converted PowerPoint when the dashboard opens and share its ready download across account pages; changed decks prepare separately without stale downloads; 11 tests pass and real automatic start verified
- [x] Confirm automatic ready download with CloudConvert - new workspace conversion verified after reconnection
- [x] Replace unsupported conversion redirect mode with manual status checks; cover upload/download redirect rejection and cleanup in tests
- [x] Add CloudConvert conversion before PowerPoint delivery - real uploaded-customer flow produced an editable converted download; 11 slides validated and visually inspected; PDF download unchanged; 11 export/conversion tests pass
- [x] Replace rehearsal voicing with ElevenLabs and verify playback/mute/replay (real audio response and browser playing event)
- [x] Anchor insight review buttons to the bottom-right of each card
- [x] Stack the Sites map above the comparison table at full width
- [x] Correct the role icon’s alignment with the selector’s left border
- [x] Make insight tags describe the specific financial, washing, service or evidence topic
- [x] Remove the notification marked in image-40
- [ ] Resolve Windows PowerPoint refusal - automatic external Office conversion is implemented and real download validates/renders; final confirmation still requires opening the newly converted download in Windows PowerPoint
- [x] Make round info buttons smaller and remove the extra outer circle
- [x] Show full next-step action sentences without truncation or secondary subtitles
- [x] Keep the Recap closing headline on one desktop line and remove Questions for you
- [x] Repair the rehearsal scorecard layout in narrow panels
- [x] Render AI formatting in rehearsal messages and coaching instead of literal Markdown markers
- [x] Fix rehearsal voice playback when the speaker button is clicked (start/replay requests verified; audible playback needs a device check)
- [x] Remove the Finish and debrief button from rehearsal
- [x] Move the rehearsal meeting/toughness/answer subtitle into a round info button
- [x] Move the upload card's long explanation into a round info button beside the "Upload the customer's data" heading
- [x] Keep the studio headline on one line on desktop
- [x] Keep generation progress text inside its border on desktop and mobile
- [x] Fix overlapping PowerPoint text and verify a downloaded presentation
- [x] Make the header avatar selector the only dashboard role-switching control
- [x] Remove the header's Uploaded data tag
- [x] Verify saved customer interests directly influence dashboard priorities and observations
- [x] Lock generated dashboard country scope to the selected avatar location

## Report studio pipeline (Keylon, 7 Nov) - current focus
- [x] Connect Logo.dev and replace company initials with domain-based logos
- [x] Upload-only entry and dashboard access; no bundled sample fallback
- [x] Remove sample actions and hackathon-only labels from UI, assistant and exports
- [x] Verify empty entry, upload, generation and reload
- [x] Remove app subtitles, keep disclosures as standalone notes
- [x] Add a guided tour across the generated dashboard
- [x] Dark-only pages with Lindström and selectable per-company colour themes (superseded by the light Lindström look)
- [x] Step 1 - Raw data: upload Excel (.xlsx/.xls) or PDF tables; show only uploaded data
- [x] PDF table reader: deterministic text-position table extraction into the same ingestion pipeline + fixture tests
- [x] Step 2 - Audience: three pickers (company, role, location) built from saved avatars; empty state when none exist
- [x] "Add a new avatar" AI interview (superseded: onboarding now uses company/role/location picks)
- [x] AI web research per avatar: country climate/CO₂ rules, carbon pricing, tax incentives, textile waste/EPR, water, hygiene, company facts - with sources
- [x] Deterministic linking of researched rules to dashboard metrics (carbon-price value of CO₂ avoided, deadlines, emphasis weights)
- [x] Step 3 - Generate: combine data × avatar × country rules into the personalised dashboard
- [x] Dashboard: "prepared for" header, avatar switcher limited to created avatars, Country rules page, overview rules panel
- [x] Export deck + assistant include the regulatory context
- [x] Stakeholders page reworked around created avatars (edit/fine-tune, research refresh, delete, export/import)
- [x] End-to-end browser verification (xlsx, pdf, interview, research, generate, export)

## Core (challenge requirements)
- [x] Data ingestion layer (XLSX → validated, normalized dataset) + default NorthStar pack
- [x] Calculation engine (KPIs, footprint/handprint, baselines, low/base/high, provenance) + tests
- [x] Account shell following Ventura Program dashboard structure (header, glow menu, outlet)
- [x] Overview: rings, needs attention, next-year opportunities, first-screen KPIs, priority prompt
- [x] Sites: map + cards + filters + export; site drill-down page
- [x] Impact: baseline selector, sensitivity, footprint vs handprint, circularity, waste routes
- [x] Insights: rules-based observations (≥3), recommendations, steering questions, garment rebalancing
- [x] Stakeholder avatars (organizer feedback)
- [ ] Priority prompt personalization (rules + AI interpretation) - live AI check
- [x] AI value assistant chat grounded in calculated figures - live AI check
- [x] Customer-ready review export: PowerPoint + PDF, avatar-tailored, with sources/assumptions/limitations
- [x] Trust center: methodology note, assumption registry (editable), data quality, data-readiness map
- [x] Data import: upload replacement export, mapping + unmapped/missing report

## Differentiators
- [ ] Boardroom rehearsal: AI plays the avatar - live AI check
- [x] Garment passport: "life of a jacket" from RFID service cycles
- [ ] Live voice mode for the boardroom rehearsal (microphone unverified)
- [ ] Copilot/assistant connector (MCP endpoint) exposing review tools
- [ ] Regulation radar alerts: re-run research and diff rules since last review

## Later
- [ ] Rehearsal: live check of the stakeholder persona using the avatar's goals and country rules
- [x] Mobile pass of the studio steps and the Country rules page (narrow screens)
- [ ] Tax/funding "opportunity calculator": pair researched incentives with the account's energy and fleet figures

## Delivery
- [x] Methodology + data-readiness notes downloadable; README run instructions
- [x] Visual polish pass (desktop + mobile) of the presentation export in Lindström style; PDF and converted PowerPoint slides visually inspected
- [x] Routine package security update

## Notes
- Avatars, research briefs, uploads and preferences stay in the operator's browser (no sign-in); labelled in the UI. A shared team avatar library would need sign-in and Lovable Cloud.
- Manual column mapping for unknown exports is not implemented; alias mapping + rejection report instead.

## Header polish + Recap (Keylon5, 7 Nov late)
- [x] Remove dark top strip on dashboard pages (keep on studio)
- [x] Ventura hover-flip animation on dashboard tabs
- [x] Remove red underline from active tab
- [x] Align role icon to left edge of the role pill
- [x] Remove Guide and colour-palette buttons from the dashboard header
- [x] Remove the Recap opening scene that lists the five questions
- [x] Remove red "Question X of 5" eyebrow lines from Recap scenes
- [x] Remove the personalised hero block from the dashboard overview
- [x] Widen the baseline selector so the full baseline name is visible
- [x] Remove the "What country's rules mean" block from the dashboard overview
- [x] Swap Key figures and the "What matters most" prompt on the dashboard overview
- [x] Rename site status tags to "Act now" and "Watch closely" (pills, map legend, filters)
- [x] Assistant dialog: remove the "What the assistant sees" sidebar; disclaimer moved to a round info button by the title
- [x] Service health rings: round info button per metric explaining meaning and calculation (app-owned ServiceRings, same visuals)
- [x] Sites page: remove Country roll-up; Compare sites table moved up beside the map

## Rehearsal input + People updates (Keylon6, 8 Nov)
- [x] Rehearsal chat: input text must clear after sending a prompt
- [x] People tab: allow adding more files (LinkedIn link, CRM file, notes) to an existing person to update their info
- [x] Create a mock CRM PDF file for demo runs (deliver to Files)
