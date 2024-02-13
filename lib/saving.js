import { Transform } from "node:stream";

import sql from './db.js';
import { getLocation } from './geo.js';

async function save(obj) {
  const {
    websiteId,
    eventId,
    originalSessionId,
    correctSessionId,
    ip,
  } = obj;

  // Do everything in a transaction.
  return sql.begin(async (sql) => {
    // Find the event, the original session,
    // and check if the correct session already exists.
    const events = await sql`
      SELECT
        CASE WHEN cs.session_id IS NOT NULL THEN true ELSE false END AS correct_session_exists,
        os.hostname,
        os.browser,
        os.os,
        os.device,
        os.screen,
        os.language,
        os.country,
        os.subdivision1,
        os.subdivision2,
        os.city,
        e.created_at
      FROM website_event e
      LEFT JOIN session cs ON cs.session_id = ${correctSessionId}
      INNER JOIN session os ON e.session_id = os.session_id
      AND e.website_id = ${websiteId}
      AND e.event_id = ${eventId}
      AND e.session_id = ${originalSessionId}
      LIMIT 1
    `;

    if (!events.length) {
      throw new Error(`Event not found: ${JSON.stringify(obj)}`);
    }

    const event = events[0];

    let created = false;

    if (!event.correctSessionExists) {
      const location = await getLocation(ip);

      const createdSession = await sql`
        INSERT INTO session (
          session_id,
          website_id,
          hostname,
          browser,
          os,
          device,
          screen,
          language,
          country,
          subdivision1,
          subdivision2,
          city,
          created_at
        ) VALUES (
          ${correctSessionId},
          ${websiteId},
          ${event.hostname},
          ${event.browser},
          ${event.os},
          ${event.device},
          ${event.screen},
          ${event.language},
          ${location?.country || event.country},
          ${location?.subdivision1 || event.subdivision1},
          ${location?.subdivision2 || event.subdivision2},
          ${location?.city || event.city},
          ${event.createdAt}
        ) ON CONFLICT (session_id) DO NOTHING
      `;

      created = createdSession.count > 0;
    }

    // Update the event to use the correct session.
    const updated = await sql`
      UPDATE website_event
      SET session_id = ${correctSessionId}
      WHERE website_id = ${websiteId}
      AND event_id = ${eventId}
    `;

    // If the original session is now empty, delete it.
    const deleted = await sql`
      DELETE FROM session
      WHERE session_id = ${originalSessionId}
      AND NOT EXISTS (
        SELECT 1
        FROM website_event
        WHERE session_id = ${originalSessionId}
      )
    `;

    return {
      correctSessionExisted: event.correctSessionExists,
      createdCorrectSession: created,
      updatedEvent: updated.count > 0,
      deletedOriginalSession: deleted.count > 0,
    };
  });
}

class SaveTransform extends Transform {
  constructor(options = {}) {
    super({
      ...options,
      objectMode: true,
    });
  }

  async _transform(obj, _, done) {
    try {
      const saved = await save(obj);
      this.push({ ...obj, ...saved });
    } catch (err) {
      this.emit('saving-failed', err);
    }
  
    done();
  }
}

export { SaveTransform };
