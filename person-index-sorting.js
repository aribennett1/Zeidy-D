"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const SORT_FILE = path.join(__dirname, "person-index-sort.json");

function lastNameKey(name) {
  // Parenthetical aliases are not part of the primary name.
  const primary = name.split("(")[0].trim();
  const words = primary.split(/\s+/);
  const last = words.pop();
  return words.length ? `${last}, ${words.join(" ")}` : last;
}

function sortKey(person, decisions) {
  const choice = decisions.people[person.id];
  // A renamed entry needs a new decision; do not silently reuse an old choice.
  if (!choice || choice.displayName !== person.displayName) return person.displayName;
  return choice.sortKey;
}

function indexDisplayName(person, decisions) {
  const choice = decisions.people[person.id];
  if (!choice || choice.displayName !== person.displayName || choice.mode === "F") {
    return person.displayName;
  }
  if (choice.mode === "L") {
    const aliasAt = person.displayName.indexOf("(");
    const aliases = aliasAt < 0 ? "" : ` ${person.displayName.slice(aliasAt)}`;
    return lastNameKey(person.displayName) + aliases;
  }
  // Explicit comma-form custom names are printed exactly as entered.
  if (choice.sortKey.includes(",")) return choice.sortKey;
  // Support existing custom keys, including reordered keys such as
  // "Landau R’ Avraham", while preserving locations and parenthetical aliases.
  const words = person.displayName.split(/\s+/);
  const keyWords = choice.sortKey.split(/\s+/);
  for (let count = keyWords.length; count > 0; count--) {
    const prefix = keyWords.slice(0, count);
    const at = words.findIndex((_, i) => prefix.every((word, j) => words[i + j] === word));
    if (at < 0) continue;
    const rest = [...words.slice(0, at), ...words.slice(at + count)].join(" ");
    return prefix.join(" ") + (rest ? `, ${rest}` : "");
  }
  return `${choice.sortKey}, ${person.displayName}`;
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

module.exports = { SORT_FILE, lastNameKey, sortKey, indexDisplayName, loadSortDecisions };
