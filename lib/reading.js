import { createInterface } from "node:readline/promises";

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

export { createReadlineIterator, createLineNumbersIterator };
