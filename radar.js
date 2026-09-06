/* NOAA observed reflectivity. Map traffic only while this page is visible. */
const Radar = (() => {
  const endpoint =
    "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows";
  let map,
    marker,
    pending,
    place,
    key = "",
    active = false,
    frames = [],
    index = 0,
    overlay,
    playing = false,
    timer,
    imageTimeout,
    refreshed = 0,
    generation = 0,
    fetching = false,
    fetchingKey = "",
    fetchAbort;
  const el = (id) => document.getElementById(id);
  const status = (message) => {
    const node = el("radar-status");
    if (node) node.textContent = message;
  };
  function updateControls() {
    const range = el("radar-time"),
      play = el("radar-play"),
      refresh = el("radar-refresh"),
      ready = frames.length > 0,
      playable = frames.length > 1;
    if (range) {
      range.max = String(Math.max(0, frames.length - 1));
      range.value = String(Math.min(index, Math.max(0, frames.length - 1)));
      range.disabled = !playable;
      range.setAttribute(
        "aria-valuetext",
        ready ? `Frame ${index + 1} of ${frames.length}` : "No radar frames",
      );
    }
    if (play) {
      play.disabled = !playable;
      play.textContent = playing ? "Pause" : "Play";
      play.setAttribute(
        "aria-label",
        playing ? "Pause radar playback" : "Play radar playback",
      );
    }
    if (refresh) refresh.disabled = !place || fetching;
  }
  function stop() {
    playing = false;
    clearTimeout(timer);
    timer = null;
    updateControls();
  }
  function cancelPending() {
    clearTimeout(imageTimeout);
    imageTimeout = null;
    generation++;
    if (pending) {
      pending.remove();
      pending = null;
    }
  }
  function cancelFetch() {
    if (fetchAbort) {
      try {
        fetchAbort.abort();
      } catch {}
      fetchAbort = null;
    }
  }
  function covered() {
    return (
      place &&
      place.latitude >= 20 &&
      place.latitude <= 55 &&
      place.longitude >= -130 &&
      place.longitude <= -60
    );
  }
  function validPlace(value) {
    if (value?.latitude == null || value?.longitude == null || value.latitude === "" || value.longitude === "") return null;
    const latitude = Number(value?.latitude),
      longitude = Number(value?.longitude);
    return Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180
      ? { ...value, latitude, longitude }
      : null;
  }
  function setPlace(value) {
    const nextPlace = validPlace(value);
    if (!nextPlace) {
      place = null;
      key = "";
      cancelFetch();
      cancelPending();
      stop();
      frames = [];
      index = 0;
      updateControls();
      status("Radar location unavailable.");
      return;
    }
    const nextKey = nextPlace.latitude + "," + nextPlace.longitude;
    place = nextPlace;
    if (nextKey === key) return;
    key = nextKey;
    cancelFetch();
    cancelPending();
    stop();
    frames = [];
    index = 0;
    refreshed = 0;
    updateControls();
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (map) {
      marker?.setLatLng([place.latitude, place.longitude]);
      map.setView([place.latitude, place.longitude], 7);
    }
    if (active) activate();
  }
  function init() {
    if (map || !place) return;
    map = L.map("radar-map", {
      scrollWheelZoom: false,
      attributionControl: true,
      zoomControl: true,
      minZoom: 4,
      maxZoom: 10,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      keepBuffer: 0,
    }).addTo(map);
    map.on("moveend", () => {
      stop();
      if (active && frames.length) showFrame(index);
    });
    map.setView([place.latitude, place.longitude], 7);
    marker = L.circleMarker(
      [place.latitude, place.longitude],
      {
        radius: 5,
        color: "#163d60",
        weight: 2,
        fillColor: "#fff",
        fillOpacity: 1,
      },
    ).addTo(map);
  }
  function parseFrames(xml) {
    const dimension = [...xml.getElementsByTagName("Dimension")].find(
      (node) => node.getAttribute("name") === "time",
    );
    return (dimension?.textContent || "")
      .split(",")
      .map((value) => value.trim())
      .map((value) => ({ value, time: Date.parse(value) }))
      .filter((entry) => Number.isFinite(entry.time))
      .sort((a, b) => a.time - b.time)
      .filter((entry, i, all) => i === 0 || entry.time !== all[i - 1].time)
      .map((entry) => entry.value);
  }
  function sampleFrames(times) {
    const sampled = times.filter((_, i) => i % 5 === 0);
    if (times.length && sampled.at(-1) !== times.at(-1)) sampled.push(times.at(-1));
    return sampled;
  }
  async function activate() {
    if (!place || !active || document.hidden) return;
    init();
    map?.invalidateSize();
    if (!covered()) {
      stop();
      status("Radar covers the contiguous U.S.; forecast works worldwide.");
      return;
    }
    if (fetching) return;
    if (Date.now() - refreshed < 300000 && frames.length) {
      updateControls();
      showFrame(index);
      return;
    }
    fetching = true;
    fetchingKey = key;
    const token = key,
      controller =
        typeof AbortController === "function" ? new AbortController() : null;
    fetchAbort = controller;
    updateControls();
    status("Loading NOAA radar…");
    let timeout, timedOut = false;
    try {
      if (controller) timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
      const signal = controller?.signal || AbortSignal.timeout(15000);
      const response = await fetch(
        endpoint + "?service=WMS&request=GetCapabilities",
        { signal },
      );
      if (!response.ok) throw Error("Radar service unavailable");
      const xml = new DOMParser().parseFromString(
        await response.text(),
        "text/xml",
      );
      const times = parseFrames(xml);
      if (!times.length) throw Error("No radar frames available");
      if (token !== key) return;
      frames = sampleFrames(times);
      index = frames.length - 1;
      refreshed = Date.now();
      updateControls();
      if (active && !document.hidden) showFrame(index);
    } catch (error) {
      const aborted = error?.name === "AbortError";
      if (token === key && active && (!aborted || timedOut))
        status(timedOut ? "Radar request timed out · use ↻ to retry" : "Radar unavailable · use ↻ to retry. " + error.message);
    } finally {
      clearTimeout(timeout);
      if (fetchingKey === token) {
        fetching = false;
        fetchingKey = "";
        fetchAbort = null;
      }
      updateControls();
      if (token !== key && active) activate();
    }
  }
  function showFrame(value) {
    if (!active || document.hidden || !frames.length || !covered() || !map)
      return;
    clearTimeout(timer);
    cancelPending();
    const frameIndex = Math.max(
        0,
        Math.min(Number(value) || 0, frames.length - 1),
      ),
      frame = frames[frameIndex],
      ticket = ++generation,
      bounds = map.getBounds(),
      sw = L.CRS.EPSG3857.project(bounds.getSouthWest()),
      ne = L.CRS.EPSG3857.project(bounds.getNorthEast()),
      size = map.getSize(),
      query = new URLSearchParams({
        service: "WMS",
        version: "1.1.1",
        request: "GetMap",
        layers: "conus_bref_qcd",
        styles: "",
        format: "image/png",
        transparent: "true",
        srs: "EPSG:3857",
        bbox: [sw.x, sw.y, ne.x, ne.y].join(","),
        width: String(Math.max(1, Math.round(size.x))),
        height: String(Math.max(1, Math.round(size.y))),
        time: frame,
      }),
      next = L.imageOverlay(endpoint + "?" + query, bounds, {
        opacity: 0.7,
        interactive: false,
      });
    index = frameIndex;
    updateControls();
    status("Loading radar frame…");
    next.on("load", () => {
      if (ticket !== generation || !active) {
        next.remove();
        return;
      }
      clearTimeout(imageTimeout);
      imageTimeout = null;
      if (overlay) overlay.remove();
      overlay = next;
      pending = null;
      const latest = Date.parse(frames.at(-1)),
        age = Number.isFinite(latest)
          ? Math.max(0, Math.round((Date.now() - latest) / 60000))
          : null;
      status(
        new Date(frame).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }) +
          " · observed" +
          (age === null
            ? " · latest age unavailable"
            : age > 20
              ? " · delayed, latest " + age + " min old"
              : " · latest " + age + " min ago"),
      );
      if (playing)
        timer = setTimeout(() => showFrame((index + 1) % frames.length), 900);
    });
    const failed = () => {
      next.remove();
      if (ticket !== generation) return;
      cancelPending();
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
      stop();
      status("Radar image unavailable · use ↻ to retry");
    };
    next.on("error", failed);
    imageTimeout = setTimeout(failed, 15000);
    pending = next;
    next.addTo(map);
  }
  new IntersectionObserver(
    (entries) => {
      active = Boolean(entries[0]?.isIntersecting);
      if (active) activate();
      else {
        stop();
        cancelPending();
        cancelFetch();
      }
    },
    { threshold: 0.3 },
  ).observe(el("radar-map"));
  el("radar-play").onclick = () => {
    if (playing) {
      stop();
      return;
    }
    if (frames.length < 2) return;
    playing = true;
    updateControls();
    showFrame((index + 1) % frames.length);
  };
  el("radar-time").oninput = (event) => {
    stop();
    showFrame(Number(event.target.value));
  };
  el("radar-refresh").onclick = () => {
    if (fetching) return;
    stop();
    refreshed = 0;
    activate();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
      cancelPending();
      cancelFetch();
    } else if (active) activate();
  });
  setInterval(() => {
    if (active && !document.hidden) activate();
  }, 300000);
  updateControls();
  return { setPlace };
})();
