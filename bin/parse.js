#!/usr/bin/env node

import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { format, parse } from "fast-csv";

import { ParseTransform } from "../lib/parsing.js";

const DEFAULT_SOURCE = 'files/filtered';
const DEFAULT_DESTINATION = 'files/parsed';

function buildLogger(name) {
  const transport = pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: { destination: `logs/parsing-${name}.log` },
      },
      { target: 'pino-pretty' },
    ],
  });

  return pino(transport);
}

async function main(source, destination) {
  const files = await readdir(source, { withFileTypes: true });

  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.csv')) continue;

    console.time(`Parsing ${file.name}`);

    const logger = buildLogger(file.name);

    const transform = new ParseTransform();

    transform.on('invalid-line', (err) => {
      logger.warn(err, 'Failed to parse line');
    });

    await pipeline(
      createReadStream(`${source}/${file.name}`),
      parse({ headers: true }),
      transform,
      format({ headers: true }).transform((row) => ({
        ...row,
        time: row.time.toISOString(),
      })),
      createWriteStream(`${destination}/${file.name}.parsed.csv`)
    );

    console.timeEnd(`Parsing ${file.name}`);
  }

  console.log('Done!');
}

(async () => {
  await main(
    resolve(process.argv[2] || DEFAULT_SOURCE),
    resolve(process.argv[3] || DEFAULT_DESTINATION)
  );
})();
