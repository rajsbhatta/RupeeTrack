[README.md](https://github.com/user-attachments/files/28377248/README.md)
# ₹ RupeeTrack – Personal Finance Vault

A **zero-cost, zero-backend, offline-first PWA** to manage your personal finances. All data is stored only on your device using `localStorage`. Nothing is ever sent to any server.

---

## Features

| Module | What you can track |
|---|---|
| **Monthly Bills** | Electricity, water, rent, maid — with due day, generated day, reminders, last payment |
| **Annual Bills** | Building tax, OTT subscriptions, domain renewals — with annual due date and reminder |
| **Credit Cards** | Statement date, due date, credit limit, outstanding, utilisation % |
| **Investments** | FD, MF, stocks, bonds, PPF, NPS, gold, RD — with invested amount, current value, gain/loss, maturity reminder |
| **Insurance** | Life, health, term, vehicle policies — with premium due date, sum assured, policy expiry alerts |
| **Alerts Dashboard** | Consolidated upcoming dues across all categories |
| **Backup & Restore** | Export all data as JSON; import it back any time |

### Security
- 4-digit PIN stored locally
- Security question for PIN recovery
- All data in device `localStorage` only

### PWA
- Installable on Android, iOS, Windows, macOS, Linux
- Works fully offline after first load
- Browser push notifications for due date reminders

---

## Deploy to GitHub Pages (Free)

1. **Fork or create** a new repository on GitHub (e.g. `my-rupeetrack`)
2. **Upload** all 5 files into the repository root:
   - `index.html`
   - `app.js`
   - `sw.js`
   - `manifest.json`
   - `icon-192.png`
   - `icon-512.png`
3. Go to **Settings → Pages**
4. Set source to **Deploy from branch: `main` / root (`/`)**
5. Click **Save**. Your app will be live at `https://yourusername.github.io/my-rupeetrack/`

> 💡 For PWA install to work, GitHub Pages uses HTTPS by default, which is required.

---

## Files

```
rupeetrack/
├── index.html      ← Full app UI (single page)
├── app.js          ← All logic, storage, rendering
├── sw.js           ← Service worker (offline + notifications)
├── manifest.json   ← PWA manifest
├── icon-192.png    ← App icon 192×192
└── icon-512.png    ← App icon 512×512
```

---

## Privacy

> **RupeeTrack collects zero data.** Everything is stored in your browser's `localStorage` which never leaves your device. There are no analytics, no tracking, no ads, no server calls.

---

## Ideas for Future Enhancements

- **EMI Tracker** – Track home loan, car loan EMIs with outstanding balance
- **Budget Planner** – Set monthly budgets per category, track spending vs budget
- **Net Worth Dashboard** – Assets minus liabilities, trended over time
- **SIP Tracker** – Systematic investment plan tracking with XIRR calculation
- **Expense Log** – Day-to-day expense entry with categories and tags
- **PIN auto-lock** – Lock app after X minutes of inactivity
- **Multi-currency** – For NRIs tracking assets in multiple currencies
- **Family vault** – Separate profiles on same device

---

*Built with ❤ and ₹ — zero dependencies, zero cost, 100% yours.*
