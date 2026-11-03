# Setting up the shared database (Supabase)

This makes every device see the same data, live. You do this once. It takes about 20 minutes and needs no coding.

You need: a free Supabase account, the file `alexandria.html`, and the school logo as `school-logo.png` (optional, I can embed it).

## 1. Create the project
1. Go to supabase.com and sign up or sign in.
2. Click **New project**. Name it `alexandria`. Choose a **database password** and write it down somewhere safe.
3. Choose the region nearest you (for India, **South Asia (Mumbai)** if offered). Click **Create new project** and wait about two minutes.

## 2. Create the tables and safety rules
1. In the left menu open **SQL Editor** and click **New query**.
2. Open the file `supabase/schema.sql`, copy everything, paste it in, and click **Run**.
3. It should say **Success. No rows returned.** You can run it again safely.

## 3. Stop strangers from making their own login (important)
1. Open **Authentication**, then **Sign In / Providers** (in some versions, **Providers**), then **Email**.
2. Turn **off** "Allow new users to sign up". Click **Save**.

## 4. Create the library logins
1. Open **Authentication**, then **Users**, then **Add user**, then **Create new user**.
2. Email: `sr-library@alexandria-app.com`. Choose a strong password. Tick **Auto Confirm User**. Click **Create user**.
3. The username in the app is the part before the `@`, so here it is `sr-library`. (No email is ever sent. The address is only a name.)
4. When the Jr. Library is ready, repeat with `jr-library@alexandria-app.com`.
   Different usernames: tell me and I will change the app's list.

## 5. Copy the two connection details
1. Open **Project Settings**, then **API**.
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. Copy the **anon public** key (a long text). Do **not** use the `service_role` key anywhere.

## 6. Connect the app
1. Open `alexandria.html`. Click the logo, then **Connection settings** at the bottom of the sign-in box.
2. Paste the URL and the key, click **Save and connect**, then sign in with `sr-library` and its password.
3. Open **Settings**, then **Shared database**, then **Run connection test**. Every line should have a tick. If one does not, the line tells you what to fix.

## 7. Put your data in
1. **Collections, Add many:** paste your book list from Excel (columns: accession, title, subtitle, author, genre, publisher, year, ISBN, status).
2. **Students, Add many:** paste class lists. **Teachers tab, Add many:** paste teachers.
3. Books the old list marks as "Issued" with no borrower can be cleared one at a time: scan the book in Issue / Return and choose **Mark it returned**.

## 8. More devices
Open the same `alexandria.html` (or the website, if you host it) on each device, enter the URL and key once, and sign in. Phones and tablets cannot open a file from a pendrive, so for those host the file online (for example Netlify Drop or GitHub Pages) and open that address.

## 9. Put it online (so every device can open it)
Use the folder from `alexandria-site.zip` (unzip it). Open `config.js` in Notepad, paste your Project URL and anon key between the quotes, and save. Then upload the whole folder to a free host:
- **Netlify Drop (easiest):** go to app.netlify.com/drop, sign in, and drag the folder onto the page. You get an address like `something.netlify.app`; you can rename it.
- **Firebase Hosting (gives `yourname.web.app`):** needs a Google account and the Firebase command line tool; ask your IT manager or me for the exact commands.
- **Cloudflare Pages** or **GitHub Pages** work too.
Because the address is public, anyone can see the logo page, but nobody can see any data without a library login. Keep `config.js` with the anon key only; never put the `service_role` key anywhere.

## Good to know
- Each visit starts at the logo. Closing the browser signs you out, and the app signs out after 30 minutes without activity (change it in Settings).
- A free Supabase project may pause after a week without use. Check the current plan limits. For daily automatic backups choose a paid plan, and in any case use **Settings, Copy backup** each week.
- If two devices issue the same book at the same moment, the database allows only one. The other device is told and shows the latest data.
- The Sr. Library is switched on. To switch the Jr. Library on later: Connection settings, tick "The Jr. Library is ready to use".
