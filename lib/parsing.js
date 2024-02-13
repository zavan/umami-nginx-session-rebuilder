import { Transform } from "node:stream";

import { parse as dateFnsParse } from "date-fns";

// Regex for the Combined Log NGINX format:
// 172020,"172.56.90.120 - - [05/Jan/2024:00:00:14 +0000] ""POST /api/send HTTP/2.0"" 200 596 ""https://bluefinsushiramen.com/"" ""Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1"" ""-"""
const DEFAULT_REGEX = /^(\S+) (\S+) (\S+) \[([\w:/]+\s[+\-]\d{4})\] "(\S+) (\S+)\s*(\S*)" (\d{3}) (\S+) "(\S+)" "(.*)" "(.*)"$/;

class LineParsingError extends Error {
  constructor(line, property = null, match = null, ...args) {
    if (property) {
      super(`Failed to parse property '${property}': '${match}' in line: '${line}'`, ...args); 
    } else {
      super(`Failed to parse line: '${line}'`, ...args);
    }

    this.line = line;
    this.property = property;
    this.match = match;
  }
}

function parseTime(time) {
  try {
    // Format: 03/Feb/2024:01:14:25 +0000
    return dateFnsParse(time, "dd/MMM/yyyy:HH:mm:ss X", new Date());
  } catch (e) {
    return null;
  }
}

function parseReferrer(referrer) {
  if (!referrer.startsWith("http")) return null;

  try {
    return new URL(referrer);
  } catch (e) {
    return null;
  }
}

function parseLine(line, regex = DEFAULT_REGEX) {
  const match = line.match(regex);

  if (!match) throw new LineParsingError(line);

  const referrerURL = parseReferrer(match[10]);

  if (!referrerURL) throw new LineParsingError(line, 'referrer', match[10]);

  const hostname = referrerURL.hostname.toLowerCase();
  const domain = hostname.replace(/www\./, '');

  const time = parseTime(match[4]);

  if (!time) throw new LineParsingError(line, 'time', match[4]);

  const ip = match[1];

  if (!ip) throw new LineParsingError(line, 'ip', match[1]);

  const userAgent = match[11];

  if (!userAgent) throw new LineParsingError(line, 'userAgent', match[11]);

  return {
    ip,
    hostname,
    domain,
    time,
    userAgent,
    // method: match[5],
    // url: match[6],
    // protocol: match[7],
    // status: parseInt(match[8]),
    // bytes: parseInt(match[9]),
    // referrer: match[10],
  };
}

class ParseTransform extends Transform {
  constructor(options = {}) {
    super({
      ...options,
      objectMode: true,
    });
  }

  _transform(obj, _encoding, callback) {
    try {
      const parsed = parseLine(obj.line);
      this.push({ ...obj, ...parsed });
      callback();
    } catch (e) {
      if (e instanceof LineParsingError) {
        this.emit('invalid-line', e);
        callback();
      } else {
        callback(e);
      }
    }
  }
}

export { ParseTransform };
