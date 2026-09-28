// P06 Your Dates logic checks, updated in P07 R1 for the approved flow:
// Dates 2 now continues to Your Profile (32 connected steps), no longer ends.
const { ok, eq, lib, done } = require('./_setup');
const D = lib('yourDates.ts');
const F = lib('previewFlow.ts');
const B = lib('basics.ts');
const C = lib('compatibility.ts');
const L = lib('yourLife.ts');
const W = lib('yourWorld.ts');
const P = lib('yourProfile.ts');
// copy
ok(eq(D.DATES_SCREENS,[{title:'Your ideal first date?',helper:'Pick 1 or 2.'},{title:'When are you free?',helper:'For a first date.'}]),'screen copy');
ok(eq(D.DATE_TYPES.map(t=>t.label),['Coffee','Drinks','Dinner','A fun activity','A walk','Outdoors']),'labels row-major');
ok(eq(D.DATE_TYPES.map(t=>t.key),['coffee','drinks','dinner','activity','walk','outdoors']),'canonical keys');
ok(D.SPOT_TITLE==='Have a favorite spot?'&&D.SPOT_HELPER==='For a first date. Optional.'&&D.SPOT_PLACEHOLDER==='Enter a place name','spot copy');
ok(D.SUMMARY_HELPER==='Choose the exact time together.','summary helper');
ok(!JSON.stringify(D).toLowerCase().includes('fine')&&!JSON.stringify(D.DATE_TYPES).includes('cozy'),'no dinner vibe');
// empty defaults
const E=D.EMPTY_DATES_DRAFT;ok(eq(E,{dateTypes:[],spotText:'',days:null,time:null}),'no defaults');
ok(!D.isDatesStepValid(1,E),'0 types invalid');ok(!D.isDatesStepValid(2,E),'screen2 empty invalid');
// min/max
let t=D.toggleDateType([],'coffee');ok(eq(t,['coffee'])&&D.isDatesStepValid(1,{...E,dateTypes:t}),'1 valid');
t=D.toggleDateType(t,'dinner');ok(eq(t,['coffee','dinner'])&&D.isDatesStepValid(1,{...E,dateTypes:t}),'2 valid');
const t3=D.toggleDateType(t,'walk');ok(eq(t3,['coffee','dinner']),'3rd refused, no replace');
ok(eq(D.toggleDateType(t,'coffee'),['dinner']),'deselect');
ok(eq(D.toggleDateType([],'bogus'),[]),'unknown key refused');
ok(!D.isDatesStepValid(1,{...E,dateTypes:['coffee','dinner','walk']}),'3 invalid');
ok(!D.isDatesStepValid(1,{...E,dateTypes:['x']}),'unknown invalid');
// venue
ok(!D.isDatesStepValid(1,{...E,spotText:'Kronotrop'}),'venue does not satisfy types');
ok(D.favoriteSpot({...E,spotText:''})===null,'empty spot none');
ok(D.favoriteSpot({...E,spotText:'   \t '})===null,'whitespace spot none');
ok(eq(D.favoriteSpot({...E,spotText:'  kronotrop Karaköy '}),{source:'custom',displayName:'kronotrop Karaköy'}),'spot keeps case/spelling, trims');
const sp=D.favoriteSpot({...E,spotText:'Moda Sahil'});ok(eq(Object.keys(sp).sort(),['displayName','source']),'no fabricated id/coords/address');
ok(D.isDatesStepValid(1,{...E,dateTypes:['coffee','dinner'],spotText:'Moda'}),'coffee+dinner one spot string');
ok(D.SPOT_MAX_LENGTH===120,'maxLength 120');
// screen 2
ok(!D.isDatesStepValid(2,{...E,days:'weekends'}),'days only invalid');
ok(!D.isDatesStepValid(2,{...E,time:'evening'}),'time only invalid');
ok(D.isDatesStepValid(2,{...E,days:'weekends',time:'daytime'}),'both valid');
ok(D.isDatesStepValid(2,{...E,days:'either',time:'either'}),'either/either valid');
ok(!D.isDatesStepValid(2,{...E,days:'daytime',time:'weekends'}),'cross-group keys invalid');
ok(D.datesSummary(E)===null&&D.datesSummary({...E,days:'weekends'})===null,'no summary until both');
ok(D.datesSummary({...E,days:'weekends',time:'daytime'})==='Weekends · Daytime','summary');
ok(D.datesSummary({...E,days:'either',time:'evening'})==='Any day · Evening','any day');
ok(D.datesSummary({...E,days:'weekdays',time:'either'})==='Weekdays · Any time','any time');
ok(D.datesSummary({...E,days:'weekends',time:'evening'})==='Weekends · Evening','summary updates');
// flow
const all=[];let p=F.FIRST_POS;while(p){all.push(p);p=F.nextPos(p);}
ok(all.length===32,'32 steps (got '+all.length+')');
ok(eq(F.nextPos({section:'yourWorld',step:6}),{section:'yourDates',step:1}),'World6 -> Dates1');
ok(eq(F.prevPos({section:'yourDates',step:1}),{section:'yourWorld',step:6}),'Dates1 back -> World6');
ok(eq(F.prevPos({section:'yourDates',step:2}),{section:'yourDates',step:1}),'Dates2 back -> Dates1');
ok(eq(F.nextPos({section:'yourDates',step:2}),{section:'yourProfile',step:1}),'Dates2 -> Your Profile 1 (was the end in P06)');
ok(eq(F.prevPos({section:'yourProfile',step:1}),{section:'yourDates',step:2}),'Your Profile 1 back -> Dates2');
ok(F.nextPos({section:'yourProfile',step:7})===null,'end after Your Profile 7 (received)');
const back=[];p=all[all.length-1];while(p){back.push(p);p=F.prevPos(p);}ok(eq(back.reverse(),all),'back mirrors forward');
ok(F.SECTIONS.find(s=>s.id==='yourDates').label==='Your Dates','section label');
const full={...E,dateTypes:['walk'],spotText:'Maçka Parkı',days:'weekends',time:'daytime'};
ok(F.isPosValid({section:'yourDates',step:1},B.EMPTY_BASICS_DRAFT,C.EMPTY_COMPAT_DRAFT,L.EMPTY_LIFE_DRAFT,W.EMPTY_WORLD_DRAFT,full,P.EMPTY_PROFILE_DRAFT),'isPosValid dates1');
ok(!F.isPosValid({section:'yourDates',step:2},B.EMPTY_BASICS_DRAFT,C.EMPTY_COMPAT_DRAFT,L.EMPTY_LIFE_DRAFT,W.EMPTY_WORLD_DRAFT,E,P.EMPTY_PROFILE_DRAFT),'isPosValid dates2 empty');
ok(!F.isPosValid({section:'yourWorld',step:4},B.EMPTY_BASICS_DRAFT,C.EMPTY_COMPAT_DRAFT,L.EMPTY_LIFE_DRAFT,W.EMPTY_WORLD_DRAFT,full,P.EMPTY_PROFILE_DRAFT),'interests gate intact');
module.exports = done('P06 Your Dates');
