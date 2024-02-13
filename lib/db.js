import postgres from "postgres";
import prexit from "prexit";

import { databaseURL } from "./config.js";

const sql = postgres(databaseURL, { transform: postgres.toCamel });

async function closeDB() {
  return sql.end({ timeout: 2 });
}

prexit(async () => {
  await closeDB();
});

export default sql;
export { closeDB };
