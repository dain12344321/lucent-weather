/* All coordinates are device-independent pixels. */
function tileBounds(bar, tray, position) {
  const left = bar.x + 8, right = bar.x + bar.width - 212;
  const trayValid = tray && tray.width > 0 && tray.x > bar.x && tray.x < bar.x + bar.width;
  // If Explorer does not expose its tray bounds, retain a generous tray margin.
  const target = trayValid ? tray.x - 212 : bar.x + bar.width - 524;
  return {x:Math.round(position === "tray" ? Math.max(left,Math.min(right,target)) : left),
    y:Math.round(bar.y+(bar.height-44)/2),width:204,height:44};
}
module.exports = {tileBounds};
