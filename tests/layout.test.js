// Tests for placement geometry: `node --test`
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/core/layout.js");

const VIEWPORT = { width: 1000 };
const BAR = { width: 200, height: 40 };

// Selection of 100 px width, centered in the window.
const sel = (top, left = 450) => ({ left, top, bottom: top + 20, width: 100 });

test("toolbar: centered above the selection", () => {
  // Selection center = 500; toolbar of 200 => left = 400; top = 300 - 40 - 8.
  assert.deepEqual(L.placeToolbar(sel(300), BAR, VIEWPORT), {
    left: 400,
    top: 252,
  });
});

test("toolbar: below the selection when there is no room above", () => {
  // top = 30 - 40 - 8 = -18 < 8 => below the selection: bottom (50) + 8.
  assert.deepEqual(L.placeToolbar(sel(30), BAR, VIEWPORT), {
    left: 400,
    top: 58,
  });
});

test("toolbar: exact limit between above and below", () => {
  // top = 56 - 48 = 8: exact margin, stay above.
  assert.equal(L.placeToolbar(sel(56), BAR, VIEWPORT).top, 8);
  // top = 55 - 48 = 7 < 8: switch below.
  assert.equal(L.placeToolbar(sel(55), BAR, VIEWPORT).top, 75 + 8);
});

test("toolbar: bounded on the left", () => {
  assert.equal(L.placeToolbar(sel(300, 0), BAR, VIEWPORT).left, 8);
});

test("toolbar: bounded on the right", () => {
  // Width = 1000 - 200 - 8 = 792.
  assert.equal(L.placeToolbar(sel(300, 950), BAR, VIEWPORT).left, 792);
});

test("toolbar: window narrower than the bar -> stuck to the left", () => {
  assert.equal(L.placeToolbar(sel(300), BAR, { width: 150 }).left, 8);
});

test("toolbar: rounded coordinates", () => {
  const out = L.placeToolbar(
    { left: 10.4, top: 300.6, bottom: 320.6, width: 33.3 },
    BAR,
    VIEWPORT,
  );
  assert.ok(Number.isInteger(out.left) && Number.isInteger(out.top));
});

test("popover: above the chip when there is room", () => {
  // Chip at y=500, panel of 200 => 500 - 200 - 4 = 296.
  assert.equal(L.placePopover(500, 18, 200), 296);
});

test("popover: below the chip when it does not fit above", () => {
  // Chip at y=150, panel of 200: above = -54 < 8 => 150 + 18 + 4.
  assert.equal(L.placePopover(150, 18, 200), 172);
});

test("popover: exact limit between above and below", () => {
  assert.equal(L.placePopover(212, 18, 200), 8); // 212 - 204 = 8: stay above.
  assert.equal(L.placePopover(211, 18, 200), 233); // 211 - 204 = 7: switch below (211 + 18 + 4).
});

test("chip row: side by side with a gap", () => {
  const items = [
    { width: 58, visible: true },
    { width: 80, visible: true },
    { width: 40, visible: true },
  ];
  assert.deepEqual(L.flowRow(items, 6), [0, 64, 150]);
});

test("chip row: a hidden chip does not take space", () => {
  const items = [
    { width: 58, visible: false },
    { width: 80, visible: true },
  ];
  assert.deepEqual(L.flowRow(items, 6), [0, 0]); // The second goes to the front.
  const items2 = [
    { width: 58, visible: true },
    { width: 80, visible: false },
    { width: 40, visible: true },
  ];
  assert.deepEqual(L.flowRow(items2, 6), [0, 64, 64]);
});

test("chip row: empty, or all hidden", () => {
  assert.deepEqual(L.flowRow([], 6), []);
  assert.deepEqual(
    L.flowRow(
      [
        { width: 10, visible: false },
        { width: 10, visible: false },
      ],
      6,
    ),
    [0, 0],
  );
});

test("chip row: the width of a hidden chip has no effect", () => {
  const a = L.flowRow(
    [
      { width: 999, visible: false },
      { width: 50, visible: true },
      { width: 50, visible: true },
    ],
    6,
  );
  const b = L.flowRow(
    [
      { width: 1, visible: false },
      { width: 50, visible: true },
      { width: 50, visible: true },
    ],
    6,
  );
  assert.deepEqual(a, b);
});

test("popover: never overlaps the chip", () => {
  for (const chipTop of [0, 50, 150, 212, 400, 900]) {
    const y = L.placePopover(chipTop, 18, 200);
    const panelBottom = y + 200;
    const above = panelBottom <= chipTop; // Entirely above.
    const below = y >= chipTop + 18; // Entirely below.
    assert.ok(
      above || below,
      `chipTop=${chipTop} : panel [${y}, ${panelBottom}] overlaps the chip`,
    );
  }
});
