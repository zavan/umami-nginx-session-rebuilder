#!/usr/bin/env node

import { resolve } from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { format, parse } from "fast-csv";
import pino from 'pino';

import { sortedReadDir } from "../lib/reading.js";
import { IdentifyTransform } from "../lib/identifying.js";

const DEFAULT_SOURCE = 'files/parsed';
const DEFAULT_DESTINATION = 'files/identified';

function buildLogger(name) {
  const transport = pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: { destination: `logs/identifying-${name}.log` },
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

    console.time(`Identifying ${file.name}`);

    const logger = buildLogger(file.name);

    const transform = new IdentifyTransform();

    transform.on('invalid-object', (err) => {
      logger.warn(err, 'Failed to identify object');
    });

    await pipeline(
      createReadStream(`${source}/${file.name}`),
      parse({ headers: true }).transform((row) => ({
        ...row,
        time: new Date(row.time),
      })),
      transform,
      format({ headers: true }).transform((row) => ({
        ...row,
        time: row.time.toISOString(),
      })),
      createWriteStream(`${destination}/${file.name}.identified.csv`)
    );

    console.timeEnd(`Identifying ${file.name}`);
  }

  console.log('Done!');
}

(async () => {
  await main(
    resolve(process.argv[2] || DEFAULT_SOURCE),
    resolve(process.argv[3] || DEFAULT_DESTINATION)
  );
})();
