#!/usr/bin/env bash
# HireWise AI smoke tests — 12 checks
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

echo "---- smoke: $PASS passed, $FAIL failed ----"
[ "$FAIL" -eq 0 ]
