#!/usr/bin/env node
"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline");
const { SORT_FILE, lastNameKey, indexDisplayName, loadSortDecisions } = require("./person-index-sorting");

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(`Usage: node review-person-index-sorting.js [--include-reviewed]

Review every selected index name. Enter F for the full current name, L for
last-name sorting, C for a custom sort key, or Q to quit. Press Enter after
each choice. Parenthetical aliases are ignored when finding the last name.
Choices save immediately to person-index-sort.json; reruns resume automatically.
--include-reviewed lets you revise saved choices. L and C entries print surname/custom name first, followed by a comma.
Unreviewed or renamed entries keep their current full-name sorting.`);
    return;
  }
  for (const arg of args) {
    if (arg !== "--include-reviewed") throw new Error(`Unknown argument: ${arg}`);
  }
  const review = JSON.parse(await fs.readFile(path.join(__dirname, "person-index-review.json"), "utf8"));
  const decisions = await loadSortDecisions();
  const people = Object.entries(review.people).map(([id, p]) => ({ id, displayName: p.displayName }))
    .filter(p => p.displayName).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const pending = people.filter(p => args.includes("--include-reviewed") || decisions.people[p.id]?.displayName !== p.displayName);
  console.log(`${pending.length} names to review. F = full name, L = last name, C = custom, Q = quit.`);
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async prompt => {
    process.stdout.write(prompt);
    const line = await lines.next();
    return line.done ? null : line.value.trim();
  };
  try {
    for (const [i, person] of pending.entries()) {
      const last = lastNameKey(person.displayName);
      console.log(`\n[${i + 1}/${pending.length}] ${person.displayName}\n  F: ${person.displayName}\n  L: ${last}`);
      if (decisions.people[person.id]) console.log(`  Saved: ${decisions.people[person.id].sortKey}`);
      let mode, key;
      while (true) {
        const answer = await ask("F / L / C / Q: ");
        if (answer === null || answer.toUpperCase() === "Q") return;
        mode = answer.toUpperCase();
        if (mode === "F") key = person.displayName;
        else if (mode === "L") key = last;
        else if (mode === "C") {
          key = await ask('Custom name or full "Last name, First name" label: ');
          if (key === null) return;
          if (!key) continue;
        } else continue;
        break;
      }
      decisions.people[person.id] = { displayName: person.displayName, mode, sortKey: key };
      const temp = `${SORT_FILE}.${process.pid}.tmp`;
      await fs.writeFile(temp, JSON.stringify(decisions, null, 2) + "\n");
      await fs.rename(temp, SORT_FILE);
      console.log(`Saved: ${key}\nIndex label: ${indexDisplayName(person, decisions)}`);
    }
    console.log("\nReview complete. Rebuild the book to apply the saved sorting.");
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
