import { Transform } from "node:stream";

import sql from "./db.js";
import uuid from "./uuid.js";
import { savedIp } from "./config.js";

const websiteCache = {};

async function findWebsiteId(domain) {
  let websiteId = websiteCache[domain];

  if (websiteId === undefined) {
    const websiteResults = await sql`SELECT website_id FROM website WHERE domain = ${domain} LIMIT 1`;

    if (!websiteResults.length) {
      websiteCache[domain] = null;
      return null;
    }

    websiteId = websiteResults[0].websiteId;
    websiteCache[domain] = websiteId;
  }

  return websiteId;
}

class IdentifyError extends Error {
  constructor(property, obj, ...args) {
    super(`Failed to identify ${property}`, ...args);
    this.property = property;
    this.obj = obj;
  }
}

async function identify(obj) {
  const { ip, hostname, domain, time, userAgent } = obj;

  const websiteId = await findWebsiteId(domain);

  if (!websiteId) throw new IdentifyError('websiteId', obj);

  const originalSessionId = uuid(websiteId, hostname, savedIp, userAgent, time);
  const correctSessionId = uuid(websiteId, hostname, ip, userAgent, time);

  return {
    websiteId,
    originalSessionId,
    correctSessionId,
  };
}

class IdentifyTransform extends Transform {
  constructor(options = {}) {
    super({
      ...options,
      objectMode: true,
    });
  }

  async _transform(obj, _encoding, callback) {
    try {
      const identified = await identify(obj);
      this.push({ ...obj, ...identified });
      callback();
    } catch (e) {
      if (e instanceof IdentifyError) {
        this.emit('invalid-object', e);
        callback();
      } else {
        callback(e);
      }
    }
  }
}

export { IdentifyTransform };
