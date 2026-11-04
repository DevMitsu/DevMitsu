# Publishing Alexandria on its own web address (Firebase Hosting)

Result: your site at `https://YOUR-PROJECT.web.app`, and later at your own domain such as `https://library.yourschool.in`.
Firebase Hosting is free for a site this size and gives the secure (https) lock automatically.

Someone has to do this with their own Google account. I cannot sign in for you.
Needed: a Google account, and a computer with Node.js installed (nodejs.org, the "LTS" button).

## A. Create the Firebase project (once)
1. Go to console.firebase.google.com and sign in with Google.
2. Click **Create a project**. Name it (for example `alexandria-library`). Turn Google Analytics **off**. Click **Create**.
3. Note the **Project ID** shown (for example `alexandria-library-4f2a1`). It becomes the address `alexandria-library-4f2a1.web.app`.

## B. Fill in the connection details
Open `public/config.js` in Notepad. Paste the Supabase Project URL and anon key (see SETUP-SUPABASE.md). Save.
If you skip this, the site runs as a demo with dummy data.

## C. Publish
Open the unzipped folder in a terminal (Windows: type `cmd` in the folder's address bar and press Enter), then run:

    npx firebase-tools login
    npx firebase-tools use --add          (choose your project)
    npx firebase-tools deploy --only hosting

When it finishes it prints the **Hosting URL**. Open it, click the logo, sign in.
To update later: change the files, run the last command again.

## D. Your own domain (optional)
1. Buy a domain from any registrar (Namecheap, GoDaddy, Hostinger, Google Domains successor). A `.in` or `.com` costs roughly ₹700 to ₹1,200 a year.
2. Firebase console, **Hosting**, **Add custom domain**. Type the domain or subdomain (for example `library.yourschool.in`).
3. Firebase shows DNS records (an A record and a TXT record). Add them at your registrar's DNS page.
4. Wait from a few minutes to a few hours. Firebase then issues the https certificate by itself.

## Security notes
- The address is public. Without a library login nobody can see any data (Supabase rules). Make sure sign-ups are turned off (SETUP-SUPABASE.md, step 3).
- Only the anon public key goes in `config.js`. Never the `service_role` key.
- The site sends strict security headers (see `firebase.json`), including a rule that it may only talk to your Supabase project.

---

# Option 2: Netlify (a `yourname.netlify.app` address, or your own domain)

This works the same way as Firebase and is the easiest of all: no command line.

## Quick way (drag and drop, 2 minutes)
1. Unzip `alexandria-netlify.zip`. Open `config.js` in Notepad, paste your Supabase Project URL and anon key between the quotes, save.
2. Go to **app.netlify.com/drop**, sign up (free), and drag the unzipped folder onto the page.
3. Netlify gives an address like `random-name-1234.netlify.app`. Open it, click the logo, sign in.
4. Site settings, **Change site name**, to get something readable like `yourschool-library.netlify.app`.
To update later: edit the files and drag the folder onto the site's **Deploys** page again.

## Automatic way (every change goes live by itself)
1. Netlify, **Add new site**, **Import an existing project**, **GitHub**, choose the `DevMitsu/DevMitsu` repository and the branch with the app.
2. Netlify reads `netlify.toml`, so leave the build settings as they are (build `npm run build`, publish `dist`).
3. Before deploying open **Site configuration, Environment variables** and add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your anon public key
   - `LIBRARIES` = `sr` (change to `sr,jr` when the Jr. Library is ready)
   The build writes them into `config.js`, so no keys are stored in the code.
4. Click **Deploy**.

## Your own domain on Netlify
**Domain management, Add a domain**, type it, and follow the DNS steps shown. The https lock is automatic.

## Notes
- `public/_headers` gives Netlify the same security rules as the Firebase setup (the site may only talk to your own Supabase project).
- A Netlify address is public. Without a library login nobody can see any data, provided sign-ups are off in Supabase.
