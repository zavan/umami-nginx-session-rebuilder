#!/usr/bin/env node

import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";

import { filterToCSV } from "../lib/filtering.js";

const DEFAULT_SOURCE = 'files/raw';
const DEFAULT_DESTINATION = 'files/filtered';

async function main(source, destination) {
  const files = await readdir(source, { withFileTypes: true });

  for (const file of files) {
    if (!file.isFile() || !file.name.includes('.log')) continue;

    console.time(`Filtering ${file.name}`);

    await filterToCSV(
      createReadStream(`${source}/${file.name}`),
      createWriteStream(`${destination}/${file.name}.filtered.csv`)
    );

    console.timeEnd(`Filtering ${file.name}`);
  }

  console.log('Done!');
}

(async () => {
  await main(
    resolve(process.argv[2] || DEFAULT_SOURCE),
    resolve(process.argv[3] || DEFAULT_DESTINATION)
  );
})();
