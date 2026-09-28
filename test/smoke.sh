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

echo "---- smoke: $PASS passed, $FAIL failed ----"
[ "$FAIL" -eq 0 ]
