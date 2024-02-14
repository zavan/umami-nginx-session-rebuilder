# Umami-NGINX Session Rebuilder

This is a very specific tool to rebuild [Umami](https://umami.is/) sessions from NGINX access logs. It was created to fix a problem where Umami sessions were all created using the same IP because either Umami or NGINX weren't configured properly, like [in this case](https://github.com/umami-software/umami/issues/2492).

**NOTES**:
- **WARNING**: _The last step (saving) is a destructive process._ Make sure to backup your database before running it. I recommend running it first on a copy of the database.
- NGINX logs must be in the Combined format (the default), but this can be adapted by changing the regex passed to `parseLine(line, regex)` if needed.
- Only works with PostgreSQL.
- This tool was written to work with sessions created by *Umami >=2.9.0*, which uses the current month as a salt for the session uuid, but it can be easily adapted for earlier versions (check `lib/uuid.js`).
- The tool assumes you have the correct access times, hostnames, user-agents and IPs in the access logs.
- This tool was written to fix an urgent issue and thus does not have automated tests and uses some quick and dirty ways to do some things. I recommend reading the source-code (it's realatively simple if you're familiar with node streams and the way Umami works) before trying to use it. Start with the files in `bin` and work your way from there.

## How to use

1. Set the environment variables in a `.env` file (copy `.env.example` and fill).
2. Place the uncompressed NGINX access logs (access.log, access.log.1, ...) in the `files/raw` directory.
3. Place the [MaxMind geo db](https://raw.githubusercontent.com/GitSquared/node-geolite2-redist/master/redist/GeoLite2-City.tar.gz) file in the `geo` directory.
4. Run in order, making sure each step is successful before running the next:
   1. `npm run filter`
   2. `npm run parse`
   3. `npm run identify`
   4. `npm run match`
   5. `npm run save` (**DESTRUCTIVE STEP, HAVE A DB BACKUP**)

Logs will be streamed to `stdout` and saved in JSONL to the `logs` directory.

The slowest step are usually `match` and `save` but most of that wait is caused by latency when talking to the DB, so the closer you can get the tool to your database server (say, running it in the same server as the DB, or in a server in the same subnetwork) the faster it will run.

## How it works

Each step takes input files from the previous step directory, runs its operations for each row, and outputs new files with extra data to its directory.

1. Filtering (`npm run filter`, `bin/filter.js`):
   - Input: Raw log files in `files/raw`.
   - Operation: The files are filtered to only contain the lines of interest (`POST /api/send` ...).
   - Output: CSV files in `files/filtered` containing the original line number and the actual log line.
2. Parsing (`npm run parse`, `bin/parse.js`):
   - Input: CSV files in `files/filtered`.
   - Operation: Lines are parsed using a regex to extract the client IP, access time, user-agent, hostname and domain.
   - Output: CSV files in `files/parsed` containing previous data plus the parsed data.
3. Identifying (`npm run identify`, `bin/identify.js`):
   - Input: CSV files in `files/parsed`.
   - Operation: The websiteId is found using the domain. The originalSessionId is calculated from websiteId, hostname, savedIp (from `.env`), userAgent and time, and the correctSessionId is calculated the same way except using the parsed ip.
   - Output: CSV files in `files/identified` containing previous data plus the the calculated data.
4. Matching (`npm run match`, `bin/match.js`):
   - Input: CSV files in `files/identified`.
   - Operation: Using the websiteId, originalSessionId and time, the line is matched to a `website_event` in the Umami database.
   - Output: CSV files in `files/matched` containing previous data plus the matched eventId.
5. Saving (`npm run save`, `bin/save.js`) (**DESTRUCTIVE STEP, HAVE A DB BACKUP**):
   - Input: CSV files in `files/matched`.
   - Operations (all done inside a DB transaction so they are rolled back if an error occurs):
      1. The website_event is found in the database by its eventId.
      2. If the correct session record does not exist yet in the database, it's created by combining the correctSessionId, the original session data, the event createdAt, and new ip-based location data.
      3. If it does exist and its createdAt is after the event date, it's updated to the event's createdAt. This guarantees that each session has its first event's createdAt as they should.
      4. The event's sessionId is updated to the correctSessionId.
      5. If the original session does not have any more events, it's deleted.
      6. Information regarding these operations is returned: correctSessionExisted, createdCorrectSession, updatedEvent, deletedOriginalSession.
   - Output: CSV files in `files/saved` containing previous data plus the returned data.

If a step fails for any row, the error is logged (`stdout` and `logs` directory) and the process continues.

You can have an idea of the progress of each step by counting the lines of the files in the directory of the current step, for example: `wc -l files/parsed/*.csv`.
