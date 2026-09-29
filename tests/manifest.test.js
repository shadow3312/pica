const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file),"utf8");
const exists = file => fs.existsSync(path.join(ROOT, file));
const manifest = JSON.parse(read("manifest.json"));
const contentScripts = manifest.content_scripts.flatMap(script => script.js);

test("manifest.json exists", () => {
    assert.ok(exists("manifest.json"), "manifest.json does not exist");
});


test("manifest.json is valid JSON", () => {
    assert.doesNotThrow(() => JSON.parse(read("manifest.json")), SyntaxError, "manifest.json is not valid JSON");
});

test("content scripts exist", () => {
    contentScripts.forEach(script => {
        assert.ok(exists(script), `Content script does not exist: ${script}`);
    });
});

test("no duplicate content scripts", () => {
    const duplicates = contentScripts.filter((script, index) => contentScripts.indexOf(script) !== index);
    assert.strictEqual(duplicates.length, 0, `Duplicate content scripts found: ${duplicates.join(", ")}`);
});