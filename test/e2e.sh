#!/usr/bin/env bash
# HireWise AI e2e tests — 7 flows through the real logic module
set -u
cd "$(dirname "$0")/.." || exit 1
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

# Flow 1: full post-builder flow -> 3 distinct tones, pay line, red-flag check clean
node -e "
const HW=require('./js/logic.js');
const d={role:'Delivery Driver',company:'QuickBite',location:'Denver, CO',payMin:'20',payMax:'26',payType:'hourly',mustHaves:['Valid driver\\'s license','Clean driving record','Weekend availability'],niceToHaves:['Bilingual']};
const p=HW.generatePosts(d);
const tones=[p.professional,p.friendly,p.bold];
if(new Set(tones).size!==3) process.exit(1);
if(!tones.every(t=>t.includes('Delivery Driver')&&t.includes('\$20'))) process.exit(1);
const flags=HW.redFlags(d,tones.join('\n'));
if(flags.some(f=>f.severity==='high')) {console.error(JSON.stringify(flags));process.exit(1);}
" && ok "flow1: post builder -> 3 distinct tones, pay shown, no high-severity flags" || bad "flow1 failed"

# Flow 2: strong sample resume (Maria) scores strong with evidence
node -e "
const HW=require('./js/logic.js');
const resume=['MARIA SANTOS','4 years experience as a line cook','ServSafe certified food safety','customer service','cash handling','available weekends'].join(' ');
const r=HW.screenResume({role:'Line Cook',resumeText:resume,mustHaves:['food safety','weekend availability','cash handling','customer service']});
if(r.verdict!=='strong') {console.error(JSON.stringify(r));process.exit(1);}
if(r.matched.length<3) process.exit(1);
if(!r.evidence.some(e=>/years of experience/.test(e.text))) process.exit(1);
" && ok "flow2: strong resume -> strong verdict, matches + experience evidence" || bad "flow2 failed"

# Flow 3: career-changer (Devon) lands in maybe with gap questions
node -e "
const HW=require('./js/logic.js');
const resume='DEVON CARTER — customer service professional moving into the restaurant industry. 2 years experience in retail customer service and cash handling as a cashier at a busy grocery store. Friendly, reliable, quick learner, eager to learn food safety and kitchen skills. Open schedule and willing to work weekends during the training period. References available on request.';
const r=HW.screenResume({role:'Line Cook',resumeText:resume,mustHaves:['food safety','weekend availability','cash handling']});
if(r.verdict!=='maybe') {console.error(JSON.stringify(r));process.exit(1);}
if(!r.questions.some(q=>/food safety/i.test(q))) process.exit(1);
" && ok "flow3: career changer -> maybe, gap question targets missing skill" || bad "flow3 failed"

# Flow 4: irrelevant resume -> no fit, 5 questions still generated
node -e "
const HW=require('./js/logic.js');
const r=HW.screenResume({role:'Line Cook',resumeText:'Freelance graphic designer, 6 years experience. Photoshop, Illustrator.',mustHaves:['food safety','weekend availability']});
if(r.verdict!=='no'||r.score>=40) {console.error(JSON.stringify(r));process.exit(1);}
if(r.questions.length!==5) process.exit(1);
" && ok "flow4: irrelevant resume -> no fit, still 5 interview questions" || bad "flow4 failed"

# Flow 5: red flags catch risky language
node -e "
const HW=require('./js/logic.js');
const f=HW.redFlags({mustHaves:['x'],niceToHaves:[]},'Hiring a young energetic ninja for our fast-paced family! Must be available 24/7. Competitive salary!');
const s=f.map(x=>x.severity).join(',');
if(!/high/.test(s)) {console.error(JSON.stringify(f));process.exit(1);}
if(f.length<4) process.exit(1);
" && ok "flow5: risky post -> multiple flags incl. high severity" || bad "flow5 failed"

# Flow 6: empty inputs don't crash
node -e "
const HW=require('./js/logic.js');
const p=HW.generatePosts({});
const r=HW.screenResume({resumeText:'',mustHaves:[]});
const f=HW.redFlags({},'');
if(!p.professional||typeof r.score!=='number'||!f.length) process.exit(1);
" && ok "flow6: empty inputs handled gracefully" || bad "flow6 failed"

# ============ onboarding flows (merged from OnboardPilot AI) ============

# Flow 7b: onboard hire lifecycle — create, check items, 100%
node -e "
const OP=require('./js/onboard.js');
const st=OP.blankState();
const h=OP.addHire(st,'Lena Wu','Barista','2026-09-28',null);
if(OP.progressAll(h).overall!==0) process.exit(1);
for(const t of h.checklist) OP.setItemDone(st,h.id,t.id,true);
const p=OP.progressAll(h);
if(p.overall!==100||p.day1!==100||p.week1!==100||p.day30!==100) {console.error(p);process.exit(1);}
" && ok "flow7b: onboarding hire lifecycle to 100%" || bad "flow7b failed"

# Flow 7c: milestone due dates anchored on start date + upcoming across hires
node -e "
const OP=require('./js/onboard.js');
const st=OP.blankState();
const h=OP.addHire(st,'Nora','Barista','2026-09-28',null);
if(OP.phaseDueDate(h,'day1')!=='2026-09-29') process.exit(1);
if(OP.phaseDueDate(h,'week1')!=='2026-10-05') process.exit(1);
if(OP.phaseDueDate(h,'day30')!=='2026-10-28') process.exit(1);
let ms=OP.milestoneStatus(h,'2026-10-01');
if(ms[0].state!=='overdue') process.exit(1);
if(OP.milestoneLabel(ms[0])!=='Day 1 overdue by 2 days') process.exit(1);
h.checklist.filter(t=>t.phase==='day1').forEach(t=>OP.setItemDone(st,h.id,t.id,true));
if(OP.dashboard(st,'2026-09-27')[0].nextMilestone.phase!=='week1') process.exit(1);
const h2=OP.addHire(st,'Later','Barista','2026-10-20',null);
const up=OP.upcomingMilestones(st,'2026-09-27');
if(up.length!==2||up[0].hireName!=='Nora') process.exit(1);
" && ok "flow7c: milestone due dates + upcoming milestones" || bad "flow7c failed"

# Flow 7d: buddy nudge → owner reassign → pulse end-to-end
node -e "
const OP=require('./js/onboard.js');
const st=OP.blankState();
const b=OP.addBuddy(st,'Rosa','Senior');
const h=OP.addHire(st,'Nia','Line Cook','2026-09-01',b.id);
if(!OP.buddyCheckins(st,'2026-09-15').length) process.exit(1);
h.checklist.filter(t=>t.owner==='Buddy'&&!t.done).forEach(t=>{
  if(!OP.setItemOwner(st,h.id,t.id,'Manager')) process.exit(1);
});
if(OP.buddyCheckins(st,'2026-09-15').length) process.exit(1);
OP.addHirePulse(st,h.id,3,'Slow start, watching closely');
const ps=OP.hirePulses(st,h.id);
if(ps.length!==1||ps[0].score!==3||OP.pulseAverage(ps)!==3) process.exit(1);
OP.addHireNote(st,h.id,'First impression: solid');
if(OP.hireNotes(st,h.id).length!==1) process.exit(1);
" && ok "flow7d: nudge → owner reassign → pulse → note" || bad "flow7d failed"

# Flow 7e: custom role flow + CSV export + archive round-trip
node -e "
const OP=require('./js/onboard.js');
const st=OP.blankState();
OP.createCustomRole(st,'Bike Mechanic',{day1:[{title:'Shop tour',category:'Culture',owner:'Buddy'}]});
OP.addCustomTask(st,'Bike Mechanic','week1','Fix first flat','Training','Buddy');
OP.addCustomTask(st,'Bike Mechanic','day30','Solo service','Training','New hire');
const h=OP.addHire(st,'Rico','Bike Mechanic','2026-09-28',null);
const counts=[OP.countsFor(h,'day1').total,OP.countsFor(h,'week1').total,OP.countsFor(h,'day30').total];
if(counts.join(',')!=='1,1,1') process.exit(1);
const csv=OP.hiresToCSV(OP.dashboard(st,'2026-09-28'));
if(!csv.includes('Rico')||!csv.includes('Bike Mechanic')) process.exit(1);
OP.archiveHire(st,h.id);
const st2=OP.deserialize(OP.serialize(st));
if(!OP.archivedHires(st2).some(x=>x.id===h.id)) process.exit(1);
" && ok "flow7e: custom role + CSV + archive persist" || bad "flow7e failed"

# Flow 7f: full suite journey — post → screen → pipeline → hire → onboard
node -e "
const HW=require('./js/logic.js');
const OP=require('./js/onboard.js');
// post
const d={role:'Line Cook',company:'Sunny Side',location:'Austin, TX',payMin:'18',payMax:'24',payType:'hourly',mustHaves:['Food safety cert','Weekend availability'],niceToHaves:[]};
const p=HW.generatePosts(d);
if(!p.professional.includes('Line Cook')) process.exit(1);
// screen
const r=HW.screenResume({role:'Line Cook',resumeText:'Maria Santos — line cook, 4 years experience. ServSafe certified food safety. Available weekends.',mustHaves:['food safety','weekend availability']});
if(r.verdict!=='strong') process.exit(1);
// pipeline
const c={name:'Maria Santos',role:'Line Cook',score:r.score,verdict:r.verdict};
HW.stampStage(c,'applied',1728259200000);
HW.stampStage(c,'hired',1728259200000+864e5);
if(HW.stalledCandidates([c],7,1728259200000+864e5).length) process.exit(1);
// offer
const L=HW.offerLetter({name:c.name,role:c.role,company:'Sunny Side',pay:'22',payType:'hourly',startDate:'2026-12-01',manager:'Pat'});
if(!/Line Cook/.test(L)||!/2026-12-01/.test(L)) process.exit(1);
// onboard on the same journey
const st=OP.blankState();
const h=OP.addHire(st,c.name,c.role,'2026-12-01',null);
c.onboardId=h.id;
if(!h||OP.progressAll(h).overall!==0) process.exit(1);
if(OP.dashboard(st,'2026-11-20')[0].startIn!==11) process.exit(1);
" && ok "flow7f: post → screen → pipeline → offer → onboarding, one journey" || bad "flow7f failed"

# Flow 7: all 3 bundled samples are distinct people
node -e "
const fs=require('fs');
const s=fs.readFileSync('./js/samples.js','utf8');
for(const n of ['Maria Santos','Devon Carter','Alex Morgan']) if(!s.includes(n)) process.exit(1);
" && ok "flow7: 3 sample resumes bundled" || bad "flow7 failed"

# Flow 8: pipeline lifecycle — screen, add candidate with notes, stats, CSV export
node -e "
const HW=require('./js/logic.js');
// simulate: two screened candidates land in the pipeline, one gets a note
const pipe=[
  {name:'Maria Santos',role:'Line Cook',score:85,verdict:'strong',stage:'applied',ts:1728259200000},
  {name:'Devon Carter',role:'Line Cook',score:55,verdict:'maybe',stage:'screening',notes:'Strong service background',ts:1728345600000}
];
const s=HW.pipeStats(pipe);
if(s.total!==2||s.perStage.applied!==1||s.perStage.screening!==1||s.avgScore!==70) process.exit(1);
const csv=HW.pipelineToCSV(pipe);
if(!csv.includes('Maria Santos')||!csv.includes('Devon Carter')||!csv.includes('Strong service background')) process.exit(1);
if(!csv.includes('Name,Role,Score,Verdict,Stage,Notes,Added')) process.exit(1);
// stage moves keep stats coherent
pipe[0].stage='interview';
if(HW.pipeStats(pipe).perStage.interview!==1) process.exit(1);
" && ok "flow8: pipeline stats + CSV export across screened candidates" || bad "flow8 failed"

# Flow 9: notes persist on the CSV export (spreadsheet round-trip shape)
node -e "
const HW=require('./js/logic.js');
const csv=HW.pipelineToCSV([{name:'X',role:'R',score:70,verdict:'maybe',stage:'offer',notes:'Multi-line\nnote',ts:0}]);
if(!/\"Multi-line\\nnote\"/.test(csv)) {console.error(csv);process.exit(1);}
" && ok "flow9: multi-line notes quoted safely in CSV" || bad "flow9 failed"

# Flow 10: stage lifecycle — moves stamp history, stalls surface, docs generate
node -e "
const HW=require('./js/logic.js');
// simulate a candidate journey with controlled timestamps
let now=1728259200000;
const c={name:'Maria Santos',role:'Line Cook',score:85,verdict:'strong'};
HW.stampStage(c,'applied',now);
now+=2*864e5; HW.stampStage(c,'screening',now);
now+=10*864e5; HW.stampStage(c,'interview',now);
if(c.stageLog.length!==3) process.exit(1);
// 9 days later, still in interview -> stalled (>7)
const later=now+9*864e5;
const stalled=HW.stalledCandidates([c],7,later);
if(stalled.length!==1||stalled[0].days!==9) {console.error(stalled);process.exit(1);}
// move to offer resets the clock
HW.stampStage(c,'offer',later);
if(HW.stalledCandidates([c],7,later).length!==0) process.exit(1);
// hired: offer letter reads right
HW.stampStage(c,'hired',later+864e5);
const L=HW.offerLetter({name:c.name,role:c.role,company:'Sunny Side',pay:'24',payType:'hourly',startDate:'2026-12-01',manager:'Pat'});
if(!/offer you the position of Line Cook/.test(L)) process.exit(1);
// rejected path: encouraging rejection keeps the door open
const r2={name:'Devon Carter',role:'Line Cook'};
HW.stampStage(r2,'rejected',later);
const rej=HW.rejectionEmail({name:r2.name,role:r2.role,company:'Sunny Side',tone:'encouraging'});
if(!/reach out when something fits/.test(rej.body)) process.exit(1);
// daysInStage falls back to ts for pre-log candidates
const old={name:'Old',stage:'screening',ts:later-30*864e5};
if(HW.daysInStage(old,later)!==30) process.exit(1);
" && ok "flow10: stage history, stall detection, offer letter, rejection email" || bad "flow10 failed"

node -e "
const HW=require('/home/hatch/workspace/hirewise-ai/js/logic.js');
// quick-add candidate shape: null score must not break stats/CSV
const cands=[{name:'New Person',role:'Cook',score:null,verdict:'new',stage:'applied',ts:Date.now(),notes:''},
             {name:'Scored',role:'Cook',score:80,verdict:'strong',stage:'applied',ts:Date.now(),notes:''}];
const s=HW.pipeStats(cands);
if(s.total!==2) process.exit(1);
if(s.avgScore!==80) { console.log('avg='+s.avgScore); process.exit(1); }
const csv=HW.pipelineToCSV(cands);
if(!csv.includes('New Person')) process.exit(1);
" && ok "flow11: quick-add null-score candidate keeps stats + CSV working" || bad "flow11 failed"

echo "---- e2e: $PASS passed, $FAIL failed ----"
[ "$FAIL" -eq 0 ]
