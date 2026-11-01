"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const SORT_FILE = path.join(__dirname, "person-index-sort.json");

function lastNameKey(name) {
  // Parenthetical aliases are not part of the primary name.
  const primary = name.split("(")[0].trim();
  const words = primary.split(/\s+/);
  const last = words.pop();
  return [last, ...words].join(" ");
}

function sortKey(person, decisions) {
  const choice = decisions.people[person.id];
  // A renamed entry needs a new decision; do not silently reuse an old choice.
  if (!choice || choice.displayName !== person.displayName) return person.displayName;
  return choice.sortKey;
}

async function loadSortDecisions(file = SORT_FILE) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, people: {} };
    throw error;
  }
  if (data.version !== 1 || !data.people || typeof data.people !== "object" || Array.isArray(data.people)) {
    throw new Error(`Invalid index sorting file: ${file}`);
  }
  for (const choice of Object.values(data.people)) {
    if (!choice || !["F", "L", "C"].includes(choice.mode) || typeof choice.displayName !== "string" || typeof choice.sortKey !== "string" || !choice.sortKey.trim()) {
      throw new Error(`Invalid index sorting decision in ${file}`);
    }
  }
  return data;
}

module.exports = { SORT_FILE, lastNameKey, sortKey, loadSortDecisions };
