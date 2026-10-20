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
  renderPdfTextOverlay,
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
const { buildRoutes } = require("./build-manifest");

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

test("keeps the Lag Baomer 5784 route title apostrophe-free", () => {
  assert.equal(ROUTES["/lag-baomer/5784/"].title, "Lag Baomer 5784");
});

test("manifest rebuild preserves route anchors and PDF text overlays", () => {
  const manifest = {
    "06 - Yom Tov": {
      "01 - Pesach": {
        "5783": {
          "Dvar Torah": "Dvar Torah Pesach 5783",
        },
      },
    },
    "07 - Haskamos": {
      "01 - Rabbi Oelbaum": "Rabbi Oelbaum",
    },
  };
  const existingRoutes = {
    byRoute: {
      "/pesach/5783/dvar-torah/": {
        contentPath: "06 - Yom Tov/01 - Pesach/5783/Dvar Torah",
        anchor: "pesach-5783-dvar-torah",
      },
      "/rabbi-oelbaum/": {
        contentPath: "07 - Haskamos/01 - Rabbi Oelbaum",
        pdfPage: "Rabbi Oelbaum.pdf",
        pdfTextOverlay: {
          docx: "Rabbi Oelbaum.docx",
          referenceLabel: "pesach-5783-dvar-torah",
        },
      },
    },
    byContentPath: {
      "06 - Yom Tov/01 - Pesach/5783/Dvar Torah": "/pesach/5783/dvar-torah/",
      "07 - Haskamos/01 - Rabbi Oelbaum": "/rabbi-oelbaum/",
    },
  };
  const rebuilt = buildRoutes(manifest, existingRoutes).byRoute;

  assert.equal(rebuilt["/pesach/5783/dvar-torah/"].anchor, "pesach-5783-dvar-torah");
  assert.deepEqual(rebuilt["/rabbi-oelbaum/"].pdfTextOverlay, {
    docx: "Rabbi Oelbaum.docx",
    referenceLabel: "pesach-5783-dvar-torah",
  });
});

test("renders Rabbi Oelbaum's contextual Pesach page link", () => {
  assert.equal(
    ROUTES["/pesach/5783/dvar-torah/"].anchor,
    "pesach-5783-dvar-torah",
    "Pesach Dvar Torah anchor"
  );
  assert.equal(
    ROUTES["/rabbi-oelbaum/"].pdfTextOverlay.referenceLabel,
    "pesach-5783-dvar-torah",
    "Rabbi Oelbaum reference anchor"
  );

  const rendered = renderPdfTextOverlay(
    {
      title: "Rabbi Oelbaum",
      pdfTextOverlay: {
        referenceAfter: "becomes מתגייר?",
        referenceLabel: "pesach-5783-dvar-torah",
        masks: [],
        body: { x: "0in", y: "0in", width: "1in" },
        signature: { x: "0in", y: "0in", width: "1in" },
      },
    },
    `when a ${RTL_ISOLATE}גוי${POP_DIRECTIONAL_ISOLATE} becomes ${RTL_ISOLATE}מתגייר${POP_DIRECTIONAL_ISOLATE}?`
  );

  assertContains(
    rendered,
    "#link(<pesach-5783-dvar-torah>)[#context[(Editor's Note: See Page #counter(page).at(<pesach-5783-dvar-torah>).first())]]",
    "contextual Pesach page link"
  );
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

test("does not count typst divider as docx paragraph for alignment", () => {
  const alignments = new Map([
    [0, { align: "center", text: "before" }],
    [1, { align: "center", text: "after" }],
  ]);

  assert.equal(
    applyDocxParagraphAlignments("before\n\n#divider()\n\nafter", alignments),
    "#align(center)[\nbefore\n]\n\n#divider()\n\n#align(center)[\nafter\n]"
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

test("keeps space after comma in dates before four-digit years", () => {
  assert.equal(
    normalizePunctuationSpacing("On January 28, 1986, the world watched"),
    "On January 28, 1986, the world watched"
  );
});

test("removes spaces before sentence punctuation", () => {
  assert.equal(
    normalizePunctuationSpacing("R' Moshe Sternbuch , who quoted Rav Itzele Peterburger . What"),
    "R’ Moshe Sternbuch, who quoted Rav Itzele Peterburger. What"
  );
});

test("adds a space after English terminal punctuation before Hebrew", () => {
  assert.equal(
    normalizePunctuationSpacing("No one else.הקדוש ברוך הוא is responsible."),
    "No one else. הקדוש ברוך הוא is responsible."
  );
});

test("preserves an English source paragraph break after punctuation", () => {
  assert.equal(
    applyTextRules("L'kavod my dear friend, Dr. Leslie Bennett,\n\nEvery year, we daven."),
    "L'kavod my dear friend, Dr. Leslie Bennett,\n\nEvery year, we daven."
  );
});

test("closes an unclosed nested Hebrew source before English prose", () => {
  assert.equal(
    applyTextRules("There is a (מדרש תנחומא (תצוה ה׳:ה׳ on the פסוק."),
    `There is a ${RTL_ISOLATE}מדרש תנחומא ${LTR_ISOLATE}(תצוה ה׳:ה׳)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE} on the ${RTL_ISOLATE}פסוק${POP_DIRECTIONAL_ISOLATE}.`
  );
});

test("keeps a comma-separated Hebrew quotation together before English prose", () => {
  assert.equal(
    applyTextRules("which begins שִׁיר לַמַּעֲלוֹת, אֶשָּׂא עֵינַי אֶל הֶהָרִים. Why"),
    `which begins ${RTL_ISOLATE}שִׁיר לַמַּעֲלוֹת, אֶשָּׂא עֵינַי אֶל הֶהָרִים${POP_DIRECTIONAL_ISOLATE}. Why`
  );
});

test("keeps a vocalized Hebrew quotation together before an English connector", () => {
  assert.equal(
    applyTextRules("mumbled ה׳ נָתַן, ה׳ לָקָח, יְהִי שֵׁם ה׳ מְבֹרָךְ, and continued"),
    `mumbled ${RTL_ISOLATE}ה׳ נָתַן, ה׳ לָקָח, יְהִי שֵׁם ה׳ מְבֹרָךְ${POP_DIRECTIONAL_ISOLATE}, and continued`
  );
});

test("keeps a lamed-prefixed divine name inside a wrapped Hebrew quotation", () => {
  assert.equal(
    applyTextRules("it says דַּבֵּר אֶל בְּנֵי יִשְׂרָאֵל וְאָמַרְתָּ אֲלֵהֶם אָדָם כִּי יַקְרִיב מִכֶּם\nקׇרְבָּן לַה׳. Why"),
    `it says ${RTL_ISOLATE}דַּבֵּר אֶל בְּנֵי יִשְׂרָאֵל וְאָמַרְתָּ אֲלֵהֶם אָדָם כִּי יַקְרִיב מִכֶּם קׇרְבָּן לַה׳${POP_DIRECTIONAL_ISOLATE}. Why`
  );
});

test("keeps a vocalized vav-prefixed divine name inside a Hebrew quotation", () => {
  assert.equal(
    applyTextRules("cries bitterly (ישעיהו מ״ט:י״ד):וַתֹּאמֶר צִיּוֹן עֲזָבַנִי ה׳ וַה׳ שְׁכֵחָנִי. This"),
    `cries bitterly ${LTR_ISOLATE}(ישעיהו מ״ט:י״ד)${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}וַתֹּאמֶר צִיּוֹן עֲזָבַנִי ה׳ וַה׳ שְׁכֵחָנִי${POP_DIRECTIONAL_ISOLATE}. This`
  );
});

test("keeps Hebrew text separated by a Typst nonbreaking space in one RTL run", () => {
  assert.equal(
    applyTextRules("Parshas Ha'azinu. הַאֲזִינוּ הַשָּׁמַיִם וַאֲדַבֵּרָה~וְתִשְׁמַע הָאָרֶץ אִמְרֵי פִי. The"),
    `Parshas Ha'azinu. ${RTL_ISOLATE}הַאֲזִינוּ הַשָּׁמַיִם וַאֲדַבֵּרָה וְתִשְׁמַע הָאָרֶץ אִמְרֵי פִי${POP_DIRECTIONAL_ISOLATE}. The`
  );
});

test("keeps a Hebrew speaker attribution and its quotation in one RTL run", () => {
  assert.equal(
    applyTextRules("it says: אָמַר רַבִּי חֲנִינָא: כׇּל הַמִּתְפַּתֶּה בְּיֵינוֹ יֵשׁ בּוֹ מִדַּעַת קוֹנוֹ. An"),
    `it says: ${RTL_ISOLATE}אָמַר רַבִּי חֲנִינָא: כׇּל הַמִּתְפַּתֶּה בְּיֵינוֹ יֵשׁ בּוֹ מִדַּעַת קוֹנוֹ${POP_DIRECTIONAL_ISOLATE}. An`
  );
});

test("keeps an English-introduced Hebrew source before its bracketed Mishnah quote", () => {
  assert.equal(
    applyTextRules("from the משנה in (ב׳:ד׳) סנהדרין: מֶּלֶךְ פוֹרֵץ [גֶדֶר] לַעֲשׂוֹת לוֹ דֶרֶךְ - A king"),
    `from the ${RTL_ISOLATE}משנה${POP_DIRECTIONAL_ISOLATE} in ${RTL_ISOLATE}סנהדרין${POP_DIRECTIONAL_ISOLATE} ${LTR_ISOLATE}(ב׳:ד׳)${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}מֶּלֶךְ פוֹרֵץ \\[${RTL_ISOLATE}גֶדֶר${POP_DIRECTIONAL_ISOLATE}\\] לַעֲשׂוֹת לוֹ דֶרֶךְ${POP_DIRECTIONAL_ISOLATE} - A king`
  );
});

test("keeps a Hebrew question and answer in one RTL run", () => {
  assert.equal(
    applyTextRules("As the חכמים teach (תמיד ל״ב ע״א): אֵיזֶהוּ חָכָם? הָרוֹאֶה אֶת הַנּוֹלָד. Next"),
    `As the ${RTL_ISOLATE}חכמים${POP_DIRECTIONAL_ISOLATE} teach ${LTR_ISOLATE}(תמיד ל״ב ע״א)${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}אֵיזֶהוּ חָכָם? הָרוֹאֶה אֶת הַנּוֹלָד${POP_DIRECTIONAL_ISOLATE}. Next`
  );
});

test("moves a leading Hebrew source after its English-clause quote", () => {
  assert.equal(
    applyTextRules("The last word is (אבות ד׳:א׳) אֵיזֶהוּ עָשִׁיר, הַשָּׂמֵחַ בְּחֶלְקוֹ. The"),
    `The last word is ${RTL_ISOLATE}אֵיזֶהוּ עָשִׁיר, הַשָּׂמֵחַ בְּחֶלְקוֹ ${LTR_ISOLATE}(אבות ד׳:א׳)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}. The`
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

test("keeps closing single quote after Hebrew word as quote", () => {
  assert.equal(
    normalizePunctuationSpacing("I replied 'You should have Yiddish נחת', and I gave"),
    "I replied 'You should have Yiddish נחת’, and I gave"
  );
});

test("smarten closing single quotes after punctuation and possessive names", () => {
  assert.equal(
    applyTextRules("on time?' He asked. 'Sure, ' they said. R’ Sheps ' sefer. R’ Sheps'#metadata(none) <person-index-r-sheps-1> sefer."),
    "on time?’ He asked. 'Sure,’ they said. R’ Sheps’ sefer. R’ Sheps’#metadata(none) <person-index-r-sheps-1> sefer."
  );
});

test("smarten closing double quote before a Hebrew isolate", () => {
  assert.equal(
    applyTextRules('We want it to remain with us."אמר לו'),
    `We want it to remain with us.”${RTL_ISOLATE}אמר לו${POP_DIRECTIONAL_ISOLATE}`
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

test("keeps multi-sentence Hebrew quote in one RTL run", () => {
  assert.equal(
    applyTextRules("rule: הלומד תורה על מנת ללמד, מספיקין בידו ללמוד וללמד. והלומד על מנת לעשות, מספיקין בידו ללמוד וללמד לשמור ולעשות. One of"),
    `rule: ${RTL_ISOLATE}הלומד תורה על מנת ללמד, מספיקין בידו ללמוד וללמד. והלומד על מנת לעשות, מספיקין בידו ללמוד וללמד לשמור ולעשות${POP_DIRECTIONAL_ISOLATE}. One of`
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

test("normalizes reversed ein bein first-second phrase", () => {
  assert.equal(
    applyTextRules("that we have is לאדר שני אין בין אדר ראשון, that the פורים"),
    `that we have is ${RTL_ISOLATE}אין בין אדר ראשון לאדר שני${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} that the ${RTL_ISOLATE}פורים${POP_DIRECTIONAL_ISOLATE}`
  );
  assert.equal(
    applyTextRules("the line says ליום טוב שני אין בין יום טוב ראשון."),
    `the line says ${RTL_ISOLATE}אין בין יום טוב ראשון ליום טוב שני${POP_DIRECTIONAL_ISOLATE}.`
  );
});

test("normalizes reversed Hebrew title compounds", () => {
  assert.equal(
    applyTextRules("I'm married to a חכם תלמיד who's going to kollel"),
    `I'm married to a ${RTL_ISOLATE}תלמיד חכם${POP_DIRECTIONAL_ISOLATE} who's going to kollel`
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

test("flips nested Hebrew quotes inside an RTL run", () => {
  assert.equal(
    applyTextRules('רש״י says יוֹתֵר מִמַּה שֶּׁנִּצְטַוָּה, שֶׁהַקָּבָּ״ה אָמַר לוֹ "וְסָמַכְתָּ אֶת יָדְךָ" - Hashem'),
    `${LTR_ISOLATE}רש״י${POP_DIRECTIONAL_ISOLATE} says ${RTL_ISOLATE}יוֹתֵר מִמַּה שֶּׁנִּצְטַוָּה, שֶׁהַקָּבָּ״ה אָמַר לוֹ ”וְסָמַכְתָּ אֶת יָדְךָ“${POP_DIRECTIONAL_ISOLATE} - Hashem`
  );
});

test("flips inline Hebrew quote before English dash explanation", () => {
  assert.equal(
    applyTextRules('came to R’ Chaim and said, "מחלה חולה - if you translate'),
    `came to R’ Chaim and said, ${RTL_ISOLATE}”מחלה חולה“${POP_DIRECTIONAL_ISOLATE} - if you translate`
  );
});

test("keeps English quotes outside a quoted Hebrew phrase", () => {
  assert.equal(
    applyTextRules('we both said simultaneously, "סַבּוּנִי גַם סְבָבוּנִי."'),
    `we both said simultaneously, “${RTL_ISOLATE}סַבּוּנִי גַם סְבָבוּנִי${POP_DIRECTIONAL_ISOLATE}.”`
  );
});

test("moves a trapped opening quote outside an inline Hebrew isolate", () => {
  assert.equal(
    applyTextRules('he called the sefer “מנחת חן”, חן is נח'),
    `he called the sefer “${RTL_ISOLATE}מנחת חן${POP_DIRECTIONAL_ISOLATE}”, ${RTL_ISOLATE}חן${POP_DIRECTIONAL_ISOLATE} is ${RTL_ISOLATE}נח${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("moves a paragraph-opening quote outside its Hebrew isolate", () => {
  assert.equal(
    applyTextRules("“גנב! What have you done with my wonderful עבירות?”"),
    `“${RTL_ISOLATE}גנב${POP_DIRECTIONAL_ISOLATE}! What have you done with my wonderful ${RTL_ISOLATE}עבירות${POP_DIRECTIONAL_ISOLATE}?”`
  );
});

test("keeps opening quote before Hebrew word when quoted sentence continues in English", () => {
  assert.equal(
    applyTextRules('They would answer "קרובץ is קרובץ לפורים"'),
    `They would answer “${RTL_ISOLATE}קרובץ${POP_DIRECTIONAL_ISOLATE} is ${RTL_ISOLATE}קרובץ לפורים${POP_DIRECTIONAL_ISOLATE}”`
  );
});

test("keeps quotes around hyphenated Hebrew word", () => {
  assert.equal(
    applyTextRules('can be read as "כ-פורים," like פורים'),
    `can be read as “${RTL_ISOLATE}כ-פורים${POP_DIRECTIONAL_ISOLATE},” like ${RTL_ISOLATE}פורים${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("repairs curly opening quote after Hebrew word to closing quote", () => {
  assert.equal(
    applyTextRules("They would answer קרובץ“ is קרובץ לפורים"),
    `They would answer ${RTL_ISOLATE}קרובץ${POP_DIRECTIONAL_ISOLATE}” is ${RTL_ISOLATE}קרובץ לפורים${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps opening quote outside inline quoted Hebrew before English continuation", () => {
  assert.equal(
    applyTextRules('made the following proclamation: "ריבונו של עולם, you told us'),
    `made the following proclamation: “${RTL_ISOLATE}ריבונו של עולם${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} you told us`
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

test("keeps quotes around Hebrew word before adjacent Hebrew word", () => {
  assert.equal(
    applyTextRules('he says a "בלעז" לשון, where רש״י will translate'),
    `he says a “${RTL_ISOLATE}בלעז${POP_DIRECTIONAL_ISOLATE}” ${RTL_ISOLATE}לשון${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} where ${LTR_ISOLATE}רש״י${POP_DIRECTIONAL_ISOLATE} will translate`
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

test("keeps Hebrew hyphenated letter pair after Hebrew comma phrase in order", () => {
  assert.equal(
    applyTextRules("How does the letters of הן, ה-נ teach you אחדות?"),
    `How does the letters of ${RTL_ISOLATE}הן, ה-נ${POP_DIRECTIONAL_ISOLATE} teach you ${RTL_ISOLATE}אחדות${POP_DIRECTIONAL_ISOLATE}?`
  );
});

test("keeps the Vayakhel-Pekudei Hebrew label in one RTL run", () => {
  assert.equal(
    applyTextRules("the year, ויקהל/פקודי פרשת החדש. In ויקהל"),
    `the year, ${RTL_ISOLATE}ויקהל/פקודי\u00A0פרשת\u00A0החדש${POP_DIRECTIONAL_ISOLATE}. In ${RTL_ISOLATE}ויקהל${POP_DIRECTIONAL_ISOLATE}`
  );
});

test("keeps right-aligned Hebrew initialism expansion rows in source order", () => {
  assert.equal(
    applyTextRules(`#align(right)[\nו - והקרן]`),
    `#align(right)[\n${LTR_ISOLATE}ו - והקרן${POP_DIRECTIONAL_ISOLATE}]`
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

test("keeps a prefixed divine name inside a Hebrew pasuk phrase", () => {
  const typst = applyTextRules("וַה׳ נָתַן אֶת חֵן הָעָם בְּעֵינֵי מִצְרַיִם וַיַּשְׁאִלוּם.");

  assertContains(
    typst,
    `${RTL_ISOLATE}וַה׳ נָתַן אֶת חֵן הָעָם בְּעֵינֵי מִצְרַיִם וַיַּשְׁאִלוּם${POP_DIRECTIONAL_ISOLATE}.`,
    "prefixed divine name remains in the RTL phrase"
  );
  assertNotContains(
    typst,
    `${LTR_ISOLATE}וַה׳${POP_DIRECTIONAL_ISOLATE}`,
    "prefixed divine name isolated as an acronym"
  );
});

test("keeps hakadosh baruch hu acronym inside a Hebrew phrase", () => {
  const typst = applyTextRules("עד שהראה לו הקב״ה באצבעו - until");

  assert.equal(
    typst,
    `${RTL_ISOLATE}עד שהראה לו הקב״ה באצבעו${POP_DIRECTIONAL_ISOLATE} - until`
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

test("moves leading Hebrew source after its book and verse", () => {
  assert.equal(
    applyTextRules("a pasuk from (י״ז:ה׳) משלי: לֹעֵג לָרָשׁ חֵרֵף עֹשֵׂהוּ."),
    `a pasuk from ${RTL_ISOLATE}משלי${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}לֹעֵג לָרָשׁ חֵרֵף עֹשֵׂהוּ ${LTR_ISOLATE}(י״ז:ה׳)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}.`
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

test("repairs nested Hebrew source parenthesis before English prose", () => {
  assert.equal(
    applyTextRules("a pasuk in (מלכים א (ה:י״ב, describing its meaning"),
    `a pasuk in ${LTR_ISOLATE}(מלכים א ה:י״ב)${POP_DIRECTIONAL_ISOLATE}, describing its meaning`
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

test("repairs Hebrew quote with trailing unclosed source parenthesis", () => {
  assert.equal(
    applyTextRules("due, (הָאוֹמֵר דָּבָר בְּשֵׁם אוֹמְרוֹ מֵבִיא גְאֻלָּה לָעוֹלָם (אבות ו:ו. So"),
    `due, ${RTL_ISOLATE}הָאוֹמֵר דָּבָר בְּשֵׁם אוֹמְרוֹ מֵבִיא גְאֻלָּה לָעוֹלָם ${LTR_ISOLATE}(אבות ו:ו)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}. So`
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

test("keeps person index markers outside closing quotes", () => {
  const indexState = {
    people: [
      {
        id: "the-weekly-vort",
        displayName: "The Weekly Vort",
        aliases: ["The Weekly Vort"],
      },
    ],
    mentions: new Map([["the-weekly-vort", []]]),
    nextMarker: 1,
  };

  assert.equal(
    tagPersonIndexMentions('from “The Weekly Vort” is relevant.', indexState),
    'from “The Weekly Vort”#metadata(none) <person-index-the-weekly-vort-1> is relevant.'
  );
});

test("keeps person index markers outside possessive apostrophes", () => {
  const indexState = {
    people: [
      {
        id: "r-sheps",
        displayName: "R’ Sheps",
        aliases: ["R’ Sheps"],
      },
    ],
    mentions: new Map([["r-sheps", []]]),
    nextMarker: 1,
  };

  assert.equal(
    tagPersonIndexMentions("R’ Sheps’ sefer", indexState),
    "R’ Sheps’#metadata(none) <person-index-r-sheps-1> sefer"
  );
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

test("docx: Bo 5784 keeps hakadosh baruch hu inside the Hebrew clause", () => {
  const typst = convertedDocx("/bo/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}עד שהראה לו הקב״ה באצבעו${POP_DIRECTIONAL_ISOLATE} - until`,
    "hakadosh baruch hu clause in RTL order"
  );
  assertNotContains(
    typst,
    `${LTR_ISOLATE}עד שהראה לו הקב״ה${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}באצבעו${POP_DIRECTIONAL_ISOLATE}`,
    "hakadosh baruch hu clause split at its acronym"
  );
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
    `help me marry off my daughters.’” “My friend,” said Reb Levi`,
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

test("docx: reported single quote closers use closing glyphs", () => {
  const cases = [
    ["/chayai-sara/5786/", "on time?’ He wasn't bothered"],
    ["/pekudei/5785/", "near the galley.’\nTo my surprise"],
    ["/korach/5785/", "speak with you.’ I thought"],
    ["/ki-seitzei/5785/", "'Sure,’ they said"],
    ["/ki-savo/5785/", "Sheps’\nsefer"],
    ["/pesach/5785/story-1/", "'True,’ I\nadmitted"],
    ["/elul/5784/", "for supper?’ So she gives"],
    ["/shavuos/5783/", "We want it to remain with us.”"],
  ];

  for (const [route, expected] of cases) {
    assertContains(convertedDocx(route), expected, `${route} closing quote`);
  }
});

test("docx: Ki Savo 5785 keeps indexed Sheps possessive apostrophe tight", () => {
  const typst = convertedDocxWithIndex("/ki-savo/5785/", [
    {
      id: "r-sheps",
      displayName: "R’ Sheps",
      aliases: ["R’ Sheps"],
    },
  ]);

  assertContains(
    typst,
    `R’ Sheps’#metadata(none) <person-index-r-sheps-1>\nsefer`,
    "index marker follows Sheps possessive apostrophe"
  );
  assertNotContains(
    typst,
    `Sheps#metadata(none) <person-index-r-sheps-1>'\nsefer`,
    "index marker should not separate Sheps from possessive apostrophe"
  );
});

test("docx: Behar 5784 keeps indexed quoted title tight to its closing quote", () => {
  const typst = convertedDocxWithIndex("/behar/5784/", [
    {
      id: "the-weekly-vort",
      displayName: "The Weekly Vort",
      aliases: ["The Weekly Vort"],
    },
  ]);

  assertContains(
    typst,
    `Vort"#metadata(none) <person-index-the-weekly-vort-1> is relevant`,
    "index marker follows the closing quote"
  );
  assertNotContains(
    typst,
    `Vort#metadata(none) <person-index-the-weekly-vort-1>" is relevant`,
    "index marker should not separate quoted title from its closing quote"
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
    `in A Short Vort: #metadata(none) <person-index-a-short-vort-1> The`,
    "colon stays tight before indexed A Short Vort marker"
  );
  assertNotContains(
    typst,
    `in A Short Vort #metadata(none) <person-index-a-short-vort-1>: The`,
    "index marker should not separate A Short Vort from colon"
  );
});

test("docx: Chanukah 5785 keeps inline Hebrew bracha list on one line", () => {
  const typst = convertedDocx("/chanukah/5785/");

  assertContains(
    typst,
    `our enemies, grant us ${RTL_ISOLATE}גזונט${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}פרנסה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} and ${RTL_ISOLATE}נחת${POP_DIRECTIONAL_ISOLATE}`,
    "inline Hebrew list items should not be separated by a hard break"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}גזונט,${POP_DIRECTIONAL_ISOLATE} \\ ${RTL_ISOLATE}פרנסה${POP_DIRECTIONAL_ISOLATE}`,
    "hard break should not be preserved inside inline Hebrew bracha list"
  );
});

test("docx: Tu Beshvat 5784 keeps Hebrew bullets on the RTL side", () => {
  const typst = convertedDocx("/tu-beshvat/5784/");

  assertContains(
    typst,
    `#align(right)[\n#set text(dir: rtl)\n- ${RTL_ISOLATE}ראש חודש אדר${POP_DIRECTIONAL_ISOLATE}\n- ${RTL_ISOLATE}פורים${POP_DIRECTIONAL_ISOLATE}`,
    "Hebrew-only bullet list should be grouped into an RTL list"
  );
  assertNotContains(
    typst,
    `#align(right)[\n- ${RTL_ISOLATE}ראש חודש אדר${POP_DIRECTIONAL_ISOLATE}]`,
    "Hebrew-only bullet list should not keep LTR-side markers"
  );
});

test("docx: Tu Beshvat 5784 keeps comma after Bnei Yissaschar before zechuso", () => {
  const typst = convertedDocxWithIndex("/tu-beshvat/5784/", [
    {
      id: "r-tzvi-elimelech-of-dinov",
      displayName: "R’ Tzvi Elimelech of Dinov",
      aliases: ["בני יששכר"],
    },
  ]);

  assertContains(
    typst,
    `the ${RTL_ISOLATE}בני יששכר${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} #metadata(none) <person-index-r-tzvi-elimelech-of-dinov-1> ${RTL_ISOLATE}זכותו יגן עלינו${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} explains`,
    "comma should follow indexed Bnei Yissaschar before zechuso"
  );
  assertNotContains(
    typst,
    `the ${RTL_ISOLATE}בני יששכר,${POP_DIRECTIONAL_ISOLATE} #metadata(none) <person-index-r-tzvi-elimelech-of-dinov-1> ${RTL_ISOLATE}זכותו יגן עלינו${POP_DIRECTIONAL_ISOLATE}`,
    "comma should not remain inside Bnei Yissaschar RTL isolate"
  );
});

test("docx: Purim Katon 5784 keeps ein bein Mishnah phrase in logical order", () => {
  const typst = convertedDocx("/purim-katon/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}אין בין אדר ראשון לאדר שני${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} that the ${RTL_ISOLATE}פורים${POP_DIRECTIONAL_ISOLATE} in ${RTL_ISOLATE}אדר ראשון${POP_DIRECTIONAL_ISOLATE}`,
    "ein bein Adar phrase"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}לאדר שני אין בין אדר ראשון${POP_DIRECTIONAL_ISOLATE}`,
    "reversed ein bein Adar phrase"
  );
});

test("docx: Purim Katon 5784 keeps Avos source after Hebrew quote", () => {
  const typst = convertedDocx("/purim-katon/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}הָאוֹמֵר דָּבָר בְּשֵׁם אוֹמְרוֹ מֵבִיא גְאֻלָּה לָעוֹלָם ${LTR_ISOLATE}(אבות ו:ו)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}. So I wanted`,
    "Avos source after Hebrew quote"
  );
  assertNotContains(
    typst,
    `(אבות ו${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}ו${POP_DIRECTIONAL_ISOLATE}`,
    "split reversed Avos source"
  );
});

test("docx: Pesach 5783 keeps inline Minchas Chen quotes outside Hebrew", () => {
  const typst = convertedDocx("/pesach/5783/dvar-torah/");

  assertContains(
    typst,
    `called the sefer “${RTL_ISOLATE}מנחת חן${POP_DIRECTIONAL_ISOLATE}”, ${RTL_ISOLATE}חן${POP_DIRECTIONAL_ISOLATE} is`,
    "Minchas Chen quote boundaries"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}“מנחת חן${POP_DIRECTIONAL_ISOLATE}”,`,
    "opening quote trapped inside Minchas Chen Hebrew isolate"
  );
});

test("docx: Ki Seitzei 5784 keeps midah keneged midah and bais hachaim in RTL order", () => {
  const typst = convertedDocx("/ki-seitzei/5784/(2)/");

  assertContains(
    typst,
    `it's ${RTL_ISOLATE}מדה כנגד מדה${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} it does not want`,
    "midah keneged midah before English continuation"
  );
  assertContains(
    typst,
    `in the ${RTL_ISOLATE}בית החיים${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מדה כנגד מדה${POP_DIRECTIONAL_ISOLATE}.`,
    "LTR comma between bais hachaim and midah keneged midah"
  );
});

test("docx: Ki Sisa 5785 keeps the Shir Lamaalos quotation in source order", () => {
  const typst = convertedDocx("/ki-sisa/5785/");

  assertContains(
    typst,
    `${RTL_ISOLATE}שִׁיר לַמַּעֲלוֹת, אֶשָּׂא עֵינַי אֶל הֶהָרִים${POP_DIRECTIONAL_ISOLATE}. Why`,
    "Shir Lamaalos quotation in logical order"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}שִׁיר לַמַּעֲלוֹת${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}אֶשָּׂא עֵינַי אֶל הֶהָרִים${POP_DIRECTIONAL_ISOLATE}`,
    "split Shir Lamaalos quotation"
  );
});

test("docx: Pekudei 5785 keeps the Iyov quotation in source order", () => {
  const typst = convertedDocx("/pekudei/5785/");

  assertContains(
    typst,
    `${RTL_ISOLATE}ה׳ נָתַן, ה׳ לָקָח, יְהִי שֵׁם ה׳ מְבֹרָךְ${POP_DIRECTIONAL_ISOLATE}, and keep saying`,
    "Iyov quotation in logical order"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}ה׳ נָתַן${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}ה׳ לָקָח${POP_DIRECTIONAL_ISOLATE}`,
    "split Iyov quotation"
  );
});

test("docx: Vayikra 5785 keeps the lamed-prefixed divine name inside the pasuk", () => {
  const typst = convertedDocx("/vayikra/5785/");

  assertContains(
    typst,
    `${RTL_ISOLATE}דַּבֵּר אֶל בְּנֵי יִשְׂרָאֵל וְאָמַרְתָּ אֲלֵהֶם אָדָם כִּי יַקְרִיב מִכֶּם קׇרְבָּן לַה׳${POP_DIRECTIONAL_ISOLATE}. Why`,
    "Vayikra pasuk with lamed-prefixed divine name"
  );
});

test("docx: Eikev 5784 keeps the vocalized vav divine name inside the pasuk", () => {
  const typst = convertedDocx("/eikev/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}וַתֹּאמֶר צִיֹּון עֲזָבַנִי ה׳ וַה׳ שְׁכֵחָנִי${POP_DIRECTIONAL_ISOLATE}. This`,
    "Eikev pasuk with vocalized vav-prefixed divine name"
  );
});

test("docx: Ha'azinu 5785 keeps the opening pasuk across a nonbreaking space", () => {
  const typst = convertedDocx("/ha'azinu/5785/");

  assertContains(
    typst,
    `${RTL_ISOLATE}הַאֲזִינוּ הַשָּׁמַיִם וַאֲדַבֵּרָה וְתִשְׁמַע הָאָרֶץ אִמְרֵי פִי${POP_DIRECTIONAL_ISOLATE}. The`,
    "Ha'azinu opening pasuk in logical order"
  );
});

test("docx: Pesach 5784 keeps the Rabbi Chanina statement in source order", () => {
  const typst = convertedDocx("/pesach/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}אָמַר רַבִּי חֲנִינָא: כׇּל הַמִּתְפַּתֶּה בְּיֵינוֹ יֵשׁ בּוֹ מִדַּעַת קוֹנוֹ${POP_DIRECTIONAL_ISOLATE}. An`,
    "Rabbi Chanina statement in logical order"
  );
});

test("docx: Pesach 5785 keeps the Mishnah source before its bracketed quote", () => {
  const typst = convertedDocx("/pesach/5785/dvar-torah/");

  assertContains(
    typst,
    `in ${LTR_ISOLATE}(ב׳:ד׳)${POP_DIRECTIONAL_ISOLATE}\n${RTL_ISOLATE}סנהדרין: מֶּלֶךְ פוֹרֵץ \\[גֶדֶר\\] לַעֲשׂוֹת לוֹ דֶרֶךְ${POP_DIRECTIONAL_ISOLATE} - A king`,
    "Pesach Mishnah source and quote in logical order"
  );
});

test("docx: Pesach 5785 keeps the Tamid question and answer in source order", () => {
  const typst = convertedDocx("/pesach/5785/dvar-torah/");

  assertContains(
    typst,
    `${RTL_ISOLATE}אֵיזֶהוּ חָכָם? הָרוֹאֶה אֶת הַנּוֹלָד${POP_DIRECTIONAL_ISOLATE}. \\[Which`,
    "Tamid question and answer in logical order"
  );
});

test("docx: Vayakhel-Pekudei 5783 keeps the combined parsha label in one RTL run", () => {
  const typst = convertedDocx("/vayakhel-pekudei/5783/");

  assertContains(
    typst,
    `${RTL_ISOLATE}ויקהל/פקודי\u00A0פרשת\u00A0החדש${POP_DIRECTIONAL_ISOLATE}`,
    "combined Vayakhel-Pekudei label"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}ויקהל${POP_DIRECTIONAL_ISOLATE}/${RTL_ISOLATE}פקודי`,
    "combined Vayakhel-Pekudei label split around slash"
  );
});

test("docx: Lech Lecha 5784 restores logical order from adjacent RTL source runs", () => {
  const typst = convertedDocx("/lech-lecha/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}קָרוֹב ה׳ לְכׇל קֹרְאָיו לְכֹל אֲשֶׁר יִקְרָאֻהוּ בֶאֱמֶת${POP_DIRECTIONAL_ISOLATE}`,
    "pasuk restored from adjacent RTL source runs"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}קֹרְאָיו לְכֹל אֲשֶׁר יִקְרָאֻהוּ בֶאֱמֶת קָרוֹב ה׳ לְכׇל${POP_DIRECTIONAL_ISOLATE}`,
    "visually ordered RTL source runs"
  );
});

test("docx: Lech Lecha 5785 restores a short closing blessing from adjacent RTL runs", () => {
  const typst = convertedDocx("/lech-lecha/5785/");

  assertContains(
    typst,
    `${RTL_ISOLATE}משיח במהרה בימינו אמן${POP_DIRECTIONAL_ISOLATE}!`,
    "closing blessing in logical order"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}בימינו אמן משיח במהרה${POP_DIRECTIONAL_ISOLATE}!`,
    "visually ordered closing blessing"
  );
});

test("docx: Vayairah 5784 restores a closing blessing split by a short RTL run", () => {
  const typst = convertedDocx("/vayairah/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}ביאת גואל צדק במהרה בימינו אמן${POP_DIRECTIONAL_ISOLATE}!`,
    "closing blessing in logical order"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}גואל צדק במהרה בימינו אמן ביאת${POP_DIRECTIONAL_ISOLATE}!`,
    "visually ordered closing blessing"
  );
});

test("docx: Rosh Hashana in Berditchev keeps an opening quote before Hebrew", () => {
  const typst = convertedDocx("/rosh-hashana/rosh-hashana-in-berditchev/");

  assertContains(
    typst,
    `“${RTL_ISOLATE}גנב${POP_DIRECTIONAL_ISOLATE}! What have you done with my wonderful ${RTL_ISOLATE}עבירות${POP_DIRECTIONAL_ISOLATE}?”`,
    "opening quote before ganav"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}“גנב${POP_DIRECTIONAL_ISOLATE}!`,
    "opening quote trapped inside ganav isolate"
  );
});

test("docx: Re'eh 5783 preserves current hard-break initialism rows", () => {
  const typst = convertedDocx("/re'eh/5783/");

  assertContains(
    typst,
    `${RTL_ISOLATE}ו${POP_DIRECTIONAL_ISOLATE} - ${RTL_ISOLATE}והקרן${POP_DIRECTIONAL_ISOLATE} \\ ${RTL_ISOLATE}ק${POP_DIRECTIONAL_ISOLATE} - ${RTL_ISOLATE}קיימת${POP_DIRECTIONAL_ISOLATE}`,
    "current hard-break initialism rows"
  );
});

test("docx: English sentence punctuation stays separated from following Hebrew", () => {
  const cases = [
    ["/noach/5784/(1)/", "else."],
    ["/lech-lecha/5786/(2)/", "question."],
    ["/toldos/5785/", "notions."],
    ["/vayaishev/5785/", "midos.", LTR_ISOLATE],
    ["/mikeitz/5784/", "charge."],
    ["/balak/5785/", "loving."],
    ["/balak/5785/", "saying."],
    ["/shavuos/5783/", "mouths."],
  ];

  for (const [route, sentenceEnd, isolate = RTL_ISOLATE] of cases) {
    const typst = convertedDocx(route);
    assertContains(
      typst,
      `${sentenceEnd} ${isolate}`,
      `${route} keeps a space after ${sentenceEnd}`
    );
  }
});

test("docx: Story Purim 5783 keeps talmid chacham in logical order", () => {
  const typst = convertedDocx("/purim/5783/story/");

  assertContains(
    typst,
    `I'm married to a ${RTL_ISOLATE}תלמיד חכם${POP_DIRECTIONAL_ISOLATE} who's\ngoing to kollel`,
    "talmid chacham title"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}חכם תלמיד${POP_DIRECTIONAL_ISOLATE}`,
    "reversed talmid chacham title"
  );
});

test("docx: Krovitz keeps opening quote before Hebrew word", () => {
  const typst = convertedDocx("/purim/5783/krovitz/");

  assertContains(
    typst,
    `answer “${RTL_ISOLATE}קרובץ${POP_DIRECTIONAL_ISOLATE} is ${RTL_ISOLATE}קרובץ לפורים${POP_DIRECTIONAL_ISOLATE}`,
    "opening quote before Krovitz"
  );
  assertNotContains(
    typst,
    `They would answer ${RTL_ISOLATE}“קרובץ${POP_DIRECTIONAL_ISOLATE}`,
    "opening quote inside Krovitz isolate"
  );
});

test("docx: Korach 5783 keeps date comma spacing before four-digit year", () => {
  const typst = convertedDocx("/korach/5783/");

  assertContains(
    typst,
    "On January 28, 1986, the world watched",
    "date comma spacing before four-digit year"
  );
  assertNotContains(
    typst,
    "On January 28,1986, the world watched",
    "collapsed date comma spacing"
  );
});

test("docx: Lag Baomer 5784 keeps Mishlei before its source", () => {
  const typst = convertedDocx("/lag-baomer/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}משלי${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}לֹעֵג לָרָשׁ חֵרֵף עֹשֵׂהוּ ${LTR_ISOLATE}(י״ז:ה׳)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}. It's a well-known halacha`,
    "Mishlei verse before its source"
  );
  assertNotContains(
    typst,
    `${LTR_ISOLATE}(י״ז:ה׳)${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}משלי${POP_DIRECTIONAL_ISOLATE}:`,
    "source should not precede Mishlei"
  );
});

test("docx: Chukas-Balak 5783 keeps hen and hei-nun in logical order", () => {
  const typst = convertedDocx("/chukas-balak/5783/");

  assertContains(
    typst,
    `How do the letters of ${RTL_ISOLATE}הן, ה-נ${POP_DIRECTIONAL_ISOLATE} teach you ${RTL_ISOLATE}אחדות${POP_DIRECTIONAL_ISOLATE}?`,
    "hen and hei-nun letter phrase"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}הן, ה${POP_DIRECTIONAL_ISOLATE}-${RTL_ISOLATE}נ${POP_DIRECTIONAL_ISOLATE}`,
    "split hei-nun after comma phrase"
  );
});

test("docx: Pinchas 5784 flips nested Hebrew quote marks inside Rashi", () => {
  const typst = convertedDocx("/pinchas/5784/");

  assertContains(
    typst,
    `${RTL_ISOLATE}יוֹתֵר וְיוֹתֵר מִמַּה שֶּׁנִּצְטַוָּה, שֶׁהַקָּבָּ״ה אָמַר לוֹ ”וְסָמַכְתָּ אֶת יָדְךָ“${POP_DIRECTIONAL_ISOLATE} - Hashem said`,
    "nested Hebrew quote marks inside Rashi"
  );
  assertNotContains(
    typst,
    `אָמַר לוֹ “וְסָמַכְתָּ אֶת יָדְךָ”`,
    "unflipped nested Hebrew quote marks inside Rashi"
  );
});

test("docx: Matos-Maasei 5783 flips Hebrew quote before dash explanation", () => {
  const typst = convertedDocx("/matos-maasei/5783/");

  assertContains(
    typst,
    `and said, ${RTL_ISOLATE}”מחלה חולה“${POP_DIRECTIONAL_ISOLATE} - if you translate`,
    "Hebrew quote before English dash explanation"
  );
  assertNotContains(
    typst,
    `and said, ${RTL_ISOLATE}“מחלה חולה${POP_DIRECTIONAL_ISOLATE} - if you translate`,
    "opening quote trapped on wrong side of Hebrew phrase"
  );
});

test("docx: Purim 5785 keeps quotes around hyphenated Hebrew word", () => {
  const typst = convertedDocx("/purim/5785/");

  assertContains(
    typst,
    `can be read as “${RTL_ISOLATE}כ-פורים${POP_DIRECTIONAL_ISOLATE},” like ${RTL_ISOLATE}פורים${POP_DIRECTIONAL_ISOLATE}`,
    "quotes around hyphenated k-purim"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}“כ-פורים${POP_DIRECTIONAL_ISOLATE}`,
    "opening quote inside hyphenated Hebrew isolate"
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

test("docx: Shavuos 5785 repairs nested Melachim source parenthesis", () => {
  const typst = convertedDocx("/shavuos/5785/");

  assertContains(
    typst,
    `based on a pasuk in\n${LTR_ISOLATE}(מלכים א ה:י״ב)${POP_DIRECTIONAL_ISOLATE}, describing the vastness`,
    "fixed Melachim source"
  );
  assertNotContains(typst, "(⁧מלכים א⁩ (⁧ה⁩", "nested Melachim source parenthesis");
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
    `their ${RTL_ISOLATE}רצון${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE};${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}וְאֶת שַׁוְעָתָם יִשְׁמַע וְיוֹשִׁיעֵם${POP_DIRECTIONAL_ISOLATE} - Hashem hears`,
    "semicolon between Shmini Atzeres Hebrew phrases"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}רצון; וְאֶת שַׁוְעָתָם`,
    "single RTL Shmini Atzeres semicolon phrase"
  );
});

test("docx: Shmini Atzeres 5784 keeps opening quote before Hebrew proclamation", () => {
  const typst = convertedDocx("/shmini-atzeres/5784/");

  assertContains(
    typst,
    `made the following proclamation: “${RTL_ISOLATE}ריבונו של עולם${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} you told us`,
    "opening quote before Ribon Shel Olam proclamation"
  );
  assertNotContains(
    typst,
    `made the following proclamation: ${RTL_ISOLATE}“ריבונו של עולם${POP_DIRECTIONAL_ISOLATE}`,
    "opening quote should not remain inside the Hebrew isolate"
  );
});

test("docx: Rabbi Oelbaum Shabbos keeps the revised introductory note centered", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    "#align(center)[\nA dvar Torah on parshas Ki Sisa by R’ Oelbaum, who gave permission to",
    "centered introductory note"
  );
  assertNotContains(
    typst,
    "#align(center)[\n#align(center)[",
    "introductory note should have one alignment wrapper"
  );
});

test("docx: Rabbi Oelbaum Shabbos keeps space after Maharal colon", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `Says the ${LTR_ISOLATE}מהר״ל${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}אבל מפני כי השבת בו השלים השם יתברך העולם${POP_DIRECTIONAL_ISOLATE}.`,
    "space after Maharal colon"
  );
  assertNotContains(
    typst,
    `${LTR_ISOLATE}מהר״ל${POP_DIRECTIONAL_ISOLATE}:${RTL_ISOLATE}אבל`,
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

test("docx: Rabbi Oelbaum Shabbos keeps revised Gemara phrase in one RTL isolate", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `${RTL_ISOLATE}תני נמי הכי, לדעת כי אני ה׳ מקדשכם. אמר להם הקדוש ברוך הוא למשה, מתנה טובה יש לי בבית גנזי ושבת שמה, ואני מבקש ליתנה לישראל${POP_DIRECTIONAL_ISOLATE}; ${RTL_ISOLATE}לך והודיעם${POP_DIRECTIONAL_ISOLATE}.`,
    "Gemara phrase remains in RTL order"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}תני נמי הכי, לדעת כי אני ה׳ מקדשכם${POP_DIRECTIONAL_ISOLATE}. ${RTL_ISOLATE}אמר להם הקדוש ברוך הוא`,
    "Gemara phrase should not split at the sentence boundary"
  );
});

test("docx: Rabbi Oelbaum Shabbos keeps revised piyut phrases in RTL order", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `${RTL_ISOLATE}הכל יודוך, והכל ישבחוך,  והכל יאמרו אין קדוש כה׳${POP_DIRECTIONAL_ISOLATE}, ${RTL_ISOLATE}הכל ירוממוך סלה, יוצר הכל${POP_DIRECTIONAL_ISOLATE}.`,
    "piyut phrases remain in RTL order"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}הכל יודוך${POP_DIRECTIONAL_ISOLATE}, ${RTL_ISOLATE}והכל ישבחוך${POP_DIRECTIONAL_ISOLATE}`,
    "first piyut phrase should not split at its internal comma"
  );
});

test("docx: Rabbi Oelbaum Shabbos keeps revised Malbim Gemara citation in RTL order", () => {
  const typst = convertedDocx("/rabbi-oelbaum-shabbos/");

  assertContains(
    typst,
    `the ${LTR_ISOLATE}מלבי״ם${POP_DIRECTIONAL_ISOLATE} cites the ${LTR_ISOLATE}מאמר חז״ל${POP_DIRECTIONAL_ISOLATE}: ${RTL_ISOLATE}לדעת כי אני ה׳ מקדשכם. אמר הקדוש ברוך הוא למשה: משה, מתנה טובה יש לי בבית גנזי ושבת שמה, ואני מבקש ליתנה לישראל${POP_DIRECTIONAL_ISOLATE}; ${RTL_ISOLATE}לך והודיעם${POP_DIRECTIONAL_ISOLATE}.`,
    "Malbim Gemara citation remains in RTL order"
  );
  assertNotContains(
    typst,
    `${RTL_ISOLATE}לדעת כי אני ה׳ מקדשכם${POP_DIRECTIONAL_ISOLATE}. ${RTL_ISOLATE}אמר הקדוש ברוך הוא למשה`,
    "Malbim citation should not split at the sentence boundary"
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

test("docx: Vayailech 5786 keeps Avos quote in one RTL run", () => {
  const typst = convertedDocx("/vayailech/5786/");

  assertContains(
    typst,
    `rule (4:5): ${RTL_ISOLATE}הַלּוֹמֵד תּוֹרָה עַל מְנָת לְלַמֵּד, מַסְפִּיקִין בְּיָדוֹ לִלְמֹד וּלְלַמֵּד. וְהַלּוֹמֵד עַל מְנָת לַעֲשׂוֹת, מַסְפִּיקִין בְּיָדוֹ לִלְמֹד וּלְלַמֵּד לִשְׁמֹר וְלַעֲשׂוֹת${POP_DIRECTIONAL_ISOLATE}. One of`,
    "Avos quote stays in one RTL isolate"
  );
});

test("docx: Simchas Torah 5785 keeps closing quote after Yiddish nachas", () => {
  const typst = convertedDocx("/simchas-torah/5785/");

  assertContains(
    typst,
    `I replied 'You should have Yiddish ${RTL_ISOLATE}נחת${POP_DIRECTIONAL_ISOLATE}’, and I gave`,
    "single quote after nachas stays a closing English quote"
  );
  assertNotContains(
    typst,
    `Yiddish\n${LTR_ISOLATE}נחת׳${POP_DIRECTIONAL_ISOLATE}`,
    "single quote after nachas should not become a Hebrew geresh"
  );
  assertContains(
    typst,
    `And\ntomorrow we're making a ${RTL_ISOLATE}ברית${POP_DIRECTIONAL_ISOLATE}\\.’”`,
    "final nested single quote after bris stays a closing English quote"
  );
});

test("docx: Zeidy foreword keeps final acknowledgment centered after divider", () => {
  const typst = convertedDocx("/zeidy/");

  assertContains(
    typst,
    `#divider()\n\n#align(center)[\nI would like to acknowledge permission graciously extended by the\nfollowing writers to include selections of their work in this sefer: ]`,
    "acknowledgment paragraph stays centered after divider"
  );
  assertContains(
    typst,
    `#align(center)[\nRabbi Noach Isaac Oelbaum - Divrei Torah]\n\n#align(center)[\nRabbi Gedalia Zlotowitz - ArtScroll/Mesorah]`,
    "final acknowledgment line stays centered"
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

test("docx: Rabbi Dovid Hoffman Haskama keeps the salutation paragraph break", () => {
  const typst = convertedDocx("/rabbi-dovid-hoffman/");

  assertContains(
    typst,
    "L'kavod my dear friend, Dr. Leslie Bennett,\n\nEvery year, on Rosh Hashanah",
    "paragraph break after Dr. Leslie Bennett"
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

test("docx: Teruma 5785 keeps quotes around b'laaz before lashon", () => {
  const typst = convertedDocx("/teruma/5785/");

  assertContains(
    typst,
    `he says a “${RTL_ISOLATE}בלעז${POP_DIRECTIONAL_ISOLATE}” ${RTL_ISOLATE}לשון${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} where ${LTR_ISOLATE}רש״י${POP_DIRECTIONAL_ISOLATE} will translate`,
    "quoted Hebrew word before adjacent Hebrew word"
  );
  assertNotContains(
    typst,
    `“${RTL_ISOLATE}בלעז” לשון${POP_DIRECTIONAL_ISOLATE}`,
    "opening quote should not float outside a merged quoted-Hebrew run"
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

test("docx: Shemos 5783 keeps the V'Hashem pasuk in one RTL phrase", () => {
  const typst = convertedDocx("/shemos/5783/");

  assertContains(
    typst,
    `${RTL_ISOLATE}וַה׳ נָתַן אֶת חֵן הָעָם בְּעֵינֵי מִצְרַיִם וַיַּשְׁאִלוּם${POP_DIRECTIONAL_ISOLATE}.`,
    "V'Hashem pasuk in logical order"
  );
  assertNotContains(
    typst,
    `${LTR_ISOLATE}וַה׳ נָתַן אֶת חֵן${POP_DIRECTIONAL_ISOLATE}`,
    "V'Hashem pasuk split by an LTR acronym isolate"
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
