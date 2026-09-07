const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, screen } = require("electron");
const { tileBounds } = require("./placement");
module.exports = async function runQA(ctx) {
  const { qa, win, dock, secondary, json, label, show, refresh, setPosition, setScreens, configPath, diagnostics, setConfig, setSelectedDock } = ctx;
      try {
        const places = await json(
          "https://geocoding-api.open-meteo.com/v1/search?name=London&count=8&language=en&format=json",
        );
        const p =
          places.results?.find((p) => p.country_code === "GB") ||
          places.results?.[0];
        if (!p) throw Error("No live location results");
        setConfig({
          place: {
            name: p.name,
            label: label(p),
            latitude: p.latitude,
            longitude: p.longitude,
            timezone: p.timezone,
          },
          unit: "F",
          position: "left",
          screens: "all",
        });
        show();
        await refresh();
        if (!ctx.last) throw Error("Live forecast failed");
        await new Promise((r) => setTimeout(r, 2300));
        const result = await win.webContents.executeJavaScript(
          `({temperature:document.getElementById('temperature').textContent,sunrise:document.getElementById('sunrise').textContent,sunset:document.getElementById('sunset').textContent,days:document.getElementById('days').children.length,visible:!document.getElementById('forecast').hidden,scrollHeight:document.body.scrollHeight,viewport:innerHeight,headerTop:document.querySelector("header").getBoundingClientRect().top})`,
        );
        if (!result.visible || result.days !== 7 || result.sunrise === "—" || result.headerTop < 0)
          throw Error("Rendered forecast check failed");
        fs.mkdirSync(qa, { recursive: true });
        fs.writeFileSync(
          path.join(qa, "runtime-test.json"),
          JSON.stringify(
            { passed: true, place: ctx.config.place, result },
            null,
            2,
          ),
        );
        fs.writeFileSync(
          path.join(qa, "weather-preview.png"),
          (await win.webContents.capturePage()).toPNG(),
        );
        const placementChecks={};
        setPosition("left");
        await new Promise(r=>setTimeout(r,900));
        placementChecks.left=dock.getBounds().x===ctx.geometry.taskbar.x+8;
        setPosition("tray");
        await new Promise(r=>setTimeout(r,900));
        placementChecks.tray=dock.getBounds().x===tileBounds(ctx.geometry.taskbar,ctx.geometry.tray,"tray").x;
        setScreens("all");
        await new Promise(r=>setTimeout(r,2500));
        placementChecks.secondary=secondary.diagnostics();
        placementChecks.expected=ctx.secondaryBars.length;
        placementChecks.persisted=JSON.parse(fs.readFileSync(configPath(),"utf8"));
        if(!placementChecks.left || !placementChecks.tray || placementChecks.secondary.length!==placementChecks.expected || placementChecks.secondary.some(x=>x.taskbarExposed&&!x.visible)) throw Error("Placement or multi-screen regression");
        fs.writeFileSync(path.join(qa,"placement-test.json"),JSON.stringify(placementChecks,null,2));
        if(placementChecks.secondary.length) {
          const bounds=placementChecks.secondary[0].bounds;
          setSelectedDock(BrowserWindow.getAllWindows().find(w=>w!==win && w.getBounds().x===bounds.x && w.getBounds().y===bounds.y));
          if(!ctx.selectedDock)throw Error("Missing secondary tile window");
          show();
          if(screen.getDisplayMatching(win.getBounds()).id!==screen.getDisplayMatching(bounds).id)throw Error("Forecast opened on wrong screen");
        }
        setScreens("primary");
        setSelectedDock(dock);
        if(secondary.diagnostics().length)throw Error("Secondary tiles not removed");
        show();
        await dock.webContents.executeJavaScript('document.getElementById("widget").focus();document.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true}))');
        await new Promise(r=>setTimeout(r,900));
        const menuReset=await dock.webContents.executeJavaScript('({cleared:document.getElementById("widget").classList.contains("menu-dismissed"),blurred:document.activeElement!==document.getElementById("widget"),background:getComputedStyle(document.getElementById("widget")).backgroundColor})');
        if(!menuReset.cleared||!menuReset.blurred||menuReset.background!=="rgba(0, 0, 0, 0)")throw Error("Menu dismissal highlight regression");
        fs.writeFileSync(path.join(qa,"menu-dismissal-test.json"),JSON.stringify(menuReset,null,2));
        show();
        const night = await win.webContents.executeJavaScript(`
          (() => {
            render(state, {now:new Date(Daylight.instant(Daylight.localDate(new Date(),state.data.timezone)+"T23:00",state.data.timezone)).toISOString()});
            return {moonVisible:!document.getElementById("night-details").hidden,solarHidden:document.getElementById("solar-detail").hidden,countdown:document.getElementById("next-event").textContent};
          })()
        `);
        if(!night.moonVisible || !night.solarHidden || !night.countdown.startsWith("Sunrise in")) throw Error("Night card regression");
        fs.writeFileSync(path.join(qa,"dynamic-night-test.json"),JSON.stringify(night,null,2));
        await new Promise(r=>setTimeout(r,700));
        fs.writeFileSync(path.join(qa,"dynamic-night-preview.png"),(await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript("render(state)");
        const refinement = await win.webContents.executeJavaScript(`
          (async()=>{
            const page=document.getElementById('outlook-page');
            const first=document.getElementById('now-page');
            const result={firstHeight:first.offsetHeight, viewport:document.querySelector('main').clientHeight, days:document.getElementById('days').children.length};
            Radar.setPlace({latitude:41.2,longitude:-86.6});
            scrollToPage('outlook-page','instant');
            await new Promise(r=>setTimeout(r,12000));
            result.headerTop=document.querySelector("header").getBoundingClientRect().top;
            result.radar=document.getElementById('radar-status').textContent;
            result.images=document.querySelectorAll('.leaflet-image-layer').length;
            result.pageTop=Math.round(page.getBoundingClientRect().top-document.querySelector('main').getBoundingClientRect().top);
            return result;
          })()
        `);
        if(refinement.headerTop<0 || refinement.days!==7 || Math.abs(refinement.pageTop)>2 || refinement.firstHeight>refinement.viewport+2) throw Error("Two-page layout regression: "+JSON.stringify(refinement));
        fs.writeFileSync(path.join(qa,"refinement-test.json"),JSON.stringify(refinement,null,2));
        fs.writeFileSync(path.join(qa,"outlook-preview.png"),(await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript("scrollToPage('now-page','instant')");
        for (let i = 0; i < 20 && !ctx.geometry?.taskbar; i++)
          await new Promise((r) => setTimeout(r, 2300));
        if (!ctx.geometry?.taskbar)
          throw Error("Taskbar geometry was not observed");
        fs.writeFileSync(
          path.join(qa, "taskbar-test.json"),
          JSON.stringify({ geometry: ctx.geometry, widget: dock.getBounds() }, null, 2),
        );
        dock.show();
        await new Promise((r) => setTimeout(r, 1200));
        fs.writeFileSync(
          path.join(qa, "widget-preview.png"),
          (
            await dock.webContents.capturePage(undefined, {
              stayHidden: true,
              stayAwake: true,
            })
          ).toPNG(),
        );
        fs.writeFileSync(
          path.join(qa, "visibility-test.json"),
          JSON.stringify(
            { visible: dock.isVisible(), bounds: dock.getBounds(), geometry: ctx.geometry },
            null,
            2,
          ),
        );
        const { desktopCapturer } = require("electron");
        const display = screen.getPrimaryDisplay();
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: {
            width: Math.round(display.size.width * display.scaleFactor),
            height: Math.round(display.size.height * display.scaleFactor),
          },
        });
        const source = sources.find((s) => s.display_id === String(display.id));
        if (source) {
          const size = source.thumbnail.getSize();
          fs.writeFileSync(
            path.join(qa, "taskbar-preview.png"),
            source.thumbnail
              .crop({
                x: 0,
                y: size.height - Math.round(64 * display.scaleFactor),
                width: Math.round(350 * display.scaleFactor),
                height: Math.round(64 * display.scaleFactor),
              })
              .toPNG(),
          );
        }
        for (const [name, code, day] of [
          ["night", 0, 0],
          ["rain", 63, 1],
          ["snow", 73, 1],
        ]) {
          await win.webContents.executeJavaScript(
            `render({...state,data:{...state.data,current:{...state.data.current,weather_code:${code},is_day:${day}}}})`,
          );
          await new Promise((r) => setTimeout(r, 600));
          fs.writeFileSync(
            path.join(qa, name + "-preview.png"),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
        const moonChecks = [];
        for (const [name, phase] of [
          ["new", 0],
          ["waxing-crescent", 0.125],
          ["first-quarter", 0.25],
          ["waxing-gibbous", 0.375],
          ["full", 0.5],
          ["waning-gibbous", 0.625],
          ["last-quarter", 0.75],
          ["waning-crescent", 0.875],
        ]) {
          await win.webContents.executeJavaScript(
            `render({...state,data:{...state.data,current:{...state.data.current,weather_code:0,is_day:0}}},{phase:'night',moonPhase:${phase}})`,
          );
          await new Promise((r) => setTimeout(r, 200));
          const check = await win.webContents.executeJavaScript(
            `({name:document.getElementById('moon-name').textContent,detail:document.getElementById('moon-detail').textContent,height:document.body.scrollHeight,viewport:innerHeight})`,
          );
          if (check.name === "—" || check.height > check.viewport)
            throw Error("Lunar card missing or overflow");
          moonChecks.push({ phase, ...check });
          fs.writeFileSync(
            path.join(qa, "moon-" + name + ".png"),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
        fs.writeFileSync(
          path.join(qa, "moon-tests.json"),
          JSON.stringify(moonChecks, null, 2),
        );
        const sceneChecks = [];
        for (const [name, code, phase] of [
          ["sunrise", 0, "sunrise"],
          ["sunset", 0, "sunset"],
          ["night-clear", 0, "night"],
          ["night-storm", 95, "night"],
          ["light-rain", 61, "day"],
          ["heavy-rain", 65, "day"],
          ["night-rain", 63, "night"],
          ["drizzle", 51, "day"],
          ["snow-heavy", 75, "night"],
          ["fog", 45, "day"],
          ["freezing-rain", 67, "night"],
          ["hail", 99, "night"],
          ["partly-cloudy", 2, "day"],
          ["overcast", 3, "day"],
        ]) {
          await win.webContents.executeJavaScript(
            `render({...state,data:{...state.data,current:{...state.data.current,weather_code:${code},is_day:${phase === "night" ? 0 : 1}}}},{phase:${JSON.stringify(phase)}})`,
          );
          await new Promise((r) => setTimeout(r, 200));
          const actual = await win.webContents.executeJavaScript(
            `({...document.body.dataset})`,
          );
          if (actual.phase !== phase) throw Error("Wrong phase for " + name);
          sceneChecks.push({ name, code, ...actual });
          fs.writeFileSync(
            path.join(qa, "scene-" + name + ".png"),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
        fs.writeFileSync(
          path.join(qa, "scene-tests.json"),
          JSON.stringify(sceneChecks, null, 2),
        );
        const assert = require("node:assert/strict");
        const hourlyCheck = await win.webContents.executeJavaScript(
          `(() => { const buttons = document.querySelectorAll(".hour"); if (buttons.length !== 24) throw Error("Expected 24 hourly forecasts"); buttons[3].click(); return {count: buttons.length, selected: buttons[3].getAttribute("aria-pressed"), detail: document.getElementById("hour-detail").textContent}; })()`,
        );
        assert.equal(hourlyCheck.selected, "true");
        assert.match(hourlyCheck.detail, /Feels like/);
        fs.writeFileSync(
          path.join(qa, "hourly-test.json"),
          JSON.stringify(hourlyCheck, null, 2),
        );
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 5; i++) {
          show();
          await sleep(250);
          assert.equal(
            win.isVisible(),
            true,
            "Flyout is actually visible after opening",
          );
          assert.equal(win.isFocused(), true, "Flyout receives focus");
          win.hide();
          await sleep(100);
          assert.equal(dock.isVisible(), true);
        }
        // Keep our own foreground panel open: closing the final cycle can
        // reactivate a fullscreen app, where a recovered tile must stay hidden.
        show();
        await sleep(1500);
        assert.equal(dock.isVisible(), true, "Taskbar exposed before recovery checks");
        dock.webContents.forcefullyCrashRenderer();
        await sleep(2000);
        assert.equal(dock.webContents.isCrashed(), false);
        assert.match(
          await dock.webContents.executeJavaScript(
            "document.getElementById('temp').textContent",
          ),
          /°/,
        );
        const helperBefore = diagnostics().helperPid;
        assert.ok(helperBefore, "Primary helper has a process");
        process.kill(helperBefore);
        await sleep(3200);
        assert.ok(diagnostics().helperPid && diagnostics().helperPid !== helperBefore, "Primary helper restarts after exit");
        assert.equal(dock.isVisible(), true, "Primary tile returns after helper recovery");
        const stabilityChecks = [];
        setScreens("all");
        await sleep(2500);
        for (const tile of BrowserWindow.getAllWindows().filter(w => w !== win)) {
          const overlay = new BrowserWindow({show:false, frame:false, transparent:true, skipTaskbar:true, focusable:false, webPreferences:{sandbox:true}});
          let hides = 0;
          const onHide = () => hides++;
          try {
            await overlay.loadURL("data:text/html,<body style='margin:0;background:transparent'></body>");
            overlay.setBounds(tile.getBounds());
            overlay.setIgnoreMouseEvents(true);
            overlay.setAlwaysOnTop(true, "screen-saver");
            overlay.showInactive();
            tile.moveTop();
            tile.on("hide", onHide);
            for (let i=0;i<24;i++) {
              await sleep(250);
              assert.equal(tile.isVisible(), true, "Click-through overlay must not cause taskbar flashing");
            }
            assert.equal(hides, 0, "No hide/show oscillation behind click-through overlay");
            stabilityChecks.push({bounds:tile.getBounds(),samples:24,hides});
          } finally { tile.removeListener("hide", onHide); overlay.destroy(); }
        }
        fs.writeFileSync(path.join(qa,"taskbar-stability-tests.json"),JSON.stringify(stabilityChecks,null,2));
        const fullscreenChecks = [];
        setScreens("all");
        await sleep(2500);
        for (const display of screen.getAllDisplays()) {
          const primary = display.id === screen.getPrimaryDisplay().id;
          const targetVisible = () => primary ? dock.isVisible() : secondary.diagnostics()
            .filter(entry => screen.getDisplayMatching(entry.bounds).id === display.id)
            .some(entry => entry.visible);
          if (!primary && !secondary.diagnostics().some(entry => screen.getDisplayMatching(entry.bounds).id === display.id)) continue;
          show();
          await sleep(1200);
          assert.equal(targetVisible(), true, "Taskbar tile ready before fullscreen");
          win.hide();
          const mock = new BrowserWindow({show:false, frame:false, skipTaskbar:true, title:"Lucent Weather fullscreen QA", backgroundColor:"#102039", webPreferences:{sandbox:true,partition:"qa-video"}});
          try {
            await mock.loadURL("data:text/html," + encodeURIComponent('<html><body style="margin:0;background:#102039;color:white;font:24px sans-serif"><canvas id="c" width="640" height="360" hidden></canvas><video id="v" autoplay muted style="width:100%;height:100%;object-fit:contain"></video></body></html>'));
            mock.setBounds({x:display.bounds.x+40,y:display.bounds.y+40,width:640,height:400});
            mock.show();
            mock.focus();
            await Promise.race([mock.webContents.executeJavaScript(`(async()=>{
              const c=document.getElementById('c'), x=c.getContext('2d'), v=document.getElementById('v');
              let n=0; setInterval(()=>{x.fillStyle='#102039';x.fillRect(0,0,640,360);x.fillStyle='#ffdb7b';x.fillRect((n++*5)%640,100,80,80);x.fillStyle='white';x.font='24px sans-serif';x.fillText('Lucent Weather fullscreen video verification',35,270);},80);
              v.srcObject=c.captureStream(12);await v.play();await v.requestFullscreen();
            })()`, true), sleep(10000).then(()=>{throw Error("HTML video fullscreen request timed out");})]);
            await sleep(2400);
            const video = await mock.webContents.executeJavaScript("({fullscreen:!!document.fullscreenElement,playing:!v.paused,time:v.currentTime,width:v.videoWidth})");
            assert.equal(video.fullscreen,true);assert.equal(video.playing,true);assert.ok(video.time>0 && video.width>0);
            assert.equal(targetVisible(),false,"Hide tile during HTML video fullscreen");
            assert.equal(mock.isFocused(),true,"Taskbar watcher must not steal focus from video");
            await mock.webContents.executeJavaScript("document.exitFullscreen()");
            await sleep(1800);
            assert.equal(targetVisible(),true,"Tile returns after exiting video fullscreen");
            // Also test a borderless topmost player without the Fullscreen API.
            mock.setBounds(display.bounds);mock.setAlwaysOnTop(true,"screen-saver");mock.focus();
            await sleep(2400);
            assert.equal(targetVisible(),false,"Hide tile under a borderless fullscreen player");
            fullscreenChecks.push({displayId:display.id,primary,video,htmlVideoHideAndReturn:true,borderlessHidden:true});
          } finally { mock.destroy(); }
          show();await sleep(1800);
          assert.equal(targetVisible(),true,"Recover after fullscreen player closes");
        }
        const secondaryFullscreenHideAndReturn = fullscreenChecks.some(check=>!check.primary) ? true : null;
        fs.writeFileSync(path.join(qa,"fullscreen-video-tests.json"),JSON.stringify(fullscreenChecks,null,2));
        fs.writeFileSync(
          path.join(qa, "interaction-tests.json"),
          JSON.stringify(
            {
              passed: true,
              openCloseCycles: 5,
              rendererRecovery: true,
              helperRecovery: true,
              fullscreenHideAndReturn: true,
              secondaryFullscreenHideAndReturn,
            },
            null,
            2,
          ),
        );
        app.quit();
      } catch (e) {
        fs.mkdirSync(qa, { recursive: true });
        fs.writeFileSync(
          path.join(qa, "runtime-test.json"),
          JSON.stringify({
            passed: false,
            error: e.stack,
            diagnostics: diagnostics(),
          }),
        );
        app.exit(1);
      }

};
