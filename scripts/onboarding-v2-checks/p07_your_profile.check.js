// P07 / P07 R1 Your Profile logic checks (photos, prompts, preview privacy,
// email demo check, submit routing, flow length and back/forward).
const { ok, eq, lib, done } = require('./_setup');
const P = lib('yourProfile.ts');
const F = lib('previewFlow.ts');
const B = lib('basics.ts');
const C = lib('compatibility.ts');
const L = lib('yourLife.ts');
const W = lib('yourWorld.ts');
const D = lib('yourDates.ts');
const ph = (k) => ({ id: 'p' + k, uri: 'file:///local/' + k + '.jpg' });
// flow
ok(P.YOUR_PROFILE_TOTAL_STEPS===7,'7 profile steps');
ok(eq(P.PROFILE_SCREENS.map(s=>s.title),['Add your photos','A little more you','Your profile','A quick selfie','Your email','Check your email',"You're on the list!"]),'titles; no Ready to submit');
const all=[];let p=F.FIRST_POS;while(p){all.push(p);p=F.nextPos(p);}ok(all.length===32,'32 steps got '+all.length);
ok(eq(F.nextPos({section:'yourDates',step:2}),{section:'yourProfile',step:1})&&eq(F.prevPos({section:'yourProfile',step:1}),{section:'yourDates',step:2}),'Dates2<->Photos');
ok(eq(F.nextPos({section:'yourProfile',step:6}),{section:'yourProfile',step:7})&&F.nextPos({section:'yourProfile',step:7})===null,'code -> received last');
// interests
ok(W.MIN_INTERESTS===1&&W.MAX_INTERESTS===10,'interests 1–10');
ok(W.WORLD_SCREENS[3].helper==='Pick a few things you enjoy.','interests helper');
ok(!W.isWorldStepValid(4,{...W.EMPTY_WORLD_DRAFT,interests:[]}),'0 interests invalid');
ok(W.isWorldStepValid(4,{...W.EMPTY_WORLD_DRAFT,interests:['food']}),'1 interest valid');
ok(!W.isWorldStepSkippable(4),'no Add later on interests');
let ten=[];for(const i of W.INTERESTS.slice(0,11))ten=W.toggleInterest(ten,i.key);ok(ten.length===10,'max 10');
// photos
const E=P.EMPTY_PROFILE_DRAFT;const L3=P.addPhotos([], [ph(1),ph(2),ph(3)]);
ok(P.photosValid(L3)&&!P.photosValid(P.removePhoto(L3,'p1')),'3 valid, remove->2 invalid');
ok(P.addPhotos(L3,[ph(4),ph(5),ph(6),ph(7)]).length===6,'max 6');
ok(eq(P.makeMainPhoto(L3,'p3').map(x=>x.id),['p3','p1','p2'])&&eq(P.movePhoto(L3,'p1',1).map(x=>x.id),['p2','p1','p3']),'main/move');
// prompts (R2 model: three empty "Choose a prompt" slots, catalog prompts)
ok(eq(E.prompts,[{promptId:null,answer:''},{promptId:null,answer:''},{promptId:null,answer:''}]),'three empty slots, no preselected prompts');
ok(!P.promptsValid(E.prompts),'empty slots never valid');
let pr=P.saveSlot(P.saveSlot(E.prompts,0,'dont_judge_me','Pineapple pizza'),1,'together_we_could','Walk the Bosphorus');
ok(P.promptsValid(pr),'2 answers valid');
ok(eq(P.saveSlot(pr,1,'dont_judge_me','x'),pr),'dup prompt refused');
const p3=pr;ok(P.promptsValid(p3)&&P.publicAnswers(p3).length===2,'optional third empty');
// email / submit
const full={...E,photos:L3,prompts:pr,selfie:{uri:'file:///selfie.jpg'},email:'deniz@example.com',emailCheck:{email:'deniz@example.com'}};
ok(P.firstMissingStep(full)===null,'complete -> no missing');
ok(P.firstMissingStep({...full,photos:P.removePhoto(L3,'p1')})===1,'missing photos -> 1');
ok(P.firstMissingStep({...full,prompts:E.prompts})===2,'missing answers -> 2');
ok(P.firstMissingStep({...full,selfie:null})===4,'missing selfie -> 4');
ok(P.firstMissingStep({...full,emailCheck:null})===6,'unchecked email -> code');
ok(P.firstMissingStep({...full,email:'x',emailCheck:null})===5,'bad email -> email');
ok(P.isProfileStepValid(6,full)&&!P.isProfileStepValid(7,full),'code valid; received needs marker (verify != submit)');
ok(!P.emailChecked('other@example.com',full.emailCheck),'check bound to email');
// preview
const basics={...B.EMPTY_BASICS_DRAFT,firstName:'Deniz',lastName:'Hiddensurname',dobDay:'4',dobMonth:'7',dobYear:'1995',heightCm:'172',location:{id:'x',kind:'district',city:'İstanbul',district:'Kadıköy',country:'Turkey',label:'Kadıköy, İstanbul, Turkey'}};
const compat={...C.EMPTY_COMPAT_DRAFT,intent:'long_term',values:['trust','respect']};
const life={...L.EMPTY_LIFE_DRAFT,smoking:'no',drinking:'sometimes',pets:'have_pets',petKind:'cat',activity:'very'};
const world={...W.EMPTY_WORLD_DRAFT,jobTitle:'Designer',school:{kind:'school',source:'sample',id:'s',title:'Boğaziçi University'},hometown:{kind:'hometown',source:'sample',id:'h',title:'İzmir'},interests:['food','travel'],artists:[{kind:'artist',source:'custom',id:'a',title:'Sezen Aksu'}],books:[{kind:'book',source:'openlibrary',id:'b',title:'Kürk Mantolu Madonna',subtitle:'Sabahattin Ali',imageUrl:'https://covers.openlibrary.org/b/id/1-M.jpg'}],screen:[{kind:'screen',source:'wikidata',id:'m',title:'Ezel',subtitle:'2009 · Series'}]};
const dates={...D.EMPTY_DATES_DRAFT,dateTypes:['coffee','walk'],days:'weekends',time:'daytime',spotText:'Moda Sahil'};
const pf={...full,prompts:p3,photos:P.addPhotos(L3,[ph(4),ph(5)])};
const bl=P.buildProfilePreview(basics,compat,life,world,dates,pf);const js=JSON.stringify(bl);
ok(bl[0].type==='hero'&&bl[0].name==='Deniz'&&bl[0].age>=30&&bl[0].photo.id==='p1','name+age on the main photo (hero, P07 R1 polish)');
ok(!bl.some(b=>b.type==='header'),'no separate name line when a photo exists');
ok(bl.filter(b=>JSON.stringify(b).includes('"name":"Deniz"')).length===1,'name appears exactly once');
{const g=bl.find(b=>b.type==='groups');const it=t=>g.groups.find(x=>x.title===t).items;
 ok(it('Looking for')[0].icon==='heart-outline'&&it('Looking for')[0].text==='A serious relationship','Looking for: heart icon + text');
 ok(it('What matters most').some(f=>f.text==='Trust'&&f.icon==='link-variant'&&f.family==='mci'),'Trust uses the link icon');
 ok(it('Into').every(f=>typeof f.icon==='string'&&f.icon.endsWith('-outline')),'interests use outline icons');
 ok(!JSON.stringify(g).match(/[\u{1F300}-\u{1FAFF}]/u),'no emoji in answer groups');}
for(const t of ['İstanbul','172 cm','Cancer','Designer','Boğaziçi University','From İzmir','A serious relationship','Trust','Respect','Food','Travel',"Doesn't smoke",'Drinks sometimes','Has a cat','Very active','Coffee · A walk','Weekends · Daytime','Favorite spot: Moda Sahil','Sezen Aksu','Kürk Mantolu Madonna','Ezel'])ok(js.includes(t),'preview has '+t);
for(const t of ['Hiddensurname','1995','deniz@','selfie','Kadıköy'])ok(!js.includes(t),'preview excludes '+t);
ok(bl.filter(b=>b.type==='photo'||b.type==='hero').length===5,'all usable photos shown once');
const types=bl.map(b=>b.type);ok(types.indexOf('prompt')<types.lastIndexOf('photo'),'prompts interleaved with photos');
let consecutive=0;for(let i=1;i<types.length;i++)if(types[i]==='photo'&&types[i-1]==='photo')consecutive++;ok(consecutive===0,'no photo stacks when info exists: '+types.join(','));
const min=P.buildProfilePreview({...B.EMPTY_BASICS_DRAFT,firstName:'Ada'},C.EMPTY_COMPAT_DRAFT,L.EMPTY_LIFE_DRAFT,W.EMPTY_WORLD_DRAFT,D.EMPTY_DATES_DRAFT,{...E,photos:L3,prompts:pr});
ok(eq(min.map(b=>b.type),['hero','prompt','photo','prompt','photo']),'empty groups omitted: '+min.map(b=>b.type));
{const noPhoto=P.buildProfilePreview({...B.EMPTY_BASICS_DRAFT,firstName:'Ada'},C.EMPTY_COMPAT_DRAFT,L.EMPTY_LIFE_DRAFT,W.EMPTY_WORLD_DRAFT,D.EMPTY_DATES_DRAFT,{...E,photos:[],prompts:pr});
 ok(noPhoto[0].type==='header'&&noPhoto[0].name==='Ada','without a photo the name falls back to a header');}
ok(!JSON.stringify(min).includes('title'),'no empty section titles');
// Walk the real connected flow with complete drafts: every one of the 32
// steps is valid (Continue never blocks) and Back retraces it exactly.
{
  const fullBasics={...basics,gender:'man',interestedIn:['women']};
  const fullCompat={...compat,socialEnergy:'mix',messageFrequency:'few_checkins',relationshipSpace:'balance',emotionalExpression:'open',meetingPace:'after_chatting'};
  const fullProfile={...pf,applicationPreview:{receivedAt:1}};
  const seq=[];let q=F.FIRST_POS;while(q){seq.push(q);q=F.nextPos(q);}
  const bad=seq.filter(s=>!F.isPosValid(s,fullBasics,fullCompat,life,world,dates,fullProfile));
  ok(bad.length===0,'every step valid with full drafts: '+JSON.stringify(bad));
  const secs=[...new Set(seq.map(s=>s.section))];
  ok(eq(secs,['basics','compatibility','yourLife','yourWorld','yourDates','yourProfile']),'section order');
  const back=[];q=seq[seq.length-1];while(q){back.push(q);q=F.prevPos(q);}ok(eq(back.reverse(),seq),'back mirrors forward (32)');
}
module.exports = done('P07 R1 Your Profile');
