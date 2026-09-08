const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {app, BrowserWindow, screen} = require("electron");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = async function taskbarQA(ctx) {
  const {qa, win, dock, secondary, show, setScreens, diagnostics} = ctx;
  const results = [];
  let mock;
  try {
    fs.mkdirSync(qa, {recursive:true});
    setScreens("all");
    show();
    await sleep(2500);
    for (const tile of BrowserWindow.getAllWindows().filter(w => w !== win)) {
      const bounds = tile.getBounds(), display = screen.getDisplayMatching(bounds);
      const initial = diagnostics();
      const blocked = display.id === screen.getPrimaryDisplay().id ? initial.geometry?.fullscreenBlocked :
        initial.secondary.find(entry => screen.getDisplayMatching(entry.bounds).id === display.id)?.fullscreenBlocked;
      if (blocked) { results.push({displayId:display.id,skipped:"External fullscreen window covers taskbar"}); continue; }
      mock = new BrowserWindow({show:false,frame:false,skipTaskbar:true,backgroundColor:"#20354c",webPreferences:{sandbox:true}});
      await mock.loadURL("data:text/html,<body style='color:white;font:20px sans-serif'>Lucent Weather ordinary-window visibility test</body>");
      const check = {displayId:display.id, bounds, hides:0, samples:0};
      const onHide = () => check.hides++;
      tile.on("hide", onHide);
      try {
        // An ordinary window can overlap the taskbar without being fullscreen.
        // v0.9.1 hides the tile here even though this is routine desktop use.
        mock.setBounds({x:Math.max(display.bounds.x,bounds.x-100),y:bounds.y-230,width:600,height:280});
        mock.show(); mock.focus();
        assert.equal(mock.isFocused(),true,"QA ordinary window received focus");
        for (let cycle=0;cycle<6;cycle++) {
          if(cycle%2) show(); else mock.focus();
          for (let sample=0;sample<6;sample++) {
            await sleep(250);
            check.samples++;
            assert.equal(tile.isVisible(),true,"Ordinary overlapping windows must never hide the taskbar tile");
          }
        }
        mock.setBounds(display.workArea); mock.focus();
        await sleep(1800);
        assert.equal(tile.isVisible(),true,"Maximized work-area window keeps the tile visible");
        check.maximizedVisible = true;
        assert.equal(check.hides,0,"No visibility transitions during normal window switching");
        fs.writeFileSync(path.join(qa,`tile-${display.id}.png`),(await tile.webContents.capturePage()).toPNG());
      } finally { tile.removeListener("hide",onHide); }
      if (process.argv.includes("--qa-desktop-only")) {
        results.push(check);
        mock.destroy(); mock = null;
        continue;
      }
      // Only a foreground window filling this entire display should hide it.
      const otherTiles = BrowserWindow.getAllWindows().filter(w => w !== win && w !== mock && w !== tile).map(w => ({window:w, visible:w.isVisible()}));
      mock.setBounds(display.bounds); mock.setAlwaysOnTop(true,"pop-up-menu"); mock.focus();
      await sleep(1800);
      assert.equal(tile.isVisible(),false,"Foreground fullscreen window hides only its monitor's tile");
      for(const other of otherTiles) {
        assert.equal(other.window.isVisible(),other.visible,"Fullscreen on this monitor must not change the other monitor");
      }
      check.fullscreenHidden = true;
      show(); await sleep(1800);
      assert.equal(tile.isVisible(),false,"Dialog focus must not expose a tile over background fullscreen");
      check.dialogOverFullscreenHidden = true;
      mock.minimize(); await sleep(1800);
      assert.equal(tile.isVisible(),true,"Minimizing fullscreen restores the taskbar tile");
      check.minimizedFullscreenVisible = true;
      mock.destroy(); mock = null;
      results.push(check);
    }
    fs.writeFileSync(path.join(qa,"taskbar-window-switching.json"),JSON.stringify({passed:true,results,diagnostics:diagnostics()},null,2));
    app.quit();
  } catch(error) {
    fs.writeFileSync(path.join(qa,"taskbar-window-switching.json"),JSON.stringify({passed:false,error:error.stack,results,diagnostics:diagnostics()},null,2));
    if(mock&&!mock.isDestroyed())mock.destroy();
    app.exit(1);
  }
};
