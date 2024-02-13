#!/usr/bin/env node

import { resolve } from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { format, parse } from "fast-csv";
import pino from 'pino';

import { sortedReadDir } from "../lib/reading.js";
import { SaveTransform } from "../lib/saving.js";

const DEFAULT_SOURCE = 'files/matched';
const DEFAULT_DESTINATION = 'files/saved';

function buildLogger(name) {
  const transport = pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: { destination: `logs/saving-${name}.log` },
      },
      { target: 'pino-pretty' },
    ],
  });

  return pino(transport);
}

async function main(source, destination) {
  const files = await sortedReadDir(source);

  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.csv')) continue;

    console.time(`Saving ${file.name}`);

    const logger = buildLogger(file.name);

    const transform = new SaveTransform();

    transform.on('saving-failed', (err) => {
      logger.warn(err, 'Failed to save object');
    });

    await pipeline(
      createReadStream(`${source}/${file.name}`),
      parse({ headers: true }),
      transform,
      format({ headers: true }),
      createWriteStream(`${destination}/${file.name}.saved.csv`)
    );

    console.timeEnd(`Saving ${file.name}`);
  }

  console.log('Done!');
}

(async () => {
  await main(
    resolve(process.argv[2] || DEFAULT_SOURCE),
    resolve(process.argv[3] || DEFAULT_DESTINATION)
  );
})();
