"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { lastNameKey, sortKey, loadSortDecisions } = require("./person-index-sorting");

(async () => {
  assert.equal(lastNameKey("R’ Leib Chasman (Ohr Yahel)"), "Chasman R’ Leib");
  assert.equal(lastNameKey("Rashi"), "Rashi");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "index-sorting-"));
  try {
    for (const file of ["person-index-sorting.js", "review-person-index-sorting.js"]) {
      await fs.copyFile(path.join(__dirname, file), path.join(dir, file));
    }
    await fs.writeFile(path.join(dir, "person-index-review.json"), JSON.stringify({ people: {
      book: { displayName: "A Short Vort" }, person: { displayName: "R’ Aaron Goodman" },
      compound: { displayName: "R’ David de Sola" },
    } }));
    const run = input => {
      const result = spawnSync(process.execPath, [path.join(dir, "review-person-index-sorting.js")], { input, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    run("f\nl\nq\n");
    const file = path.join(dir, "person-index-sort.json");
    let saved = await loadSortDecisions(file);
    assert.equal(saved.people.book.sortKey, "A Short Vort");
    assert.equal(saved.people.person.sortKey, "Goodman R’ Aaron");
    assert.equal(Object.keys(saved.people).length, 2);
    assert.match(run("c\nde Sola David\n"), /1 names to review/);
    saved = await loadSortDecisions(file);
    assert.equal(saved.people.compound.sortKey, "de Sola David");
    assert.equal(sortKey({ id: "person", displayName: "R’ Aaron Goodman" }, saved), "Goodman R’ Aaron");
    assert.equal(sortKey({ id: "person", displayName: "Changed Name" }, saved), "Changed Name");
    assert.match(run(""), /0 names to review/);
    await fs.writeFile(file, "{broken");
    await assert.rejects(loadSortDecisions(file));
    console.log("Index sorting tests passed (save, resume, custom keys, renamed entries, malformed JSON).");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
