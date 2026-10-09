# QR Suggestion Box

Replace the box on the wall. People scan a QR code, write a message or attach a file, voice note or video, pick who should read it, and follow whether it was seen and answered. Anonymous by default.

Built in Uganda by **BrytMa Tech Uganda**. Support: muhumuzabright26@gmail.com

## Features

- **Send:** scan, pick a reader (MD, ED, Secretary, Manager...), write, attach up to 4 files (25 MB each), record a voice note, or capture video. No account.
- **Anonymous by default:** an optional email or phone is stored encrypted and never shown to readers.
- **Track:** the sender gets a code and sees Sent, Seen, Replied and Closed, reads replies, and can reply back.
- **Read:** a simple inbox (New, Replied, Done) with reply, forward and mark done. Readers sign in with an emailed link, no passwords.
- **Admin:** add readers, print the QR poster, test the flow.
- **Settings:** themes (6) and templates (4) with a live preview before applying.
- Works on phones and desktops. No build step, no external services needed to try it.

## Quick start

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:3100/admin, create your organisation, add the people who can receive suggestions, print the QR poster, and send a test. With no email configured, sign-in links appear in the server console and as a "Dev mode" button on the sign-in page. See [GUIDE.md](GUIDE.md) for the full walkthrough, deployment and troubleshooting.

```bash
npm test    # end-to-end smoke test on a temporary database
```

## Configuration

Environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | Default `3100` |
| `BASE_URL` | Public address, used in the QR code and emails, e.g. `https://suggest.example.co.ug` |
| `SMTP_URL` | Turns on email, e.g. `smtps://user:pass@smtp.example.com` |
| `MAIL_FROM` | Sender line for emails |
| `DATA_DIR` | Database, uploads and encryption key. Default `./data`. Back it up |
| `NODE_ENV=production` | Secure cookies (needs HTTPS), hides dev links |
| `TRUST_PROXY=1` | Set behind nginx or Caddy so rate limits see real IPs |

## Privacy and security

- Tracking codes are stored hashed. Only the sender has the code, and it cannot be recovered.
- Optional contacts are encrypted at rest (AES-256-GCM) with `DATA_DIR/secret.key`. **Back this file up and never commit it.**
- No IP addresses are stored. Rate limiting keeps them in memory only.
- Emails never contain the message text.
- Readers can only open items addressed to them. Uploads are type-checked and served sandboxed from a protected route.
- Sign-in links work once and expire after 30 minutes.

## Project layout

```
server.js        API, auth, uploads, database (SQLite via better-sqlite3)
public/          pages and scripts (plain HTML/CSS/JS, no build)
  looks.js       themes and templates
test/smoke.js    end-to-end test
GUIDE.md         how to use, deploy and troubleshoot
```

## Not built yet

- SMS to phone-number contacts (logged to the console only)
- Removing location data from photos and videos
- Auto-delete after a retention period
- More Settings: reply deadlines and reminders, escalation, auto-transcripts, public "You said, we did" page, reports, custom colours and logo
- Virus scanning of uploads

If you run this for real users in Uganda, register with the Personal Data Protection Office under the Data Protection and Privacy Act 2019 and have a lawyer review your privacy policy.

## Licence

Not yet chosen. Until a licence is added, all rights are reserved by BrytMa Tech Uganda.
