# Feedback, member polls and exportable reports (design)

Request (2026-11-16): "club member poll need, and feedbacks of events; if completed, all analysis shows with PDF and images". Original notes also asked for feedback after events and badges that depend on feedback. Same local-mock rules as the rest (Supabase-shaped tables, `Result<T, ErrorCode>` rules, tests first).

## 1. Event feedback
- **Who can answer:** a person whose registration is `attended` or `going` on a `completed` event (no-shows cannot), from the event's end until 14 days later. One response per person per event; they may edit it while the window is open.
- **Fields (fixed form, v1):** overall rating 1–5, "would you recommend" 0–10 (NPS), "what went well" (≤ 1000), "what should improve" (≤ 1000), `anonymous` flag. Custom per-event questions are deferred.
- **Anonymity:** the row keeps `profile_id` (one response each) but staff views never show who wrote an anonymous answer.
- **Summary:** responses n, response rate (n / attended + going), average rating (1 decimal), distribution 1–5, NPS = % promoters (9–10) − % detractors (0–6), comments newest first.
- **Request:** one hour after an event is completed, each eligible person gets an in-app notification and an email (`feedback_request`, deduped per event and person). Feedback-based badge: "Voice of the club" at 3 responses.

## 2. Club member polls
- **Poll:** title and description (mn/en), 2–10 options, single or multi choice (max choices), audience (`members` = status member; `community` = members and alumni; `everyone` = any signed-in person), anonymous yes/no, results visibility (`after_vote`, `after_close`, `staff_only`), opens/closes window, status `draft → published → closed`.
- **Voting:** one ballot per person, changeable until the poll closes; eligibility by audience (`forbidden` otherwise); closed or not-yet-open polls return `closed`.
- **Results:** tallies and turnout (voted / eligible). Anonymous polls never expose who voted for what; non-anonymous polls show voters to staff only.
- **Notify:** publishing sends an in-app notification and an email (`poll_opened`, priority 2, respects the announcements preference) to the audience.
- **Screens:** member `/me/polls` (list + vote + results when allowed), Home card "Open poll"; staff `/admin/polls` (create/edit, publish, close, results with charts, export).

## 3. Reports and exports
- **Event report** (`/admin/events/[id]/report`, offered when an event is completed): facts, funnel (registered → going → attended, waitlist, no-show), show rate, attendees by school and major track, new vs returning attendees, registrations over time, feedback summary and comments (anonymous respected).
- **Period report** (`/admin/reports?from&to`, default this semester): events, unique attendees, new members, retention, show rate, average rating and NPS per event, top events, poll turnout.
- **Export:** the same page is the document: print stylesheet (A4, brand header, no chrome, page breaks between sections) and a **Download PDF** button that opens the browser's print-to-PDF; every chart has **Download image** (PNG, 2× scale, white background, from the chart's SVG with fonts inlined); a "Download all images" button saves them one after another. No server PDF engine (no new dependency, works on free tiers); a server-side PDF can replace the print path later without changing the page.

## 4. Data
`event_feedback {id, event_id, profile_id, rating, nps, went_well, improve, anonymous, created_at, updated_at}` · `polls {id, title, description, options[], multi, max_choices, audience, anonymous, results, opens_at, closes_at, status, created_by, created_at}` · `poll_votes {poll_id, profile_id, option_ids[], created_at, updated_at}` · templates `feedback_request`, `poll_opened`.

## 5. Non-goals
Custom per-event feedback questions, ranked-choice voting, scheduled report emails, server-rendered PDF.
