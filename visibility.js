function createVisibilityGate(options = {}) {
  const hideSamples = Math.max(1, options.hideSamples ?? 2);
  const showSamples = Math.max(1, options.showSamples ?? 2);
  let state = "unknown";
  let hidden = 0;
  let shown = 0;
  let lastReason = "unobserved";

  function observe(isVisible, reason = isVisible ? "shown" : "unknown") {
    lastReason = reason;
    if (isVisible) {
      hidden = 0;
      shown += 1;
      if (shown >= showSamples && state !== "shown") {
        state = "shown";
        return {action: "show", state, reason, hidden, shown};
      }
    } else {
      shown = 0;
      hidden += 1;
      if (hidden >= hideSamples && state !== "hidden") {
        state = "hidden";
        return {action: "hide", state, reason, hidden, shown};
      }
    }
    return {action: null, state, reason, hidden, shown};
  }

  function reset(nextState = "unknown") {
    state = nextState;
    hidden = 0;
    shown = 0;
    lastReason = "unobserved";
  }

  return {
    observe,
    reset,
    get state() {
      return state;
    },
    get lastReason() {
      return lastReason;
    },
    get samples() {
      return {hidden, shown};
    },
  };
}

module.exports = {createVisibilityGate};
