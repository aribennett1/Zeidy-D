#!/usr/bin/env node

"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = __dirname;
const FILES_DIR = path.join(ROOT_DIR, "Files");
const ROUTES_FILE = path.join(ROOT_DIR, "routes.json");
const PERSON_INDEX_REVIEW_FILE = path.join(ROOT_DIR, "person-index-review.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "Files/09 - Misc/Final Sefer");
const WORD_DOCUMENT = "word/document.xml";
const DOMAIN = "https://zeidyd.com";
const FRONT_MATTER_SPECS = ["07 - Haskamos/", "/about-the-name/", "/zeidy/", "/ari/"];
const NO_FOOTER_ROUTES = new Set(["/about-the-name/", "/zeidy/", "/ari/"]);
const HASKAMA_CONTENT_PREFIX = "07 - Haskamos/";
const LTR_ISOLATE = "\u2066";
const RTL_ISOLATE = "\u2067";
const POP_DIRECTIONAL_ISOLATE = "\u2069";
const RTL_REFERENCE_MARKER = "\uE010";
const HEBREW_LETTERS = "[\\u0590-\\u05FF\\uFB1D-\\uFB4F]";
const HEBREW_BASE_LETTERS = "[\\u05D0-\\u05EA\\uFB1D-\\uFB4F]";
const HEBREW_INTERNAL_QUOTE = "(?:\\\\[\"']|[\"'׳״])";
const HEBREW_TOKEN = `${HEBREW_LETTERS}+(?:${HEBREW_INTERNAL_QUOTE}${HEBREW_LETTERS}+)*(?:${HEBREW_INTERNAL_QUOTE})?`;
const HEBREW_REF_TOKEN = `${HEBREW_BASE_LETTERS}+(?:${HEBREW_INTERNAL_QUOTE}${HEBREW_BASE_LETTERS}+)*(?:${HEBREW_INTERNAL_QUOTE})?`;
const HEBREW_SOURCE_INNER = `(?:${HEBREW_TOKEN}\\s+)?${HEBREW_TOKEN}\\s*:\\s*${HEBREW_TOKEN}`;
const HEBREW_ACRONYM = `${HEBREW_LETTERS}+(?:(?:${HEBREW_INTERNAL_QUOTE}${HEBREW_LETTERS}+)+|${HEBREW_INTERNAL_QUOTE})`;
const HEBREW_STRONG_ACRONYM = `(?:${HEBREW_LETTERS}+(?:${HEBREW_INTERNAL_QUOTE}${HEBREW_LETTERS}+)+|${HEBREW_LETTERS}{2,}${HEBREW_INTERNAL_QUOTE})`;
const HEBREW_PAREN_REFERENCE = `\\((?=[^()]{1,120}\\))(?=[^()]{0,120}(?:${HEBREW_STRONG_ACRONYM}|:))(?:${HEBREW_TOKEN}|\\s|:|-){1,120}\\)`;
const HEBREW_TEXT_WITH_PAREN_REFERENCE_RE = new RegExp(
  `(${HEBREW_TOKEN}(?:(?:\\s+${HEBREW_TOKEN})|(?:\\s+\\\\?\\.\\.\\.)){0,160})\\s+(${HEBREW_PAREN_REFERENCE})(?=\\s*(?:[.?!]|-))`,
  "gu"
);
const HEBREW_MULTI_TEXT_WITH_PAREN_REFERENCE_RE = new RegExp(
  `(${HEBREW_TOKEN}(?:(?:\\s+${HEBREW_TOKEN})|(?:\\s+\\\\?\\.\\.\\.)){1,160})\\s+(${HEBREW_PAREN_REFERENCE})(?=\\s*(?:,|[A-Za-z]))`,
  "gu"
);
const HEBREW_PAREN_REFERENCE_BEFORE_QUOTE_RE = new RegExp(
  `(\\b(?:say|says|said|state|states|stated|stating|pasuk says)\\s+)(${HEBREW_PAREN_REFERENCE})\\s+(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){0,80})(?=\\s*[.?!,;:]|\\s+-|\\s+[A-Za-z]|$)`,
  "gu"
);
const NUMERIC_SOURCE_HEBREW_QUOTE_RE = new RegExp(
  `(\\(\\d+:\\d+\\):\\s+)(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){2,220})(?=\\s*[.?!])`,
  "gu"
);
const HEBREW_PHRASE_NUMERIC_SOURCE_RE = new RegExp(
  `(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){1,8})\\s*\\\\?\\((\\d+:\\d+)\\),(?=\\s+${HEBREW_TOKEN})`,
  "gu"
);
const HEBREW_PARAGRAPH_LEADING_REFERENCE_RE = new RegExp(
  `^\\s*(${HEBREW_PAREN_REFERENCE})\\s+(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){0,220})([.?!]?)\\s*$`,
  "gu"
);
const ESCAPED_HEBREW_PARAGRAPH_CITATION_RE = new RegExp(
  `^\\\\\\(([\\s\\S]*?)\\s+\\((${HEBREW_SOURCE_INNER})\\s*$`,
  "u"
);
const HEBREW_ELLIPSIS_PHRASE_RE = new RegExp(
  `${HEBREW_TOKEN}(?:(?:\\s+${HEBREW_TOKEN})){0,80}\\s+\\\\?\\.\\.\\.\\s+${HEBREW_TOKEN}(?:(?:\\s+${HEBREW_TOKEN})){0,80}`,
  "gu"
);
const HEBREW_PAREN_REFERENCE_RE = new RegExp(HEBREW_PAREN_REFERENCE, "gu");
const HEBREW_BARE_REFERENCE_RE = new RegExp(
  `(?:${HEBREW_TOKEN}\\s+)?${HEBREW_REF_TOKEN}\\s*:\\s*${HEBREW_REF_TOKEN}(?=\\s*:)`,
  "gu"
);
const HEBREW_LOOSE_CITATION_CLOSE_RE = new RegExp(
  `(^|\\s)((?:${HEBREW_TOKEN}\\s+)?${HEBREW_TOKEN}:${HEBREW_TOKEN})\\)\\)+(?=\\s+${HEBREW_TOKEN})`,
  "gu"
);
const NAMED_NUMERIC_LOOSE_CITATION_CLOSE_RE = new RegExp(
  `(^|\\s)(${HEBREW_TOKEN}\\s+\\d+:\\d+)\\)\\)+\\s*:`,
  "gu"
);
const HEBREW_ACRONYM_PHRASE = `(?:${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){0,3}\\s+${HEBREW_STRONG_ACRONYM}|${HEBREW_STRONG_ACRONYM}(?:\\s+${HEBREW_TOKEN}){1,3})`;
const HEBREW_ACRONYM_COMMA_SEQUENCE_RE = new RegExp(
  `${HEBREW_ACRONYM_PHRASE},\\s+${HEBREW_ACRONYM_PHRASE}`,
  "gu"
);
const HEBREW_ACRONYM_CONTEXT_RE = new RegExp(
  HEBREW_ACRONYM_PHRASE,
  "gu"
);
const HEBREW_TRAILING_ACRONYM_PHRASE_RE = new RegExp(
  `${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){1,3}\\s+${HEBREW_STRONG_ACRONYM}`,
  "gu"
);
const HEBREW_ACRONYM_CONTINUATION_PHRASE_RE = new RegExp(
  `${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){0,6}\\s+${HEBREW_STRONG_ACRONYM}\\s+${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){0,6}(?=\\s*(?:[,.;:?!]|-|[A-Za-z]|$))`,
  "gu"
);
const HEBREW_COMMA_PHRASE_SEQUENCE_RE = new RegExp(
  `${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*(?:,\\s*${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*){1,8},?`,
  "gu"
);
const HEBREW_QUESTION_PHRASE_RE = new RegExp(
  `${HEBREW_TOKEN}(?:[\\s,]+${HEBREW_TOKEN}){1,80}\\?`,
  "gu"
);
const HEBREW_SEMICOLON_PHRASE_RE = new RegExp(
  `${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*\\s*\\\\;\\s*${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*(?:,\\s*${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*){0,8},?`,
  "gu"
);
const HEBREW_PARSHAS_HYPHENATED_PHRASE_RE = new RegExp(
  `פרשת\\s+${HEBREW_TOKEN}(?:-${HEBREW_TOKEN})+(?:\\s+${HEBREW_TOKEN})*`,
  "gu"
);
const HEBREW_HYPHENATED_TOKEN_RE = new RegExp(
  `${HEBREW_TOKEN}(?:-${HEBREW_TOKEN})+(?:\\s+${HEBREW_TOKEN})*`,
  "gu"
);
const HEBREW_ACRONYM_RE = new RegExp(
  `${HEBREW_STRONG_ACRONYM}(?:\\s+${HEBREW_STRONG_ACRONYM})*`,
  "gu"
);
const HEBREW_PHRASE_RE = new RegExp(
  `${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*,?`,
  "gu"
);
const MISPLACED_HEBREW_COMMA_RE = new RegExp(
  `,\\s*,(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*)(?=\\s+[A-Za-z])`,
  "gu"
);
const HEBREW_CITATION_COLON_RE = new RegExp(
  `(^|[^\\u0590-\\u05FF\\uFB1D-\\uFB4F])(${HEBREW_REF_TOKEN})\\s*:\\s*(${HEBREW_REF_TOKEN})(?!${HEBREW_LETTERS})`,
  "gu"
);
const MISSING_OPEN_HEBREW_CITATION_PAREN_RE = new RegExp(
  `(\\bthe\\s+${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*?)\\s+((?:${HEBREW_TOKEN}\\s+)?${HEBREW_TOKEN}:${HEBREW_TOKEN})\\)\\)+\\s*:`,
  "gu"
);
const MALFORMED_ESCAPED_OPEN_HEBREW_CITATION_RE = new RegExp(
  `\\(\\\\\\(((?:${HEBREW_TOKEN}\\s+)?${HEBREW_TOKEN}:${HEBREW_TOKEN}):\\s*(?=${HEBREW_LETTERS})`,
  "gu"
);
const MALFORMED_NESTED_OPEN_HEBREW_CITATION_RE = new RegExp(
  `\\((${HEBREW_TOKEN})\\s+\\((${HEBREW_REF_TOKEN}\\s*:\\s*${HEBREW_REF_TOKEN}):\\s*(?=${HEBREW_LETTERS})`,
  "gu"
);
const MALFORMED_ESCAPED_OPEN_NUMERIC_CITATION_RE = new RegExp(
  `\\((\\d+:\\d+)\\\\\\(:\\s*(?=${HEBREW_LETTERS})`,
  "gu"
);
const DUPLICATE_ESCAPED_OPEN_NUMERIC_CITATION_RE = /\(\\\((\d+:\d+)(?=[,):])/gu;
const NUMERIC_CITATION_WITH_TRAILING_AS_QUOTED_RE = /\((\d+:\d+),\s+(as quoted\b)/gu;
const MALFORMED_HEBREW_LABEL_ESCAPED_OPEN_NUMERIC_CITATION_RE = new RegExp(
  `(${HEBREW_TOKEN})\\s+\\(\\\\\\((\\d+:\\d+):\\s*(?=${HEBREW_LETTERS})`,
  "gu"
);
const HEBREW_TO_ENGLISH_DASH_RE = new RegExp(
  `(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*)\\s*-\\s*(?=[A-Za-z])`,
  "gu"
);
const SHORT_HEBREW_PREFIX_DASH_RE = new RegExp(
  `(^|[^\\u0590-\\u05FF\\uFB1D-\\uFB4F])(${HEBREW_LETTERS}{1,3})\\s*-\\s*(${HEBREW_TOKEN}\\s+${HEBREW_TOKEN}(?=\\s+-\\s+[A-Za-z]))`,
  "gu"
);
const HEBREW_PASUK_BEFORE_PEREK_RE = new RegExp(
  `פסוק\\s+(${HEBREW_TOKEN})\\s+פרק\\s+(${HEBREW_TOKEN})`,
  "gu"
);
const HEBREW_TRAILING_PARSHAS_NAME_RE = new RegExp(
  `(^|[^\\u0590-\\u05FF\\uFB1D-\\uFB4F])(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){0,3})\\s+פרשת(?=\\s*(?:[,.;:?!-]|[A-Za-z]|$))`,
  "gu"
);
const HEBREW_FROM_PLACE_BEFORE_RABBI_NAME_RE = new RegExp(
  `(^|[^\\u0590-\\u05FF\\uFB1D-\\uFB4F])((?:מ${HEBREW_LETTERS}+))\\s+(ר[׳']\\s+${HEBREW_TOKEN})(?=\\s*(?:[,.;:?!()\\-]|[A-Za-z]|$))`,
  "gu"
);
const HEBREW_DAF_BEFORE_MASECHTA_RE = new RegExp(
  `\\(דף\\s+(${HEBREW_TOKEN})\\)\\s+מסכת\\s+(${HEBREW_TOKEN})`,
  "gu"
);
const HEBREW_MASECHTA_DAF_QUOTE_RE = new RegExp(
  `מסכת\\s+(${HEBREW_TOKEN})\\s+\\(דף\\s+(${HEBREW_TOKEN})\\)[,:]\\s+(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){1,40})\\?(?=\\s+-\\s+[A-Za-z])`,
  "gu"
);
const SPLIT_GEMARA_SOURCE_RE = new RegExp(
  `${RTL_ISOLATE}(${HEBREW_TOKEN}),${POP_DIRECTIONAL_ISOLATE}\\s+${LTR_ISOLATE}([^${POP_DIRECTIONAL_ISOLATE}]*?דף[^${POP_DIRECTIONAL_ISOLATE}]*?ד${HEBREW_INTERNAL_QUOTE}ה[^${POP_DIRECTIONAL_ISOLATE}]*?)${POP_DIRECTIONAL_ISOLATE}\\s+${RTL_ISOLATE}(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN})*)${POP_DIRECTIONAL_ISOLATE}`,
  "gu"
);
const SPLIT_MASECHTA_DAF_QUESTION_RE = new RegExp(
  `${RTL_ISOLATE}מסכת\\s+(${HEBREW_TOKEN})\\s+${LTR_ISOLATE}\\(דף\\s+(${HEBREW_TOKEN})\\)${POP_DIRECTIONAL_ISOLATE}${POP_DIRECTIONAL_ISOLATE}[,:]\\s+${RTL_ISOLATE}(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){1,40})${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}\\?${POP_DIRECTIONAL_ISOLATE}`,
  "gu"
);
const SPLIT_REVERSED_MASECHTA_DAF_QUESTION_RE = new RegExp(
  `${LTR_ISOLATE}\\((${HEBREW_TOKEN})\\s+דף\\)${POP_DIRECTIONAL_ISOLATE}\\s+${RTL_ISOLATE}(${HEBREW_TOKEN})\\s+מסכת[,:]\\s+(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){1,40})${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}\\?${POP_DIRECTIONAL_ISOLATE}`,
  "gu"
);
const MIXED_LTR_PARENTHETICAL_RE = new RegExp(
  `(?<!${LTR_ISOLATE})\\((?=(?:[^()\\n]|\\n(?!\\n)){0,300}[A-Za-z])(?=(?:[^()\\n]|\\n(?!\\n)){0,300}${RTL_ISOLATE})(?:[^()\\n]|\\n(?!\\n)){1,300}\\)(?:[,.;:!?])?`,
  "gu"
);
function usage() {
  console.log(`Usage: node build-typeset-proof.js [options]

Build a Typst proof or full-book PDF from .docx source files.

Options:
  --all             Include every route from routes.json.
  --limit <n>       Number of routes to include. Default: 5
  --route <route>   Include one route. Can be repeated.
  --size <size>     Page size: 5x8 or 6x9. Default: 6x9
  --output <name>   Output basename inside typeset/. Default: proof
  --person-index    Append the reviewed person index.
  --no-person-index Do not append the reviewed person index.
  --help            Show this help text.`);
}

function parseArgs(argv) {
  const options = {
    limit: 5,
    all: false,
    routes: [],
    size: "6x9",
    output: "proof",
    personIndex: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--limit") {
      options.limit = Number.parseInt(argv[++i] || "", 10);
    } else if (arg === "--all") {
      options.all = true;
    } else if (arg === "--route") {
      options.routes.push(argv[++i] || "");
    } else if (arg === "--size") {
      options.size = argv[++i] || "";
    } else if (arg === "--output") {
      options.output = argv[++i] || "";
    } else if (arg === "--person-index") {
      options.personIndex = true;
    } else if (arg === "--no-person-index") {
      options.personIndex = false;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("--limit must be a positive integer");
  }

  if (!["5x8", "6x9"].includes(options.size)) {
    throw new Error("--size must be 5x8 or 6x9");
  }

  if (!/^[A-Za-z0-9._ -]+$/.test(options.output)) {
    throw new Error("--output contains invalid filename characters");
  }

  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `:\n${detail}` : ""}`);
  }

  return result.stdout;
}

function commandExists(command) {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  return result.status === 0;
}

async function optimizePdfForWeb(pdfPath) {
  if (!commandExists("qpdf")) {
    console.error("Skipping PDF web optimization: qpdf is not installed.");
    return false;
  }

  const optimizedPath = `${pdfPath}.optimized`;
  const startedAt = Date.now();
  console.error("Optimizing PDF for web streaming with qpdf...");
  run("qpdf", ["--linearize", pdfPath, optimizedPath]);
  await fs.rename(optimizedPath, pdfPath);
  console.error(`Finished PDF optimization in ${formatDuration(startedAt)}.`);
  return true;
}

function typstString(value) {
  return JSON.stringify(value);
}

function decodeDocxXmlText(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function typstLabel(value) {
  return `label(${typstString(value)})`;
}

function titleFromBaseFilename(baseFilename) {
  return baseFilename.replace(/\s+/g, " ").trim();
}

function titleFromRouteSegment(segment) {
  return segment
    .replace(/^\d+\s*-\s*/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeContentPathPrefix(value) {
  return String(value || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function routeMatchesContentPrefix(details, prefix) {
  if (!details?.contentPath) {
    return false;
  }

  const normalizedPath = normalizeContentPathPrefix(details.contentPath);
  const normalizedPrefix = normalizeContentPathPrefix(prefix);

  return (
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
  );
}

function isHaskamaEntry(details) {
  return routeMatchesContentPrefix(details, HASKAMA_CONTENT_PREFIX);
}

function docxParagraphAlignments(docxPath) {
  const xml = run("unzip", ["-p", docxPath, WORD_DOCUMENT]);
  const defaultAlignment = docxDefaultParagraphAlignment(docxPath);
  const alignments = new Map();
  const paragraphRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  let visibleParagraphIndex = 0;
  let match;

  while ((match = paragraphRe.exec(xml)) !== null) {
    const paragraphXml = match[0];
    const text = Array.from(paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g))
      .map((textMatch) => decodeDocxXmlText(textMatch[1]))
      .join("");

    if (text.trim() === "") {
      continue;
    }

    const alignmentMatch = paragraphXml.match(/<w:jc\b[^>]*\bw:val=["']([^"']+)["']/);
    const align = alignmentMatch ? alignmentMatch[1] : defaultAlignment;
    if (align) {
      alignments.set(visibleParagraphIndex, {
        align,
        text,
      });
    }

    visibleParagraphIndex += 1;
  }

  return alignments;
}

function docxDefaultParagraphAlignment(docxPath) {
  let stylesXml = "";

  try {
    stylesXml = run("unzip", ["-p", docxPath, "word/styles.xml"]);
  } catch (_error) {
    return null;
  }

  const defaultsMatch = stylesXml.match(/<w:pPrDefault\b[\s\S]*?<\/w:pPrDefault>/);
  if (!defaultsMatch) {
    return null;
  }

  const alignmentMatch = defaultsMatch[0].match(/<w:jc\b[^>]*\bw:val=["']([^"']+)["']/);
  return alignmentMatch ? alignmentMatch[1] : null;
}

function isHebrewDominantText(value) {
  const hebrewMatches = value.match(/[\u0590-\u05FF\uFB1D-\uFB4F]/g) || [];
  const latinMatches = value.match(/[A-Za-z]/g) || [];
  return hebrewMatches.length > 0 && hebrewMatches.length >= latinMatches.length;
}

function isHebrewOnlyText(value) {
  const plain = value
    .replace(/#(?:strong|emph)\[([^\]]*)\]/g, "$1")
    .replace(/#\w+(?:\([^)]*\))?/g, "")
    .replace(/[\u2066-\u2069]/g, "");
  return /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(plain) && !/[A-Za-z0-9]/.test(plain);
}

function typstAlignmentForDocxParagraph(paragraphInfo) {
  if (!paragraphInfo) {
    return null;
  }

  if (paragraphInfo.align === "center") {
    return "center";
  }

  if (
    (paragraphInfo.align === "right" || paragraphInfo.align === "end") &&
    isHebrewDominantText(paragraphInfo.text)
  ) {
    return "right";
  }

  return null;
}

function normalizeHebrewParagraphSoftBreaks(typstContent) {
  return typstContent
    .split(/(\n{2,})/)
    .map((part) => {
      if (/^\n{2,}$/.test(part) || part.trim() === "") {
        return part;
      }

      return part.replace(/([\s\S]*?)\s*\\\s+\\\s+(?=[A-Z])/g, (match, before, offset) => {
        if (offset !== 0 || !isHebrewOnlyText(before)) {
          return match;
        }

        return `${before.trimEnd()}\n\n`;
      });
    })
    .join("");
}

function applyDocxParagraphAlignments(typstContent, paragraphAlignments) {
  let visibleParagraphIndex = 0;

  return typstContent
    .split(/(\n{2,})/)
    .map((part) => {
      if (/^\n{2,}$/.test(part) || part.trim() === "") {
        return part;
      }

      const alignment = typstAlignmentForDocxParagraph(
        paragraphAlignments.get(visibleParagraphIndex)
      ) || (isHebrewOnlyText(part) ? "right" : null);
      visibleParagraphIndex += 1;

      if (!alignment) {
        return part;
      }

      return `#align(${alignment})[\n${part}\n]`;
    })
    .join("");
}

function shiftedParagraphAlignments(paragraphAlignments, removedParagraphCount) {
  if (removedParagraphCount <= 0) {
    return paragraphAlignments;
  }

  const shifted = new Map();
  for (const [index, paragraphInfo] of paragraphAlignments.entries()) {
    if (index >= removedParagraphCount) {
      shifted.set(index - removedParagraphCount, paragraphInfo);
    }
  }

  return shifted;
}

function countStrippedDuplicateTitleParagraphs(typstContent, titles, options = {}) {
  const paragraphs = typstContent
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const normalizedTitles = titles.filter(Boolean).map(normalizeTitle);

  if (paragraphs.length === 0) {
    return 0;
  }

  if (!isDuplicateTitleLine(paragraphs[0], normalizedTitles)) {
    if (isLikelyDuplicateTitleLine(paragraphs[0])) {
      if (options.allowTitleOverride) {
        return paragraphs[1] && isParentheticalSubtitleLine(paragraphs[1]) ? 2 : 1;
      }
      throw new Error(duplicateTitleMismatchMessage(paragraphs[0], titles));
    }
    return 0;
  }

  if (paragraphs[1] && isParentheticalSubtitleLine(paragraphs[1])) {
    return 2;
  }

  return 1;
}

function isShortHaskamaSignatureLine(paragraph) {
  const plain = paragraph
    .replace(/#(?:strong|emph)\[([^\]]*)\]/g, "$1")
    .replace(/[\\{}[\]#]/g, "")
    .trim();
  const words = plain.split(/\s+/).filter(Boolean);

  return (
    plain.length > 0 &&
    plain.length <= 80 &&
    words.length <= 6 &&
    !/[.!?]$/.test(plain)
  );
}

function tightenHaskamaSignatureBlock(typstContent) {
  const parts = typstContent.split(/(\n{2,})/);
  const paragraphIndexes = [];

  for (let index = 0; index < parts.length; index += 2) {
    if (parts[index].trim() !== "") {
      paragraphIndexes.push(index);
    }
  }

  let signatureStart = paragraphIndexes.length;
  while (
    signatureStart > 0 &&
    isShortHaskamaSignatureLine(parts[paragraphIndexes[signatureStart - 1]])
  ) {
    signatureStart -= 1;
  }

  const signatureIndexes = paragraphIndexes.slice(signatureStart);
  if (signatureIndexes.length < 2) {
    return typstContent;
  }

  const firstPartIndex = signatureIndexes[0];
  const lastPartIndex = signatureIndexes[signatureIndexes.length - 1];
  const signatureBlock = signatureIndexes
    .map((index) => parts[index].trim())
    .join("\n#linebreak()\n");

  parts.splice(
    firstPartIndex,
    lastPartIndex - firstPartIndex + 1,
    signatureBlock
  );

  return parts.join("");
}

function resolveFrontMatterRoutes(frontMatterSpecs, allRoutes, byRoute) {
  const seen = new Set();
  const frontMatterRoutes = [];

  for (const spec of frontMatterSpecs) {
    if (String(spec).startsWith("/")) {
      if (!byRoute[spec]) {
        throw new Error(`Front matter route not found in routes.json: ${spec}`);
      }

      if (!seen.has(spec)) {
        seen.add(spec);
        frontMatterRoutes.push(spec);
      }
      continue;
    }

    const matches = allRoutes.filter((route) =>
      routeMatchesContentPrefix(byRoute[route], spec)
    );

    if (matches.length === 0) {
      throw new Error(`Front matter content path not found in routes.json: ${spec}`);
    }

    for (const route of matches) {
      if (!seen.has(route)) {
        seen.add(route);
        frontMatterRoutes.push(route);
      }
    }
  }

  return frontMatterRoutes;
}

function normalizeIndexKey(value) {
  return value
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/״/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sortIndexDisplayName(value) {
  return normalizeIndexKey(value);
}

function wrapIndexDisplayName(value, maxLineLength = 34) {
  const chars = Array.from(value);
  if (chars.length <= maxLineLength) {
    return [value];
  }

  const parentheticalIndex = value.indexOf(" (");
  if (parentheticalIndex > 0) {
    const beforeParen = value.slice(0, parentheticalIndex);
    const parenthetical = value.slice(parentheticalIndex + 1);

    if (Array.from(beforeParen).length <= 34) {
      return [
        beforeParen,
        ...wrapIndexDisplayName(parenthetical, 34),
      ];
    }
  }

  const words = value.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && Array.from(next).length > maxLineLength) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [value];
}

function indexNameLikelyWraps(value) {
  return Array.from(value).length > 48;
}

function uniqueValues(values) {
  const seen = new Set();
  const unique = [];

  for (const value of values) {
    const trimmed = String(value || "").replace(/\s+/g, " ").trim();
    const key = normalizeIndexKey(trimmed);

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

async function loadPersonIndex() {
  let review;

  try {
    review = JSON.parse(await fs.readFile(PERSON_INDEX_REVIEW_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  if (review.version !== 2 || !review.people || typeof review.people !== "object") {
    return [];
  }

  return Object.entries(review.people)
    .map(([id, person]) => ({
      id,
      displayName: String(person.displayName || "").trim(),
      aliases: uniqueValues([person.displayName, ...(person.aliases || [])]),
    }))
    .filter((person) => person.displayName && person.aliases.length > 0)
    .sort((a, b) => sortIndexDisplayName(a.displayName).localeCompare(sortIndexDisplayName(b.displayName)));
}

function escapeRegexChar(char) {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasRegexSource(alias) {
  return Array.from(alias).map((char) => {
    if (/\s/.test(char)) {
      return "\\s+";
    }

    if (char === "'" || char === "’" || char === "‘") {
      return "['’‘]";
    }

    if (char === '"' || char === "״" || char === "“" || char === "”") {
      return '["״“”]';
    }

    return escapeRegexChar(char);
  }).join("");
}

function personAliasRegex(person) {
  const aliasSources = person.aliases
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(aliasRegexSource);

  if (aliasSources.length === 0) {
    return null;
  }

  const boundaryChars = "A-Za-z0-9\\u0590-\\u05FF\\uFB1D-\\uFB4F-";
  return new RegExp(`(?<![${boundaryChars}])(?:${aliasSources.join("|")})(?:['’‘]s)?(?![${boundaryChars}])`, "giu");
}

function createPersonIndexState(people) {
  return {
    people,
    mentions: new Map(people.map((person) => [person.id, []])),
    nextMarker: 1,
  };
}

function tagPersonIndexMentions(typstContent, indexState) {
  if (!indexState || indexState.people.length === 0) {
    return typstContent;
  }

  let tagged = typstContent;

  for (const person of indexState.people) {
    const re = personAliasRegex(person);
    if (!re) {
      continue;
    }

    tagged = tagged.replace(re, (match, offset, fullText) => {
      if (fullText.slice(offset + match.length).startsWith("#metadata(none) <person-index-")) {
        return match;
      }
      const marker = `person-index-${person.id}-${indexState.nextMarker}`;
      indexState.nextMarker += 1;
      indexState.mentions.get(person.id).push(marker);
      return `${match}#metadata(none) <${marker}>`;
    });
  }

  return tagged;
}

function normalizeTitle(value) {
  return value
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/\bkipper\b/g, "kippur")
    .replace(/\bKipper\b/g, "Kippur")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[\\#*_`\]]/g, "")
    .replace(/[/-]/g, " ")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function titleTokens(value) {
  return normalizeTitle(value)
    .replace(/['’‘]/g, " ")
    .replace(/\b5\d{3}\b/g, "")
    .replace(/\b\d+\b/g, "")
    .replace(/\b[ivxlcdm]+\b/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function isParentheticalSubtitleLine(line) {
  return /^\([^)]{1,120}\)$/.test(line.trim());
}

function titleYear(value) {
  return normalizeTitle(value).match(/\b(5\d{3})\b/)?.[1] || null;
}

function isLikelyDuplicateTitleLine(line) {
  const normalizedLine = normalizeTitle(line);
  if (!normalizedLine) {
    return false;
  }

  const tokens = titleTokens(line);
  return Boolean(titleYear(line)) && tokens.length > 0 && tokens.length <= 8;
}

function duplicateTitleMismatchMessage(line, titles) {
  const expectedTitles = titles.filter(Boolean).join(", ");
  return `DOCX title "${line.trim()}" does not match route title${expectedTitles ? ` (${expectedTitles})` : ""}. Add an explicit route title or update the DOCX title; duplicate titles are not allowed.`;
}

function isDuplicateTitleLine(line, normalizedTitles) {
  const normalizedLine = normalizeTitle(line);
  const lineTokens = new Set(titleTokens(line));

  for (const title of normalizedTitles) {
    if (!title) {
      continue;
    }

    if (normalizedLine === title) {
      return true;
    }

    if (normalizedLine.startsWith(`${title} (`) && normalizedLine.endsWith(")")) {
      return true;
    }

    const candidateTokens = titleTokens(title);
    if (
      candidateTokens.length > 0 &&
      candidateTokens.every((token) => lineTokens.has(token))
    ) {
      return true;
    }
  }

  return false;
}

function stripDuplicateTitle(typstContent, titles, options = {}) {
  const lines = typstContent.replace(/\r\n/g, "\n").split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim() !== "");
  const normalizedTitles = titles.filter(Boolean).map(normalizeTitle);

  if (firstContentIndex < 0) {
    return lines.join("\n").trim();
  }

  if (!isDuplicateTitleLine(lines[firstContentIndex], normalizedTitles)) {
    if (isLikelyDuplicateTitleLine(lines[firstContentIndex])) {
      if (options.allowTitleOverride) {
        lines.splice(firstContentIndex, 1);
        const subtitleIndex = lines.findIndex((line) => line.trim() !== "");
        if (subtitleIndex >= 0 && isParentheticalSubtitleLine(lines[subtitleIndex])) {
          lines.splice(subtitleIndex, 1);
        }
        while (lines[0] === "") {
          lines.shift();
        }
        return lines.join("\n").trim();
      }
      throw new Error(duplicateTitleMismatchMessage(lines[firstContentIndex], titles));
    }
    return lines.join("\n").trim();
  }

  if (firstContentIndex >= 0) {
    lines.splice(firstContentIndex, 1);
    const subtitleIndex = lines.findIndex((line) => line.trim() !== "");
    if (subtitleIndex >= 0 && isParentheticalSubtitleLine(lines[subtitleIndex])) {
      lines.splice(subtitleIndex, 1);
    }
    while (lines[0] === "") {
      lines.shift();
    }
  }

  return lines.join("\n").trim();
}

function normalizeMisplacedHebrewCommas(typstContent) {
  return typstContent.replace(MISPLACED_HEBREW_COMMA_RE, (_match, hebrewPhrase) => {
    return `, ${hebrewPhrase},`;
  });
}

function normalizeNumberedSoftBreaks(typstContent) {
  return typstContent
    .replace(/([^\n])\n{2,}(\\?)(?=\d+\.\s)/g, (_match, before, escapedNumber) => {
      return `${before}\\\n${escapedNumber || "\\"}`;
    })
    .replace(/\\\s+\\?(?=\d+\.\s)/g, "\\\n\\");
}

function normalizeColonHebrewSoftBreaks(typstContent) {
  const hebrewAtParagraphStartRe = new RegExp(`([:：])\\n{2,}(?=${HEBREW_LETTERS})`, "gu");
  return typstContent.replace(hebrewAtParagraphStartRe, "$1\\\n");
}

function repairEscapedHebrewParagraphCitations(typstContent) {
  return typstContent
    .split(/(\n{2,})/)
    .map((part) => {
      if (/^\n{2,}$/.test(part) || part.trim() === "") {
        return part;
      }

      return part.replace(
        ESCAPED_HEBREW_PARAGRAPH_CITATION_RE,
        (_match, quote, source) => `${quote} ${RTL_REFERENCE_MARKER}(${source})`
      );
    })
    .join("");
}

function protectMarkedRtlReferences(typstContent, protect) {
  let output = "";
  let remaining = typstContent;
  const referenceAtStartRe = new RegExp(`^\\s*(${HEBREW_PAREN_REFERENCE})`, "u");

  while (remaining.includes(RTL_REFERENCE_MARKER)) {
    const markerIndex = remaining.indexOf(RTL_REFERENCE_MARKER);
    const afterMarker = remaining.slice(markerIndex + RTL_REFERENCE_MARKER.length);
    const referenceMatch = afterMarker.match(referenceAtStartRe);

    if (!referenceMatch) {
      output += remaining.slice(0, markerIndex);
      remaining = afterMarker;
      continue;
    }

    const reference = referenceMatch[1];
    const referenceEnd = markerIndex + RTL_REFERENCE_MARKER.length + referenceMatch[0].length;
    const blankLineIndex = remaining.lastIndexOf("\n\n", markerIndex);
    const blockOpenIndex = remaining.lastIndexOf("[\n", markerIndex);
    const paragraphStart = Math.max(
      blankLineIndex >= 0 ? blankLineIndex + 2 : 0,
      blockOpenIndex >= 0 ? blockOpenIndex + 2 : 0
    );
    const beforeParagraph = remaining.slice(0, paragraphStart);
    const paragraphBeforeReference = remaining.slice(paragraphStart, markerIndex).trimEnd();

    output += beforeParagraph;
    output += protect(`${RTL_ISOLATE}${paragraphBeforeReference} ${reference}${POP_DIRECTIONAL_ISOLATE}`);
    remaining = remaining.slice(referenceEnd);
  }

  return output + remaining;
}

function moveLeadingHebrewSourceAfterQuote(typstContent) {
  return typstContent
    .replace(
      HEBREW_PARAGRAPH_LEADING_REFERENCE_RE,
      (_match, reference, quote, punctuation) =>
        `${quote} ${RTL_REFERENCE_MARKER}${reference}${punctuation}`
    )
    .replace(
      HEBREW_PAREN_REFERENCE_BEFORE_QUOTE_RE,
      (_match, prefix, reference, quote) => `${prefix}${quote} ${reference}`
    );
}

function keepIndexMarkersAfterPunctuation(typstContent) {
  return typstContent.replace(
    /(#metadata\(none\)\s*<[^>\n]+>)[\s\u00A0\u202F]*((?:\\?[,;:.!?)\]])+(?:[\s\u00A0\u202F]*\\?[,;:.!?])?)([ \t\u00A0\u202F]*)/g,
    (_match, marker, punctuation, trailingSpace) =>
      `${punctuation.replace(/[\s\u00A0\u202F]+/g, "")}${marker}${trailingSpace}`
  );
}

function normalizeHebrewQuotePlacement(typstContent) {
  return typstContent.replace(
    new RegExp(
      `(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){2,80})\\\\?"\\s+(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){2,80})\\\\?"(?=\\s+-)`,
      "gu"
    ),
    "”$1“ $2"
  );
}

function smartenStraightDoubleQuotes(typstContent) {
  const hebrewClass = HEBREW_LETTERS.slice(1, -1);
  return normalizeHebrewQuotePlacement(typstContent)
    .replace(new RegExp(`(${HEBREW_LETTERS})\\\\?"(?=${HEBREW_LETTERS})`, "gu"), "$1״")
    .replace(new RegExp(`(^|[\\s([{\\-])\\\\?"(?=(?:${HEBREW_LETTERS}|[\\u2066\\u2067]))`, "gu"), "$1“")
    .replace(new RegExp(`(${HEBREW_LETTERS})\\\\?"(?=\\s|$|[,.;:!?)}\\]]|\\u2069)`, "gu"), "$1”")
    .replace(new RegExp(`(^|[\\s([{\\-])\\\\?"(?=[^\\s${hebrewClass}])`, "gu"), "$1“")
    .replace(new RegExp(`([^\\s${hebrewClass}])\\\\?"(?=\\s|$|[,.;:!?)}\\]])`, "gu"), "$1”");
}

function preserveInitialCase(replacement) {
  return (match) => {
    if (match[0] === match[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  };
}

function normalizeEditorialReplacements(typstContent) {
  return typstContent
    .replace(/\bparshah\b/giu, preserveInitialCase("parsha"))
    .replace(/\bbezras\b/giu, preserveInitialCase("b’ezras"))
    .replace(/\bmidrash\b/giu, preserveInitialCase("medrash"))
    .replace(/\bArtscroll\b/g, "ArtScroll");
}

function normalizePunctuationSpacing(typstContent) {
  return smartenStraightDoubleQuotes(normalizeEditorialReplacements(keepIndexMarkersAfterPunctuation(typstContent)
    .replace(/\u2014/g, "-")
    .replace(new RegExp(`(${HEBREW_LETTERS})['’‘](?!s\\b)`, "gu"), "$1׳")
    .replace(/R'/g, "R’")
    .replace(/([A-Za-z])'"\./g, "$1.'\"")
    .replace(/([,;:.!?])(#metadata\(none\)\s*<[^>\n]+>)(\\?["”])/g, "$1$3$2")
    .replace(/([,;:.!?])\s+"(?=\s+(?:said|asked|answered|responded|replied)\b)/giu, "$1\"")
    .replace(/((?:\\?["”])(?:[ \t\u00A0\u202F]+\S+){1,4})\n(?=(?:said|asked|answered|responded|replied)\b)/giu, "$1 ")
    .replace(MALFORMED_ESCAPED_OPEN_HEBREW_CITATION_RE, "($1): ")
    .replace(MALFORMED_NESTED_OPEN_HEBREW_CITATION_RE, "($1 $2): ")
    .replace(MALFORMED_HEBREW_LABEL_ESCAPED_OPEN_NUMERIC_CITATION_RE, "$1 ($2): ")
    .replace(MALFORMED_ESCAPED_OPEN_NUMERIC_CITATION_RE, "($1): ")
    .replace(DUPLICATE_ESCAPED_OPEN_NUMERIC_CITATION_RE, "($1")
    .replace(NUMERIC_CITATION_WITH_TRAILING_AS_QUOTED_RE, "($1), $2")
    .replace(new RegExp(`(${HEBREW_LETTERS})(?=[A-Za-z])`, "gu"), "$1 ")
    .replace(new RegExp(`([A-Za-z])(?=${HEBREW_LETTERS})`, "gu"), "$1 ")
    .replace(/[\s\u00A0\u202F]+(\\(?!\.\.)[,;:.!?)\]]|[,;:.!?)\]])/g, "$1")
    .replace(/(?<!\\)([;:])[\t \u00A0\u202F]*(?=\S)/g, "$1 ")
    .replace(/,(?![\d"])\s*/g, ", ")
    .replace(/,\s+(\\?["”])(?=(?:\s+\S+){1,4}\s+(?:said|asked|answered|responded|replied)\b)/giu, ",$1")
    .replace(/,\s+(\\?["”])(?=\s+[a-z])/gu, ",$1")
    .replace(/(\d),\s+(?=\d)/g, "$1,")
    .replace(/,\s*,\s*/g, ", ")
    .replace(/(\d+):\s+(\d+)/g, "$1:$2")
    .replace(new RegExp(`(\\(\\d+:\\d+\\))(?=${HEBREW_LETTERS})`, "gu"), "$1 ")
    .replace(HEBREW_CITATION_COLON_RE, "$1$2:$3")
    .replace(NAMED_NUMERIC_LOOSE_CITATION_CLOSE_RE, "$1($2):")
    .replace(HEBREW_LOOSE_CITATION_CLOSE_RE, "$1($2)")
    .replace(MISSING_OPEN_HEBREW_CITATION_PAREN_RE, "$1 ($2):")
    .replace(HEBREW_TRAILING_PARSHAS_NAME_RE, "$1פרשת $2")
    .replace(HEBREW_FROM_PLACE_BEFORE_RABBI_NAME_RE, "$1$3 $2")
    .replace(HEBREW_DAF_BEFORE_MASECHTA_RE, "מסכת $2 (דף $1)")
    .replace(HEBREW_PASUK_BEFORE_PEREK_RE, "פרק $2 פסוק $1")
    .replace(SHORT_HEBREW_PREFIX_DASH_RE, "$1$2 - $3")
    .replace(HEBREW_TO_ENGLISH_DASH_RE, "$1 - ")));
}

function normalizeInlineWhitespace(value) {
  return value.replace(/[ \t\u00A0\u202F]*\n[ \t\u00A0\u202F]*/g, " ");
}

function isolateHebrewRuns(typstContent) {
  const protectedSequences = [];
  const protect = (value) => {
    const marker = `\uE000${protectedSequences.length}\uE001`;
    protectedSequences.push(value);
    return marker;
  };
  const followedByEnglish = (fullText, endOffset) => {
    const rawFollowing = fullText.slice(endOffset);
    if (/^(?:[ \t\u00A0\u202F]+|\n(?!\n)|#metadata\(none\)\s*<[^>\n]+>)*\((?:[^()\n]|\n(?!\n)){0,300}[A-Za-z]/.test(rawFollowing)) {
      return true;
    }

    const following = rawFollowing
      .replace(/^(?:[ \t\u00A0\u202F]+|\n(?!\n)|#metadata\(none\)\s*<[^>\n]+>)*(?:["'“‘\[]|\\\[)/g, "")
      .replace(/^(?:[ \t\u00A0\u202F]+|\n(?!\n)|#metadata\(none\)\s*<[^>\n]+>)*/g, "");
    if (/^[?!][ \t\u00A0\u202F]+[A-Za-z]/.test(following)) {
      return true;
    }
    if (/^[.][ \t\u00A0\u202F]+[A-Za-z]/.test(following)) {
      return true;
    }
    return /^(?:[A-Za-z]|\d)/.test(following);
  };
  const isolateHebrewPhrase = (value, useLtrTrailingComma = false) => {
    const normalizedValue = normalizeInlineWhitespace(value);
    if (useLtrTrailingComma && value.endsWith(",")) {
      const phraseWithoutComma = normalizedValue.slice(0, -1);
      if (!phraseWithoutComma.includes(",")) {
        return `${RTL_ISOLATE}${phraseWithoutComma}${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE}`;
      }
      return `${RTL_ISOLATE}${normalizedValue.slice(0, -1)}${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE}`;
    }

    return `${RTL_ISOLATE}${normalizedValue}${POP_DIRECTIONAL_ISOLATE}`;
  };
  const isolateHebrewCommaPhrase = (value, useLtrCommas = false) => {
    const normalizedValue = normalizeInlineWhitespace(value);
    if (!useLtrCommas) {
      return `${RTL_ISOLATE}${normalizedValue.replace(/\s*,\s*/g, ", ")}${POP_DIRECTIONAL_ISOLATE}`;
    }

    const hasTrailingComma = normalizedValue.endsWith(",");
    const parts = normalizedValue
      .replace(/,$/, "")
      .split(/\s*,\s*/)
      .filter(Boolean);

    if (parts.length === 1 && hasTrailingComma) {
      return `${RTL_ISOLATE}${parts[0]}${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE}`;
    }

    return parts
      .map((part, index) => {
        const needsComma = index < parts.length - 1 || hasTrailingComma;
        return `${RTL_ISOLATE}${part}${POP_DIRECTIONAL_ISOLATE}${needsComma ? `${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE}` : ""}`;
      })
      .join(" ");
  };

  const rtlReferenceSafeContent = protectMarkedRtlReferences(typstContent, protect);

  const protectHebrewTextWithReference = (_match, hebrewText, reference) => {
      const isRtlReference = hebrewText.endsWith(RTL_REFERENCE_MARKER);
      const cleanHebrewText = hebrewText.replace(RTL_REFERENCE_MARKER, "");
      const isolatedReference = isRtlReference
        ? reference
        : `${LTR_ISOLATE}${reference}${POP_DIRECTIONAL_ISOLATE}`;

      return protect(`${RTL_ISOLATE}${normalizeInlineWhitespace(cleanHebrewText)} ${isolatedReference}${POP_DIRECTIONAL_ISOLATE}`);
  };

  const textWithReferenceSafeContent = rtlReferenceSafeContent
    .replace(HEBREW_TEXT_WITH_PAREN_REFERENCE_RE, protectHebrewTextWithReference)
    .replace(HEBREW_MULTI_TEXT_WITH_PAREN_REFERENCE_RE, protectHebrewTextWithReference);

  const hebrewEllipsisSafeContent = textWithReferenceSafeContent.replace(HEBREW_ELLIPSIS_PHRASE_RE, (match) => {
    return protect(`${RTL_ISOLATE}${normalizeInlineWhitespace(match)}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const precededByEnglishPreposition = (fullText, startOffset) => {
    const preceding = fullText.slice(Math.max(0, startOffset - 80), startOffset);
    return /\b(?:in|of|from|by|with|for|as|to)\s*$/.test(preceding);
  };

  const masechtaDafQuoteSafeContent = hebrewEllipsisSafeContent.replace(HEBREW_MASECHTA_DAF_QUOTE_RE, (_match, masechta, daf, question) => {
    return protect(formatMasechtaDafQuestion(masechta, daf, question));
  });

  const hebrewPhraseNumericSourceSafeContent = masechtaDafQuoteSafeContent.replace(HEBREW_PHRASE_NUMERIC_SOURCE_RE, (_match, phrase, source) => {
    return protect(formatHebrewPhraseNumericSource(phrase, source));
  });

  const hebrewQuestionSafeContent = hebrewPhraseNumericSourceSafeContent.replace(HEBREW_QUESTION_PHRASE_RE, (match, offset, fullText) => {
    const phrase = normalizeInlineWhitespace(match).replace(/\?$/, "");
    if (phrase.includes(",") && precededByEnglishPreposition(fullText, offset)) {
      return protect(`${isolateHebrewCommaPhrase(phrase, true)}${LTR_ISOLATE}?${POP_DIRECTIONAL_ISOLATE}`);
    }
    return protect(`${RTL_ISOLATE}${phrase}${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE}?${POP_DIRECTIONAL_ISOLATE}`);
  });

  const hebrewSemicolonSafeContent = hebrewQuestionSafeContent.replace(HEBREW_SEMICOLON_PHRASE_RE, (match) => {
    const [beforeSemicolon, afterSemicolon] = normalizeInlineWhitespace(match)
      .split(/\s*\\;\s*/, 2)
      .map((part) => part.trim());
    return protect(
      `${RTL_ISOLATE}${beforeSemicolon}${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE};${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}${afterSemicolon}${POP_DIRECTIONAL_ISOLATE}`
    );
  });

  const referenceSafeContent = hebrewSemicolonSafeContent.replace(HEBREW_PAREN_REFERENCE_RE, (match) => {
    return protect(`${LTR_ISOLATE}${match}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const bareReferenceSafeContent = referenceSafeContent.replace(HEBREW_BARE_REFERENCE_RE, (match) => {
    return protect(`${LTR_ISOLATE}${match}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const numericSourceQuoteSafeContent = bareReferenceSafeContent.replace(
    NUMERIC_SOURCE_HEBREW_QUOTE_RE,
    (_match, source, quote) => `${source}${protect(`${RTL_ISOLATE}${normalizeInlineWhitespace(quote)}${POP_DIRECTIONAL_ISOLATE}`)}`
  );

  const acronymCommaSequenceSafeContent = numericSourceQuoteSafeContent.replace(HEBREW_ACRONYM_COMMA_SEQUENCE_RE, (match) => {
    return protect(`${LTR_ISOLATE}${match}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const trailingAcronymPhraseSafeContent = acronymCommaSequenceSafeContent.replace(HEBREW_TRAILING_ACRONYM_PHRASE_RE, (match) => {
    return protect(`${LTR_ISOLATE}${match}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const hebrewCommaPhraseSafeContent = trailingAcronymPhraseSafeContent.replace(HEBREW_COMMA_PHRASE_SEQUENCE_RE, (match, offset, fullText) => {
    return protect(isolateHebrewCommaPhrase(match, followedByEnglish(fullText, offset + match.length)));
  });

  const hebrewParshasHyphenatedSafeContent = hebrewCommaPhraseSafeContent.replace(HEBREW_PARSHAS_HYPHENATED_PHRASE_RE, (match) => {
    return protect(`${RTL_ISOLATE}${normalizeInlineWhitespace(match)}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const hebrewHyphenatedSafeContent = hebrewParshasHyphenatedSafeContent.replace(HEBREW_HYPHENATED_TOKEN_RE, (match) => {
    return protect(`${RTL_ISOLATE}${normalizeInlineWhitespace(match)}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const acronymContinuationSafeContent = hebrewHyphenatedSafeContent.replace(HEBREW_ACRONYM_CONTINUATION_PHRASE_RE, (match) => {
    return protect(`${RTL_ISOLATE}${normalizeInlineWhitespace(match)}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const acronymContextSafeContent = acronymContinuationSafeContent.replace(HEBREW_ACRONYM_CONTEXT_RE, (match) => {
    return protect(`${LTR_ISOLATE}${match}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const acronymSafeContent = acronymContextSafeContent.replace(HEBREW_ACRONYM_RE, (match) => {
    return protect(`${LTR_ISOLATE}${match}${POP_DIRECTIONAL_ISOLATE}`);
  });

  const isolatedContent = acronymSafeContent.replace(HEBREW_PHRASE_RE, (match, offset, fullText) => {
    return isolateHebrewPhrase(match, followedByEnglish(fullText, offset + match.length));
  });

  return isolatedContent.replace(/\uE000(\d+)\uE001/g, (_match, index) => {
    return protectedSequences[Number(index)];
  }).replace(new RegExp(RTL_REFERENCE_MARKER, "g"), "");
}

function formatMasechtaDafQuestion(masechta, daf, question) {
  const source = `${RTL_ISOLATE}${normalizeInlineWhitespace(masechta)}${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}מסכת${POP_DIRECTIONAL_ISOLATE} (דף ${normalizeInlineWhitespace(daf)}):`;
  const questionWords = normalizeInlineWhitespace(question).match(new RegExp(HEBREW_TOKEN, "gu")) || [];
  const isolatedQuestionWords = questionWords
    .reverse()
    .map((word) => `${RTL_ISOLATE}${word}${POP_DIRECTIONAL_ISOLATE}`)
    .join(" ");
  return `${LTR_ISOLATE}${source} ${isolatedQuestionWords}?${POP_DIRECTIONAL_ISOLATE}`;
}

function formatHebrewPhraseNumericSource(phrase, source) {
  return `${RTL_ISOLATE}${normalizeInlineWhitespace(phrase)}${POP_DIRECTIONAL_ISOLATE} ${LTR_ISOLATE}(${source}),${POP_DIRECTIONAL_ISOLATE}`;
}

function repairSplitGemaraSources(typstContent) {
  return typstContent.replace(
    SPLIT_GEMARA_SOURCE_RE,
    (_match, masechta, citation, tail) =>
      `${RTL_ISOLATE}${masechta}, ${citation.replace(/\s+/g, " ")} ${tail}${POP_DIRECTIONAL_ISOLATE}`
  );
}

function repairSplitMasechtaDafQuestions(typstContent) {
  return typstContent
    .replace(
      SPLIT_MASECHTA_DAF_QUESTION_RE,
      (_match, masechta, daf, question) =>
        formatMasechtaDafQuestion(masechta, daf, question)
    )
    .replace(
      SPLIT_REVERSED_MASECHTA_DAF_QUESTION_RE,
      (_match, daf, masechta, question) =>
        formatMasechtaDafQuestion(masechta, daf, question)
    );
}

function repairQuotedHebrewRuns(typstContent) {
  return typstContent
    .replace(
      new RegExp(`${RTL_ISOLATE}[“"]([^${POP_DIRECTIONAL_ISOLATE}]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}]*)${POP_DIRECTIONAL_ISOLATE}”(?=\\]|\\n|$)`, "gu"),
      `${RTL_ISOLATE}”$1“${POP_DIRECTIONAL_ISOLATE}`
    )
    .replace(
      new RegExp(`${RTL_ISOLATE}[“"]([^${POP_DIRECTIONAL_ISOLATE}]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}]*)${POP_DIRECTIONAL_ISOLATE}(\\\\?[.?!])”`, "gu"),
      `“${RTL_ISOLATE}$1${POP_DIRECTIONAL_ISOLATE}$2”`
    )
    .replace(
      new RegExp(`${RTL_ISOLATE}[“"]([^${POP_DIRECTIONAL_ISOLATE}]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}]*)${POP_DIRECTIONAL_ISOLATE}(${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE})(?=\\s+[A-Za-z])`, "gu"),
      `“${RTL_ISOLATE}$1${POP_DIRECTIONAL_ISOLATE}$2`
    );
}

function repairTwoPartHebrewCommaDashPhrases(typstContent) {
  return typstContent.replace(
    new RegExp(
      `${RTL_ISOLATE}(${HEBREW_TOKEN}),\\s+(${HEBREW_TOKEN}(?:\\s+${HEBREW_TOKEN}){1,8})${POP_DIRECTIONAL_ISOLATE}(?=\\s+-\\s+[A-Za-z])`,
      "gu"
    ),
    (_match, firstPart, secondPart) => {
      return `${RTL_ISOLATE}${firstPart}${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE} ${RTL_ISOLATE}${secondPart}${POP_DIRECTIONAL_ISOLATE}`;
    }
  );
}

function protectMixedLtrParentheticals(typstContent) {
  return typstContent.replace(MIXED_LTR_PARENTHETICAL_RE, (match) => {
    return `${LTR_ISOLATE}${match}${POP_DIRECTIONAL_ISOLATE}`;
  });
}

function isSingleHebrewBaseLetter(value) {
  const baseLetters = value.match(new RegExp(HEBREW_BASE_LETTERS, "gu")) || [];
  return baseLetters.length === 1 && !/\s/.test(value);
}

function repairIntraWordStyledHebrew(typstContent) {
  return typstContent.replace(
    new RegExp(`(${HEBREW_LETTERS}+)\\s+#(strong|emph)\\[([^\\]\\n]*${HEBREW_LETTERS}[^\\]\\n]*)\\]\\s+(${HEBREW_LETTERS}+)`, "gu"),
    (match, before, style, styledText, after) => {
      if (!isSingleHebrewBaseLetter(styledText)) {
        return match;
      }
      return `${before}#${style}[${styledText}]${after}`;
    }
  );
}

function repairStyledHebrewContinuations(typstContent) {
  const rtlRun = `([^${POP_DIRECTIONAL_ISOLATE}\\n]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}\\n]*)`;
  const styledHebrew = `#(strong|emph)\\[([^\\]\\n]*${HEBREW_LETTERS}[^\\]\\n]*)\\]`;
  const softSpace = `[\\t \\u00A0\\u202F]*(?:\\n(?!\\n)[\\t \\u00A0\\u202F]*)?`;
  const requiredSoftSpace = `[\\t \\u00A0\\u202F]+|[\\t \\u00A0\\u202F]*\\n(?!\\n)[\\t \\u00A0\\u202F]*`;

  let repaired = typstContent.replace(
    new RegExp(`#(strong|emph)\\[${RTL_ISOLATE}${rtlRun}${POP_DIRECTIONAL_ISOLATE}\\]`, "gu"),
    "#$1[$2]"
  );

  let previous;
  do {
    previous = repaired;
    repaired = repaired
      .replace(
        new RegExp(`${RTL_ISOLATE}${rtlRun}${POP_DIRECTIONAL_ISOLATE}${softSpace}${styledHebrew}`, "gu"),
        `${RTL_ISOLATE}$1 #$2[$3]${POP_DIRECTIONAL_ISOLATE}`
      )
      .replace(
        new RegExp(`${styledHebrew}${softSpace}${RTL_ISOLATE}${rtlRun}${POP_DIRECTIONAL_ISOLATE}`, "gu"),
        `${RTL_ISOLATE}#$1[$2] $3${POP_DIRECTIONAL_ISOLATE}`
      )
      .replace(
        new RegExp(`${RTL_ISOLATE}([^${POP_DIRECTIONAL_ISOLATE}\\n]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}\\n]*${styledHebrew}[^${POP_DIRECTIONAL_ISOLATE}\\n]*)${POP_DIRECTIONAL_ISOLATE}(?:${requiredSoftSpace})${RTL_ISOLATE}${rtlRun}${POP_DIRECTIONAL_ISOLATE}`, "gu"),
        `${RTL_ISOLATE}$1 $4${POP_DIRECTIONAL_ISOLATE}`
      )
      .replace(
        new RegExp(`${RTL_ISOLATE}${rtlRun}${POP_DIRECTIONAL_ISOLATE}(?:${requiredSoftSpace})${RTL_ISOLATE}([^${POP_DIRECTIONAL_ISOLATE}\\n]*${styledHebrew}[^${POP_DIRECTIONAL_ISOLATE}\\n]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}\\n]*)${POP_DIRECTIONAL_ISOLATE}`, "gu"),
        `${RTL_ISOLATE}$1 $2${POP_DIRECTIONAL_ISOLATE}`
      );
  } while (repaired !== previous);

  return repairIntraWordStyledHebrew(repaired);
}

function repairHebrewIsolateContinuations(typstContent) {
  const hebrewIsolate = `[${RTL_ISOLATE}${LTR_ISOLATE}]([^${POP_DIRECTIONAL_ISOLATE}\\n]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}\\n]*)${POP_DIRECTIONAL_ISOLATE}`;
  const softSeparator = `(["”]?)[\\t \\u00A0\\u202F]*(?:\\n(?!\\n)[\\t \\u00A0\\u202F]*)?`;

  let repaired = typstContent;
  let previous;
  do {
    previous = repaired;
    repaired = repaired
      .replace(
        new RegExp(`([“”])${hebrewIsolate}`, "gu"),
        `${RTL_ISOLATE}$1$2${POP_DIRECTIONAL_ISOLATE}`
      )
      .replace(
        new RegExp(`${hebrewIsolate}([“”])(?=[\\t \\u00A0\\u202F]*(?:\\n(?!\\n)[\\t \\u00A0\\u202F]*)?[${RTL_ISOLATE}${LTR_ISOLATE}])`, "gu"),
        `${RTL_ISOLATE}$1$2${POP_DIRECTIONAL_ISOLATE}`
      )
      .replace(
        new RegExp(`${hebrewIsolate}(["”])(?=[\\t \\u00A0\\u202F]*(?:\\n(?!\\n)[\\t \\u00A0\\u202F]*)?-)`, "gu"),
        `${RTL_ISOLATE}$1$2${POP_DIRECTIONAL_ISOLATE}`
      )
      .replace(
        new RegExp(`${hebrewIsolate}${softSeparator}${hebrewIsolate}`, "gu"),
        (match, left, quote, right) => {
          if (!quote && !/[#"”]/.test(left) && !/[#"”]/.test(right)) {
            return match;
          }
          return `${RTL_ISOLATE}${left}${quote} ${right}${POP_DIRECTIONAL_ISOLATE}`;
        }
      );
  } while (repaired !== previous);

  return repaired;
}

function normalizeIsolatedPunctuationSpacing(typstContent) {
  return typstContent
    .replace(/(#metadata\(none\)\s*<[^>\n]+>)(?:\\?["”])\s*:/g, "”:$1")
    .replace(/([,;:.!?])(#metadata\(none\)\s*<[^>\n]+>)(?:\\?["”])/g, "$1”$2")
    .replace(/([,;:.!?])(?:\\?["”])(#metadata\(none\)\s*<[^>\n]+>)/g, "$1”$2")
    .replace(/(\\?["”])(#metadata\(none\)\s*<[^>\n]+>):/g, "$1:$2")
    .replace(
      new RegExp(`${RTL_ISOLATE}([^${POP_DIRECTIONAL_ISOLATE}]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}]*),${POP_DIRECTIONAL_ISOLATE}([”"])`, "gu"),
      `${RTL_ISOLATE}$1${POP_DIRECTIONAL_ISOLATE}${LTR_ISOLATE},${POP_DIRECTIONAL_ISOLATE}$2`
    )
    .replace(
      new RegExp(`${RTL_ISOLATE}([^${POP_DIRECTIONAL_ISOLATE}]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}]*)${POP_DIRECTIONAL_ISOLATE}:\\s*${RTL_ISOLATE}([^${POP_DIRECTIONAL_ISOLATE}]*${HEBREW_LETTERS}[^${POP_DIRECTIONAL_ISOLATE}]*)${POP_DIRECTIONAL_ISOLATE}`, "gu"),
      (match, beforeColon, afterColon, offset, fullText) => {
        const hebrewTokenCount = (beforeColon.match(new RegExp(HEBREW_TOKEN, "gu")) || []).length;
        const afterHebrewTokenCount = (afterColon.match(new RegExp(HEBREW_TOKEN, "gu")) || []).length;
        const followedByDashExplanation = /^[\t \u00A0\u202F]*(?:\n(?!\n)[\t \u00A0\u202F]*)?-[\t \u00A0\u202F]*[A-Za-z]/.test(
          fullText.slice(offset + match.length)
        );
        if ((hebrewTokenCount < 4 && !followedByDashExplanation) || afterHebrewTokenCount < 2) {
          return match;
        }
        return `${RTL_ISOLATE}${beforeColon}: ${afterColon}${POP_DIRECTIONAL_ISOLATE}`;
      }
    )
    .replace(
      new RegExp(`([${LTR_ISOLATE}${RTL_ISOLATE}][^${POP_DIRECTIONAL_ISOLATE}]+${POP_DIRECTIONAL_ISOLATE}):(?=[${LTR_ISOLATE}${RTL_ISOLATE}])`, "gu"),
      "$1: "
    )
    .replace(
      new RegExp(`(${POP_DIRECTIONAL_ISOLATE}[.?!])(?=[${LTR_ISOLATE}${RTL_ISOLATE}])`, "gu"),
      "$1 "
    )
    .replace(
      new RegExp(`(${POP_DIRECTIONAL_ISOLATE}\\\\?[.?!])(?=[A-Za-z])`, "gu"),
      "$1 "
    );
}

function applyTextRules(typstContent) {
  return repairQuotedHebrewRuns(
    normalizeIsolatedPunctuationSpacing(
      repairIntraWordStyledHebrew(
        repairHebrewIsolateContinuations(
          repairStyledHebrewContinuations(
            protectMixedLtrParentheticals(
              repairTwoPartHebrewCommaDashPhrases(
                repairSplitMasechtaDafQuestions(
                  repairSplitGemaraSources(
                    repairQuotedHebrewRuns(
                      isolateHebrewRuns(
                        moveLeadingHebrewSourceAfterQuote(
                          repairEscapedHebrewParagraphCitations(
                            normalizeMisplacedHebrewCommas(
                              normalizePunctuationSpacing(
                                normalizeColonHebrewSoftBreaks(normalizeNumberedSoftBreaks(typstContent))
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}

function pageSettings(size) {
  if (size === "5x8") {
    return {
      width: "5in",
      height: "8in",
      inside: "0.68in",
      outside: "0.55in",
      top: "0.58in",
      bottom: "0.74in",
      fontSize: "11pt",
      leading: "0.58em",
      qrSize: "0.42in",
    };
  }

  return {
    width: "6in",
    height: "9in",
    inside: "0.78in",
    outside: "0.62in",
    top: "0.68in",
    bottom: "0.82in",
    fontSize: "11pt",
    leading: "0.6em",
    qrSize: "0.48in",
  };
}

async function loadEntries(options) {
  const routesDocument = JSON.parse(await fs.readFile(ROUTES_FILE, "utf8"));
  const byRoute = routesDocument.byRoute;

  if (!byRoute || typeof byRoute !== "object" || Array.isArray(byRoute)) {
    throw new Error('routes.json must contain a "byRoute" object');
  }

  const allRoutes = Object.keys(byRoute);
  const frontMatterRoutes = resolveFrontMatterRoutes(
    FRONT_MATTER_SPECS,
    allRoutes,
    byRoute
  );
  const frontMatterRouteSet = new Set(frontMatterRoutes);
  const bookRoutes = [
    ...frontMatterRoutes,
    ...allRoutes.filter(
      (route) =>
        !frontMatterRouteSet.has(route) &&
        route !== "/bloopers/" && route !== "/final-sefer/" &&
        byRoute[route]?.baseFilename
    ),
  ];
  let selectedRoutes =
    options.routes.length > 0
      ? options.routes
      : options.all
        ? bookRoutes
        : allRoutes.slice(0, options.limit);

  return selectedRoutes.map((route) => {
    const details = byRoute[route];
    if (!details) {
      throw new Error(`Route not found in routes.json: ${route}`);
    }

    const baseTitle = titleFromBaseFilename(details.baseFilename);
    const title = details.title
      ? details.title.replace(/\s+/g, " ").trim()
      : baseTitle;
    const directory = path.join(FILES_DIR, details.contentPath);
    const pdfPagePath = details.pdfPage
      ? path.join(directory, details.pdfPage)
      : null;
    const routeSegmentTitles = details.contentPath
      .split("/")
      .map(titleFromRouteSegment)
      .filter(Boolean);
    const isHaskama = isHaskamaEntry(details);
    const hasExplicitTitle = Boolean(details.title);

    return {
      route,
      url: new URL(route, DOMAIN).href,
      title,
      hasExplicitTitle,
      isHaskama,
      isFrontMatter: frontMatterRouteSet.has(route),
      isPdfPage: Boolean(pdfPagePath),
      sourceTitles: [title, baseTitle, ...routeSegmentTitles],
      docxPath: path.join(directory, `${details.baseFilename}.docx`),
      pdfPagePath,
      qrPath: path.join(directory, `${details.baseFilename}.png`),
      hasFooter: !pdfPagePath && !NO_FOOTER_ROUTES.has(route),
    };
  });
}

async function ensureEntryFiles(entries) {
  for (const entry of entries) {
    if (entry.isPdfPage) {
      await fs.access(entry.pdfPagePath);
      continue;
    }

    await fs.access(entry.docxPath);
    if (entry.hasFooter) {
      try {
        await fs.access(entry.qrPath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }

        entry.hasFooter = false;
        console.error(`Skipping footer for ${entry.title}: missing QR image`);
      }
    }
  }
}

function convertDocxToTypst(entry, indexState = null) {
  const typst = run("pandoc", [entry.docxPath, "-t", "typst"]);
  const repairedTypst = repairEscapedHebrewParagraphCitations(typst);
  const removedParagraphCount = entry.isHaskama
    ? 0
    : countStrippedDuplicateTitleParagraphs(repairedTypst, entry.sourceTitles, { allowTitleOverride: entry.hasExplicitTitle });
  const unalignedBody = entry.isHaskama
    ? repairedTypst.trim()
    : stripDuplicateTitle(repairedTypst, entry.sourceTitles, { allowTitleOverride: entry.hasExplicitTitle });
  const signatureAdjustedBody = entry.isHaskama
    ? tightenHaskamaSignatureBlock(unalignedBody)
    : unalignedBody;
  const paragraphAdjustedBody = normalizeHebrewParagraphSoftBreaks(signatureAdjustedBody);
  const body = applyDocxParagraphAlignments(
    paragraphAdjustedBody,
    shiftedParagraphAlignments(
      docxParagraphAlignments(entry.docxPath),
      removedParagraphCount
    )
  );
  const indexedBody = indexState ? tagPersonIndexMentions(body, indexState) : body;
  return applyTextRules(indexedBody);
}

function renderPdfPage(entry) {
  const pdfRelativePath = path.relative(OUTPUT_DIR, entry.pdfPagePath).split(path.sep).join("/");

  return `#block(width: 100%, height: 100%)[
  #align(center + horizon)[
    #image(${typstString(pdfRelativePath)}, width: 100%, height: 100%, fit: "contain")
  ]
]`;
}

function typstPageMargin(settings) {
  return `(
    inside: ${settings.inside},
    outside: ${settings.outside},
    top: ${settings.top},
    bottom: ${settings.bottom},
  )`;
}

function formatDuration(startedAt) {
  const elapsedMs = Date.now() - startedAt;
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function renderPersonIndex(indexState) {
  if (!indexState) {
    return "";
  }

  const rows = indexState.people
    .map((person) => ({
      person,
      markers: indexState.mentions.get(person.id) || [],
    }))
    .filter((entry) => entry.markers.length > 0);

  if (rows.length === 0) {
    return "";
  }

  const parts = [
    `#pagebreak()
#set page(header: page-number-header(), footer: none)
= Index

#set par(first-line-indent: 0em, justify: false)

#let index-pages(labels) = context {
  let pages = ()
  let items = ()
  for marker in labels {
    let page = counter(page).at(marker).first()
    if not pages.contains(page) {
      pages.push(page)
      items.push(link(marker)[#page])
    }
  }

  items.join[, ]
}

#let index-prefix-row(name-line) = grid(
  columns: (auto, 1fr, 2.15in),
  gutter: 0.04in,
  align: top,
  [#name-line],
  [],
  [],
)

#let index-final-row(name-line, labels) = grid(
    columns: (auto, 1fr, 2.15in),
    gutter: 0.04in,
    align: top,
    [#name-line],
    text(fill: rgb("#777777"))[#repeat[.]],
    box(width: 2.15in)[#index-pages(labels)],
)

#let index-row(name-lines, labels) = block(width: 100%, below: 2pt)[
  #let rows = ()
  #for name-line in name-lines.slice(0, name-lines.len() - 1) {
    rows.push(index-prefix-row(name-line))
  }
  #rows.push(index-final-row(name-lines.at(name-lines.len() - 1), labels))
  #stack(dir: ttb, spacing: 0.30em, ..rows)
]
`,
  ];

  for (const { person, markers } of rows) {
    const labels = markers.map(typstLabel).join(", ");
    const tuple = markers.length === 1 ? `(${labels},)` : `(${labels})`;
    const nameLines = wrapIndexDisplayName(person.displayName)
      .map(typstString)
      .join(", ");
    parts.push(`#index-row((${nameLines},), ${tuple})\n`);
  }

  return parts.join("\n");
}

function renderTypstDocument(entries, options, indexState = null) {
  const settings = pageSettings(options.size);
  const parts = [];
  const startedAt = Date.now();

  parts.push(`#set document(title: ${typstString(`Zeidy-D ${options.output}`)})
#set page(
  width: ${settings.width},
  height: ${settings.height},
  margin: (
    inside: ${settings.inside},
    outside: ${settings.outside},
    top: ${settings.top},
    bottom: ${settings.bottom},
  ),
  numbering: "1",
)
#set text(
  font: "Times New Roman",
  size: ${settings.fontSize},
  lang: "en",
  dir: auto,
  hyphenate: false,
)
#set par(
  first-line-indent: 0em,
  justify: true,
  leading: ${settings.leading},
)

#let page-number-header(show-number: true) = context {
  if show-number {
    let number = text(size: 7.2pt, fill: rgb("#444444"))[
      #counter(page).display()
    ]

    if calc.odd(here().page()) {
      grid(
        columns: (1fr, auto),
        align: top,
        [],
        number,
      )
    } else {
      grid(
        columns: (auto, 1fr),
        align: top,
        number,
        [],
      )
    }
  } else {
    []
  }
}

#let article-footer(url, qr) = context {
  let link-text = text(size: 7.2pt, fill: rgb("#222222"))[
    #link(url)[#url]
  ]
  let qr-image = image(qr, width: ${settings.qrSize})
  let left-link-block = box[
    #grid(
      columns: (auto, auto),
      gutter: 0.06in,
      align: bottom,
      qr-image,
      link-text,
    )
  ]
  let right-link-block = box[
    #grid(
      columns: (auto, auto),
      gutter: 0.06in,
      align: bottom,
      link-text,
      qr-image,
    )
  ]

  if calc.odd(here().page()) {
    grid(
      columns: (1fr, auto),
      align: top,
      [],
      right-link-block,
    )
  } else {
    grid(
      columns: (auto, 1fr),
      align: top,
      left-link-block,
      [],
    )
  }
}

#show heading.where(level: 1): it => {
  set align(center)
  set text(font: "Times New Roman", size: 11pt, weight: "regular")
  block(above: 0pt, below: 16pt)[#it.body]
}

#show par: it => {
  it
}
`);

  console.error(`Converting ${entries.length} article${entries.length === 1 ? "" : "s"} from source files...`);

  let insertedTableOfContents = false;

  entries.forEach((entry, index) => {
    console.error(`[${index + 1}/${entries.length}] ${entry.title}`);
    const isFrontMatter = entry.isFrontMatter;
    const body = entry.isPdfPage
      ? renderPdfPage(entry)
      : convertDocxToTypst(entry, isFrontMatter ? null : indexState);
    const qrRelativePath = entry.hasFooter
      ? path.relative(OUTPUT_DIR, entry.qrPath).split(path.sep).join("/")
      : null;
    const shouldInsertTableOfContents =
      options.all && !insertedTableOfContents && !isFrontMatter;

    if (shouldInsertTableOfContents) {
      if (index > 0) {
        parts.push("#pagebreak()\n");
      }

      parts.push(`#set page(header: none, footer: none)
#outline(
  title: [Contents],
  target: heading.where(level: 1),
)
#pagebreak(to: "odd")
#counter(page).update(1)
`);
      insertedTableOfContents = true;
    } else if (index > 0) {
      parts.push("#pagebreak()\n");
    }

    const header = isFrontMatter ? "none" : "page-number-header()";
    const footer = entry.hasFooter
      ? `article-footer(${typstString(entry.url)}, ${typstString(qrRelativePath)})`
      : "none";
    const heading = entry.isPdfPage || entry.isHaskama
      ? ""
      : isFrontMatter
      ? `#heading(level: 1, outlined: false)[${entry.title}]`
      : `= ${entry.title}`;
    const margin = entry.isPdfPage ? "0in" : typstPageMargin(settings);

    parts.push(`#set page(header: ${header}, footer: ${footer}, margin: ${margin})
${heading}

${body}
`);
  });

  const indexContent = renderPersonIndex(indexState);
  if (indexContent) {
    parts.push(indexContent);
  }

  console.error(`Finished source conversion in ${formatDuration(startedAt)}.`);
  return parts.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = await loadEntries(options);
  const shouldBuildPersonIndex = options.personIndex ?? options.all;
  const personIndexPeople = shouldBuildPersonIndex ? await loadPersonIndex() : [];
  const indexState = shouldBuildPersonIndex
    ? createPersonIndexState(personIndexPeople)
    : null;

  await ensureEntryFiles(entries);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const typstPath = path.join(OUTPUT_DIR, `${options.output}.typ`);
  const pdfPath = path.join(OUTPUT_DIR, `${options.output}.pdf`);
  const typstDocument = renderTypstDocument(entries, options, indexState);

  await fs.writeFile(typstPath, typstDocument, "utf8");
  const compileStartedAt = Date.now();
  console.error(`Compiling PDF with Typst...`);
  run("typst", ["compile", "--root", ROOT_DIR, typstPath, pdfPath]);
  console.error(`Finished Typst compile in ${formatDuration(compileStartedAt)}.`);
  await optimizePdfForWeb(pdfPath);

  console.log(`Built ${path.relative(ROOT_DIR, typstPath)}`);
  console.log(`Built ${path.relative(ROOT_DIR, pdfPath)}`);
  console.log(`Included ${entries.length} article${entries.length === 1 ? "" : "s"} at ${options.size}.`);
  if (shouldBuildPersonIndex) {
    const indexedPeople = Array.from(indexState.mentions.values()).filter((markers) => markers.length > 0).length;
    console.log(`Indexed ${indexedPeople} person${indexedPeople === 1 ? "" : "s"}.`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`build-typeset-proof failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  applyDocxParagraphAlignments,
  applyTextRules,
  convertDocxToTypst,
  isolateHebrewRuns,
  normalizeMisplacedHebrewCommas,
  normalizeColonHebrewSoftBreaks,
  normalizeHebrewParagraphSoftBreaks,
  normalizeNumberedSoftBreaks,
  normalizePunctuationSpacing,
  protectMixedLtrParentheticals,
  normalizeIsolatedPunctuationSpacing,
  repairEscapedHebrewParagraphCitations,
  repairSplitGemaraSources,
  repairTwoPartHebrewCommaDashPhrases,
  renderPersonIndex,
  shiftedParagraphAlignments,
  tagPersonIndexMentions,
  tightenHaskamaSignatureBlock,
  stripDuplicateTitle,
  wrapIndexDisplayName,
};
