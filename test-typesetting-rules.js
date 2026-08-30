#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const {
  PDF_PATTERNS,
  repairPdfExtractedTrailingPunctuationArtifacts,
  scanTextForPattern,
  shouldSkipLineForPattern,
  TYP_PATTERNS,
} = require("./audit-typeset");

const {
  applyDocxParagraphAlignments,
  applyTextRules,
  convertDocxToTypst,
  normalizeMisplacedHebrewCommas,
  normalizeColonHebrewSoftBreaks,
  normalizeHebrewParagraphSoftBreaks,
  normalizeIsolatedPunctuationSpacing,
  normalizeNumberedSoftBreaks,
  normalizePunctuationSpacing,
  protectMixedLtrParentheticals,
  repairEscapedHebrewParagraphCitations,
  repairSplitGemaraSources,
  renderPersonIndex,
  shiftedParagraphAlignments,
  tagPersonIndexMentions,
  tightenHaskamaSignatureBlock,
  stripDuplicateTitle,
  wrapIndexDisplayName,
} = require("./build-typeset-proof");

const LTR_ISOLATE = "\u2066";
const RTL_ISOLATE = "\u2067";
const POP_DIRECTIONAL_ISOLATE = "\u2069";
const ROOT_DIR = __dirname;
const FILES_DIR = path.join(ROOT_DIR, "Files");
const ROUTES = require("./routes.json").byRoute;

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function titleFromBaseFilename(filename) {
  return String(filename || "")
    .replace(/\.[^.]+$/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromRouteSegment(segment) {
  return String(segment || "")
    .replace(/^\d+\s*-\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function docxEntry(route) {
  const details = ROUTES[route];
  assert.ok(details, `Route not found in routes.json: ${route}`);

  const baseTitle = titleFromBaseFilename(details.baseFilename);
  const title = details.title
    ? details.title.replace(/\s+/g, " ").trim()
    : baseTitle;
  const directory = path.join(FILES_DIR, details.contentPath);
  const routeSegmentTitles = details.contentPath
    .split("/")
    .map(titleFromRouteSegment)
    .filter(Boolean);

  return {
    route,
    title,
    isHaskama: details.contentPath.startsWith("07 - Haskamos/"),
    sourceTitles: [title, baseTitle, ...routeSegmentTitles],
    docxPath: path.join(directory, `${details.baseFilename}.docx`),
  };
}

function convertedDocx(route) {
  return convertDocxToTypst(docxEntry(route));
}

function convertedDocxWithIndex(route, aliases) {
  const people = aliases.map((alias, index) => ({
    id: alias.id || `person-${index + 1}`,
    displayName: alias.displayName || alias.id || `Person ${index + 1}`,
    aliases: alias.aliases,
  }));
  const indexState = {
    people,
    mentions: new Map(people.map((person) => [person.id, []])),
    nextMarker: 1,
  };

  return convertDocxToTypst(docxEntry(route), indexState);
}

function assertContains(haystack, needle, label = needle) {
  assert.ok(
    haystack.includes(needle),
    `Expected converted Typst to contain ${label}\n\nNeedle:\n${needle}\n`
  );
}

function assertNotContains(haystack, needle, label = needle) {
  assert.ok(
    !haystack.includes(needle),
    `Expected converted Typst not to contain ${label}\n\nNeedle:\n${needle}\n`
  );
}

function auditPattern(patterns, label) {
  const pattern = patterns.find((candidate) => candidate.label === label);
  assert.ok(pattern, `Audit pattern not found: ${label}`);
  return pattern;
}

function auditMatches(value, pattern, source = "PDF visual text") {
  return pattern.re.test(scanTextForPattern(value, pattern, source));
}

test("adds spaces after commas and removes spaces before commas", () => {
  assert.equal(
    normalizePunctuationSpacing("נזיקין,בבא קמא , בבא מציעא"),
    "נזיקין, בבא קמא, בבא מציעא"
  );
});

test("audit ignores PDF-extracted leading comma that is visually trailing Hebrew punctuation", () => {
  const pattern = auditPattern(PDF_PATTERNS, "leading punctuation before Hebrew");
  const line = "your children, your ⁧‫אייניקלעך‬,⁩ and your ⁧‫עיר אייניקלעך‬,⁩ all following ⁧,‫בדרך השם‬";

  assert.equal(auditMatches(line, pattern), false);
});

test("audit ignores PDF-extracted semicolon that is visually trailing Hebrew punctuation", () => {
  const pattern = auditPattern(PDF_PATTERNS, "leading punctuation before Hebrew");
  const line = "‫ ⁩שבת‬comes in, we have to perforce add on from ⁧‫ ⁩חול‬to ⁧‫ֲאָבל ַהָּקדֹוׁש ָּברּוְך⁧ ;⁩קודש‬";

  assert.equal(auditMatches(line, pattern), false);
});

test("audit still flags real leading punctuation before Hebrew", () => {
  const pdfPattern = auditPattern(PDF_PATTERNS, "leading punctuation before Hebrew");
  const typPattern = auditPattern(TYP_PATTERNS, "space before punctuation in Typst source");

  assert.equal(auditMatches("all following ,בדרך השם", pdfPattern), true);
  assert.equal(auditMatches("all following בדרך השם ,", typPattern, "Typst source"), true);
});

test("audit flags source space on both sides of colon", () => {
  const pattern = auditPattern(TYP_PATTERNS, "space on both sides of colon in Typst source");

  assert.equal(auditMatches("(12:2) : ⁧הַחֹדֶשׁ", pattern, "Typst source"), true);
  assert.equal(auditMatches("(12:2): ⁧הַחֹדֶשׁ", pattern, "Typst source"), false);
  assert.equal(auditMatches("(12:2):⁧הַחֹדֶשׁ", pattern, "Typst source"), false);
});

test("audit flags source space on both sides of semicolon", () => {
  const pattern = auditPattern(TYP_PATTERNS, "space on both sides of semicolon in Typst source");

  assert.equal(auditMatches("⁧השם אחד⁩ \\; ⁧רחמים⁩", pattern, "Typst source"), true);
  assert.equal(auditMatches("⁧השם אחד; רחמים⁩", pattern, "Typst source"), false);
  assert.equal(auditMatches("אריז״ל\\;#metadata(none) <person-index-1> it's not", pattern, "Typst source"), false);
});

test("audit flags quotes surrounded by spaces", () => {
  const pdfPattern = auditPattern(PDF_PATTERNS, "quote surrounded by spaces");
  const typPattern = auditPattern(TYP_PATTERNS, "quote surrounded by spaces in Typst source");

  assert.equal(auditMatches('paid up, " the sibling said', pdfPattern), true);
  assert.equal(auditMatches('the sibling said. "Look, the money', pdfPattern), false);
  assert.equal(auditMatches('paid up, \\" the sibling said', typPattern, "Typst source"), true);
  assert.equal(auditMatches('the sibling said. \\"Look, the money', typPattern, "Typst source"), false);
});

test("audit flags missing source space after colon before Hebrew isolate", () => {
  const pattern = auditPattern(TYP_PATTERNS, "missing space after colon before Hebrew in Typst source");

  assert.equal(auditMatches("(12:2):⁧הַחֹדֶשׁ", pattern, "Typst source"), true);
  assert.equal(auditMatches("(12:2): ⁧הַחֹדֶשׁ", pattern, "Typst source"), false);
  assert.equal(auditMatches("https://zeidyd.com/bo/5784/", pattern, "Typst source"), false);
});

test("audit allows colon inside parenthesized source references", () => {
  const pattern = auditPattern(TYP_PATTERNS, "missing space after colon before Hebrew in Typst source");

  assert.equal(auditMatches("as we know ⁦(משלי ו:כג)⁩ ⁧כִּי נֵר", pattern, "Typst source"), false);
  assert.equal(auditMatches("⁦(רש״י ל״ב:ט׳)⁩: \\", pattern, "Typst source"), false);
  assert.equal(auditMatches("the famous saying about ⁧עפר ואפר⁩:⁧עפר⁩ is", pattern, "Typst source"), true);
  assert.equal(auditMatches("⁦(משלי ו:כג)⁩:⁧כִּי נֵר", pattern, "Typst source"), true);
});

test("audit skips broken thousands separator findings on index pages only", () => {
  const pattern = auditPattern(PDF_PATTERNS, "broken thousands separator");

  assert.equal(
    shouldSkipLineForPattern("A Short Vort 248, 283, 303", pattern, {
      source: "PDF visual text",
      title: "Index",
    }),
    true
  );
  assert.equal(
    shouldSkipLineForPattern("R’ Elimelech Biderman ........................ 342, 349, 361, 403, 404, 410, 413,", pattern, {
      source: "PDF visual text",
      title: "R’ Elimelech Biderman ........................ 342, 349, 361, 403, 404, 410, 413,",
    }),
    true
  );
  assert.equal(
    shouldSkipLineForPattern("415, 421", pattern, {
      source: "PDF visual text",
      title: "R’ Elimelech Biderman ........................ 342, 349, 361, 403, 404, 410, 413,",
    }),
    true
  );
  assert.equal(
    shouldSkipLineForPattern("(Lutzker Rav, The Oznayim LaTorah) . 11, 20, 96, 101, 116, 145, 151,", pattern, {
      source: "PDF visual text",
      title: "R' Shlomo Zalman Sonnenfeld ............ 205",
    }),
    true
  );
  assert.equal(
    shouldSkipLineForPattern("There are 12, 196 letters", pattern, {
      source: "PDF visual text",
      title: "Bo 5783",
    }),
    false
  );
});

test("wraps selected typst paragraphs in docx alignment", () => {
  const alignments = new Map([
    [0, { align: "center", text: "first" }],
    [2, { align: "right", text: "שלום וברכה" }],
    [3, { align: "right", text: "English text" }],
  ]);

  assert.equal(
    applyDocxParagraphAlignments("first\n\nsecond\n\nthird\n\nfourth", alignments),
    "#align(center)[\nfirst\n]\n\nsecond\n\n#align(right)[\nthird\n]\n\nfourth"
  );
});

test("right-aligns Hebrew-only paragraphs without explicit docx alignment", () => {
  assert.equal(
    applyDocxParagraphAlignments("English paragraph\n\nשלום וברכה", new Map()),
    "English paragraph\n\n#align(right)[\nשלום וברכה\n]"
  );
});

test("does not auto-align paragraphs containing ascii numbers", () => {
  assert.equal(
    applyDocxParagraphAlignments("תהלים 105:24", new Map()),
    "תהלים 105:24"
  );
});

test("splits Hebrew paragraph from following English after double soft break", () => {
  assert.equal(
    normalizeHebrewParagraphSoftBreaks("שלום וברכה \\ \\ The next paragraph"),
    "שלום וברכה\n\nThe next paragraph"
  );
});

test("shifts docx paragraph alignment after stripped title paragraphs", () => {
  const shifted = shiftedParagraphAlignments(
    new Map([
      [0, { align: "both", text: "Title" }],
      [1, { align: "right", text: "שלום" }],
    ]),
    1
  );

  assert.deepEqual([...shifted.entries()], [
    [0, { align: "right", text: "שלום" }],
  ]);
});

test("tightens haskama signature paragraphs into line breaks", () => {
  assert.equal(
    tightenHaskamaSignatureBlock("Body paragraph.\n\nYossi Bennett\n\nWoodmere, NY\n\nי״ג אב תשפ״ו\n\nJuly 27#super[th], 2026"),
    "Body paragraph.\n\nYossi Bennett\n#linebreak()\nWoodmere, NY\n#linebreak()\nי״ג אב תשפ״ו\n#linebreak()\nJuly 27#super[th], 2026"
  );
});

test("converts escaped numbered soft breaks to typst line breaks", () => {
  assert.equal(
    normalizeNumberedSoftBreaks("\\1. First item \\ 2. Second item \\ \\3. Third item"),
    "\\1. First item \\\n\\2. Second item \\\n\\3. Third item"
  );
});

test("preserves paragraph break after colon before numbered list", () => {
  assert.equal(
    applyTextRules("I count five:\n\n\\1. First item \\ 2. Second item"),
    "I count five: \\\n\\1. First item \\\n\\2. Second item"
  );
});

test("converts consecutive escaped numbered paragraphs to tight hard breaks", () => {
  assert.equal(
    applyTextRules("questions:\n\n\\1. First question.\n\n\\2. Second question.\n\n\\3. Third question."),
    "questions: \\\n\\1. First question.\\\n\\2. Second question.\\\n\\3. Third question."
  );
});

test("converts colon before Hebrew quote paragraph to tight line break", () => {
  assert.equal(
    normalizeColonHebrewSoftBreaks("second time (22:15-17):\n\nוַיִּקְרָא מַלְאַךְ"),
    "second time (22:15-17):\\\nוַיִּקְרָא מַלְאַךְ"
  );
});

test("keeps numeric thousands separators tight", () => {
  assert.equal(
    normalizePunctuationSpacing("There are 12,196 letters, which appears again as 12, 196"),
    "There are 12,196 letters, which appears again as 12,196"
  );
});

test("removes spaces before sentence punctuation", () => {
  assert.equal(
    normalizePunctuationSpacing("R' Moshe Sternbuch , who quoted Rav Itzele Peterburger . What"),
    "R’ Moshe Sternbuch, who quoted Rav Itzele Peterburger. What"
  );
});

test("removes spaces before closing parenthesis", () => {
  assert.equal(
    normalizePunctuationSpacing("it is the בית הלוי ). He says"),
    "it is the בית הלוי). He says"
  );
});

test("moves English closing quote before said attribution", () => {
  assert.equal(
    normalizePunctuationSpacing('"My friend, " said Reb Levi Yitzchok'),
    '“My friend,” said Reb Levi Yitzchok'
  );
});

test("removes space between comma and closing quote before attribution", () => {
  assert.equal(
    normalizePunctuationSpacing('paid up, " the sibling said'),
    'paid up,” the sibling said'
  );
});

test("moves punctuation inside nested English close quotes", () => {
  assert.equal(
    normalizePunctuationSpacing("help me marry off my daughters'\". \"My friend"),
    "help me marry off my daughters.'\” \“My friend"
  );
});

test("converts Hebrew trailing straight apostrophe to geresh", () => {
  assert.equal(
    normalizePunctuationSpacing("this is וראית את אחורי וגו' - The"),
    "this is וראית את אחורי וגו׳ - The"
  );
  assert.equal(
    normalizePunctuationSpacing("later you'll understand"),
    "later you'll understand"
  );
});

test("keeps person index markers after adjacent punctuation", () => {
  assert.equal(
    normalizePunctuationSpacing(
      "R' Moshe Sternbuch#metadata(none) <person-index-1>, who quoted Rav Itzele Peterburger#metadata(none) <person-index-2>. What"
    ),
    "R’ Moshe Sternbuch, #metadata(none) <person-index-1> who quoted Rav Itzele Peterburger.#metadata(none) <person-index-2> What"
  );
});

test("keeps person index markers after escaped semicolon punctuation", () => {
  assert.equal(
    normalizePunctuationSpacing("אריז״ל#metadata(none) <person-index-arizal-1>\\; it's not"),
    "אריז״ל\\;#metadata(none) <person-index-arizal-1> it's not"
  );
});

test("keeps person index marker after close parenthesis", () => {
  assert.equal(
    normalizePunctuationSpacing(
      "it is the בית הלוי#metadata(none) <person-index-bais-halevi-33>). He says"
    ),
    "it is the בית הלוי).#metadata(none) <person-index-bais-halevi-33> He says"
  );
});

test("wraps mixed Hebrew English parenthetical in LTR isolate", () => {
  assert.equal(
    applyTextRules("by מנחה, (אגב I did not mention this in the shiur\non שבת), and therefore"),
    `by ${RTL_ISOLATE}מנחה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${LTR_ISOLATE}(${RTL_ISOLATE}אגב${POP_DIRECTIONAL_ISOLATE} I did not mention this in the shiur\non ${RTL_ISOLATE}שבת${POP_DIRECTIONAL_ISOLATE}),${POP_DIRECTIONAL_ISOLATE} and therefore`
  );
});

test("adds spaces between adjacent Hebrew and English words", () => {
  assert.equal(
    applyTextRules("we have מצוותwhich are נגד הטבע and quoted inמעינה"),
    `we have ${RTL_ISOLATE}מצוות${POP_DIRECTIONAL_ISOLATE} which are ${RTL_ISOLATE}נגד הטבע${POP_DIRECTIONAL_ISOLATE} and quoted in ${RTL_ISOLATE}מעינה${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("removes pandoc source wrapping newlines inside Hebrew runs", () => {
  assert.equal(
    applyTextRules("it says, וַיְדַבֵּר פַּרְעֹה אֶל יוֹסֵף בַּחֲלֹמִי\nהִנְנִי עֹמֵד עַל שְׂפַת הַיְאֹר."),
    `it says, ${RTL_ISOLATE}וַיְדַבֵּר פַּרְעֹה אֶל יוֹסֵף בַּחֲלֹמִי הִנְנִי עֹמֵד עַל שְׂפַת הַיְאֹר${POP_DIRECTIONAL_ISOLATE}.`
  );
});

test("adds space after citation before Hebrew quote", () => {
  assert.equal(
    normalizePunctuationSpacing("(שמות כ״א:ל״ז):כִּי"),
    "(שמות כ״א:ל״ז): כִּי"
  );
});

test("keeps source space after colon before isolated Hebrew", () => {
  assert.equal(
    applyTextRules("(12:2): הַחֹדֶשׁ הַזֶּה"),
    `(12:2): ${RTL_ISOLATE}הַחֹדֶשׁ הַזֶּה${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("preserves space after Hebrew label colon before Hebrew quote", () => {
  assert.equal(
    normalizePunctuationSpacing("The פסוק says in פסוק ב: דַּבֵּר"),
    "The פסוק says in פסוק ב: דַּבֵּר"
  );
});

test("adds space after colon between isolated Hebrew runs", () => {
  assert.equal(
    normalizeIsolatedPunctuationSpacing(`${LTR_ISOLATE}מהר״ל${POP_DIRECTIONAL_ISOLATE}:${RTL_ISOLATE}מזמור שיר${POP_DIRECTIONAL_ISOLATE}`),
    `${LTR_ISOLATE}מהר״ל${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}מזמור שיר${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("adds space after sentence punctuation between isolated Hebrew runs", () => {
  assert.equal(
    normalizeIsolatedPunctuationSpacing(`${RTL_ISOLATE}עול מלכות שמים${POP_DIRECTIONAL_ISOLATE}.${RTL_ISOLATE}בן ננס${POP_DIRECTIONAL_ISOLATE}`),
    `${RTL_ISOLATE}עול מלכות שמים${POP_DIRECTIONAL_ISOLATE}. ${RTL_ISOLATE}בן ננס${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps Hebrew citation colons tight", () => {
  assert.equal(
    normalizePunctuationSpacing("כ״א : ל״ז"),
    "כ״א:ל״ז"
  );
});

test("keeps numeric source references tight", () => {
  assert.equal(
    normalizePunctuationSpacing("itself says (25:7) וְשָׁכַנְתִּי"),
    "itself says (25:7) וְשָׁכַנְתִּי"
  );
});

test("adds space after numeric parenthesized source before Hebrew quote", () => {
  assert.equal(
    applyTextRules("The dream described (37:9)הַשֶּׁמֶשׁ וְהַיָּרֵחַ"),
    `The dream described (37:9) ${RTL_ISOLATE}הַשֶּׁמֶשׁ וְהַיָּרֵחַ${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps Hebrew quote after numeric source in one RTL run", () => {
  assert.equal(
    applyTextRules("as follows (14:31): וַיַּרְא יִשְׂרָאֵל אֶת הַיָּד הַגְּדֹלָה אֲשֶׁר עָשָׂה ה׳ בְּמִצְרַיִם וַיִּירְאוּ הָעָם אֶת ה׳ וַיַּאֲמִינוּ בַּה׳ וּבְמֹשֶׁה עַבְדּוֹ."),
    `as follows (14:31): ${RTL_ISOLATE}וַיַּרְא יִשְׂרָאֵל אֶת הַיָּד הַגְּדֹלָה אֲשֶׁר עָשָׂה ה׳ בְּמִצְרַיִם וַיִּירְאוּ הָעָם אֶת ה׳ וַיַּאֲמִינוּ בַּה׳ וּבְמֹשֶׁה עַבְדּוֹ${POP_DIRECTIONAL_ISOLATE}.`
  );
});

test("keeps Hebrew phrase with trailing numeric source in visual reading order", () => {
  assert.equal(
    applyTextRules("The פסוק says in פרשת כי תשא\\(30:23), וְאַתָּה קַח לְךָ"),
    `The ${RTL_ISOLATE}פסוק${POP_DIRECTIONAL_ISOLATE} says in ${RTL_ISOLATE}פרשת כי תשא${POP_DIRECTIONAL_ISOLATE} ${LTR_ISOLATE}(30:23),${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}וְאַתָּה קַח לְךָ${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps semicolon between Hebrew phrases in English sentence order", () => {
  assert.equal(
    applyTextRules("Hashem of רחמים \\; השם אחד - רחמים and דין is one"),
    `Hashem of ${RTL_ISOLATE}רחמים${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE};${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}השם אחד${POP_DIRECTIONAL_ISOLATE} - ${RTL_ISOLATE}רחמים${POP_DIRECTIONAL_ISOLATE} and ${RTL_ISOLATE}דין${POP_DIRECTIONAL_ISOLATE} is one`
  );
});

test("keeps gerushin mizbeach phrase in English sentence order", () => {
  assert.equal(
    applyTextRules("if חס ושלום there's a גירושין, מזבח מוריד דמעות - the מזבח cries"),
    `if ${RTL_ISOLATE}חס ושלום${POP_DIRECTIONAL_ISOLATE} there's a ${RTL_ISOLATE}גירושין${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מזבח מוריד דמעות${POP_DIRECTIONAL_ISOLATE} - the ${RTL_ISOLATE}מזבח${POP_DIRECTIONAL_ISOLATE} cries`
  );
});

test("repairs escaped open parenthesis after numeric source reference", () => {
  assert.equal(
    applyTextRules("The פסוק says (30:15\\(:הֶעָשִׁיר לֹא"),
    `The ${RTL_ISOLATE}פסוק${POP_DIRECTIONAL_ISOLATE} says (30:15): ${RTL_ISOLATE}הֶעָשִׁיר לֹא${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("repairs duplicate escaped open parenthesis before numeric source reference", () => {
  assert.equal(
    applyTextRules("The מדרש רבה (\\(23:3, as quoted"),
    `The ${RTL_ISOLATE}מדרש רבה${POP_DIRECTIONAL_ISOLATE} (23:3), as quoted`
  );
});

test("repairs escaped open parenthesis after Hebrew label before numeric source", () => {
  assert.equal(
    applyTextRules("in the פסוק (\\(45:24: וַיְשַׁלַּח"),
    `in the ${RTL_ISOLATE}פסוק${POP_DIRECTIONAL_ISOLATE} (45:24): ${RTL_ISOLATE}וַיְשַׁלַּח${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("strips duplicate source title when route title has copy marker", () => {
  assert.equal(
    stripDuplicateTitle("Chukas 5784\n\nפרשת חקת", ["Chukas 5784 (1)"]),
    "פרשת חקת"
  );
});

test("strips duplicate source title with same-line parenthetical subtitle", () => {
  assert.equal(
    stripDuplicateTitle(
      "10 Teves 5785 \\ (Erev Shabbos)\n\nThe אבודרהם says",
      ["10 Teves 5785"]
    ),
    "The אבודרהם says"
  );
});

test("strips duplicate source title with next-line parenthetical subtitle", () => {
  assert.equal(
    stripDuplicateTitle(
      "10 Teves 5785\n(Erev Shabbos)\n\nThe אבודרהם says",
      ["10 Teves 5785"]
    ),
    "The אבודרהם says"
  );
});

test("strips duplicate source title when copy marker moves before year", () => {
  assert.equal(
    stripDuplicateTitle(
      "Simchas Torah (1) 5786\n\nFor שמחת תורה",
      ["Simchas Torah 5786 (1)"]
    ),
    "For שמחת תורה"
  );
});

test("strips duplicate source title with alternate b av spelling", () => {
  assert.equal(
    stripDuplicateTitle("Tu B'Av 5784\n\nחמישה עשר באב", ["15 Av 5784"]),
    "חמישה עשר באב"
  );
});

test("fails when docx title is only a route-title suffix", () => {
  assert.throws(
    () => stripDuplicateTitle("Sheini 5784]\n\nPesach is coming up", ["Pesach Sheini 5784"]),
    /DOCX title "Sheini 5784\]" does not match route title/
  );
});

test("fails when docx title uses alternate spelling not listed by route", () => {
  assert.throws(
    () => stripDuplicateTitle("Nitzavim/Vayeilech 5783]\n\nThis week's פרשיות", ["Nitzavim-Vayailech 5783"]),
    /DOCX title "Nitzavim\/Vayeilech 5783\]" does not match route title/
  );
});

test("strips duplicate source title with explicit route title", () => {
  assert.equal(
    stripDuplicateTitle("Nitzavim/Vayeilech 5783]\n\nThis week's פרשיות", ["Nitzavim/Vayeilech 5783"]),
    "This week's פרשיות"
  );
});

test("explicit route title overrides mismatched docx title", () => {
  assert.equal(
    stripDuplicateTitle("Vayikrah 5784\n\nThis week's parsha", ["Vayikra 5784"], { allowTitleOverride: true }),
    "This week's parsha"
  );
});

test("strips duplicate source title using route segment context", () => {
  assert.equal(
    stripDuplicateTitle("Krovitz Purim 5783\n\nWe said this morning", [
      "Krovitz",
      "Purim",
    ]),
    "We said this morning"
  );
});

test("restores missing open parenthesis on loose Hebrew citation closes", () => {
  assert.equal(
    normalizePunctuationSpacing("know ישעיהו ו׳:ג׳)) מְלֹא כׇל הָאָרֶץ"),
    "know (ישעיהו ו׳:ג׳) מְלֹא כׇל הָאָרֶץ"
  );
});

test("restores missing open parenthesis in Hebrew citation after English article", () => {
  assert.equal(
    normalizePunctuationSpacing("the תוכחה דברים כ״ח:מ״ז)): תַּחַת"),
    "the תוכחה (דברים כ״ח:מ״ז): תַּחַת"
  );
});

test("restores missing open parenthesis on named numeric citation from raw pandoc", () => {
  assert.equal(
    normalizePunctuationSpacing("as the פסוק says דברים 15:18)): וּבֵרַכְךָ"),
    "as the פסוק says (דברים 15:18): וּבֵרַכְךָ"
  );
});

test("normalizes Hebrew perek before pasuk references", () => {
  assert.equal(
    normalizePunctuationSpacing("in פסוק טו פרק מא, it says"),
    "in פרק מא פסוק טו, it says"
  );
});

test("normalizes trailing Hebrew parsha label before English", () => {
  assert.equal(
    applyTextRules("חיי שרה פרשת begins with"),
    `${RTL_ISOLATE}פרשת חיי שרה${POP_DIRECTIONAL_ISOLATE} begins with`
  );
  assert.equal(
    applyTextRules("פרשת בראשית begins with"),
    `${RTL_ISOLATE}פרשת בראשית${POP_DIRECTIONAL_ISOLATE} begins with`
  );
  assert.equal(
    applyTextRules("This week is פרשת תזריע-מצורע, which follows"),
    `This week is ${RTL_ISOLATE}פרשת תזריע-מצורע${POP_DIRECTIONAL_ISOLATE}, which follows`
  );
});

test("adds spaces around dash between Hebrew phrase and English explanation", () => {
  assert.equal(
    normalizePunctuationSpacing("כִּי קְרוֹבָה יְשׁוּעָתִי לָבוֹא- First"),
    "כִּי קְרוֹבָה יְשׁוּעָתִי לָבוֹא - First"
  );
});

test("replaces em dashes with hyphen-minus", () => {
  assert.equal(
    normalizePunctuationSpacing("This idea\u2014we know\u2014is important"),
    "This idea-we know-is important"
  );
});

test("keeps same-line bold Hebrew continuation inside the preceding RTL isolate", () => {
  assert.equal(
    applyTextRules("שְׁנֵי לֻחות אֲבָנִים הורִיד בְּיָדו #strong[וְכָתוּב בָּהֶם שְׁמִירַת שַׁבָּת] - That"),
    `${RTL_ISOLATE}שְׁנֵי לֻחות אֲבָנִים הורִיד בְּיָדו #strong[וְכָתוּב בָּהֶם שְׁמִירַת שַׁבָּת]${POP_DIRECTIONAL_ISOLATE} - That`
  );
});

test("keeps bold Hebrew inline inside a surrounding Hebrew phrase", () => {
  assert.equal(
    applyTextRules("what is the emphasis מתנה #strong[טובה] יש לי בבית גנזי?"),
    `what is the emphasis ${RTL_ISOLATE}מתנה #strong[טובה] יש לי בבית גנזי${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}?${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps italic Hebrew inline inside a surrounding Hebrew phrase", () => {
  assert.equal(
    applyTextRules("what is the emphasis מתנה #emph[טובה] יש לי בבית גנזי?"),
    `what is the emphasis ${RTL_ISOLATE}מתנה #emph[טובה] יש לי בבית גנזי${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}?${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("removes spaces around styled Hebrew letters inside words", () => {
  assert.equal(
    applyTextRules("אָמַ #strong[רְ] תִּי אַפְ #strong[אֵ] יהֶם אַשְׁ #strong[בִּ] יתָה מֵאֱ #strong[נֹ] ושׁ"),
    `${RTL_ISOLATE}אָמַ#strong[רְ]תִּי אַפְ#strong[אֵ]יהֶם אַשְׁ#strong[בִּ]יתָה מֵאֱ#strong[נֹ]ושׁ${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps Hebrew quote continuations in one RTL phrase", () => {
  assert.equal(
    applyTextRules('on the pasuk לדעת כי אני ה׳ מקדשכם" אמר הקב״ה למשה משה מתנה טובה יש לי בבית גנזי" - I have'),
    `on the pasuk ${RTL_ISOLATE}”לדעת כי אני ה׳ מקדשכם“ אמר הקב״ה למשה משה מתנה טובה יש לי בבית גנזי${POP_DIRECTIONAL_ISOLATE} - I have`
  );
});

test("keeps English quotes outside a quoted Hebrew phrase", () => {
  assert.equal(
    applyTextRules('we both said simultaneously, "סַבּוּנִי גַם סְבָבוּנִי."'),
    `we both said simultaneously, “${RTL_ISOLATE}סַבּוּנִי גַם סְבָבוּנִי${POP_DIRECTIONAL_ISOLATE}.”`
  );
});

test("moves extracted leading comma to the end of the Hebrew phrase", () => {
  assert.equal(
    normalizeMisplacedHebrewCommas("to משה, ,אֱחוֹז בְּכִסֵּא כְבוֹדִי symbolizes"),
    "to משה, אֱחוֹז בְּכִסֵּא כְבוֹדִי, symbolizes"
  );
});

test("collapses duplicate commas between Hebrew list items", () => {
  assert.equal(
    applyTextRules("when he grows in מצות, ,מעשים טובים and תורה, he"),
    `when he grows in ${RTL_ISOLATE}מצות${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מעשים טובים${POP_DIRECTIONAL_ISOLATE} and ${RTL_ISOLATE}תורה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} he`
  );
});

test("keeps comma-separated Hebrew list before English sentence in reading order", () => {
  assert.equal(
    applyTextRules("עשירות is תורה, מצוות, ומעשים טובים. That is עשירות"),
    `${RTL_ISOLATE}עשירות${POP_DIRECTIONAL_ISOLATE} is ${RTL_ISOLATE}תורה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מצוות${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}ומעשים טובים${POP_DIRECTIONAL_ISOLATE}. That is ${RTL_ISOLATE}עשירות${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps trailing comma with Hebrew phrase in reading order", () => {
  assert.equal(
    applyTextRules("may grant us ישועות, נחמות, and גואל צדק"),
    `may grant us ${RTL_ISOLATE}ישועות${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}נחמות${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} and ${RTL_ISOLATE}גואל צדק${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("removes spaces before escaped sentence punctuation after Hebrew", () => {
  assert.equal(
    applyTextRules("There are no pockets in תכריכים \\.\""),
    `There are no pockets in ${RTL_ISOLATE}תכריכים${POP_DIRECTIONAL_ISOLATE}\\.”`
  );
});

test("keeps single Hebrew phrase with trailing comma together before English", () => {
  assert.equal(
    applyTextRules("from רב שלמה גאנצפריד, the famous author"),
    `from ${RTL_ISOLATE}רב שלמה גאנצפריד${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} the famous author`
  );
});

test("keeps comma after Hebrew phrase before quoted English", () => {
  assert.equal(
    applyTextRules("Hashem said to משה, “Let there be חושך”"),
    `Hashem said to ${RTL_ISOLATE}משה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} “Let there be ${RTL_ISOLATE}חושך${POP_DIRECTIONAL_ISOLATE}”`
  );
});

test("keeps comma after quoted Hebrew phrase before closing quote", () => {
  assert.equal(
    applyTextRules("Hashem will say, “Okay, I'll give you a מצוה,” and He'll"),
    `Hashem will say, “Okay, I'll give you a ${RTL_ISOLATE}מצוה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE}” and He'll`
  );
});

test("keeps comma after Hebrew phrase before index marker and English", () => {
  assert.equal(
    applyTextRules("According to the אוצר פלאות התורה, #metadata(none) <person-index-1> who bentchs"),
    `According to the ${RTL_ISOLATE}אוצר פלאות התורה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} #metadata(none) <person-index-1> who bentchs`
  );
});

test("keeps comma after Hebrew phrase before bracketed English", () => {
  assert.equal(
    applyTextRules("on the פרשה, [Rav Tzadka from the"),
    `on the ${RTL_ISOLATE}פרשה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} [Rav Tzadka from the`
  );
  assert.equal(
    applyTextRules("on the פרשה, \\[Rav Tzadka from the"),
    `on the ${RTL_ISOLATE}פרשה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} \\[Rav Tzadka from the`
  );
});

test("keeps comma after Hebrew phrase before numbered continuation", () => {
  assert.equal(
    applyTextRules("1) מזוזה, 2) ציצית, 3) תפילין של ראש, and 4) תפילין של יד"),
    `1) ${RTL_ISOLATE}מזוזה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} 2) ${RTL_ISOLATE}ציצית${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} 3) ${RTL_ISOLATE}תפילין של ראש${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} and 4) ${RTL_ISOLATE}תפילין של יד${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps comma after Hebrew phrase before bare number", () => {
  assert.equal(
    applyTextRules("four times מחנה, 412. Each"),
    `four times ${RTL_ISOLATE}מחנה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} 412. Each`
  );
});

test("keeps Hebrew question phrase in one RTL run", () => {
  assert.equal(
    applyTextRules("We say: מַצָּה זוֹ שֶׁאָנוּ אוֹכְלִים, עַל שׁוּם מַה? עַל שׁוּם"),
    `We say: ${RTL_ISOLATE}מַצָּה זוֹ שֶׁאָנוּ אוֹכְלִים, עַל שׁוּם מַה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}?${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}עַל שׁוּם${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps pure Hebrew comma list visually spaced inside RTL run", () => {
  assert.equal(
    applyTextRules("What qualities contribute to a מצוה? אהבה, זריזות, יראה, כוונה - these aspects"),
    `What qualities contribute to a ${RTL_ISOLATE}מצוה${POP_DIRECTIONAL_ISOLATE}? ${RTL_ISOLATE}אהבה, זריזות, יראה, כוונה${POP_DIRECTIONAL_ISOLATE} - these aspects`
  );
});

test("keeps comma after single Hebrew phrase before English", () => {
  assert.equal(
    applyTextRules("As the בית הלוי, which this is from, says"),
    `As the ${RTL_ISOLATE}בית הלוי${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} which this is from, says`
  );
});

test("keeps comma after Hebrew phrase before index marker and newline English", () => {
  assert.equal(
    applyTextRules("as quoted by the בית הלוי, #metadata(none) <person-index-bais-halevi-1>\nnotes"),
    `as quoted by the ${RTL_ISOLATE}בית הלוי${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} #metadata(none) <person-index-bais-halevi-1>\nnotes`
  );
});

test("keeps internal Hebrew commas attached before spaces", () => {
  assert.equal(
    applyTextRules("אינו יודע רגעיו ועתיו ושעותיו, נכנס בו כחוט השערה - Since"),
    `${RTL_ISOLATE}אינו יודע רגעיו ועתיו ושעותיו, נכנס בו כחוט השערה${POP_DIRECTIONAL_ISOLATE} - Since`
  );
});

test("keeps Hebrew acronym token together", () => {
  assert.equal(
    applyTextRules('רש\\"י says'),
    `${LTR_ISOLATE}רש״י${POP_DIRECTIONAL_ISOLATE} says`
  );
});

test("keeps short Hebrew acronym phrase in logical order", () => {
  assert.equal(
    applyTextRules('There is a יסודותדיק רמב\\"ן at the beginning'),
    `There is a ${LTR_ISOLATE}יסודותדיק רמב״ן${POP_DIRECTIONAL_ISOLATE} at the beginning`
  );
});

test("keeps shorthand acronym phrase in logical order", () => {
  assert.equal(
    applyTextRules('part of שובבים ת\\"ת, which includes'),
    `part of ${LTR_ISOLATE}שובבים ת״ת${POP_DIRECTIONAL_ISOLATE}, which includes`
  );
});

test("keeps Hebrew phrase with internal geresh token in one RTL run", () => {
  assert.equal(
    applyTextRules("called out מי לה׳ אלי and broke"),
    `called out ${RTL_ISOLATE}מי לה׳ אלי${POP_DIRECTIONAL_ISOLATE} and broke`
  );
});

test("keeps comma-separated Hebrew bracha phrase in one reading order", () => {
  assert.equal(
    applyTextRules("all following בדרך השם,בנים ובני בנים עוסקים בתורה ובמצוות, להגדיל תורה ולהאדירה, עד עולם!"),
    `all following ${RTL_ISOLATE}בדרך השם, בנים ובני בנים עוסקים בתורה ובמצוות, להגדיל תורה ולהאדירה, עד עולם${POP_DIRECTIONAL_ISOLATE}!`
  );
});

test("keeps Hebrew hyphenated divine name in one reading order", () => {
  assert.equal(
    applyTextRules("spell י-ה, Hashem's name"),
    `spell ${RTL_ISOLATE}י-ה${POP_DIRECTIONAL_ISOLATE}, Hashem's name`
  );
});

test("keeps Hebrew hyphenated phrase with trailing name in one reading order", () => {
  assert.equal(
    applyTextRules("understood as בי-יששכר בנימין - who speaks"),
    `understood as ${RTL_ISOLATE}בי${POP_DIRECTIONAL_ISOLATE} - ${RTL_ISOLATE}יששכר בנימין${POP_DIRECTIONAL_ISOLATE} - who speaks`
  );
});

test("keeps Hebrew phrase split by ellipsis in one reading order", () => {
  assert.equal(
    applyTextRules("אַחַת שָׁאַלְתִּי מֵאֵת ה׳ \\... שִׁבְתִּי בְּבֵית ה׳ כׇּל יְמֵי חַיַּי - Hashem"),
    `${RTL_ISOLATE}אַחַת שָׁאַלְתִּי מֵאֵת ה׳ \\... שִׁבְתִּי בְּבֵית ה׳ כׇּל יְמֵי חַיַּי${POP_DIRECTIONAL_ISOLATE} - Hashem`
  );
});

test("keeps acronym-led Hebrew source titles in logical order", () => {
  assert.equal(
    applyTextRules('addresses this in שו\\"ת חתם סופר, יורה דעה סימן רל\\"ג, in the name'),
    `addresses this in ${LTR_ISOLATE}שו״ת חתם סופר, יורה דעה סימן רל״ג${POP_DIRECTIONAL_ISOLATE}, in the name`
  );
});

test("keeps Hebrew name phrase ending with acronym in logical order", () => {
  assert.equal(
    applyTextRules('written by ר\\\' שלמה גנצפריד זצ\\"ל - a tremendous'),
    `written by ${LTR_ISOLATE}ר\\' שלמה גנצפריד זצ״ל${POP_DIRECTIONAL_ISOLATE} - a tremendous`
  );
});

test("keeps divine-name geresh inside a Hebrew pasuk phrase", () => {
  assert.equal(
    applyTextRules("The פסוק says: וַיֹּאמֶר ה׳ אֶל מֹשֶׁה נְטֵה יָדְךָ. There"),
    `The ${RTL_ISOLATE}פסוק${POP_DIRECTIONAL_ISOLATE} says: ${RTL_ISOLATE}וַיֹּאמֶר ה׳ אֶל מֹשֶׁה נְטֵה יָדְךָ${POP_DIRECTIONAL_ISOLATE}. There`
  );
});

test("keeps short parenthesized acronym source in reading order", () => {
  assert.equal(
    applyTextRules("In (ס׳ ע״ב) מסכת ברכות"),
    `In ${LTR_ISOLATE}(ס׳ ע״ב)${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מסכת ברכות${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps full parenthesized Hebrew citation in reading order", () => {
  assert.equal(
    applyTextRules("the תוכחה (דברים כ״ח:מ״ז): תַּחַת"),
    `the ${RTL_ISOLATE}תוכחה${POP_DIRECTIONAL_ISOLATE} ${LTR_ISOLATE}(דברים כ״ח:מ״ז)${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}תַּחַת${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps masechta daf source and Hebrew question in visual reading order", () => {
  assert.equal(
    applyTextRules("חז״ל say in מסכת חולין (דף קל״ט), מרדכי מן התורה מנין? - Where"),
    `${LTR_ISOLATE}חז״ל${POP_DIRECTIONAL_ISOLATE} say in ${LTR_ISOLATE}${RTL_ISOLATE}חולין${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מסכת${POP_DIRECTIONAL_ISOLATE} (דף קל״ט): ${RTL_ISOLATE}מנין${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}התורה${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מן${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מרדכי${POP_DIRECTIONAL_ISOLATE}?${POP_DIRECTIONAL_ISOLATE} - Where`
  );
});

test("moves newline-wrapped parenthesized Hebrew citation after following quote", () => {
  assert.equal(
    applyTextRules("That's what we say (תהילים\nכ״ז:ד׳) שִׁבְתִּי"),
    `That's what we say ${RTL_ISOLATE}שִׁבְתִּי${POP_DIRECTIONAL_ISOLATE} ${LTR_ISOLATE}(תהילים\nכ״ז:ד׳)${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("moves parenthesized Hebrew citation after following quote", () => {
  assert.equal(
    applyTextRules("That's what we say (תהילים כ״ז:ד׳) שִׁבְתִּי בְּבֵית ה׳ כׇּל יְמֵי חַיַּי."),
    `That's what we say ${RTL_ISOLATE}שִׁבְתִּי בְּבֵית ה׳ כׇּל יְמֵי חַיַּי ${LTR_ISOLATE}(תהילים כ״ז:ד׳)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}.`
  );
});

test("moves standalone leading parenthesized Hebrew citation after paragraph quote", () => {
  assert.equal(
    applyTextRules("(זכריה א:ט) וָאֹמַר מָה אֵלֶּה אֲדֹנִי וַיֹּאמֶר אֵלַי הַמַּלְאָךְ."),
    `${RTL_ISOLATE}וָאֹמַר מָה אֵלֶּה אֲדֹנִי וַיֹּאמֶר אֵלַי הַמַּלְאָךְ (זכריה א:ט)${POP_DIRECTIONAL_ISOLATE}.`
  );
});

test("repairs escaped leading parenthesis on standalone Hebrew citation paragraph", () => {
  assert.equal(
    repairEscapedHebrewParagraphCitations("\\(וָאֹמַר #strong[הַדֹּבֵר בִּי] אֲנִי אַרְאֶךָּ (זכריה א:ט"),
    "וָאֹמַר #strong[הַדֹּבֵר בִּי] אֲנִי אַרְאֶךָּ (זכריה א:ט)"
  );
});

test("keeps repaired standalone Hebrew source in RTL paragraph order", () => {
  assert.equal(
    applyTextRules("\\(וָאֹמַר #strong[הַדֹּבֵר בִּי] אֲנִי אַרְאֶךָּ (זכריה א:ט"),
    `${RTL_ISOLATE}וָאֹמַר #strong[הַדֹּבֵר בִּי] אֲנִי אַרְאֶךָּ (זכריה א:ט)${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("moves parenthesized Hebrew citation after quote before dash explanation", () => {
  assert.equal(
    applyTextRules("The pasuk says (דברים י׳:י״ב) וְעַתָּה יִשְׂרָאֵל מָה ה׳ אֱלֹקֶיךָ שֹׁאֵל מֵעִמָּךְ - What"),
    `The pasuk says ${RTL_ISOLATE}וְעַתָּה יִשְׂרָאֵל מָה ה׳ אֱלֹקֶיךָ שֹׁאֵל מֵעִמָּךְ ${LTR_ISOLATE}(דברים י׳:י״ב)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE} - What`
  );
});

test("keeps Hebrew quote and source together before English continuation", () => {
  assert.equal(
    applyTextRules("says it’s וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ (ויקרא י״ט:י״ח) which pertains"),
    `says it’s ${RTL_ISOLATE}וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ ${LTR_ISOLATE}(ויקרא י״ט:י״ח)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE} which pertains`
  );
});

test("keeps Hebrew quote and source together before comma continuation", () => {
  assert.equal(
    applyTextRules("פרשה: אֶת הַכֶּבֶשׂ הָאֶחָד תַּעֲשֶׂה בַבֹּקֶר (שמות כ״ט:ל״ט), referring"),
    `${RTL_ISOLATE}פרשה${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}אֶת הַכֶּבֶשׂ הָאֶחָד תַּעֲשֶׂה בַבֹּקֶר ${LTR_ISOLATE}(שמות כ״ט:ל״ט)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}, referring`
  );
});

test("keeps plain-letter parenthesized Hebrew citation in reading order", () => {
  assert.equal(
    applyTextRules("as we know משלי ו:כג)) כִּי נֵר"),
    `as we know ${LTR_ISOLATE}(משלי ו:כג)${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}כִּי נֵר${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps bare Hebrew source reference before quote colon in reading order", () => {
  assert.equal(
    applyTextRules("from שמות ד:י״ד: וְרָאֲךָ וְשָׂמַח"),
    `from ${LTR_ISOLATE}שמות ד:י״ד${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}וְרָאֲךָ וְשָׂמַח${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("repairs nested Hebrew source parenthesis before quote colon", () => {
  assert.equal(
    applyTextRules("brings a pasuk in (תהילים (ק״ה:ל״ז: וַיּוֹצִיאֵם בְּכֶסֶף"),
    `brings a pasuk in ${LTR_ISOLATE}(תהילים ק״ה:ל״ז)${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}וַיּוֹצִיאֵם בְּכֶסֶף${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps parenthesized Hebrew source reference in reading order", () => {
  assert.equal(
    applyTextRules("called אדם (ע״ש יבמות ס״א ע״א), the אומות"),
    `called ${RTL_ISOLATE}אדם${POP_DIRECTIONAL_ISOLATE} ${LTR_ISOLATE}(ע״ש יבמות ס״א ע״א)${POP_DIRECTIONAL_ISOLATE}, the ${RTL_ISOLATE}אומות${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps parenthesized Hebrew source range in reading order", () => {
  assert.equal(
    applyTextRules("בְּשִׂמְחָה (דברים כ״ח:מ״ה - מ״ז). Our failure"),
    `${RTL_ISOLATE}בְּשִׂמְחָה ${LTR_ISOLATE}(דברים כ״ח:מ״ה - מ״ז)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}. Our failure`
  );
});

test("keeps Hebrew quote with ellipsis and trailing source in reading order", () => {
  assert.equal(
    applyTextRules("וּבָאוּ עָלֶיךָ כׇּל הַקְּלָלוֹת הָאֵלֶּה \\... תַּחַת אֲשֶׁר לֹא עָבַדְתָּ בְּשִׂמְחָה (דברים כ״ח:מ״ה - מ״ז). Our failure"),
    `${RTL_ISOLATE}וּבָאוּ עָלֶיךָ כׇּל הַקְּלָלוֹת הָאֵלֶּה \\... תַּחַת אֲשֶׁר לֹא עָבַדְתָּ בְּשִׂמְחָה ${LTR_ISOLATE}(דברים כ״ח:מ״ה - מ״ז)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}. Our failure`
  );
});

test("does not protect ordinary parenthesized Hebrew as a source reference", () => {
  assert.equal(
    applyTextRules("This (מנורה) is the example"),
    `This (${RTL_ISOLATE}מנורה${POP_DIRECTIONAL_ISOLATE}) is the example`
  );
});

test("does not hang on malformed unclosed Hebrew source reference", () => {
  assert.equal(
    applyTextRules('The פסוק says (\\(שמות ל:טו:הֶעָשִׁיר לֹא יַרְבֶּה - everybody'),
    `The ${RTL_ISOLATE}פסוק${POP_DIRECTIONAL_ISOLATE} says ${LTR_ISOLATE}(שמות ל:טו)${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}הֶעָשִׁיר לֹא יַרְבֶּה${POP_DIRECTIONAL_ISOLATE} - everybody`
  );
});

test("keeps Hebrew phrase together across a source newline", () => {
  assert.equal(
    applyTextRules("הקדוש ברוך\nהוא will"),
    `${RTL_ISOLATE}הקדוש ברוך הוא${POP_DIRECTIONAL_ISOLATE} will`
  );
});

test("tags person index aliases with straight or slanted Hebrew quotes", () => {
  const indexState = {
    people: [
      {
        id: "rashi",
        displayName: "Rashi",
        aliases: ['רש"י', "Rashi"],
      },
    ],
    mentions: new Map([["rashi", []]]),
    nextMarker: 1,
  };

  assert.equal(
    tagPersonIndexMentions("Rashi says רש״י explains", indexState),
    'Rashi#metadata(none) <person-index-rashi-1> says רש״י#metadata(none) <person-index-rashi-2> explains'
  );
  assert.deepEqual(indexState.mentions.get("rashi"), [
    "person-index-rashi-1",
    "person-index-rashi-2",
  ]);
});

test("keeps English possessive before person index marker", () => {
  const indexState = {
    people: [
      {
        id: "levi-yitzchok",
        displayName: "R' Levi Yitzchok of Berditchev",
        aliases: ["Levi Yitzchok"],
      },
    ],
    mentions: new Map([["levi-yitzchok", []]]),
    nextMarker: 1,
  };

  assert.equal(
    tagPersonIndexMentions("None were to Reb Levi Yitzchok's taste.", indexState),
    "None were to Reb Levi Yitzchok's#metadata(none) <person-index-levi-yitzchok-1> taste."
  );
});

test("does not tag aliases inside generated person index markers", () => {
  const indexState = {
    people: [
      {
        id: "rav-shach",
        displayName: "Rav Shach",
        aliases: ["Rav Shach"],
      },
      {
        id: "shach",
        displayName: "Shach",
        aliases: ["Shach"],
      },
    ],
    mentions: new Map([
      ["rav-shach", []],
      ["shach", []],
    ]),
    nextMarker: 1,
  };

  assert.equal(
    tagPersonIndexMentions("As Rav Shach said.", indexState),
    "As Rav Shach#metadata(none) <person-index-rav-shach-1> said."
  );
  assert.deepEqual(indexState.mentions.get("rav-shach"), [
    "person-index-rav-shach-1",
  ]);
  assert.deepEqual(indexState.mentions.get("shach"), []);
});

test("docx: Mikeitz 5783 fixes named numeric double-parenthesis citations", () => {
  const typst = convertedDocx("/mikeitz/5783/");

  assertContains(
    typst,
    `as the ${RTL_ISOLATE}פסוק${POP_DIRECTIONAL_ISOLATE} says (${RTL_ISOLATE}דברים${POP_DIRECTIONAL_ISOLATE} 15:18): ${RTL_ISOLATE}וּבֵרַכְךָ ה׳ אֱלֹקֶיךָ בְּכֹל אֲשֶׁר תַּעֲשֶׂה${POP_DIRECTIONAL_ISOLATE}`,
    "fixed דברים 15:18 source"
  );
  assertContains(
    typst,
    `says (${RTL_ISOLATE}דברים${POP_DIRECTIONAL_ISOLATE} 11:14): ${RTL_ISOLATE}וְאָסַפְתָּ דְגָנֶךָ וְתִירֹשְׁךָ${POP_DIRECTIONAL_ISOLATE}`,
    "fixed דברים 11:14 source"
  );
  assertNotContains(typst, "15:18))", "raw 15:18)) double close");
  assertNotContains(typst, "11:14))", "raw 11:14)) double close");
});

test("docx: Mikeitz 5784 keeps numbered quote block tight and literal", () => {
  const typst = convertedDocx("/mikeitz/5784/");

  assertContains(
    typst,
    `I count five: \\\n\\1. When they pull`,
    "literal escaped item 1 after hard break"
  );
  assertContains(
    typst,
    `in ${RTL_ISOLATE}פרק מא פסוק טו${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} it says`,
    "perek before pasuk in item 1"
  );
  assertNotContains(typst, "פסוק טו פרק מא", "raw reversed perek/pasuk order");
  assertContains(
    typst,
    `${RTL_ISOLATE}וַיְדַבֵּר פַּרְעֹה אֶל יוֹסֵף בַּחֲלֹמִי הִנְנִי עֹמֵד עַל שְׂפַת הַיְאֹר${POP_DIRECTIONAL_ISOLATE}. \\\n\\3.`,
    "source-wrapped Hebrew quote flattened before item 3"
  );
  assertNotContains(typst, "#linebreak()\n\\2.", "block linebreak before item 2");
});

test("docx: Beshalach 5783 keeps 14:31 pasuk in one RTL run", () => {
  const typst = convertedDocx("/beshalach/5783/(1)/");

  assertContains(
    typst,
    `(14:31): ${RTL_ISOLATE}וַיַּרְא יִשְׂרָאֵל אֶת הַיָּד הַגְּדֹלָה אֲשֶׁר עָשָׂה ה׳ בְּמִצְרַיִם וַיִּירְאוּ הָעָם אֶת ה׳ וַיַּאֲמִינוּ בַּה׳ וּבְמֹשֶׁה עַבְדּוֹ${POP_DIRECTIONAL_ISOLATE}.`,
    "full 14:31 pasuk"
  );
  assertNotContains(typst, `${LTR_ISOLATE}הָעָם`, "middle pasuk chunk incorrectly isolated as LTR");
});

test("docx: Vayigash 5783 keeps numbered question paragraphs tight and literal", () => {
  const typst = convertedDocx("/vayigash/5783/");

  assertContains(
    typst,
    `several profound questions on this episode: \\\n\\1. All of`,
    "literal item 1 after episode intro"
  );
  assertContains(
    typst,
    `irrelevant.\\\n\\2. When the brothers returned`,
    "hard break before literal item 2"
  );
  assertContains(
    typst,
    `${RTL_ISOLATE}הַעוֹד אָבִי חָי${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}?${POP_DIRECTIONAL_ISOLATE}\\\n\\3. Even if the question`,
    "hard break before literal item 3"
  );
});

test("docx: Vayigash 5785 repairs escaped numeric source parenthesis", () => {
  const typst = convertedDocx("/vayigash/5785/");

  assertContains(
    typst,
    `${RTL_ISOLATE}פסוק${POP_DIRECTIONAL_ISOLATE} (45:24): ${RTL_ISOLATE}וַיְשַׁלַּח אֶת אֶחָיו`,
    "fixed 45:24 source"
  );
  assertNotContains(typst, "((45:24", "double open numeric source");
  assertNotContains(typst, "(\\(45:24", "raw escaped open numeric source");
});

test("docx: Vayigash 5785 keeps comma after R' Shlomo Ganzfried", () => {
  const typst = convertedDocx("/vayigash/5785/");

  assertContains(
    typst,
    `from ${RTL_ISOLATE}רב שלמה גאנצפריד${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} the famous author`,
    "comma after R' Shlomo Ganzfried"
  );
});

test("docx: Vayairah 5786 keeps comma after Otzer Pla'os HaTorah before who", () => {
  const typst = convertedDocx("/vayairah/5786/(2)/");

  assertContains(
    typst,
    `According to the ${RTL_ISOLATE}אוצר פלאות התורה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} who bentchs`,
    "comma after Otzer Pla'os HaTorah"
  );
  assertNotContains(typst, `${RTL_ISOLATE}אוצר פלאות התורה,${POP_DIRECTIONAL_ISOLATE}`, "comma inside Otzer Pla'os HaTorah isolate");
});

test("docx: Bo 5785 keeps numbered Hebrew item commas and Haggadah question order", () => {
  const typst = convertedDocx("/bo/5785/");

  assertContains(
    typst,
    `1) ${RTL_ISOLATE}מזוזה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} 2) ${RTL_ISOLATE}ציצית${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} 3)`,
    "commas after mezuzah and tzitzis"
  );
  assertContains(
    typst,
    `${RTL_ISOLATE}מַצָּה זוֹ שֶׁאָנוּ אוֹכְלִים, עַל שׁוּם מַה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}?${POP_DIRECTIONAL_ISOLATE}`,
    "Haggadah question in one RTL run"
  );
  assertNotContains(typst, `${RTL_ISOLATE}מזוזה,${POP_DIRECTIONAL_ISOLATE}`, "comma inside mezuzah isolate");
  assertNotContains(typst, `${RTL_ISOLATE}ציצית,${POP_DIRECTIONAL_ISOLATE}`, "comma inside tzitzis isolate");
});

test("docx: Bo 5784 keeps one source space after source colon before Hebrew", () => {
  const typst = convertedDocx("/bo/5784/");

  assertContains(
    typst,
    `(12:2): ${RTL_ISOLATE}הַחֹדֶשׁ הַזֶּה לָכֶם רֹאשׁ חֳדָשִׁים${POP_DIRECTIONAL_ISOLATE}`,
    "single source space after 12:2 colon"
  );
  assertNotContains(typst, `(12:2) : ${RTL_ISOLATE}הַחֹדֶשׁ`, "space before 12:2 colon");
});

test("docx: Bo 5783 keeps comma after Moshe before quoted English", () => {
  const typst = convertedDocx("/bo/5783/");

  assertContains(
    typst,
    `Hashem said to ${RTL_ISOLATE}משה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} “Let`,
    "comma after Moshe before quoted English"
  );
  assertNotContains(typst, `${RTL_ISOLATE}משה,${POP_DIRECTIONAL_ISOLATE} "Let`, "comma inside Moshe isolate before quote");
});

test("docx: Rosh Hashana 5785 keeps closing quotes before said attribution", () => {
  const typst = convertedDocx("/rosh-hashana/5785/");

  assertContains(
    typst,
    `help me marry off my daughters.'” “My friend,” said Reb Levi`,
    "closing quote before My friend attribution"
  );
  assertNotContains(typst, `daughters'\". \"My friend, \" said`, "raw quote punctuation");
});

test("docx: Yom Kippur 5784 keeps comma tight before closing quote attribution", () => {
  const typst = convertedDocx("/yom-kippur/5784/");

  assertContains(
    typst,
    `more or less paid up,” the sibling said`,
    "comma should be tight before closing quote"
  );
  assertNotContains(typst, `more or less paid up, \\" the sibling said`, "space between comma and quote");
});

test("docx: Behar 5784 keeps indexed quote marker after closing punctuation", () => {
  const typst = convertedDocxWithIndex("/behar/5784/", [
    {
      id: "rabbi-gesheid",
      displayName: "R' Gesheid",
      aliases: ["Rabbi Gesheid"],
    },
  ]);

  assertContains(
    typst,
    `thank you Rabbi Gesheid!”#metadata(none) <person-index-rabbi-gesheid-3> she said`,
    "closing quote stays tight before indexed Gesheid marker"
  );
  assertNotContains(
    typst,
    `thank you Rabbi Gesheid!#metadata(none) <person-index-rabbi-gesheid-3>” she said`,
    "index marker should not separate exclamation point from closing quote"
  );
});

test("docx: Chanukah 5785 keeps indexed quote marker after quote colon", () => {
  const typst = convertedDocxWithIndex("/chanukah/5785/", [
    {
      id: "a-short-vort",
      displayName: "A Short Vort",
      aliases: ["A Short Vort"],
    },
  ]);

  assertContains(
    typst,
    `in “A Short Vort”:#metadata(none) <person-index-a-short-vort-1> The`,
    "colon stays tight after closing quote before indexed A Short Vort marker"
  );
  assertNotContains(
    typst,
    `in “A Short Vort”#metadata(none) <person-index-a-short-vort-1>: The`,
    "index marker should not separate closing quote from colon"
  );
});

test("docx: Shavuos 5783 keeps Hebrew colon quote phrase in one RTL run", () => {
  const typst = convertedDocx("/shavuos/5783/");

  assertContains(
    typst,
    `${RTL_ISOLATE}אָמַר לוֹ הַקָּדוֹשׁ בָּרוּךְ הוּא לְמֹשֶׁה: הַחְזֵיר לָהֶן תְּשׁוּבָה${POP_DIRECTIONAL_ISOLATE} - Hashem told Moshe`,
    "Hakodosh Baruch Hu/Moshe reply phrase stays in reading order"
  );
  assertContains(
    typst,
    `${RTL_ISOLATE}אָמַר לְפָנָיו: רִבּוֹנוֹ שֶׁל עוֹלָם, מִתְיָירֵא אֲנִי שֶׁמָּא יִשְׂרְפוּנִי בַּהֶבֶל שֶׁבְּפִיהֶם${POP_DIRECTIONAL_ISOLATE} - I'm afraid`,
    "Moshe's reply phrase stays in reading order"
  );
});

test("docx: How to do Teshuva keeps comma after parsha before bracketed note", () => {
  const typst = convertedDocx("/rosh-hashana/how-to-do-teshuva/");

  assertContains(
    typst,
    `on the ${RTL_ISOLATE}פרשה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} \\[Rav Tzadka`,
    "comma after parsha before bracketed English note"
  );
  assertNotContains(
    typst,
    `on the ${RTL_ISOLATE}פרשה,${POP_DIRECTIONAL_ISOLATE} [Rav Tzadka`,
    "comma inside parsha isolate before bracketed English note"
  );
});

test("docx: Shemos 5785 keeps semicolon attached before index marker", () => {
  const typst = convertedDocx("/shemos/5785/");

  assertContains(
    typst,
    `${LTR_ISOLATE}אריז״ל${POP_DIRECTIONAL_ISOLATE}\\; it's not`,
    "semicolon attached to Arizal"
  );
  assertNotContains(
    typst,
    `${LTR_ISOLATE}אריז״ל${POP_DIRECTIONAL_ISOLATE} \\;`,
    "space before Arizal semicolon"
  );
});

test("docx: Beshalach 5784 fixes duplicate open parenthesis before medrash source", () => {
  const typst = convertedDocx("/beshalach/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}מדרש רבה${POP_DIRECTIONAL_ISOLATE} (23:3), as quoted`,
    "single open parenthesis before 23:3 source"
  );
  assertNotContains(typst, "(\\(23:3", "raw escaped duplicate open parenthesis");
  assertNotContains(typst, "((23:3", "double open parenthesis before source");
});

test("docx: Beshalach 5784 keeps comma after Bais Halevi before indexed newline English", () => {
  const typst = convertedDocxWithIndex("/beshalach/5784/", [
    { id: "bais-halevi", displayName: "Bais Halevi", aliases: ["בית הלוי"] },
  ]);

  assertContains(
    typst,
    `as quoted by the ${RTL_ISOLATE}בית הלוי${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} #metadata(none) <person-index-bais-halevi-1>\nnotes`,
    "comma after indexed Bais Halevi before notes"
  );
  assertNotContains(typst, `${RTL_ISOLATE}בית הלוי,${POP_DIRECTIONAL_ISOLATE}`, "comma inside indexed Bais Halevi isolate");
});

test("docx: Bereshis 5784 keeps comma after Bais Halevi before English", () => {
  const typst = convertedDocx("/bereshis/5784/");

  assertContains(
    typst,
    `As the ${RTL_ISOLATE}בית הלוי${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} which this is from, says`,
    "comma after Bais Halevi"
  );
});

test("docx: Bereshis 5786 keeps mid-Hebrew commas attached before spaces", () => {
  const typst = convertedDocx("/bereshis/5786/(1)/");

  assertContains(
    typst,
    `שְׁעוֹתָיו, נִכְנַס בּוֹ כְּחוּט הַשַּׂעֲרָה${POP_DIRECTIONAL_ISOLATE}`,
    "comma-space inside Hebrew phrase"
  );
  assertNotContains(typst, `שְׁעוֹתָיו${POP_DIRECTIONAL_ISOLATE}, ${RTL_ISOLATE}נִכְנַס`, "comma outside split Hebrew phrase");
  assertNotContains(typst, "שְׁעוֹתָיו ,נִכְנַס", "space-before-comma inside Hebrew phrase");
});

test("docx: Naso 5784 repairs nested Tehillim source parenthesis", () => {
  const typst = convertedDocx("/naso/5784/");

  assertContains(
    typst,
    `brings a pasuk in ${LTR_ISOLATE}(תהילים ק״ה:ל״ז)${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}וַיּוֹצִיאֵם בְּכֶסֶף וְזָהָב וְאֵין בִּשְׁבָטָיו כּוֹשֵׁל${POP_DIRECTIONAL_ISOLATE}.`,
    "fixed Tehillim source"
  );
  assertNotContains(typst, "(⁧תהילים⁩ (", "nested Tehillim source parenthesis");
  assertNotContains(typst, "(תהילים (", "raw nested Tehillim source parenthesis");
});

test("docx: 9 Av 5785 keeps semicolon between Hebrew phrases in English order", () => {
  const typst = convertedDocx("/9-av/5785/");

  assertContains(
    typst,
    `Hashem of ${RTL_ISOLATE}רחמים${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE};${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}השם אחד${POP_DIRECTIONAL_ISOLATE} -\n${RTL_ISOLATE}רחמים${POP_DIRECTIONAL_ISOLATE} and ${RTL_ISOLATE}דין${POP_DIRECTIONAL_ISOLATE} is one`,
    "semicolon between 9 Av Hebrew phrases"
  );
  assertNotContains(typst, `${RTL_ISOLATE}רחמים; השם אחד${POP_DIRECTIONAL_ISOLATE}`, "single RTL 9 Av semicolon phrase");
});

test("docx: Shmini Atzeres 5784 keeps semicolon between Hebrew phrases in English order", () => {
  const typst = convertedDocx("/shmini-atzeres/5784/");

  assertContains(
    typst,
    `does their ${RTL_ISOLATE}רצון${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE};${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}וְאֶת שַׁוְעָתָם יִשְׁמַע וְיוֹשִׁיעֵם${POP_DIRECTIONAL_ISOLATE} - Hashem hears`,
    "semicolon between Shmini Atzeres Hebrew phrases"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}רצון; וְאֶת שַׁוְעָתָם`,
    "single RTL Shmini Atzeres semicolon phrase"
  );
});

test("docx: Rabbi Oelbaum Shabbos protects mixed parenthetical after Mincha", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `by ${RTL_ISOLATE}מנחה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${LTR_ISOLATE}(${RTL_ISOLATE}אגב${POP_DIRECTIONAL_ISOLATE} I did not mention this in the shiur\non ${RTL_ISOLATE}שבת${POP_DIRECTIONAL_ISOLATE}),${POP_DIRECTIONAL_ISOLATE} and therefore`,
    "LTR-protected mixed parenthetical after Mincha"
  );
  assertNotContains(
    typst,
    `by ${RTL_ISOLATE}מנחה,${POP_DIRECTIONAL_ISOLATE} (${RTL_ISOLATE}אגב${POP_DIRECTIONAL_ISOLATE}`,
    "comma inside Mincha isolate before parenthetical"
  );
});

test("docx: Rabbi Oelbaum Shabbos keeps space after Maharal colon", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `therefore says the ${LTR_ISOLATE}מהר״ל${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}מזמור שיר ליום השבת, יום שכולו שבת, לעולם הבא${POP_DIRECTIONAL_ISOLATE} - Then`,
    "space after Maharal colon"
  );
  assertNotContains(
    typst,
    `${LTR_ISOLATE}מהר״ל${POP_DIRECTIONAL_ISOLATE}:${RTL_ISOLATE}מזמור`,
    "missing space after Maharal colon"
  );
});

test("docx: Vayairah 5784 keeps colon Hebrew quote break tight", () => {
  const typst = convertedDocx("/vayairah/5784/");

  assertContains(
    typst,
    `a second time (22:15-17):\n\n#align(right)[\n${RTL_ISOLATE}וַיִּקְרָא מַלְאַךְ ה׳ אֶל אַבְרָהָם`,
    "right-aligned Hebrew quote after source colon"
  );
});

test("docx: Vayairah 5784 keeps pure Hebrew comma list in PDF-friendly order", () => {
  const typst = convertedDocx("/vayairah/5784/");

  assertContains(
    typst,
    `qualities contribute to a ${RTL_ISOLATE}מצוה${POP_DIRECTIONAL_ISOLATE}? ${RTL_ISOLATE}אהבה, זריזות, יראה, כוונה${POP_DIRECTIONAL_ISOLATE} - these`,
    "pure Hebrew comma list"
  );
});

test("docx: Vaeschanan 5784 keeps comma after machaneh before number", () => {
  const typst = convertedDocx("/vaeschanan/5784/");

  assertContains(
    typst,
    `of four times ${RTL_ISOLATE}מחנה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} 412. Each`,
    "comma after machaneh before 412"
  );
  assertNotContains(typst, `${RTL_ISOLATE}מחנה,${POP_DIRECTIONAL_ISOLATE} 412`, "comma inside machaneh isolate before 412");
});

test("docx: Vaeschanan 5784 indexes lowercase Belzer rebbe alias", () => {
  const typst = convertedDocxWithIndex("/vaeschanan/5784/", [
    {
      id: "the-belzer-rebbe",
      displayName: "Belzer Rebbe",
      aliases: ["Belzer Rebbe"],
    },
  ]);

  assertContains(
    typst,
    "Belzer rebbe#metadata(none) <person-index-the-belzer-rebbe-1>",
    "lowercase Belzer rebbe index marker"
  );
});

test("docx: Rabbi Oelbaum Shabbos keeps bold tova inside the matana phrase", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `good. So what is the emphasis ${RTL_ISOLATE}מתנה #strong[טובה] יש לי בבית גנזי${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}?${POP_DIRECTIONAL_ISOLATE}`,
    "bold tova stays inside the same RTL isolate as the matana phrase"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}מתנה${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}#strong[טובה] יש לי בבית גנזי${POP_DIRECTIONAL_ISOLATE}`,
    "bold tova should not split the matana phrase into two RTL isolates"
  );
});

test("docx: Rabbi Oelbaum Shabbos keeps bold hakol inside the yotzer phrase", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `the ${RTL_ISOLATE}בחינה${POP_DIRECTIONAL_ISOLATE} of ${RTL_ISOLATE}יוצר #strong[הכל]${POP_DIRECTIONAL_ISOLATE}#strong[.]`,
    "bold hakol stays inside the same RTL isolate as yotzer"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}יוצר${POP_DIRECTIONAL_ISOLATE} #strong[${RTL_ISOLATE}הכל${POP_DIRECTIONAL_ISOLATE}]`,
    "bold hakol should not be split into its own RTL isolate"
  );
});

test("docx: Rabbi Oelbaum Shabbos keeps Malbim quoted Gemara in one RTL phrase", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `on the pasuk ${RTL_ISOLATE}”לדעת כי אני ה׳ מקדשכם“ אמר הקב״ה למשה משה מתנה טובה יש לי בבית גנזי${POP_DIRECTIONAL_ISOLATE} - I have a chashuv`,
    "Malbim quoted Gemara stays in one RTL isolate"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}לדעת כי אני ה׳ מקדשכם${POP_DIRECTIONAL_ISOLATE}” ${LTR_ISOLATE}אמר הקב״ה${POP_DIRECTIONAL_ISOLATE}`,
    "quote should not split the Malbim Hebrew sequence"
  );
});

test("docx: Vayaishev 5785 keeps bold hayom inside the Re'eh RTL phrase", () => {
  const typst = convertedDocx("/vayaishev/5785/");

  assertContains(
    typst,
    `saying, ${RTL_ISOLATE}רְאֵה אָנֹכִי נֹתֵן לִפְנֵיכֶם #strong[הַיּוֹם]${POP_DIRECTIONAL_ISOLATE} - Hashem gives`,
    "bold hayom stays inside the same RTL isolate as the Re'eh phrase"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}רְאֵה אָנֹכִי נֹתֵן לִפְנֵיכֶם${POP_DIRECTIONAL_ISOLATE}\n#strong[${RTL_ISOLATE}הַיּוֹם${POP_DIRECTIONAL_ISOLATE}]`,
    "bold hayom should not be split into its own RTL isolate"
  );
});

test("docx: Vaeschanan 5783 keeps bold shabbos phrase inside the yismach moshe RTL phrase", () => {
  const typst = convertedDocx("/vaeschanan/5783/");

  assertContains(
    typst,
    `${RTL_ISOLATE}יִשמַח משֶׁה בְּמַתְּנַת חֶלְקו כִּי עֶבֶד נֶאֱמָן קָרָאתָ לּו כְּלִיל תִּפְאֶרֶת בְּראשׁו נָתַתָּ בְּעָמְדו לְפָנֶיךָ עַל הַר סִינַי וּשְׁנֵי לֻחות אֲבָנִים הורִיד בְּיָדו #strong[וְכָתוּב בָּהֶם שְׁמִירַת שַׁבָּת]${POP_DIRECTIONAL_ISOLATE}`,
    "bold shabbos phrase stays inside the same RTL isolate as the yismach moshe phrase"
  );
  assertNotContains(
    typst,
    `הורִיד בְּיָדו${POP_DIRECTIONAL_ISOLATE} #strong[${RTL_ISOLATE}וְכָתוּב בָּהֶם שְׁמִירַת שַׁבָּת${POP_DIRECTIONAL_ISOLATE}]`,
    "bold shabbos phrase should not be split into its own RTL isolate"
  );
});

test("docx: Tetzaveh 5783 keeps sentence space before Ben Nanas", () => {
  const typst = convertedDocx("/tetzaveh/5783/");

  assertContains(
    typst,
    `${RTL_ISOLATE}מקבל אחדות השם${POP_DIRECTIONAL_ISOLATE} and ${RTL_ISOLATE}עול מלכות שמים${POP_DIRECTIONAL_ISOLATE}. ${RTL_ISOLATE}בן ננס${POP_DIRECTIONAL_ISOLATE} says`,
    "space after ol malchus shamayim period before Ben Nanas"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}עול מלכות שמים${POP_DIRECTIONAL_ISOLATE}.${RTL_ISOLATE}בן ננס${POP_DIRECTIONAL_ISOLATE}`,
    "missing space between ol malchus shamayim and Ben Nanas"
  );
});

test("docx: Tetzaveh 5783 keeps quote sources after the Hebrew quotes", () => {
  const typst = convertedDocx("/tetzaveh/5783/");

  assertContains(
    typst,
    `${RTL_ISOLATE}וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ ${LTR_ISOLATE}(ויקרא י״ט:י״ח)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE} which pertains`,
    "Ben Nanas quote source remains attached after quote"
  );
  assertContains(
    typst,
    `${RTL_ISOLATE}אֶת הַכֶּבֶשׂ הָאֶחָד תַּעֲשֶׂה בַבֹּקֶר וְאֵת הַכֶּבֶשׂ הַשֵּׁנִי תַּעֲשֶׂה בֵּין הָעַרְבָּיִם ${LTR_ISOLATE}(שמות\nכ״ט:ל״ט)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}, referring`,
    "Shimon ben Pazi quote source remains attached after quote"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}וְאָהַבְתָּ לְרֵעֲךָ כָּמוֹךָ${POP_DIRECTIONAL_ISOLATE}\n${LTR_ISOLATE}(ויקרא י״ט:י״ח)${POP_DIRECTIONAL_ISOLATE}`,
    "Ben Nanas quote and source should not be separate bidi runs"
  );
});

test("docx: Sukkos 5786 keeps comma after mitzvah before closing quote", () => {
  const typst = convertedDocx("/sukkos/5786/");

  assertContains(
    typst,
    `we would have had a\n${RTL_ISOLATE}מצוה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} we would have done it`
  );
  assertContains(
    typst,
    `I'll give you an\neasy ${RTL_ISOLATE}מצוה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE}”`
  );
  assertNotContains(
    typst,
    `I'll give you a ${RTL_ISOLATE}מצוה,${POP_DIRECTIONAL_ISOLATE}”`,
    "comma should not remain inside the Hebrew isolate before the closing quote"
  );
});

test("docx: Chukas 5784 copy title is stripped from body", () => {
  const typst = convertedDocx("/chukas/5784/(1)/");

  assert.ok(
    typst.trimStart().startsWith(`${RTL_ISOLATE}פרשת חקת${POP_DIRECTIONAL_ISOLATE}.`),
    "Expected Chukas body to start after duplicate English title"
  );
  assertNotContains(typst.slice(0, 120), "Chukas 5784", "duplicate Chukas title");
});

test("docx: Yossi Bennett Haskama signature uses tight line breaks", () => {
  const typst = convertedDocx("/rabbi-yossi-bennett/");

  assertContains(
    typst,
    `Yossi Bennett\n#linebreak()\nWoodmere, NY\n#linebreak()\n${LTR_ISOLATE}י״ג אב תשפ״ו${POP_DIRECTIONAL_ISOLATE}\n#linebreak()\nJuly 27#super[th], 2026`,
    "tight haskama signature block"
  );
});

test("docx: Yossi Bennett Haskama keeps Hebrew display quote marks in RTL order", () => {
  const typst = convertedDocx("/rabbi-yossi-bennett/");

  assertContains(
    typst,
    `${RTL_ISOLATE}”אין שמחה כשמחת התורה“${POP_DIRECTIONAL_ISOLATE}`,
    "first Hebrew display quote uses RTL quote order"
  );
  assertContains(
    typst,
    `${RTL_ISOLATE}”אשרי מי שבא לכאן ותלמודו בידו“${POP_DIRECTIONAL_ISOLATE}`,
    "second Hebrew display quote uses RTL quote order"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}“אין שמחה כשמחת התורה${POP_DIRECTIONAL_ISOLATE}”`,
    "opening English quote should not remain inside standalone Hebrew isolate"
  );
});

test("docx: Rosh Chodesh keeps English quotes outside inline Hebrew phrase", () => {
  const typst = convertedDocx("/rosh-chodesh/");

  assertContains(
    typst,
    `simultaneously, “${RTL_ISOLATE}סַבּוּנִי גַם סְבָבוּנִי${POP_DIRECTIONAL_ISOLATE}\\.”`,
    "inline Rosh Chodesh Hebrew quote keeps English quote outside isolate"
  );
  assertNotContains(
    typst,
    `simultaneously, ${RTL_ISOLATE}“סַבּוּנִי גַם סְבָבוּנִי${POP_DIRECTIONAL_ISOLATE}`,
    "opening quote should not be inside inline Hebrew isolate"
  );
});

test("docx: About the Name preserves right-aligned Hebrew source paragraph", () => {
  const typst = convertedDocx("/about-the-name/");

  assert.ok(
    typst.trimStart().startsWith(`#align(right)[\n${RTL_ISOLATE}וָאֹמַר מָה אֵלֶּה`),
    "Expected About the Name to begin with right-aligned Hebrew source"
  );
  assertContains(typst, `(זכריה א:ט)${POP_DIRECTIONAL_ISOLATE}]`, "source after Hebrew paragraph");
});

test("docx: Shemos 5783 right-aligns full Hebrew paragraph", () => {
  const typst = convertedDocx("/shemos/5783/");

  assertContains(
    typst,
    `#align(right)[\n${RTL_ISOLATE}וַיֶּפֶר אֶת עַמּוֹ מְאֹד`,
    "right-aligned full Hebrew quote"
  );
  assertContains(
    typst,
    `${RTL_ISOLATE}וַיֶּפֶר אֶת עַמּוֹ מְאֹד וַיַּעֲצִמֵהוּ מִצָּרָיו׃ הָפַךְ לִבָּם לִשְׂנֹא עַמּוֹ לְהִתְנַכֵּל בַּעֲבָדָיו׃ שָׁלַח מֹשֶׁה עַבְדּוֹ אַהֲרֹן אֲשֶׁר בָּחַר בּוֹ׃${POP_DIRECTIONAL_ISOLATE}]\n\nThe entire`,
    "Hebrew quote split before following English paragraph"
  );
});

test("person index keeps wrapped names tight above the dotted row", () => {
  const typst = renderPersonIndex({
    people: [
      {
        id: "shiniver-rebbe",
        displayName: "Shiniver Rebbe (R' Yechezkel Shraga)",
      },
    ],
    mentions: new Map([["shiniver-rebbe", ["person-index-shiniver-rebbe-1"]]]),
  });

  assertContains(
    typst,
    `stack(dir: ttb, spacing: 0.30em, ..rows)`,
    "wrapped index name rows are stacked tightly"
  );
  assertContains(
    typst,
    `#let index-final-row(name-line, labels) = grid(`,
    "final wrapped index name line is the dotted row"
  );
  assertNotContains(
    typst,
    `align: bottom,\n    [#index-name-lines(name-lines)],`,
    "wrapped index name should not bottom-align the entire name against all page numbers"
  );
  assertNotContains(typst, "linebreak()", "index rows should not use paragraph-style line breaks");
});

test("person index pre-wraps long parenthetical aliases before the dotted row", () => {
  assert.deepEqual(
    wrapIndexDisplayName("Gerrer Rebbe (R' Avraham Mordechai, The Chidushi HaRim)"),
    [
      "Gerrer Rebbe",
      "(R' Avraham Mordechai, The",
      "Chidushi HaRim)",
    ]
  );
  assert.deepEqual(
    wrapIndexDisplayName("Alter of Slabodka (R' Nosson Tzvi Finkel)"),
    [
      "Alter of Slabodka",
      "(R' Nosson Tzvi Finkel)",
    ]
  );
});
