const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createVisibilityGate} = require("./visibility");

test("visibility gate filters one-sample shell transitions", () => {
  const gate = createVisibilityGate({hideSamples: 2});
  assert.equal(gate.observe(true).action, "show");
  assert.equal(gate.observe(false, "taskbar-covered").action, null);
  assert.equal(gate.state, "shown");
  const hidden = gate.observe(false, "taskbar-covered");
  assert.equal(hidden.action, "hide");
  assert.equal(hidden.reason, "taskbar-covered");
  assert.equal(gate.observe(false, "taskbar-covered").action, null);
});

test("visibility gate restores immediately after a valid sample", () => {
  const gate = createVisibilityGate({hideSamples: 2, showSamples: 1});
  gate.observe(true);
  gate.observe(false, "taskbar-hidden");
  gate.observe(false, "taskbar-hidden");
  assert.equal(gate.state, "hidden");
  assert.equal(gate.observe(true, "shown").action, "show");
  assert.equal(gate.state, "shown");
});

test("reset clears stale samples after helper restart", () => {
  const gate = createVisibilityGate({hideSamples: 2});
  gate.observe(true);
  gate.observe(false, "taskbar-covered");
  gate.reset();
  assert.equal(gate.state, "unknown");
  assert.deepEqual(gate.samples, {hidden: 0, shown: 0});
  assert.equal(gate.observe(false, "taskbar-hidden").action, null);
  assert.equal(gate.observe(false, "taskbar-hidden").action, "hide");
});
