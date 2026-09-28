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

# Flow 7: all 3 bundled samples are distinct people
node -e "
const fs=require('fs');
const s=fs.readFileSync('./js/samples.js','utf8');
for(const n of ['Maria Santos','Devon Carter','Alex Morgan']) if(!s.includes(n)) process.exit(1);
" && ok "flow7: 3 sample resumes bundled" || bad "flow7 failed"

echo "---- e2e: $PASS passed, $FAIL failed ----"
[ "$FAIL" -eq 0 ]
