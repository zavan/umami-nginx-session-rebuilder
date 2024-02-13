import { pipeline } from "node:stream/promises";

import { createReadlineIterator, createLineNumbersIterator } from "./reading.js";
import { format } from "fast-csv";

const DEFAULT_PATTERN = 'POST /api/send ';

function createFilterIterator(pattern = DEFAULT_PATTERN) {
  return (source) => ({
    [Symbol.asyncIterator]: async function* () {
      for await (const obj of source) {
        if (obj.line.includes(pattern)) {
          yield obj;
        }
      }
    }
  });
}

async function filterToCSV(source, destination) {
  return pipeline(
    source,
    createReadlineIterator(),
    createLineNumbersIterator(),
    createFilterIterator(),
    format({ headers: true }),
    destination
  );
}

export { filterToCSV };
