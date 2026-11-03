// Alexandria connection settings. Edit this file BEFORE uploading the site.
// Leave the two "PASTE" values as they are to run the demo (dummy data, demo passwords).
// After setting up Supabase (see SETUP-SUPABASE.md), paste your Project URL and anon public key.
window.ALEXANDRIA_CONFIG = {
  mode: 'supabase',
  url: 'PASTE-YOUR-PROJECT-URL-HERE',      // e.g. https://abcdefgh.supabase.co
  anonKey: 'PASTE-YOUR-ANON-PUBLIC-KEY-HERE',
  libraries: ['sr'],                        // change to ['sr', 'jr'] when the Jr. Library is ready
};
