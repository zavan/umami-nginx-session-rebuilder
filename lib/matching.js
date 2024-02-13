import { Transform } from "node:stream";

import sql from "./db.js";

class MatchError extends Error {
  constructor(obj, ...args) {
    super('Failed to match', ...args);
    this.obj = obj;
  }
}

class Matcher {
  constructor() {
    this.eventIds = {};
  }

  async match(obj) {
    const { websiteId, originalSessionId, time } = obj;

    const event = await this.findEvent(websiteId, originalSessionId, time);

    if (!event) throw new MatchError(obj);

    return event;
  }

  // Start with a 1 second window, then expand to 3 if no events are found
  async findEvent(websiteId, sessionId, time, window = 1) {
    const start = new Date(time.getTime() - window * 1000);
    const end = new Date(time.getTime() + window * 1000);

    const eventResults = await sql`
      SELECT e.event_id
      FROM website_event e
      WHERE e.website_id = ${websiteId}
      AND e.session_id = ${sessionId}
      AND e.created_at BETWEEN ${start} AND ${end}
      ${
        this.eventIds[sessionId]
          ? sql`AND e.event_id NOT IN ${sql(this.eventIds[sessionId])}`
          : sql``
      }
      LIMIT 1
    `;

    if (eventResults.length) {
      const event = eventResults[0];
      const eventId = event.eventId;

      this.eventIds[sessionId]?.push(eventId) || (this.eventIds[sessionId] = [eventId]);

      return event;
    }

    if (window === 3) {
      // Give up.
      return null;
    }

    return this.findEvent(websiteId, sessionId, time, 3);
  }
}

class MatchTransform extends Transform {
  constructor(options = {}) {
    super({
      ...options,
      objectMode: true,
    });

    this.matcher = new Matcher();
  }

  async _transform(obj, _encoding, callback) {
    try {
      const matched = await this.matcher.match(obj);
      this.push({ ...obj, ...matched });
      callback();
    } catch (e) {
      if (e instanceof MatchError) {
        this.emit('matching-failed', e);
        callback();
      } else {
        callback(e);
      }
    }
  }
}

export { MatchTransform };
