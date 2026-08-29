const fs=require('fs');
const path=require('path');
const vm=require('vm');

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const scriptMatch=html.match(/<script>([\s\S]*)<\/script>/);
if(!scriptMatch) throw new Error('script not found');
const script=scriptMatch[1];
const legalAudit50=JSON.parse(fs.readFileSync(path.join(__dirname,'LEGAL_AUDIT_50.json'),'utf8'));
const legalAudit50Ids=[...(new Set((legalAudit50.questions||[]).map(x=>x.id).filter(Boolean)))];

const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const dupIds=Object.entries(ids.reduce((m,id)=>(m[id]=(m[id]||0)+1,m),{}))
  .filter(([,n])=>n>1)
  .map(([id])=>id);

const elementStore=new Map();
const makeClassList=()=>{
  const set=new Set();
  return {
    add(...names){names.forEach(n=>set.add(n));},
    remove(...names){names.forEach(n=>set.delete(n));},
    toggle(name,force){
      if(force===undefined){set.has(name)?set.delete(name):set.add(name);}
      else if(force)set.add(name);
      else set.delete(name);
      return set.has(name);
    },
    contains(name){return set.has(name);}
  };
};
const stubEl=()=>({
  innerHTML:'',
  textContent:'',
  value:'',
  style:{},
  dataset:{},
  disabled:false,
  files:null,
  className:'',
  classList:makeClassList(),
  onclick:null,
  oninput:null,
  onchange:null,
  appendChild(){},
  remove(){},
  focus(){},
  select(){},
  closest(){return this;},
  querySelector(){return stubEl();},
  querySelectorAll(){return [];},
  click(){if(typeof this.onclick==='function')this.onclick();}
});
const getEl=s=>{
  if(!elementStore.has(s)) elementStore.set(s,stubEl());
  return elementStore.get(s);
};

const storage={value:''};
const context={
  console,
  Math,
  Date,
  JSON,
  legalAudit50,
  legalAudit50Ids,
  Blob:function(parts){this.parts=parts;},
  URL:{createObjectURL(){return'blob:test';},revokeObjectURL(){}},
  setInterval(){return 1;},
  clearInterval(){},
  setTimeout(fn){if(typeof fn==='function')fn();return 1;},
  clearTimeout(){},
  localStorage:{getItem(){return storage.value;},setItem(_k,v){storage.value=v;}},
  navigator:{clipboard:{writeText:async()=>true}},
  window:{open(){},navigator:{}},
  document:{
    body:{appendChild(){}},
    querySelector:s=>getEl(s),
    querySelectorAll(){return [];},
    createElement:()=>stubEl(),
    execCommand(){return true;}
  },
  alert(){},
  confirm(){return true}
};

vm.createContext(context);
vm.runInContext(script,context);
vm.runInContext(`
__qa=(()=>{
  const result={};
  const dup=(arr,key)=>Object.entries(arr.reduce((m,x)=>{const k=key(x);m[k]=(m[k]||0)+1;return m;},{})).filter(([,v])=>v>1).map(([k])=>k);
  const isHidden=s=>document.querySelector(s).classList.contains('hidden');
  const hasText=(s,text)=>document.querySelector(s).innerHTML.includes(text)||document.querySelector(s).textContent.includes(text);
  const finishPlainQuiz=()=>{quiz.score=Math.min(quiz.qs.length,Math.max(0,Math.floor(quiz.qs.length/2)));finishQuiz();};
  const makeAnswer=(q,ok=true)=>({date:'2026-08-28',ok,type:q.type,cat:q.cat||'共通',term:q.term||'',id:q.id||'',unit:unitIdOf(q),diff:q.diff||'',question:q.q||'',chosen:q.a||'',correct:q.a||'',unsure:false});
  const countBy=(cat,defs)=>Object.fromEntries(defs.map(u=>[u.id,SC.filter(x=>x.cat===cat&&unitIdOf(x)===u.id).length]));
  const guideMissing=g=>!g||!g.lead||!g.easy||!g.example||!g.exam||!g.trap||!g.check||!g.check.q||!g.check.a||!Array.isArray(g.check.w)||g.check.w.length!==3||!g.check.ex;
  const getGuideSetSummary=(guides)=>({
    count:Object.keys(guides||{}).length,
    missing:Object.entries(guides||{}).filter(([,g])=>guideMissing(g)).map(([id])=>id)
  });
  const thresholds={
    law:{license:22,takkenshi:22,guarantee:22,mediation:22,documents:22,eight:22,advertising:22,supervision:22},
    rights:{capacity:22,agency:22,prescription:22,registration:22,mortgage:22,obligations:22,lease:22,inheritance:22},
    limits:{zoning:16,development:16,building:16,landuse:16,farmland:16,safety:16},
    tax:{acquisition:10,fixed:10,registration_tax:10,stamp:10,price:10,income:10}
  };
  const lawCounts=countBy('宅建業法',LAW_UNITS);
  const rightsCounts=countBy('権利関係',RIGHTS_UNITS);
  const limitsCounts=countBy('法令制限',LIMITS_UNITS);
  const taxCounts=countBy('税・その他',TAX_UNITS);
  const v22Questions=SC.filter(x=>(x.id||'').startsWith('V22-'));
  const v23Questions=SC.filter(x=>(x.id||'').startsWith('V23-'));
  const v24Questions=SC.filter(x=>(x.id||'').startsWith('V24-'));
  const mock50Counts=()=>({ '宅建業法':0,'権利関係':0,'法令制限':0,'税・その他':0 });
  const inspectMock50=()=>{
    const counts=mock50Counts();
    const ids=new Set();
    const types=new Set();
    let badLevel=false,badEligible=false,badQuality=false,wrongLen=false;
    for(const q of quiz.qs||[]){
      counts[q.cat]=(counts[q.cat]||0)+1;
      types.add(q.type||'');
      if(ids.has(q.id||'')) badEligible=true;
      ids.add(q.id||'');
      if(q.type!=='scenario') badEligible=true;
      if(!q.mockEligible) badEligible=true;
      if(q.qualityStatus!=='verified') badQuality=true;
      if((q.examLevel||0)<2) badLevel=true;
    }
    wrongLen=(quiz.qs||[]).length!==50;
    return {counts,types:[...types].sort(),badLevel,badEligible,badQuality,wrongLen,ids:[...ids]};
  };

  result.version={version:PROJECT.version,updated:PROJECT.updated};
  result.storageKey=STORAGE_KEY;
  result.counts={
    terms:G.length,
    phrases:PHRASES.length,
    breakdowns:BREAKDOWNS.length,
    questions:SC.length,
    byCat:SC.reduce((m,x)=>(m[x.cat]=(m[x.cat]||0)+1,m),{}),
    byUnit:{
      law:lawCounts,
      rights:rightsCounts,
      limits:limitsCounts,
      tax:taxCounts
    }
  };
  result.guides={
    law:getGuideSetSummary(LAW_GUIDES),
    rights:getGuideSetSummary(RIGHTS_GUIDES),
    limits:getGuideSetSummary(LIMITS_GUIDES),
    tax:getGuideSetSummary(TAX_GUIDES)
  };
  result.missing={
    id:SC.filter(x=>!x.id).length,
    unit:SC.filter(x=>!x.unit).length,
    diff:SC.filter(x=>!x.diff).length,
    trap:SC.filter(x=>!x.trap).length,
    options:SC.filter(x=>!Array.isArray(x.w)||x.w.length!==3).length,
    answer:SC.filter(x=>typeof x.a!=='string'||!x.a).length,
    explanation:SC.filter(x=>!x.ex).length,
    category:SC.filter(x=>!x.cat).length
  };
  result.duplicates={
    questionIds:dup(SC,x=>x.id),
    questionText:dup(SC,x=>x.q),
    domIds:${JSON.stringify(dupIds)}
  };
  result.v22Added={
    total:v22Questions.length,
    sourceMissing:v22Questions.filter(x=>!x.source).map(x=>x.id),
    verifiedMissing:v22Questions.filter(x=>!x.verifiedAt).map(x=>x.id)
  };
  result.v23Added={
    total:v23Questions.length,
    sourceMissing:v23Questions.filter(x=>!x.source).map(x=>x.id),
    verifiedMissing:v23Questions.filter(x=>!x.verifiedAt).map(x=>x.id),
    invalidOptions:v23Questions.filter(x=>!Array.isArray(x.w)||x.w.length!==3||x.w.includes(x.a)).map(x=>x.id)
  };
  result.v24Added={
    total:v24Questions.length,
    sourceMissing:v24Questions.filter(x=>!x.source).map(x=>x.id),
    verifiedMissing:v24Questions.filter(x=>!x.verifiedAt).map(x=>x.id),
    invalidOptions:v24Questions.filter(x=>!Array.isArray(x.w)||x.w.length!==3||x.w.includes(x.a)).map(x=>x.id),
    missingDiff:v24Questions.filter(x=>!x.diff).map(x=>x.id)
  };
  result.examMeta={
    missingExamLevel:SC.filter(x=>typeof x.examLevel!=='number'||x.examLevel<1||x.examLevel>4).map(x=>x.id),
    missingQualityStatus:SC.filter(x=>!['verified','needs_review'].includes(x.qualityStatus)).map(x=>x.id),
    missingMockEligible:SC.filter(x=>typeof x.mockEligible!=='boolean').map(x=>x.id),
    mockEligibleMinima:{
      law:SC.filter(x=>x.cat==='宅建業法'&&x.mockEligible).length,
      rights:SC.filter(x=>x.cat==='権利関係'&&x.mockEligible).length,
      limits:SC.filter(x=>x.cat==='法令制限'&&x.mockEligible).length,
      tax:SC.filter(x=>x.cat==='税・その他'&&x.mockEligible).length
    },
    strictMock50Capacity:typeof strictMock50Capacity==='function'?strictMock50Capacity():null
  };
  result.scenarioAvailability={
    byCat:SC.reduce((m,x)=>(m[x.cat]=(m[x.cat]||0)+1,m),{}),
    mock50Ready:(SC.filter(x=>x.cat==='権利関係'&&x.qualityStatus==='verified'&&x.mockEligible&&x.type==='scenario'&&x.examLevel>=2).length>=14)&&(SC.filter(x=>x.cat==='法令制限'&&x.qualityStatus==='verified'&&x.mockEligible&&x.type==='scenario'&&x.examLevel>=2).length>=8)&&(SC.filter(x=>x.cat==='税・その他'&&x.qualityStatus==='verified'&&x.mockEligible&&x.type==='scenario'&&x.examLevel>=2).length>=8)&&(SC.filter(x=>x.cat==='宅建業法'&&x.qualityStatus==='verified'&&x.mockEligible&&x.type==='scenario'&&x.examLevel>=2).length>=20)
  };
  const qualityInference={
    sourceOnly:typeof inferQualityStatus==='function'?inferQualityStatus({source:'dummy',verifiedAt:'2026-08-29'}):null,
    verifiedExplicit:typeof inferQualityStatus==='function'?inferQualityStatus({source:'dummy',verifiedAt:'2026-08-29',qualityStatus:'verified'}):null,
    verifiedItemsMissingMeta:SC.filter(x=>x.qualityStatus==='verified'&&(!x.source||!x.verifiedAt)).map(x=>x.id)
  };
  const audit50Index=new Map((legalAudit50.questions||[]).map(x=>[x.id,x]));
  const audit50Missing=legalAudit50Ids.filter(id=>!SC.some(x=>x.id===id));
  const audit50Duplicates=(legalAudit50.questions||[]).map(x=>x.id).reduce((m,id)=>(m[id]=(m[id]||0)+1,m),{});
  const audit50DupIds=Object.entries(audit50Duplicates).filter(([,n])=>n>1).map(([id])=>id);
  const audit50Bad=legalAudit50Ids.filter(id=>{
    const q=SC.find(x=>x.id===id);
    const base=audit50Index.get(id)||{};
    return !q||q.qualityStatus!=='verified'||q.mockEligible!==true||(q.examLevel||0)<(base.minimumExamLevel||2);
  });
  result.legalAudit50={
    total:legalAudit50Ids.length,
    duplicates:audit50DupIds,
    missing:audit50Missing,
    bad:audit50Bad
  };
  result.qualityInference=qualityInference;
  result.minimums={
    law:Object.fromEntries(Object.entries(thresholds.law).map(([id,n])=>[id,{count:lawCounts[id]||0,ok:(lawCounts[id]||0)>=n}])),
    rights:Object.fromEntries(Object.entries(thresholds.rights).map(([id,n])=>[id,{count:rightsCounts[id]||0,ok:(rightsCounts[id]||0)>=n}])),
    limits:Object.fromEntries(Object.entries(thresholds.limits).map(([id,n])=>[id,{count:limitsCounts[id]||0,ok:(limitsCounts[id]||0)>=n}])),
    tax:Object.fromEntries(Object.entries(thresholds.tax).map(([id,n])=>[id,{count:taxCounts[id]||0,ok:(taxCounts[id]||0)>=n}]))
  };

  const oldState={
    answers:[{date:'2026-08-27',ok:true,type:'term',cat:'宅建業法',term:'媒介',id:'legacy-1',unit:'broker',diff:'用語',question:'旧問題',chosen:'',correct:'',unsure:false}],
    weak:{媒介:1},
    struggles:[],
    breakdownHistory:[],
    reviews:{},
    streak:1,
    lastStudy:'2026-08-27',
    aiPlan:null
  };
  state=normalizeState(oldState);
  const oldBackupText=JSON.stringify({app:'manabi-tab-takken',version:'2.0',state:oldState});
  restoreFromText(oldBackupText);
  result.compatibility={
    storageKeyOk:STORAGE_KEY==='manabi_takken_v1',
    oldStateGetsMockHistory:Array.isArray(normalizeState(oldState).mockHistory),
    oldBackupRestored:Array.isArray(state.mockHistory)&&state.answers.length===1
  };

  state=normalizeState({});
  make5('normal',{cat:'宅建業法'});
  const firstNormalKeys=[...quiz.meta.questionKeys];
  finishPlainQuiz();
  result.continueUiNormal={
    visible:!isHidden('#quizContinueActions'),
    continueBtn:hasText('#quizContinueActions','続けて5問'),
    changeUnitBtn:hasText('#quizContinueActions','別の単元を学ぶ'),
    stopBtn:hasText('#quizContinueActions','やめる')
  };
  const firstNormalCat=quiz.meta.cat;
  continueFiveQuestions(quiz.meta);
  result.continueKeepsNormal={
    sameSource:quiz.meta.source==='normal',
    sameCat:quiz.meta.cat===firstNormalCat,
    avoidedPrevious:firstNormalKeys.filter(k=>quiz.meta.questionKeys.includes(k)).length<firstNormalKeys.length
  };

  make5('phrase');
  finishPlainQuiz();
  const phraseMeta={...quiz.meta};
  continueFiveQuestions(phraseMeta);
  result.continueKeepsPhrase={sameSource:quiz.meta.source==='phrase'};

  buildUnitQuiz('法令制限','zoning',5,'法令制限｜単元別5問');
  finishPlainQuiz();
  const zoningMeta={...quiz.meta};
  continueFiveQuestions(zoningMeta);
  result.continueKeepsLimitsUnit={sameSource:quiz.meta.source==='unit',sameCat:quiz.meta.cat==='法令制限',sameUnit:quiz.meta.unitId==='zoning'};

  buildUnitQuiz('税・その他','acquisition',5,'税・その他｜単元別5問');
  finishPlainQuiz();
  const taxMeta={...quiz.meta};
  continueFiveQuestions(taxMeta);
  result.continueKeepsTaxUnit={sameSource:quiz.meta.source==='unit',sameCat:quiz.meta.cat==='税・その他',sameUnit:quiz.meta.unitId==='acquisition'};

  startMock20();
  finishQuiz();
  result.noContinueMiniMock=isHidden('#quizContinueActions');

  const strictMock50Ready=result.scenarioAvailability.mock50Ready;
  const beforeStrictMockHistory=state.mockHistory.length;
  let strictMock50Started=false;
  let mock50Runs=[];
  let mock50Sample=null;
  let savedCount=0;
  let firstEntry=null;
  if(strictMock50Ready){
    for(let i=0;i<100;i++){
      const mock50StartResult=startMock50();
      strictMock50Started=strictMock50Started||mock50StartResult===50;
      const snap=inspectMock50();
      if(!mock50Sample) mock50Sample=snap;
      mock50Runs.push(snap);
      quiz.score=33;
      quiz.results=quiz.qs.map((q,j)=>({id:q.id||'',cat:q.cat,unit:unitIdOf(q),ok:j<33,unsure:j<3,q:q.q}));
      finishQuiz();
    }
    result.noContinueFullMock=isHidden('#quizContinueActions');
    savedCount=state.mockHistory.length;
    firstEntry=state.mockHistory[0];
  }else{
    const mock50StartResult=startMock50();
    strictMock50Started=mock50StartResult===0&&state.mockHistory.length===beforeStrictMockHistory;
    result.noContinueFullMock=true;
    savedCount=state.mockHistory.length;
    firstEntry=state.mockHistory[0];
  }
  startQuiz([termQuestion(G[0])],G[0].name+'｜確認問題');
  finishQuiz();
  result.noContinueSingleTerm=isHidden('#quizContinueActions');

  startQuiz([guideQuestion('権利関係',getGuide('権利関係','capacity'))],'権利関係｜確認1問');
  finishQuiz();
  result.noContinueRightsGuideCheck=isHidden('#quizContinueActions');
  startQuiz([guideQuestion('法令制限',getGuide('法令制限','zoning'))],'法令制限｜確認1問');
  finishQuiz();
  result.noContinueLimitsGuideCheck=isHidden('#quizContinueActions');
  startQuiz([guideQuestion('税・その他',getGuide('税・その他','acquisition'))],'税・その他｜確認1問');
  finishQuiz();
  result.noContinueTaxGuideCheck=isHidden('#quizContinueActions');

  const lawPool=SC.filter(x=>x.cat==='宅建業法').slice(0,6).map(scenarioQuestion);
  state=normalizeState({});
  const unseenFive=pickPreferredQuestions(lawPool,5,{excludeKeys:[]});
  result.unseenPriority={allUnseenWhenEnough:unseenFive.every(q=>!answerRecencyMap()[questionKey(q)])};
  state.answers=[makeAnswer(lawPool[0]),makeAnswer(lawPool[1])];
  const partial=pickPreferredQuestions(lawPool.slice(0,5),5,{excludeKeys:[]});
  result.unseenPriority.partialUnseenCount=partial.filter(q=>!answerRecencyMap()[questionKey(q)]&&answerRecencyMap()[questionKey(q)]!==0).length;
  state.answers=lawPool.slice(0,5).map(q=>makeAnswer(q));
  const noUnseen=pickPreferredQuestions(lawPool.slice(0,5),2,{excludeKeys:[]});
  result.unseenPriority.oldestSeenFirst=noUnseen.map(q=>q.id).join(',')===lawPool.slice(0,2).map(q=>q.id).join(',');

  const term=G.find(x=>x.cat==='宅建業法')||G[0];
  const forward=termQuestion(term),reverse=reverseTermQuestion(term);
  state.answers=[makeAnswer(forward)];
  const termPick=pickPreferredQuestions([forward,reverse],1,{excludeKeys:[]})[0];
  result.unseenPriority.forwardReverseSeparated=questionKey(termPick)===questionKey(reverse);
  state.answers=[makeAnswer(lawPool[0])];
  const scenarioPick=pickPreferredQuestions(lawPool.slice(0,2),1,{excludeKeys:[]})[0];
  result.unseenPriority.scenarioIdPriority=scenarioPick.id===lawPool[1].id;

  state=normalizeState({});
  openUnitPickerForCategory('宅建業法');
  const lawOpened=!isHidden('#unitModal');
  openUnitPickerForCategory('権利関係');
  const rightsOpened=!isHidden('#rightsUnitModal');
  openUnitPickerForCategory('法令制限');
  const limitsOpened=!isHidden('#limitsUnitModal');
  openUnitPickerForCategory('税・その他');
  const taxOpened=!isHidden('#taxUnitModal');
  result.unitPickers={lawOpened,rightsOpened,limitsOpened,taxOpened};

  state=normalizeState({});
  showGuide('宅建業法','license');
  const lawGuideShown=!isHidden('#guideModal')&&document.querySelector('#guideCat').textContent==='宅建業法';
  showGuide('法令制限','zoning');
  const limitsGuideShown=!isHidden('#guideModal')&&document.querySelector('#guideCat').textContent==='法令制限';
  showGuide('税・その他','acquisition');
  const taxGuideShown=!isHidden('#guideModal')&&document.querySelector('#guideCat').textContent==='税・その他';
  result.guideOpen={lawGuideShown,limitsGuideShown,taxGuideShown};

  state=normalizeState({});
  startMock20();
  quiz.score=10;
  quiz.results=quiz.qs.map((q,i)=>({id:q.id||'',cat:q.cat,unit:unitIdOf(q),ok:i<10,unsure:false,q:q.q}));
  finishQuiz();
  const miniMockNotSaved=state.mockHistory.length===0;
  result.mockChecks={miniMockNotSaved,savedCount,firstEntry,noDuplicateSave:state.mockHistory.length===0,mock50Count:mock50Sample?mock50Sample.counts:null,total:strictMock50Ready?mock50Runs.length>0?Object.values(mock50Runs[0].counts).reduce((n,v)=>n+v,0):0:0,mockRuns:mock50Runs,strictMock50Ready,strictMock50Started};

  state=normalizeState({});
  state.answers=Array.from({length:100},(_,i)=>({date:'2026-08-28',ok:i%2===0,type:'scenario',cat:i<40?'権利関係':i<70?'法令制限':i<90?'税・その他':'宅建業法',term:'',id:'A'+i,unit:'u',diff:'基礎',question:'Q'+i,chosen:'',correct:'',unsure:i<6}));
  result.nextAction=buildNextAction().title;

  const backup=backupJSON();
  const backupObj=JSON.parse(backup);
  restoreFromText(backup);
  result.backup={hasMockHistory:Array.isArray(backupObj.state.mockHistory),restoreWorks:Array.isArray(state.mockHistory)};

  result.failures=[];
  if(PROJECT.version!=='2.5.2') result.failures.push('PROJECT.version is not 2.5.2');
  if(PROJECT.updated!=='2026-08-29') result.failures.push('PROJECT.updated is not 2026-08-29');
  if(STORAGE_KEY!=='manabi_takken_v1') result.failures.push('STORAGE_KEY changed');
  if(result.examMeta.missingExamLevel.length) result.failures.push('examLevel missing');
  if(result.examMeta.missingQualityStatus.length) result.failures.push('qualityStatus missing');
  if(result.examMeta.missingMockEligible.length) result.failures.push('mockEligible missing');
  if(result.qualityInference.sourceOnly!=='needs_review') result.failures.push('inferQualityStatus source-only mismatch');
  if(result.qualityInference.verifiedExplicit!=='verified') result.failures.push('inferQualityStatus explicit verified mismatch');
  if(result.qualityInference.verifiedItemsMissingMeta.length) result.failures.push('verified items missing source or verifiedAt');
  if(!result.legalAudit50.total||result.legalAudit50.total!==50) result.failures.push('legal audit 50 total mismatch');
  if(result.legalAudit50.duplicates.length) result.failures.push('legal audit 50 duplicates');
  if(result.legalAudit50.missing.length) result.failures.push('legal audit 50 missing ids');
  if(result.legalAudit50.bad.length) result.failures.push('legal audit 50 items not verified or eligible');
  ['law','rights','limits','tax'].forEach(key=>{if(result.guides[key].missing.length) result.failures.push(key+' guide fields missing');});
  Object.entries(result.minimums.law).forEach(([id,row])=>{if(!row.ok) result.failures.push('law '+id+' below minimum');});
  Object.entries(result.minimums.rights).forEach(([id,row])=>{if(!row.ok) result.failures.push('rights '+id+' below minimum');});
  Object.entries(result.minimums.limits).forEach(([id,row])=>{if(!row.ok) result.failures.push('limits '+id+' below minimum');});
  Object.entries(result.minimums.tax).forEach(([id,row])=>{if(!row.ok) result.failures.push('tax '+id+' below minimum');});
  if(result.v22Added.sourceMissing.length) result.failures.push('v22 source missing');
  if(result.v22Added.verifiedMissing.length) result.failures.push('v22 verifiedAt missing');
  if(result.v23Added.total!==121) result.failures.push('v23 total mismatch');
  if(result.v23Added.sourceMissing.length) result.failures.push('v23 source missing');
  if(result.v23Added.verifiedMissing.length) result.failures.push('v23 verifiedAt missing');
  if(result.v23Added.invalidOptions.length) result.failures.push('v23 options invalid');
  if(result.counts.questions<600) result.failures.push('SC below 600');
  if((result.counts.byCat['宅建業法']||0)<200) result.failures.push('law total below 200');
  if((result.counts.byCat['権利関係']||0)<200) result.failures.push('rights total below 200');
  if((result.counts.byCat['法令制限']||0)<120) result.failures.push('limits total below 120');
  if((result.counts.byCat['税・その他']||0)<80) result.failures.push('tax total below 80');
  if(result.v24Added.total!==187) result.failures.push('v24 total mismatch');
  if(result.v24Added.sourceMissing.length) result.failures.push('v24 source missing');
  if(result.v24Added.verifiedMissing.length) result.failures.push('v24 verifiedAt missing');
  if(result.v24Added.invalidOptions.length) result.failures.push('v24 options invalid');
  if(result.v24Added.missingDiff.length) result.failures.push('v24 diff missing');
  if(result.missing.id||result.missing.unit||result.missing.diff||result.missing.trap||result.missing.options||result.missing.answer||result.missing.explanation||result.missing.category) result.failures.push('core fields missing');
  if(result.duplicates.questionIds.length||result.duplicates.questionText.length||result.duplicates.domIds.length) result.failures.push('duplicates found');
  if(!result.continueUiNormal.visible||!result.continueUiNormal.continueBtn||!result.continueUiNormal.changeUnitBtn||!result.continueUiNormal.stopBtn) result.failures.push('continue UI broken');
  if(!result.continueKeepsNormal.sameSource||!result.continueKeepsNormal.sameCat||!result.continueKeepsNormal.avoidedPrevious) result.failures.push('normal continue broken');
  if(!result.continueKeepsPhrase.sameSource) result.failures.push('phrase continue broken');
  if(!result.continueKeepsLimitsUnit.sameSource||!result.continueKeepsLimitsUnit.sameCat||!result.continueKeepsLimitsUnit.sameUnit) result.failures.push('limits unit continue broken');
  if(!result.continueKeepsTaxUnit.sameSource||!result.continueKeepsTaxUnit.sameCat||!result.continueKeepsTaxUnit.sameUnit) result.failures.push('tax unit continue broken');
  if(!result.noContinueMiniMock||!result.noContinueFullMock||!result.noContinueSingleTerm||!result.noContinueRightsGuideCheck||!result.noContinueLimitsGuideCheck||!result.noContinueTaxGuideCheck) result.failures.push('continue UI leaked into excluded flow');
  if(!result.unitPickers.lawOpened||!result.unitPickers.rightsOpened||!result.unitPickers.limitsOpened||!result.unitPickers.taxOpened) result.failures.push('unit picker broken');
  if(!result.guideOpen.lawGuideShown||!result.guideOpen.limitsGuideShown||!result.guideOpen.taxGuideShown) result.failures.push('guide modal broken');
  if(!result.compatibility.storageKeyOk||!result.compatibility.oldStateGetsMockHistory||!result.compatibility.oldBackupRestored) result.failures.push('compatibility broken');
  if(!result.backup.hasMockHistory||!result.backup.restoreWorks) result.failures.push('backup broken');
  if(!result.mockChecks.miniMockNotSaved||!result.mockChecks.noDuplicateSave) result.failures.push('mock history broken');
  if(result.mockChecks.strictMock50Ready){
    if(result.mockChecks.savedCount!==100||result.mockChecks.total!==50) result.failures.push('mock history broken');
    if(!result.mockChecks.mockRuns.length||result.mockChecks.mockRuns.some(x=>x.wrongLen||x.badLevel||x.badEligible||x.badQuality||x.types.some(t=>t!=='scenario')||x.counts['宅建業法']!==20||x.counts['権利関係']!==14||x.counts['法令制限']!==8||x.counts['税・その他']!==8)) result.failures.push('mock50 composition broken');
  }else{
    if(result.mockChecks.savedCount!==0||result.mockChecks.total!==0) result.failures.push('mock50 blocked state broken');
    if(result.mockChecks.mockRuns.length) result.failures.push('mock50 QA should not generate when strict pool is insufficient');
    if(!result.mockChecks.strictMock50Started) result.failures.push('mock50 blocked flow broken');
  }
  if(!result.unseenPriority.allUnseenWhenEnough||!result.unseenPriority.oldestSeenFirst||!result.unseenPriority.forwardReverseSeparated||!result.unseenPriority.scenarioIdPriority) result.failures.push('unseen priority broken');
  return result;
})()
`,context);

const result=context.__qa;
console.log(JSON.stringify(result,null,2));
if(result.failures.length){
  process.exitCode=1;
}
