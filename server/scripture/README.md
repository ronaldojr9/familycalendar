# Bundled scripture text

`web-proverbs.json` and `web-psalms.json` hold the **World English Bible** (WEB)
text of Proverbs and Psalms, as `[chapter][verse]` arrays of strings.

The WEB is in the **public domain** — no permission or attribution is required
to copy, modify or redistribute it. Derived from
<https://github.com/TehShrike/world-english-bible>.

## Why not the NLT?

The New Living Translation is copyrighted by Tyndale House Publishers, so its
text cannot be committed to this repository. The app instead fetches NLT
chapters at run time from Tyndale's own API (<https://api.nlt.to>) using a free
key the household enters in Settings, and caches them in the local database so
the hub keeps working offline afterwards.

Whichever translation is on screen is always labelled in the UI, so the two are
never confused.
