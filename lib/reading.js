import { readdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

async function sortedReadDir(path) {
  const files = await readdir(path, { withFileTypes: true });

  return files.sort((a, b) => {
    const aNum = parseInt(a.name.split('.')[2]);
    const bNum = parseInt(b.name.split('.')[2]);

    const v = bNum - aNum;

    // Hacky way to put non-numbered files last.
    if (isNaN(v)) return 1;

    return v;
  });
}

function createReadlineIterator(options = { crlfDelay: Infinity }) {
  return (input) => createInterface({
    input,
    ...options
  });
}

function createLineNumbersIterator() {
  let lineNumber = 0;

  return (source) => ({
    [Symbol.asyncIterator]: async function* () {
      for await (const line of source) {
        yield { lineNumber, line };
        lineNumber++;
      }
    }
  });
}

export { sortedReadDir, createReadlineIterator, createLineNumbersIterator };
