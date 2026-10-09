# Guide

## For the admin: first-time setup (5 minutes)

1. Run the app and open `/admin`. Enter your organisation, your name, title and email. You become the admin and are signed in.
2. **Step 1, who can receive suggestions:** add each person (name, title, email). They appear on the send page. Click **Sign-in link** next to a person to copy a link you can send them. It works once.
3. **Step 2, QR code:** press **Print poster**, or **Copy link** to share the address digitally. Put the poster where people can scan it.
4. **Step 3, test:** open the send page, send a test, then open **Inbox** to read and answer it.
5. **Settings:** pick a theme and a template. The preview shows the send page and the reader inbox. Nothing changes for your readers until you press **Apply**.

Remove someone from Setup and they disappear from the send page and are signed out. Restore them any time.

## For readers

1. Open `/inbox` and enter your email, or use the link your admin sent you. With email set up you get a sign-in link by email.
2. **New** lists unread and unanswered items. Opening one marks it Seen for the sender.
3. Write a reply and press **Send reply**. It moves to **Replied**. If the sender replies back it returns to **New**.
4. **Forward** passes it to someone else. **Mark done** closes it.
5. You never see the sender's contact details.

## For senders

1. Scan the QR code (or open the address).
2. Pick who should read it, write your message, and attach a file, record a voice note or capture a video if you like.
3. Optionally add an email or phone number to be notified. Nobody who reads the message can see it.
4. Press **Send** and **save your tracking code**. It is the only way to check the status. It cannot be recovered if lost.
5. Later, open `/track` (the Check status link), enter the code, see Sent, Seen, Replied, read replies and answer them.

## Deploying on a server

Example for a Linux VPS with Node 22 and a domain pointing at it.

```bash
git clone https://github.com/muhumuza684/E-SUGGESTION-BOX-.git /opt/qr-suggestion-box
cd /opt/qr-suggestion-box
npm ci --omit=dev
```

Run it as a service, `/etc/systemd/system/qsb.service`:

```ini
[Unit]
Description=QR Suggestion Box
After=network.target

[Service]
WorkingDirectory=/opt/qr-suggestion-box
Environment=NODE_ENV=production TRUST_PROXY=1 PORT=3100
Environment=BASE_URL=https://suggest.example.co.ug DATA_DIR=/var/lib/qsb
Environment=SMTP_URL=smtps://user:pass@smtp.example.com MAIL_FROM="Suggestion box <no-reply@example.co.ug>"
ExecStart=/usr/bin/node server.js
Restart=always
User=qsb

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r qsb && sudo mkdir -p /var/lib/qsb && sudo chown qsb /var/lib/qsb
sudo systemctl enable --now qsb
```

Put HTTPS in front, for example Caddy (`/etc/caddy/Caddyfile`):

```
suggest.example.co.ug {
  reverse_proxy localhost:3100
}
```

HTTPS is required for the Voice button on phones and for secure cookies.

### Backups

Back up all of `DATA_DIR`, especially `secret.key` (without it, saved contacts cannot be read).

```bash
sqlite3 /var/lib/qsb/qsb.db ".backup /backups/qsb-$(date +%F).db"
rsync -a /var/lib/qsb/uploads /var/lib/qsb/secret.key /backups/
```

## Try it on a phone on your local network

```powershell
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -First 1).IPAddress
$env:BASE_URL = "http://$ip`:3100"
npm start
```

Reload `/admin` on the PC and scan the new QR code. Allow Node through the Windows Firewall if asked. Voice recording needs HTTPS, so on the phone use Attach or Video.

## Troubleshooting

| Problem | Fix |
|---|---|
| Port already in use | Start on another port: `$env:PORT=3200; npm start` |
| No sign-in email arrives | Email is not configured. Use Admin > **Sign-in link**, or set `SMTP_URL` |
| "This link has expired" | Links work once for 30 minutes. Request a new one |
| Voice button does nothing on a phone | Needs HTTPS. Use Attach, or deploy with HTTPS |
| Phone cannot open the page | Same Wi-Fi, `BASE_URL` set to the PC's IP, firewall allows Node |
| Lost tracking code | It cannot be recovered, by design. Send again |
| Reset everything | Stop the app and delete the `data` folder |
