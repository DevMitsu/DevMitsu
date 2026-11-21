# Sharing the lab data between computers (Supabase)

By default Lab Inventory keeps its data in one browser on one computer. This guide connects it to a free **Supabase** database so that every teacher and lab assistant, on any computer or phone, sees the same labs, live. You do it once. It takes about 20 minutes and needs no coding.

You need: a free Supabase account and the app (`lab-inventory.html`, or the website if you host it).

## 1. Create the project
1. Go to supabase.com and sign up or sign in.
2. Click **New project**. Name it `lab-inventory` (it can share a project with other school apps: it uses its own table). Choose a **database password** and keep it somewhere safe.
3. Choose the region nearest you and click **Create new project**. Wait about two minutes.

## 2. Create the table and the safety rules
1. In the left menu open **SQL Editor** and click **New query**.
2. Open `supabase/schema.sql`, copy everything, paste it in, and click **Run**.
3. It should say **Success. No rows returned.** You can run it again safely.

## 3. Stop strangers from making their own login (important)
1. Open **Authentication → Sign In / Providers → Email**.
2. Turn **off** "Allow new users to sign up". Click **Save**.

## 4. Create a login for each person
1. Open **Authentication → Users → Add user → Create new user**.
2. Email: the person's username followed by `@lab-inventory-app.com`, for example `ms-sharma@lab-inventory-app.com`. Choose a password. Tick **Auto Confirm User**. Click **Create user**.
3. In the app they sign in with just the part before the `@` (`ms-sharma`). No email is ever sent: the address is only a name.
4. Give every person their own login. The app stamps entries with the signed-in name, so the logs show who did what.

Only logins ending in `@lab-inventory-app.com` can read or write the data. The public key alone can do nothing.

## 5. Copy the two connection details
1. Open **Project Settings → API**.
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. Copy the **anon public** key (a long text). **Never use the `service_role` key anywhere.** The app refuses it.

## 6. Connect the app
**On one computer (easiest):** open the app, go to **Customise → Data & backup → Shared database → Connect to Supabase…**, paste the URL and key, and click **Save and connect**. Sign in. Then click **Run connection test**: every line should have a tick, and if one does not, the line says what to fix.

**For the whole school:** host the app online and put the connection in `config.js` (below), so nobody has to type it in.

### What happens to the data you already have
- **The database is empty** (the first time): this computer's data becomes the shared data. If this computer has not been set up yet, you get the normal setup screen, and what you choose there is shared.
- **The database already has data**: the shared data is loaded. If the computer had its own data, that is set aside, not deleted. **Customise → Data & backup → Restore what this computer had before** brings it back if you disconnect.

## 7. More computers
Open the same app on each one, enter the URL and key once (**Connection settings** at the bottom of the sign-in box), and sign in. Phones and tablets cannot open a file from a pendrive, so for those host the app online (step 8).

## 8. Put it online (so every device can open it)
```bash
cd lab-inventory
npm install
SUPABASE_URL=https://abcdefgh.supabase.co SUPABASE_ANON_KEY=<anon public key> npm run build
```
This writes `dist/config.js` with the connection. Upload the whole `dist/` folder to a free host such as Netlify Drop (app.netlify.com/drop), Cloudflare Pages or GitHub Pages. On Netlify you can instead set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables and let it run `npm run build`. Without the build tools, edit `dist/config.js` (or `public/config.js` before building) in Notepad and paste the two values between the quotes.

`npm run build:single` with the same two variables set produces one `dist/lab-inventory.html` that already knows the connection.

The address is public, so anyone can see the sign-in page, but nobody can read or change data without a login. The anon key is meant to be visible; the `service_role` key must never be put in a web app.

## How sharing behaves
- **Live.** A change on one computer appears on the others within a second or two. The top bar shows **Shared** (green), **Saving…**, or **Offline**.
- **Stock adds up correctly.** If two people use the same chemical at the same moment, both deductions count. Each item's quantity is worked out from its stock history on every computer, so nobody's change can overwrite another's.
- **Offline.** If the connection drops, you can keep working. Changes wait and are saved when it returns. The browser warns before you close the tab with unsaved changes.
- **Editing the same record at the same time.** The last save wins for that one record (for example two people editing the same accident report). Other records are unaffected.
- **Undo** works for your own last change until a change from someone else arrives. After that it is switched off, because it would also undo their work.
- **Nothing is kept on the computer.** In shared mode the school's records are not stored in the browser, so signing out leaves nothing behind on a shared lab PC. Only that computer's own preferences (theme, text size, columns) are kept. Sign-in lasts until the tab or browser is closed.
- **Everyone with a login can change everything**, including erasing the data. There are no separate roles. Dangerous actions (remove all data, erase, restore a backup) ask you to type a word first, and a backup file is your safety net: **Download backup** regularly. Supabase's paid plans add daily automatic backups.
- **Two items can end up with the same code** if two computers add an item to the same category at the very same moment. The codes are labels, not keys, so nothing breaks: edit one of them.
- A free Supabase project may pause after a week without use. Check the current plan limits.

## Something not working?
Run **Customise → Data & backup → Shared database → Run connection test**. It checks that the database is reachable, that you are signed in with a staff login, that saving works, and that live updates reach you, and it says what to fix for each.
