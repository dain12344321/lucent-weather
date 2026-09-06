const {test} = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function harness(search = async()=>[]) {
  const elements = new Map();
  const node = () => ({children:[],value:"",hidden:false,disabled:false,listeners:{},attributes:{},style:{},dataset:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);},focus(){},scrollIntoView(){}});
  const get = id => {if(!elements.has(id))elements.set(id,node());return elements.get(id);};
  const ctx = {document:{getElementById:get,querySelector:()=>null,createElement:node,createElementNS:node,addEventListener(){},body:{dataset:{}}}, window:{weather:{onUpdate(fn){ctx.update=fn;},onTick(){},settings:async()=>({unit:"F"}),search,hide(){}}}, Hourly:require("./hourly"),Daylight:require("./daylight"),Solar:require("./solar"),Date,Intl,setInterval(){}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve("./renderer.js"),"utf8"),ctx);
  return {ctx,get};
}
test("renderer preserves zero while displaying missing readings as unavailable",()=>{
  const {ctx}=harness();
  for(const value of [null,undefined,"",false,NaN]) {ctx.reading=value;assert.equal(vm.runInContext("value(reading)",ctx),"—");assert.equal(vm.runInContext("finite(reading)",ctx),null);}
  ctx.reading=0;assert.equal(vm.runInContext("value(reading)",ctx),0);assert.equal(vm.runInContext("finite(reading)",ctx),0);
});
test("editing a query discards late search results and permits another search",async()=>{
  let finish;const {get}=harness(()=>new Promise(resolve=>{finish=resolve;}));
  get("query").value="London";
  const pending=get("search-form").onsubmit({preventDefault(){}});
  assert.equal(get("search-button").disabled,true);
  get("query").value="Paris";get("query").listeners.input();
  assert.equal(get("search-button").disabled,false);
  finish([{label:"London, United Kingdom"}]);await pending;
  assert.equal(get("results").children.length,0);
});
test("a failed location change clears the old forecast and enables retry controls",()=>{
  const {ctx,get}=harness();get("results").children.push({disabled:true});
  get("forecast").hidden=false;get("setup").hidden=true;
  ctx.update({error:"Connection unavailable",last:null});
  assert.equal(get("forecast").hidden,true);assert.equal(get("setup").hidden,false);
  assert.equal(get("results").children[0].disabled,false);assert.equal(get("search-button").disabled,false);
  assert.match(get("status").textContent,/Connection/);
});
test("astronomy and hourly inputs cannot manufacture missing events or duplicate hours",()=>{
  const Solar=require("./solar"), Lunar=require("./lunar"), Hourly=require("./hourly"), Daylight=require("./daylight");
  assert.equal(Solar.progress(null,100,50),null);assert.equal(Lunar.normalizePhase(null),null);
  assert.equal(Solar.condition(null),"Unavailable");assert.equal(Daylight.instant("2026-02-30T08:00","UTC"),null);
  const now=Date.parse("2026-09-06T12:00:00Z"),time=now/1000;
  const rows=Hourly.next({time:[time+3600,time,time],temperature_2m:[null,0,99]},now);
  assert.equal(rows.length,2);assert.equal(rows[0].temp,0);assert.equal(rows[1].temp,undefined);
});
