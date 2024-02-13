import { startOfMonth } from 'date-fns';
import { hash } from 'next-basics';
import { v5 } from 'uuid';

import { appSecret } from './config.js';

// SEE: https://github.com/umami-software/umami/blob/v2.9.0/src/lib/crypto.ts

const secretHash = hash(appSecret);

const monthSaltCache = new Map();

function salt(time) {
  const yearMonth = `${time.getFullYear()}-${time.getMonth()}`;

  let monthSalt = monthSaltCache.get(yearMonth);

  if (!monthSalt) {
    const date = startOfMonth(time).toUTCString();
    monthSalt = hash(secretHash, hash(date));
    monthSaltCache.set(yearMonth, monthSalt);
  }

  return monthSalt;
}

function uuid(websiteId, hostname, ip, userAgent, time) {
  return v5(hash(websiteId, hostname, ip, userAgent, salt(time)), v5.DNS);
}

export default uuid;
