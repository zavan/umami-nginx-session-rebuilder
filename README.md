# Umami-NGINX Session Rebuilder

This is a very specific tool to rebuild [Umami](https://umami.is/) sessions from NGINX access logs. It was created to fix a problem where Umami sessions were all created using the same IP because either Umami or NGINX weren't configured properly, like [in this case](https://github.com/umami-software/umami/issues/2492).

**NOTES**:
- **WARNING**: _This is a destructive process._ Make sure you a backup of your database before running anything. I recommend running it first on a copy of the database.
- Only tested on PostgreSQL.
- This tool was written to work with sessions created by *Umami >=2.9.0*, which uses the current month as a salt for the session uuid, but it can be easily adapted for earlier versions.
- The tool assumes you have the correct access times, hostnames, user-agents and IPs in the access logs.

## How to use

1. Make sure you have the correct environment variables set in a `.env` file (copy `.env.example`).
2. Place the uncompressed NGINX access logs (access.log, access.log.1, ...) in the `./files/raw` directory.
3. Run `npm start`.

Logs will be streamed to `stdout` by default, you can output it to a file if you want to save it: `npm start > ./log.log`.

If you have a lot of websites, I recommend creating an index on the domain column before running anything as the tool will query it a lot: `CREATE UNIQUE INDEX website_domain_idx ON website (domain);`

## How it works

1. File preparation: The files in `./files/raw` are filtered to only contain the lines of interest and output to `./files/prepared` (see `./src/prepare.js`). This is to speed-up the next steps.
2. Parsing: For each file, each line is parsed to extract the client IP, access time, user-agent and hostnames (see `./src/parse.js`).
3. Line/Event matching:
    1. Based on the line hostname, the `website id` is found in the database.
    2. The original (wrong) `session id` is calculated from the static (wrong) IP and secret key provided in the `.env` file.
    3. That `session id` is used alongside the `website id` and the `access time` to find the matching `website_event` (Umami's record of the page view) and `session` (Umami's record of a visitor) records.
 4. Session replacement:
    1. The correct `session id` is calculated from the IP extracted from the access logs (along with the website id, hostname, user-agent and monthly salt).
    2. Using that `session id` plus the original session data (except id), the correct session record is created or found (it may have been already created by a previous line) in the database.
    3. The `website_event` `session_id` is updated to point to that correct session record.
    4. If there are no other events associated to the original/wrong session record, it's deleted.
