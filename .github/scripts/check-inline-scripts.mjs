// Syntax-checks the inline <script> blocks embedded in every .html file in
// the repo, since these one-off pages have no build step to catch JS errors.
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const SKIP_DIRS = new Set([".git", "node_modules"]);

function findHtmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) findHtmlFiles(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

const scriptBlockRe = /<script(?![^>]*\bsrc=)(?![^>]*\btype="application\/json")[^>]*>([\s\S]*?)<\/script>/gi;

let failed = false;

for (const file of findHtmlFiles(".")) {
  const html = readFileSync(file, "utf8");
  let match;
  let index = 0;
  while ((match = scriptBlockRe.exec(html))) {
    index++;
    const code = match[1];
    const tmpFile = join(tmpdir(), `inline-script-check-${Date.now()}-${index}.js`);
    writeFileSync(tmpFile, code);
    try {
      execFileSync(process.execPath, ["--check", tmpFile], { stdio: "pipe" });
    } catch (err) {
      failed = true;
      console.error(`✖ ${file} (script block ${index})`);
      console.error(err.stderr.toString());
    } finally {
      unlinkSync(tmpFile);
    }
  }
}

if (failed) {
  console.error("\nInline <script> syntax errors found.");
  process.exit(1);
}

console.log("All inline <script> blocks are syntactically valid.");
