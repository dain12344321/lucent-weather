const {test} = require("node:test");
const assert = require("node:assert/strict");
const {
  MIN_TASKBAR_WIDTH,
  exposedHeight,
  taskbarVisibility,
  geometryDecision,
  boundsEqual,
} = require("./geometry");

const display = {x: 0, y: 0, width: 1920, height: 1080};

test("taskbar geometry accepts a visible horizontal bar at a negative monitor origin", () => {
  const bar = {x: -1920, y: 1040, width: 1920, height: 40};
  assert.equal(exposedHeight(bar, {x: -1920, y: 0, width: 1920, height: 1080}), 40);
  assert.equal(
    taskbarVisibility({bar, visible: true, widgetExposed: true}, {
      x: -1920,
      y: 0,
      width: 1920,
      height: 1080,
    }),
    "shown",
  );
});

test("geometry hides a hidden, undersized, offscreen, or covered taskbar", () => {
  const bar = {x: 0, y: 1032, width: MIN_TASKBAR_WIDTH, height: 48};
  assert.equal(taskbarVisibility({bar, visible: false, widgetExposed: true}, display), "taskbar-hidden");
  assert.equal(taskbarVisibility({bar: {...bar, width: MIN_TASKBAR_WIDTH - 1}, visible: true, widgetExposed: true}, display), "taskbar-offscreen");
  assert.equal(taskbarVisibility({bar: {...bar, y: 1070, height: 10}, visible: true, widgetExposed: true}, display), "taskbar-offscreen");
  assert.equal(taskbarVisibility({bar, visible: true, widgetExposed: false}, display), "taskbar-covered");
});

test("legacy helper samples remain usable while newer widget exposure wins", () => {
  const bar = {x: 0, y: 1032, width: 1920, height: 48};
  assert.equal(taskbarVisibility({bar, visible: true, taskbarExposed: true}, display), "shown");
  assert.equal(taskbarVisibility({bar, visible: true, taskbarExposed: true, widgetExposed: false}, display), "taskbar-covered");
  assert.deepEqual(geometryDecision({bar, visible: true, widgetExposed: true}, display), {reason: "shown", shown: true});
});

test("boundsEqual rejects missing or partial rectangles", () => {
  const a = {x: 1, y: 2, width: 3, height: 4};
  assert.equal(boundsEqual(a, {...a}), true);
  assert.equal(boundsEqual(a, {...a, width: 5}), false);
  assert.equal(boundsEqual(a, null), false);
});
