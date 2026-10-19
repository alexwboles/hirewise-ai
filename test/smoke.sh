#!/usr/bin/env bash
# HireWise AI smoke tests — hiring suite (post + screen + pipeline + onboard)
set -u
cd "$(dirname "$0")/.." || exit 1
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

# 1-4: required files exist
for f in index.html css/style.css js/logic.js js/app.js js/samples.js README.md; do
  [ -f "$f" ] && ok "file exists: $f" || bad "missing: $f"
done

# 5-6: JS syntax valid
for f in js/logic.js js/app.js js/samples.js; do
  node --check "$f" 2>/dev/null && ok "syntax ok: $f" || bad "syntax error: $f"
done

# 7: logic module loads in Node
node -e "const HW=require('./js/logic.js'); if(!HW.generatePosts||!HW.redFlags||!HW.screenResume) process.exit(1);" \
  && ok "logic exports generatePosts/redFlags/screenResume" || bad "logic exports missing"

# 8: post generation produces all 3 tones
node -e "
const HW=require('./js/logic.js');
const p=HW.generatePosts({role:'Line Cook',company:'Sunny Side',location:'Austin, TX',payMin:'18',payMax:'24',payType:'hourly',mustHaves:['Food safety cert','Weekend availability'],niceToHaves:['Grill experience']});
if(!p.professional||!p.friendly||!p.bold) process.exit(1);
if(!p.professional.includes('Line Cook')||!p.professional.includes('\$18')) process.exit(1);
" && ok "generatePosts: 3 tones, role + pay present" || bad "generatePosts broken"

# 9: red-flag detection catches clichés + missing pay
node -e "
const HW=require('./js/logic.js');
const f=HW.redFlags({mustHaves:['a','b','c','d','e','f','g','h','i'],niceToHaves:[]},'We need a rockstar for our fast-paced family. Competitive salary!');
const names=f.map(x=>x.flag).join('|');
if(!/rockstar/i.test(names)||!/pay range/i.test(names)||!/9 requirements/.test(names)) process.exit(1);
" && ok "redFlags: cliché + missing pay + long list detected" || bad "redFlags missed issues"

# 10: screener scores a strong resume high
node -e "
const HW=require('./js/logic.js');
const fs=require('fs');
const samples=fs.readFileSync('./js/samples.js','utf8');
if(!/Maria Santos/.test(samples)) process.exit(1);
const r=HW.screenResume({role:'Line Cook',resumeText:'Maria Santos — line cook with 4 years experience at busy downtown restaurants. ServSafe certified in food safety with strong knife skills. Ran grill and saute stations, handled customer service during expo, and did cash handling for to-go orders. Reliable, hardworking, and available weekends. References available on request.',mustHaves:['food safety','weekend availability','cash handling']});
if(r.verdict!=='strong'||r.score<70) {console.error(JSON.stringify(r));process.exit(1);}
if(r.questions.length!==5) process.exit(1);
" && ok "screenResume: strong resume -> strong (70+), 5 questions" || bad "screenResume strong case failed"

# 11: screener scores irrelevant resume low
node -e "
const HW=require('./js/logic.js');
const r=HW.screenResume({role:'Line Cook',resumeText:'Alex Morgan, freelance graphic designer, 6 years experience. Photoshop, Illustrator, web design.',mustHaves:['food safety','weekend availability','cash handling']});
if(r.verdict!=='no'||r.score>=40) {console.error(JSON.stringify(r));process.exit(1);}
if(r.missing.length!==3) process.exit(1);
" && ok "screenResume: irrelevant resume -> no (<40), all must-haves missing" || bad "screenResume weak case failed"

# 12: index.html wires all three panels
grep -q 'panel-post' index.html && grep -q 'panel-screen' index.html && grep -q 'panel-pipe' index.html \
  && ok "index.html has all 3 panels" || bad "index.html missing panels"

# 13: logic exports pipeStats + pipelineToCSV
node -e "const HW=require('./js/logic.js'); if(!HW.pipeStats||!HW.pipelineToCSV) process.exit(1);" \
  && ok "logic exports pipeStats/pipelineToCSV" || bad "logic exports pipeStats/pipelineToCSV missing"

# 14: pipeStats computes per-stage counts and average score
node -e "
const HW=require('./js/logic.js');
const s=HW.pipeStats([
  {name:'A',stage:'applied',score:80},{name:'B',stage:'interview',score:60},
  {name:'C',stage:'offer',score:null},{name:'D',stage:'applied'}
]);
if(s.total!==4||s.perStage.applied!==2||s.perStage.interview!==1||s.perStage.offer!==1) process.exit(1);
if(s.avgScore!==70) {console.error(s);process.exit(1);}
const e=HW.pipeStats([]);
if(e.total!==0||e.avgScore!==null) process.exit(1);
" && ok "pipeStats: per-stage counts + avg score (null when unscored)" || bad "pipeStats broken"

# 15: pipelineToCSV header, row fields, and comma quoting
node -e "
const HW=require('./js/logic.js');
const csv=HW.pipelineToCSV([{name:'Doe, Jane',role:'Line Cook',score:82,verdict:'strong',stage:'interview',notes:'Call Tue',ts:1728259200000}]);
const lines=csv.split('\n');
if(lines[0]!=='Name,Role,Score,Verdict,Stage,Notes,Added') {console.error(csv);process.exit(1);}
if(!/\"Doe, Jane\"/.test(lines[1])||!/,82,strong,interview,Call Tue,/.test(lines[1])) process.exit(1);
if(HW.pipelineToCSV([]).split('\n').length!==1) process.exit(1);
" && ok "pipelineToCSV: header + quoted fields + empty case" || bad "pipelineToCSV broken"

# 16: pipeline search / export / stats elements wired in index.html + app.js
grep -q 'id="pipeSearch"' index.html && grep -q 'id="exportPipe"' index.html && grep -q 'id="pipeStats"' index.html \
  && ok "index.html has pipeSearch/exportPipe/pipeStats" || bad "index.html missing pipeline tool elements"
grep -q 'pipeSearch' js/app.js && grep -q 'data-note' js/app.js \
  && ok "app.js wires pipeline search + candidate notes" || bad "app.js missing pipeline search/notes wiring"

# 17: keyboard shortcut wired
grep -q 'ctrlKey || e.metaKey' js/app.js && grep -q 'genPost' js/app.js \
  && ok "app.js has Ctrl/Cmd+Enter shortcut" || bad "keyboard shortcut missing"

# 18: logic exports stage tracking + document generators
node -e "const HW=require('./js/logic.js'); if(!HW.stampStage||!HW.daysInStage||!HW.stalledCandidates||!HW.offerLetter||!HW.rejectionEmail) process.exit(1);" \
  && ok "logic exports stampStage/daysInStage/stalledCandidates/offerLetter/rejectionEmail" || bad "new logic exports missing"

# 19: stage log dedupes, daysInStage math, stall filter, offer + rejection docs
node -e "
const HW=require('./js/logic.js');
const c={};
HW.stampStage(c,'applied',1000);
HW.stampStage(c,'applied',2000);
if(c.stageLog.length!==1) process.exit(1);
HW.stampStage(c,'interview',1000+2*864e5);
if(c.stageLog.length!==2||c.stage!=='interview') process.exit(1);
if(HW.daysInStage(c,1000+5*864e5)!==3) process.exit(1);
const now=1000+20*864e5;
const stalled=HW.stalledCandidates([c,{name:'H',stage:'hired',ts:0}],7,now);
if(stalled.length!==1||stalled[0].days!==18) {console.error(stalled);process.exit(1);}
const L=HW.offerLetter({name:'Maria',role:'Line Cook',company:'Sunny Side',pay:'22',payType:'hourly',startDate:'2026-11-01',manager:'Pat',tone:'warm'});
if(!/Maria/.test(L)||!/Line Cook/.test(L)||!/22 per hour/.test(L)||!/2026-11-01/.test(L)||!/Pat/.test(L)) {console.error(L);process.exit(1);}
const L2=HW.offerLetter({});
if(!/\[Candidate name\]/.test(L2)) process.exit(1);
const r=HW.rejectionEmail({name:'Devon',role:'Line Cook',company:'Sunny Side',tone:'encouraging'});
if(!/Devon/.test(r.body)||!/keep your resume on file/.test(r.body)) {console.error(r);process.exit(1);}
if(!/Thank you for applying/.test(r.subject)) process.exit(1);
const rb=HW.rejectionEmail({tone:'brief'});
if(rb.body.length>=r.body.length) process.exit(1);
const rw=HW.rejectionEmail({tone:'bogus'});
if(rw.tone!=='warm') process.exit(1);
" && ok "stampStage/daysInStage/stalledCandidates/offerLetter/rejectionEmail" || bad "stage tracking / doc generation broken"

# 20: stall banner + document modal + offer/rejection wiring
grep -q 'id="stallOut"' index.html && grep -q 'id="docModal"' index.html \
  && ok "index.html has stallOut + docModal" || bad "index.html missing stall/doc elements"
grep -q 'data-offer' js/app.js && grep -q 'data-rejmail' js/app.js && grep -q 'stalledCandidates' js/app.js \
  && ok "app.js wires offer letters + rejection emails + stall banner" || bad "app.js missing doc/stall wiring"
grep -q 'id="qaName"' index.html && grep -q 'id="qaRole"' index.html && grep -q 'id="quickAdd"' index.html \
  && ok "index.html has quick-add candidate controls" || bad "index.html missing quick-add"
grep -q 'dial-fill' js/app.js && grep -q 'stroke-dasharray' js/app.js && grep -q 'quickAdd' js/app.js \
  && grep -q 'verdict: "new"' js/app.js && grep -q 'unscored' js/app.js \
  && ok "app.js wires score dial + quick-add + unscored chip" || bad "app.js missing redesign wiring"
grep -q 'class="shell"' index.html && grep -q 'local-pill' index.html \
  && ok "index.html uses sidebar shell" || bad "index.html missing shell"
! grep -E 'border-radius:[[:space:]]*[1-9]' css/style.css | grep -qv '50%' \
  && ok "no rounded edges in CSS" || bad "rounded edges found in CSS"

# ============ onboarding module (merged from OnboardPilot AI) ============

# 21-23: onboarding files exist + syntax
for f in js/onboard.js js/onboard-ui.js; do
  [ -f "$f" ] && ok "file exists: $f" || bad "missing: $f"
done
node --check js/onboard.js 2>/dev/null && node --check js/onboard-ui.js 2>/dev/null \
  && ok "syntax ok: js/onboard.js + js/onboard-ui.js" || bad "syntax error in onboarding JS"

# 24: onboarding logic exports (Node)
node -e "
const OP=require('./js/onboard.js');
['generateChecklist','addHire','getHire','setItemDone','dashboard','progressFor','progressAll','isOverdue','addBuddy','getBuddyName','draftWelcomeMessage','hiresToCSV','archiveHire','unarchiveHire','archivedHires','createCustomRole','addCustomTask','allRoles','taskDue','taskOverdue','overdueTasks','milestoneStatus','nextMilestoneFor','upcomingMilestones','buddyCheckins','addHirePulse','hirePulses','pulseAverage','addHireNote','searchHires','sortHires','daysToStart','startLabel','PHASES','ROLE_TEMPLATES','STORAGE_KEY'].forEach(f=>{
  if(typeof OP[f]==='undefined') throw new Error('missing '+f);
});
if(OP.STORAGE_KEY!=='onboardpilot_v1') throw new Error('storage key changed — existing data would be lost');
" && ok "onboard.js exports full API + keeps onboardpilot_v1 storage key" || bad "onboard.js exports/storage key broken"

# 25: 6 built-in role templates, 3 phases, >=3 tasks each
node -e "
const OP=require('./js/onboard.js');
const roles=Object.keys(OP.ROLE_TEMPLATES);
if(roles.length<6) throw new Error('fewer than 6 roles');
for(const r of roles){
  const cl=OP.generateChecklist(r,{});
  for(const ph of OP.PHASES){
    if(cl.filter(t=>t.phase===ph).length<3) throw new Error(r+'/'+ph+' thin');
  }
}
" && ok "6 built-in role templates, 3 phases x >=3 tasks" || bad "role templates broken"

# 26: Day-1 doc items carry the generic-guidance note
node -e "
const OP=require('./js/onboard.js');
const cl=OP.generateChecklist('Retail Associate',{});
const docs=cl.filter(t=>t.doc);
if(docs.length<4) throw new Error('doc items missing');
if(docs.some(t=>!t.guidance||!/Generic guidance only/.test(t.guidance))) throw new Error('doc without note');
if(cl.filter(t=>!t.doc).some(t=>t.guidance)) throw new Error('non-doc has guidance');
" && ok "Day-1 document items carry generic-guidance note" || bad "doc guidance note broken"

# 27: progress math + overdue detection
node -e "
const OP=require('./js/onboard.js');
const st=OP.blankState();
const past=OP.addHire(st,'Past','Barista','2026-01-05',null);
if(!OP.isOverdue(past,'2026-09-28')) throw new Error('past not overdue');
for(const t of past.checklist.filter(t=>t.phase==='day1')) OP.setItemDone(st,past.id,t.id,true);
if(OP.isOverdue(past,'2026-09-28')) throw new Error('still overdue');
const fake={checklist:[{phase:'day1',done:true},{phase:'day1',done:false},{phase:'day1',done:false},{phase:'day1',done:false}]};
if(OP.progressFor(fake,'day1')!==25) throw new Error('1-of-4 != 25%');
" && ok "onboarding progress math + overdue Day-1 detection" || bad "onboarding progress/overdue broken"

# 28: buddy assignment + welcome message + serialize round-trip
node -e "
const OP=require('./js/onboard.js');
const st=OP.blankState();
const b=OP.addBuddy(st,'Maria Gomez','Senior Associate');
const h=OP.addHire(st,'New Person','Barista','2026-09-28',b.id);
if(OP.getBuddyName(st,h.id)!=='Maria Gomez') throw new Error('buddy mismatch');
const r=OP.draftWelcomeMessage(st,h.id);
if(r.source!=='local'||!/New Person/.test(r.message)||!/Maria Gomez/.test(r.message)) throw new Error('welcome bad');
const s2=OP.deserialize(OP.serialize(st));
if(s2.hires.length!==1||s2.hires[0].checklist.length!==h.checklist.length) throw new Error('round-trip');
" && ok "buddy + welcome message + serialize round-trip" || bad "buddy/welcome/persist broken"

# 29: milestones, task due dates, nudges, pulse
node -e "
const OP=require('./js/onboard.js');
const st=OP.blankState();
const b=OP.addBuddy(st,'Sam','Lead');
const h=OP.addHire(st,'Nia','Line Cook','2026-09-01',b.id);
if(OP.phaseDueDate(h,'day1')!=='2026-09-02') throw new Error('day1 due');
if(OP.milestoneStatus(h,'2026-09-15')[0].state!=='overdue') throw new Error('milestone not overdue');
const nudges=OP.buddyCheckins(st,'2026-09-15');
if(nudges.length!==1||!/Sam/.test(nudges[0].text)) throw new Error('nudge bad');
if(!OP.addHirePulse(st,h.id,4,'Settling in')) throw new Error('pulse');
if(OP.pulseAverage(OP.hirePulses(st,h.id))!==4) throw new Error('pulse avg');
const od=OP.overdueTasks(h,'2026-09-15');
if(!od.length) throw new Error('overdueTasks empty');
" && ok "milestones + per-task dues + buddy nudges + feedback pulse" || bad "milestone/nudge/pulse broken"

# 30: custom roles + dashboard search/sort/CSV + archive
node -e "
const OP=require('./js/onboard.js');
const st=OP.blankState();
OP.createCustomRole(st,'Dog Walker',{day1:[{title:'Meet the pack'}],week1:[{title:'Learn routes'}],day30:[{title:'Solo walks'}]});
if(!OP.generateChecklist('Dog Walker',st.customRoles)) throw new Error('custom role');
OP.addHire(st,'Zoe Park','Barista','2026-09-28',null);
const rows=OP.dashboard(st,'2026-09-28');
if(OP.searchHires(rows,'zoe').length!==1) throw new Error('search');
if(!/^Name,Role,Start date,Buddy/.test(OP.hiresToCSV(rows))) throw new Error('csv header');
OP.archiveHire(st,rows[0].id);
if(OP.dashboard(st,'2026-09-28').length!==0||OP.archivedHires(st).length!==1) throw new Error('archive');
OP.unarchiveHire(st,rows[0].id);
if(OP.dashboard(st,'2026-09-28').length!==1) throw new Error('restore');
" && ok "custom roles + search/sort/CSV + archive lifecycle" || bad "custom roles/search/archive broken"

# 31: Onboard tab wired in index.html
grep -q 'id="panel-onboard"' index.html && grep -q 'data-panel="panel-onboard"' index.html \
  && grep -q 'id="onboardCount"' index.html && grep -q 'class="opnav"' index.html \
  && for v in dashboard hires buddies roles settings; do grep -q "id=\"view-$v\"" index.html || exit 1; done \
  && ok "index.html has panel-onboard + opnav (5 views) + onboardCount" || bad "index.html missing onboard panel"

# 32: onboarding scripts loaded
grep -q 'js/onboard.js' index.html && grep -q 'js/onboard-ui.js' index.html \
  && ok "index.html loads js/onboard.js + js/onboard-ui.js" || bad "onboarding scripts not loaded"

# 33: pipeline → onboarding bridge wired
grep -q 'data-onboard' js/app.js && grep -q 'data-viewon' js/app.js && grep -q '__hwOnboard' js/app.js \
  && grep -q 'openOnboardModal' js/app.js && grep -q 'Start onboarding' js/app.js \
  && ok "app.js wires Start onboarding / View onboarding bridge" || bad "pipeline→onboard bridge missing"
grep -q 'window.__hwOnboard' js/onboard-ui.js && grep -q 'print-op-hire' js/onboard-ui.js \
  && grep -q '#panel-onboard .opnav' js/onboard-ui.js \
  && ok "onboard-ui.js exposes __hwOnboard bridge + scoped nav" || bad "onboard-ui.js bridge missing"

# 34: onboarding CSS scoped under #panel-onboard, palette remapped
grep -q '#panel-onboard .card' css/style.css && grep -q '#panel-onboard .opnav button.active' css/style.css \
  && grep -q '#panel-onboard .task' css/style.css \
  && ok "onboarding CSS scoped under #panel-onboard" || bad "onboarding CSS not scoped"
! grep -E 'var\(--forest|--forest:' css/style.css \
  && ok "no leftover forest palette vars in CSS" || bad "forest palette leaked into CSS"

# 35: pipeline → onboarding bridge flow (Node, same hire record journey)
node -e "
const HW=require('./js/logic.js');
const OP=require('./js/onboard.js');
// hired candidate from the pipeline starts onboarding
const c={name:'Maria Santos',role:'Line Cook',score:85,verdict:'strong'};
HW.stampStage(c,'applied',1728259200000);
HW.stampStage(c,'hired',1728259200000+864e5);
const st=OP.blankState();
const h=OP.addHire(st,c.name,c.role,'2026-12-01',null);
if(!h) throw new Error('addHire failed');
c.onboardId=h.id; // the link the UI stores
if(h.checklist.filter(t=>t.phase==='day1').length<3) throw new Error('no day1 checklist');
const dash=OP.dashboard(st,'2026-11-01');
if(dash.length!==1||dash[0].name!=='Maria Santos') throw new Error('dashboard');
" && ok "pipeline hire → onboarding checklist on one journey" || bad "bridge flow broken"


# ============ v2 "Talent Office" — interviews, dossier, bulk, conversion ============

# 36: logic exports interview + journal + conversion API
node -e "const HW=require('./js/logic.js'); ['scheduleInterview','removeInterview','interviewAt','upcomingInterviews','addNoteToLog','stageConversion','INTERVIEW_TYPES'].forEach(f=>{ if(typeof HW[f]==='undefined') throw new Error('missing '+f); });" \
  && ok "logic exports interview/journal/conversion API" || bad "v2 logic exports missing"

# 37: interview scheduling — valid accepted, bad date/time rejected, upcoming ordered
node -e "
const HW=require('./js/logic.js');
const c={name:'A'};
if(HW.scheduleInterview(c,{date:'not-a-date'})!==null) process.exit(1);
if(HW.scheduleInterview(c,{date:'2026-11-03',time:'25:99'})!==null) process.exit(1);
if(HW.scheduleInterview(null,{date:'2026-11-03'})!==null) process.exit(1);
const iv=HW.scheduleInterview(c,{date:'2026-11-03',time:'10:30',type:'video',interviewer:'Pat',notes:'Round 1'});
if(!iv||iv.type!=='video'||iv.interviewer!=='Pat') process.exit(1);
const iv2=HW.scheduleInterview(c,{date:'2026-11-01'});
const now=new Date('2026-10-25T12:00:00').getTime();
const up=HW.upcomingInterviews([c],now);
if(up.length!==2||up[0].interview.date!=='2026-11-01') {console.error(up);process.exit(1);}
// past interviews are excluded
if(HW.upcomingInterviews([c],new Date('2026-12-01T12:00:00').getTime()).length!==0) process.exit(1);
if(!HW.removeInterview(c,iv2.id)||c.interviews.length!==1) process.exit(1);
if(HW.removeInterview(c,'nope')!==false) process.exit(1);
" && ok "scheduleInterview/upcomingInterviews/removeInterview" || bad "interview scheduling broken"

# 38: notes journal + stage conversion funnel
node -e "
const HW=require('./js/logic.js');
const c={name:'B'};
const e=HW.addNoteToLog(c,'Strong portfolio',{});
if(e===undefined) process.exit(1);
const n=HW.addNoteToLog(c,'Called twice',1728259200000);
if(!n||n.at!==1728259200000||c.noteLog.length!==2) process.exit(1);
if(HW.addNoteToLog(c,'   ')!==null) process.exit(1);
const cs=[
  {stage:'hired',stageLog:[{stage:'applied',at:1},{stage:'screening',at:2},{stage:'interview',at:3},{stage:'offer',at:4},{stage:'hired',at:5}]},
  {stage:'screening',stageLog:[{stage:'applied',at:1},{stage:'screening',at:2}]},
  {stage:'applied'}
];
const conv=HW.stageConversion(cs);
if(conv.applied.entered!==3||conv.applied.advanced!==2||conv.applied.pct!==67) {console.error(conv.applied);process.exit(1);}
if(conv.screening.entered!==2||conv.screening.advanced!==1||conv.screening.pct!==50) process.exit(1);
if(conv.interview.entered!==1||conv.interview.advanced!==1||conv.interview.pct!==100) process.exit(1);
if(conv.offer.entered!==1||conv.offer.advanced!==1) process.exit(1);
const empty=HW.stageConversion([]);
if(empty.applied.pct!==null||empty.applied.entered!==0) process.exit(1);
" && ok "addNoteToLog + stageConversion funnel math" || bad "journal/conversion broken"

# 39: profile drawer + DnD + bulk wiring in app.js
grep -q 'profileDrawer' js/app.js && grep -q 'openProfile' js/app.js && grep -q 'data-profile' js/app.js \
  && grep -q 'dropCandidate' js/app.js && grep -q 'draggable="true"' js/app.js && grep -q 'data-dragidx' js/app.js \
  && grep -q 'data-bulk' js/app.js && grep -q 'bulkApply' js/app.js && grep -q 'renderBulkBar' js/app.js \
  && grep -q 'renderIvStrip' js/app.js && grep -q 'HW.upcomingInterviews' js/app.js \
  && ok "app.js wires drawer + drag-drop + bulk + interview strip" || bad "app.js missing v2 pipeline wiring"

# 40: drawer scorecard + interview form + journal wiring in app.js
grep -q 'data-scoresave2' js/app.js && grep -q 'data-dsc' js/app.js && grep -q 'data-ivadd' js/app.js \
  && grep -q 'data-ivdel' js/app.js && grep -q 'data-noteadd' js/app.js && grep -q 'scheduleInterview' js/app.js \
  && grep -q 'stageConversion' js/app.js && grep -q 'addNoteToLog' js/app.js \
  && ok "app.js wires drawer scorecard/interviews/journal" || bad "app.js missing drawer section wiring"

# 41: index.html has drawer + interview strip + bulk bar + Fraunces
grep -q 'id="profileDrawer"' index.html && grep -q 'id="drawerScrim"' index.html \
  && grep -q 'id="ivOut"' index.html && grep -q 'id="bulkBar"' index.html && grep -q 'id="bulkStage"' index.html \
  && grep -q 'Fraunces' index.html && grep -q 'id="drawerTitle"' index.html \
  && ok "index.html has drawer/strip/bulkbar/Fraunces" || bad "index.html missing v2 elements"

# 42: dossier CSS present, still zero rounded edges
grep -q '\.drawer\.open' css/style.css && grep -q '\.dossier-sect' css/style.css \
  && grep -q '\.iv-strip' css/style.css && grep -q '\.bulk-bar' css/style.css \
  && grep -q '\.conv' css/style.css && grep -q '\-\-brass' css/style.css \
  && ok "CSS has drawer/strip/bulk/conv/brass" || bad "v2 CSS selectors missing"
! grep -E 'border-radius:[[:space:]]*[1-9]' css/style.css | grep -qv '50%' \
  && ok "no rounded edges in v2 CSS" || bad "rounded edges found in v2 CSS"

echo "---- smoke: $PASS passed, $FAIL failed ----"
[ "$FAIL" -eq 0 ]
