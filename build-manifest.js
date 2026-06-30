#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const FILES_DIR = "./Files";
const MANIFEST_FILE = "./manifest.json";
const ROUTES_FILE = "./routes.json";
const ROOT_INDEX_FILE = "./index.html";
const FALLBACK_FILE = "./404.html";
const GENERATED_FALLBACK_MARKER = "<!-- Generated fallback page: do not edit directly. -->";
const CONTENT_KEY = "__content";

function hasMetaVideos(metaContent) {
  return [metaContent.youtube, metaContent.googleDrive, metaContent.drive].some(
    (value) => {
      if (!value) return false;
      if (Array.isArray(value)) {
        return value.some((id) => typeof id === "string" && id.trim() !== "");
      }

      return typeof value === "string" && value.trim() !== "";
    }
  );
}

// Helper function to prompt user for confirmation
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function buildManifest() {
  console.log("🔍 Scanning Files directory...");

  if (!fs.existsSync(FILES_DIR)) {
    console.error("❌ Files directory not found!");
    process.exit(1);
  }

  const manifest = {};
  let totalEntries = 0;

  async function scanDirectory(dirPath, relativePath = "", depth = 0) {
    const entries = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort();

    const result = {};
    const indent = "  ".repeat(depth);
    const icon = depth === 0 ? "📚" : depth === 1 ? "📖" : "📄";

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const currentRelativePath = relativePath
        ? `${relativePath}/${entry}`
        : entry;
      const hasChildDirectories = fs
        .readdirSync(entryPath, { withFileTypes: true })
        .some((dirent) => dirent.isDirectory());

      // Check if this directory contains content (PDF files or meta.json)
      const hasContent = checkForContent(entryPath);

      if (hasContent) {
        let contentValue = null;
        // This is a leaf node with actual content
        const metaJsonPath = path.join(entryPath, "meta.json");
        const allFiles = fs.readdirSync(entryPath);
        const pdfFiles = allFiles.filter((file) =>
          file.toLowerCase().endsWith(".pdf")
        );
        const mp3Files = allFiles.filter((file) =>
          file.toLowerCase().endsWith(".mp3")
        );

        let status = "✅";
        const warnings = [];

        if (!fs.existsSync(metaJsonPath)) {
          warnings.push("missing meta.json");
          status = "⚠️";
        }

        if (pdfFiles.length === 0) {
          // No PDF - check if there's an MP3 file to use for base name
          if (mp3Files.length === 1) {
            // Use MP3 file as base name (without extension)
            const baseFilename = mp3Files[0].replace(".mp3", "");
            contentValue = baseFilename;
            console.log(
              `${indent}${icon} ✅ ${entry} (MP3 only: ${baseFilename})`
            );
          } else if (mp3Files.length > 1) {
            // Multiple MP3s - exit with error
            console.error(
              `\n❌ Multiple MP3 files found in ${relativePath}/${entry}:`
            );
            mp3Files.forEach((mp3) => console.error(`   - ${mp3}`));
            console.error(
              "Please ensure each directory has at most one MP3 file."
            );
            process.exit(1);
          } else {
            // No PDF or MP3 - check if there's other media content
            if (fs.existsSync(metaJsonPath)) {
              try {
                const metaContent = JSON.parse(
                  fs.readFileSync(metaJsonPath, "utf8")
                );
                const hasVideos = hasMetaVideos(metaContent);

                if (hasVideos) {
                  // Has embeddable video content, no file-based content
                  contentValue = null;
                  console.log(`${indent}${icon} ✅ ${entry} (video only)`);
                } else {
                  warnings.push("no content files");
                  status = "⚠️";
                  contentValue = null;
                }
              } catch (error) {
                warnings.push("invalid meta.json");
                status = "⚠️";
                contentValue = null;
              }
            } else {
              warnings.push("no content files");
              status = "⚠️";
              contentValue = null;
            }
          }
        } else if (pdfFiles.length > 1) {
          // Multiple PDFs - exit with error
          console.error(
            `\n❌ Multiple PDF files found in ${relativePath}/${entry}:`
          );
          pdfFiles.forEach((pdf) => console.error(`   - ${pdf}`));
          console.error(
            "Please ensure each directory has exactly one PDF file."
          );
          process.exit(1);
        } else if (pdfFiles.length === 1) {
          const pdfFile = pdfFiles[0];

          // Handle MP3 renaming to match PDF
          if (mp3Files.length > 1) {
            // Multiple MP3s - exit with error
            console.error(
              `\n❌ Multiple MP3 files found in ${relativePath}/${entry}:`
            );
            mp3Files.forEach((mp3) => console.error(`   - ${mp3}`));
            console.error(
              "Please ensure each directory has at most one MP3 file."
            );
            process.exit(1);
          } else if (mp3Files.length === 1) {
            const mp3File = mp3Files[0];
            const expectedMp3Name = pdfFile.replace(".pdf", ".mp3");

            if (mp3File !== expectedMp3Name) {
              // Prompt user before renaming
              console.log(
                `\n📝 Found MP3 that needs renaming in ${relativePath}/${entry}:`
              );
              console.log(`   Current: ${mp3File}`);
              console.log(`   Expected: ${expectedMp3Name}`);

              const response = await promptUser(
                "Rename this MP3 file? (y/n/q): "
              );

              if (response === "q" || response === "quit") {
                console.log("❌ Build cancelled by user.");
                process.exit(0);
              } else if (response === "y" || response === "yes") {
                // Rename MP3 to match PDF
                const oldMp3Path = path.join(entryPath, mp3File);
                const newMp3Path = path.join(entryPath, expectedMp3Name);

                try {
                  fs.renameSync(oldMp3Path, newMp3Path);
                  console.log(`   ✅ Renamed successfully!`);
                } catch (error) {
                  console.error(`   ❌ Failed to rename: ${error.message}`);
                  process.exit(1);
                }
              } else {
                console.log(`   ⏭️  Skipped renaming.`);
                warnings.push("MP3 file not renamed");
                status = "⚠️";
              }
            }
          }
          // No warning if no MP3 files - that's optional

          // Single PDF file - store base name without extension
          const baseFilename = pdfFile.replace(".pdf", "");
          contentValue = baseFilename;

          totalEntries++;

          const warningText =
            warnings.length > 0 ? ` (${warnings.join(", ")})` : "";
          console.log(`${indent}${icon} ${status} ${entry}${warningText}`);
        }

        // Only increment totalEntries here if we didn't already do it above
        if (pdfFiles.length !== 1 && status === "✅") {
          totalEntries++;
        }

        if (hasChildDirectories) {
          result[entry] = await scanDirectory(
            entryPath,
            currentRelativePath,
            depth + 1
          );
          result[entry][CONTENT_KEY] = contentValue;
        } else {
          result[entry] = contentValue;
        }
      } else {
        // This is a branch node, scan deeper
        console.log(`${indent}${icon} Processing: ${entry}`);
        result[entry] = await scanDirectory(
          entryPath,
          currentRelativePath,
          depth + 1
        );
      }
    }

    return result;
  }

  function checkForContent(dirPath) {
    try {
      const files = fs.readdirSync(dirPath);

      // Check if directory contains PDF files or meta.json (content indicators)
      const hasPdf = files.some((file) => file.toLowerCase().endsWith(".pdf"));
      const hasMeta = files.includes("meta.json");

      // If it has content files, it's a leaf node
      if (hasPdf || hasMeta) {
        return true;
      }

      // If it only contains directories, it's a branch node
      const hasDirectories = files.some((file) => {
        const filePath = path.join(dirPath, file);
        return fs.statSync(filePath).isDirectory();
      });

      // If it has no directories and no content, consider it empty (shouldn't happen)
      return !hasDirectories;
    } catch (error) {
      console.warn(`⚠️ Error checking directory ${dirPath}:`, error.message);
      return false;
    }
  }

  // Start scanning from the Files directory
  Object.assign(manifest, await scanDirectory(FILES_DIR));

  // Write the manifest file
  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(MANIFEST_FILE, manifestJson);

  const routes = buildRoutes(manifest);
  fs.writeFileSync(ROUTES_FILE, JSON.stringify(routes, null, 2));
  generateFallbackPage();

  console.log("\n✅ Manifest built successfully!");
  console.log(`📊 Total entries: ${totalEntries}`);
  console.log(`📄 Manifest saved to: ${MANIFEST_FILE}`);
  console.log(`🧭 Routes saved to: ${ROUTES_FILE}`);
  console.log(`📄 Fallback page saved to: ${FALLBACK_FILE}`);

  return manifest;
}

function routeSegment(part) {
  return part
    .replace(/^\d+\s*-\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9'()]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function routePath(pathParts) {
  return `/${pathParts.map(routeSegment).filter(Boolean).join("/")}/`;
}

function isYear(part) {
  return /^\d{4}$/.test(String(part).trim());
}

function stripNumberPrefix(part) {
  return part.replace(/^\d+\s*-\s*/, "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, " ").trim();
}

function nearestTopic(parts) {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!isYear(parts[i])) {
      return stripNumberPrefix(parts[i]);
    }
  }
  return null;
}

function simplifyLeafName(leaf, topic, year) {
  let next = stripNumberPrefix(leaf);

  if (topic) {
    next = next.replace(new RegExp(`\\b${escapeRegex(topic)}\\b`, "i"), " ");
  }

  if (year) {
    next = next.replace(new RegExp(`\\b${escapeRegex(year)}\\b`, "g"), " ");
  }

  return normalizeSpaces(next) || stripNumberPrefix(leaf);
}

function routePartsForContent(pathParts) {
  const withoutSefer = pathParts.slice(1);
  const leaf = withoutSefer[withoutSefer.length - 1];
  const parent = withoutSefer[withoutSefer.length - 2];

  if (!leaf || !parent) {
    return withoutSefer;
  }

  if (isYear(parent)) {
    const topic = nearestTopic(withoutSefer.slice(0, -2));
    const simplified = simplifyLeafName(leaf, topic, parent);

    if (routeSegment(simplified) !== routeSegment(leaf)) {
      return [...withoutSefer.slice(0, -1), simplified];
    }

    return withoutSefer;
  }

  const leafYearMatch = stripNumberPrefix(leaf).match(/\b(5\d{3})\b/);
  if (leafYearMatch) {
    const year = leafYearMatch[1];
    const topic = nearestTopic(withoutSefer.slice(0, -1));
    const simplified = simplifyLeafName(leaf, topic, year);

    if (routeSegment(simplified) !== routeSegment(leaf)) {
      return [...withoutSefer.slice(0, -1), year, simplified];
    }
  }

  return withoutSefer;
}

function buildRoutes(manifest) {
  const routes = {
    byRoute: {},
    byContentPath: {},
  };

  function walk(node, pathParts = []) {
    for (const [key, value] of Object.entries(node)) {
      const currentPath = [...pathParts, key];

      if (key === CONTENT_KEY) {
        const contentPath = pathParts.join("/");
        const route = routePath(routePartsForContent(pathParts));
        const entry = {
          contentPath,
          baseFilename: value,
        };

        if (routes.byRoute[route]) {
          throw new Error(
            `Route collision for ${route}: ${routes.byRoute[route].contentPath} and ${contentPath}`
          );
        }

        routes.byRoute[route] = entry;
        routes.byContentPath[contentPath] = route;
      } else if (typeof value === "string" || value === null) {
        const contentPath = currentPath.join("/");
        const route = routePath(routePartsForContent(currentPath));
        const entry = {
          contentPath,
          baseFilename: value,
        };

        if (routes.byRoute[route]) {
          throw new Error(
            `Route collision for ${route}: ${routes.byRoute[route].contentPath} and ${contentPath}`
          );
        }

        routes.byRoute[route] = entry;
        routes.byContentPath[contentPath] = route;
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value, currentPath);
      }
    }
  }

  walk(manifest);
  return routes;
}

function generateFallbackPage() {
  if (!fs.existsSync(ROOT_INDEX_FILE)) {
    throw new Error(`${ROOT_INDEX_FILE} not found`);
  }

  const rootIndex = fs.readFileSync(ROOT_INDEX_FILE, "utf8");
  const fallbackIndex = rootIndex.includes(GENERATED_FALLBACK_MARKER)
    ? rootIndex
    : rootIndex.replace(
        "<!DOCTYPE html>",
        `<!DOCTYPE html>\n${GENERATED_FALLBACK_MARKER}`
      );

  fs.writeFileSync(FALLBACK_FILE, fallbackIndex);
}

// Allow running as a script or importing as a module
if (require.main === module) {
  (async () => {
    try {
      await buildManifest();
    } catch (error) {
      console.error("❌ Error building manifest:", error.message);
      process.exit(1);
    }
  })();
}

module.exports = { buildManifest };
