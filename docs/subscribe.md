# Event-notification sign-up (`/[lang]/join`)

The form posts `{ name, email, lang }` to `POST /api/subscribe`. Nothing is emailed yet: the endpoint only
**collects** sign-ups. Sending the actual notification emails needs a mail service (Resend, Mailchimp, Buttondown,
Google Workspace mail merge…) and is a separate step.

## Where sign-ups go
| Environment | Behaviour |
|---|---|
| `SUBSCRIBE_WEBHOOK_URL` set (https) | Each sign-up is forwarded as JSON `{ name, email, lang, ts }`. If `SUBSCRIBE_WEBHOOK_SECRET` is set it is sent as `Authorization: Bearer <secret>`. Works with a Google Apps Script web app that appends to a Sheet, Zapier/Make, Formspree-style endpoints, or your own API. |
| Development, no webhook | Appended to `.data/subscribers.jsonl` (gitignored, file mode 600). |
| Production, no webhook | Returns 503; the form tells visitors to follow Instagram instead. |

Set the variables in the hosting dashboard / `.env.local`, never in code.

## Protections
Same-origin only, JSON only, 2 KB body limit, strict validation, honeypot field, per-IP rate limit (5 per 10 min,
in-memory so best-effort on serverless), duplicate emails look like success (no subscriber probing).
Logs are structured JSON with constant messages and **never contain names or emails**.

## Privacy
The form states what the email is used for and how to be removed (message @hackumclub on Instagram). If you add real
sending, include an unsubscribe link in every email.
