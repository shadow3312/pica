const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const exists = (file) => fs.existsSync(path.join(ROOT, file));
const manifest = JSON.parse(read("manifest.json"));
const contentScripts = manifest.content_scripts.flatMap((script) => script.js);

const popupFile = manifest.action && manifest.action.default_popup;
const popupHtml = popupFile ? read(popupFile) : "";

const fromPopup = (src) =>
  path.posix.normalize(
    path.posix.join(path.posix.dirname(popupFile || "."), src),
  );
const popupScripts = [...popupHtml.matchAll(/<script\s+src="([^"]+)"/g)].map(
  (m) => fromPopup(m[1]),
);
const popupStyles = [
  ...popupHtml.matchAll(/<link[^>]+href="([^"]+\.css)"/g),
].map((m) => fromPopup(m[1]));

const allScripts = [...new Set([...contentScripts, ...popupScripts])];

// Code without comments: file headers cite global and API names
// ("Exposed on globalThis.LinkedInEditor") that must not count as usages.
function code(file) {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const DEFINE_RE = /(?:root|globalThis)\.(LinkedIn\w+)\s*=(?!=)/g;
const USE_RE = /(?:root|globalThis)\.(LinkedIn\w+)/g;
const names = (re, src) => new Set([...src.matchAll(re)].map((m) => m[1]));

/** Every used LinkedIn* global must be defined by a script loaded earlier in this list. */
function checkLoadOrder(scripts, label) {
  const definedBy = new Map();
  scripts.forEach((file, index) => {
    for (const name of names(DEFINE_RE, code(file))) {
      if (definedBy.has(name))
        assert.fail(
          `${label} : ${name} is defined by ${definedBy.get(name).file} and by ${file}`,
        );
      definedBy.set(name, { file, index });
    }
  });
  scripts.forEach((file, index) => {
    const own = names(DEFINE_RE, code(file));
    for (const name of names(USE_RE, code(file))) {
      if (own.has(name)) continue;
      const def = definedBy.get(name);
      assert.ok(def, `${label} : ${file} uses ${name}, defined by no script`);
      assert.ok(
        def.index < index,
        `${label} : ${file} (position ${index + 1}) uses ${name} defined later by ${def.file} (position ${def.index + 1}) : reorder required`,
      );
    }
  });
}

test("manifest.json exists", () => {
  assert.ok(exists("manifest.json"), "manifest.json does not exist");
});

test("manifest.json is valid JSON", () => {
  assert.doesNotThrow(
    () => JSON.parse(read("manifest.json")),
    SyntaxError,
    "manifest.json is not valid JSON",
  );
});

test("content scripts exist", () => {
  contentScripts.forEach((script) => {
    assert.ok(exists(script), `Content script does not exist: ${script}`);
  });
});

test("no duplicate content scripts", () => {
  const duplicates = contentScripts.filter(
    (script, index) => contentScripts.indexOf(script) !== index,
  );
  assert.strictEqual(
    duplicates.length,
    0,
    `Duplicate content scripts found: ${duplicates.join(", ")}`,
  );
});

test("the manifest declares a popup and lists its scripts", () => {
  assert.ok(popupFile, "manifest.action.default_popup is missing");
  assert.ok(popupScripts.length > 0, "no <script src> in " + popupFile);
});

test("each referenced script and stylesheet exists", () => {
  for (const file of [...allScripts, ...popupStyles, popupFile]) {
    assert.ok(exists(file), file + " is referenced but not found");
  }
});

test("no duplicate scripts in the same list", () => {
  assert.equal(
    new Set(contentScripts).size,
    contentScripts.length,
    "manifest.json",
  );
  assert.equal(new Set(popupScripts).size, popupScripts.length, popupFile);
});

/** All .js files under a directory, relative to the project root (separator: "/"). */
function jsFilesUnder(dir) {
  return fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((entry) => {
      const rel = dir + "/" + entry.name;
      if (entry.isDirectory()) return jsFilesUnder(rel);
      return entry.name.endsWith(".js") ? [rel] : [];
    });
}

// test("each .js under src/ is loaded by the manifest or the popup", () => {
//   for (const file of jsFilesUnder("src")) {
//     assert.ok(
//       allScripts.includes(file),
//       `${file} is loaded neither by manifest.json nor by the popup (omission?)`,
//     );
//   }
// });

test("no .js at the root: code is under src/, tests under tests/", () => {
  const stray = fs.readdirSync(ROOT).filter((f) => f.endsWith(".js"));
  assert.deepEqual(stray, []);
});

// ---------- Architecture: what each directory is allowed to touch ----------
const CORE_FORBIDDEN =
  /\b(document|window|chrome|navigator|localStorage|sessionStorage)\b/;

test("src/core is pure: no access to document, window, chrome, or browser storage", () => {
  for (const file of jsFilesUnder("src/core")) {
    const hit = code(file).match(CORE_FORBIDDEN);
    assert.ok(
      !hit,
      `${file} uses « ${hit && hit[0]} »: pure logic must remain testable under Node (move it to src/platform or src/widgets)`,
    );
  }
});

test("only src/platform/storage.js touches chrome.*: the rest use LinkedInStorage", () => {
  for (const file of allScripts.filter(
    (f) => f !== "src/platform/storage.js",
  )) {
    const hit = code(file).match(/\bchrome\b/);
    assert.ok(
      !hit,
      `${file} uses « chrome »: use LinkedInStorage (src/platform/storage.js)`,
    );
  }
});

test("src/widgets does not create its own interface host: everything passes through LinkedInUI.mount", () => {
  for (const file of jsFilesUnder("src/widgets")) {
    assert.ok(
      !/\.attachShadow\s*\(/.test(code(file)),
      `${file} calls attachShadow: mount the widget with LinkedInUI.mount (src/platform/ui-host.js)`,
    );
  }
});

// test("LinkedIn page load order: dependencies defined before use", () => {
//   checkLoadOrder(contentScripts, "manifest.json");
// });

test("popup load order: dependencies defined before use", () => {
  checkLoadOrder(popupScripts, popupFile);
});

test("popup: no inline scripts or event handlers (forbidden in Manifest V3)", () => {
  assert.ok(
    !/<script(?![^>]*\ssrc=)/i.test(popupHtml),
    "a <script> without src (inline script)",
  );
  assert.ok(
    !/\son[a-z]+\s*=/i.test(popupHtml),
    "an inline event handler (onclick=...)",
  );
});

test('README promise: the only permission is "storage", no expanded host access', () => {
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
  for (const cs of manifest.content_scripts) {
    assert.deepEqual(cs.matches, ["https://www.linkedin.com/*"]);
  }
});

test("README promise: no network requests or dynamic code execution", () => {
  const forbidden = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
    /\bsendBeacon\b/,
    /\bimportScripts\b/,
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
  ];
  for (const file of allScripts) {
    const src = code(file);
    for (const re of forbidden) {
      assert.ok(
        !re.test(src),
        `${file} contains ${re}: contrary to the README promise of "no network"`,
      );
    }
  }
});

test("popup: no remote resources (nothing leaves the browser)", () => {
  assert.ok(
    !/(?:src|href)="(?:https?:)?\/\//i.test(popupHtml),
    "a remote resource is loaded by the popup",
  );
});

// ---------- Settings: a name added to settings.js must be wired end to end ----------
const settingNames = Object.keys(require("../src/core/settings.js").DEFAULTS);

test("settings: each has a label in the popup", () => {
  const popup = read("src/popup/popup.js");
  for (const name of settingNames) {
    assert.ok(
      new RegExp(`\\b${name}\\s*:`).test(popup),
      `« ${name} » has no label in popup.js`,
    );
  }
});

test("settings: the types (types.d.ts) list exactly the same names", () => {
  const declared = read("types.d.ts").match(/type SettingName =([^;]+);/);
  assert.ok(declared, "type SettingName not found in types.d.ts");
  const typed = [...declared[1].matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(typed, [...settingNames].sort());
});
