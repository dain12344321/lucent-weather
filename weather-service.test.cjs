const {test} = require("node:test");
const assert = require("node:assert/strict");
const {fetchWeather,normalizeConfig} = require("./weather-service.cjs");
const config = normalizeConfig({place:{name:"Fixture",latitude:0,longitude:0,timezone:"UTC"},unit:"C"});
function daily() { return {current:{temperature_2m:0},timezone:"UTC",daily:Object.fromEntries(["time","weather_code","temperature_2m_max","temperature_2m_min","sunrise","sunset","precipitation_probability_max"].map(k=>[k,Array(8).fill(k==="time"?"2026-09-06":null)]))}; }
test("forecast calls start together, keep zero temperatures and tolerate unavailable optional providers",async()=>{
  const calls=[];
  const pending=fetchWeather(config,url=>new Promise((resolve,reject)=>calls.push({url,resolve,reject})));
  assert.equal(calls.length,3,"independent requests should not wait for each other");
  for (const call of calls) {const url=new URL(call.url);assert.equal(url.searchParams.get("latitude"),"0");if(url.hostname==="api.open-meteo.com")assert.equal(url.searchParams.get("temperature_unit"),"celsius");}
  calls[0].resolve(daily()); calls[1].reject(Error("offline"));calls[2].resolve({error:true});
  const result=await pending;assert.equal(result.current.temperature_2m,0);assert.equal(result.hourly,null);assert.equal(result.air,null);assert.match(result.hourlyError,/unavailable/);
});
test("incomplete core data and invalid timezones cannot replace a good forecast",async()=>{
  await assert.rejects(fetchWeather(config,async()=>({current:{temperature_2m:20},daily:{time:[]}})),/Incomplete/);
  await assert.rejects(fetchWeather(config,async()=>({...daily(),timezone:"invalid/zone"})),/timezone/);
});
test("settings recovery rejects invalid coordinates and preserves supported preferences",()=>{
  assert.equal(normalizeConfig(null).unit,"F");assert.equal(normalizeConfig({place:{name:"Bad",latitude:91,longitude:0}}).place,undefined);
  assert.deepEqual(normalizeConfig({...config,position:"left",screens:"all"}),{...config,position:"left",screens:"all"});
  assert.equal(normalizeConfig({...config,place:{...config.place,timezone:"invalid/zone"}}).place.timezone,"UTC");
});
