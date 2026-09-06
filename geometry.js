const MIN_TASKBAR_WIDTH = 400;
const MIN_EXPOSED_HEIGHT = 24;

function asRect(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y))
    return null;
  if (!Number.isFinite(value.width) || !Number.isFinite(value.height))
    return null;
  return {
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
  };
}

function exposedHeight(bar, display) {
  const taskbar = asRect(bar);
  const screen = asRect(display);
  if (!taskbar || !screen) return 0;
  return Math.min(taskbar.y + taskbar.height, screen.y + screen.height) -
    Math.max(taskbar.y, screen.y);
}

function taskbarVisibility(sample, display, options = {}) {
  const bar = asRect(sample && sample.bar);
  const minWidth = options.minWidth ?? MIN_TASKBAR_WIDTH;
  const minHeight = options.minHeight ?? MIN_EXPOSED_HEIGHT;

  if (!sample || !sample.visible) return "taskbar-hidden";
  if (!bar || bar.width < minWidth) return "taskbar-offscreen";
  if (exposedHeight(bar, display) < minHeight) return "taskbar-offscreen";

  // New helpers report the exposure at the tile's actual bounds. Keep the
  // legacy field as a compatible fallback for older packaged helpers.
  const exposed = sample.widgetExposed ?? sample.taskbarExposed;
  if (!exposed) return "taskbar-covered";
  return "shown";
}

function geometryDecision(sample, display, options = {}) {
  const reason = taskbarVisibility(sample, display, options);
  return {reason, shown: reason === "shown"};
}

function boundsEqual(a, b) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width &&
    a.height === b.height;
}

module.exports = {
  MIN_TASKBAR_WIDTH,
  MIN_EXPOSED_HEIGHT,
  asRect,
  exposedHeight,
  taskbarVisibility,
  geometryDecision,
  boundsEqual,
};
