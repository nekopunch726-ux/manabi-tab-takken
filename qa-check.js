const fs=require('fs');
const path=require('path');
const vm=require('vm');

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const scriptMatch=html.match(/<script>([\s\S]*)<\/script>/);
if(!scriptMatch) throw new Error('script not found');
const script=scriptMatch[1];
const auditScriptMatch=html.match(/<script type="application\/json" id="legalAuditRegistry">([\s\S]*?)<\/script>/);
if(!auditScriptMatch) throw new Error('legal audit registry script not found');
const legalAudit50=JSON.parse(fs.readFileSync(path.join(__dirname,'LEGAL_AUDIT_50.json'),'utf8'));
const embeddedAuditRegistry=JSON.parse(auditScriptMatch[1]);
const legalAudit50Ids=[...(new Set((legalAudit50.questions||[]).map(x=>x.id).filter(Boolean)))];
const legalAudit50SelectionIds=[...(new Set((legalAudit50.mockSelectionIds||[]).map(x=>x).filter(Boolean)))];
const legalAudit50Index=new Map((legalAudit50.questions||[]).map(x=>[x.id,x]));
const priorAuditTotal=154;

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
  html,
  script,
  ids,
  dupIds,
  embeddedAuditRegistry,
  legalAudit50,
  legalAudit50Ids,
  legalAudit50SelectionIds,
  legalAudit50Index,
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
    getElementById:id=>id==='legalAuditRegistry'?{textContent:auditScriptMatch[1]}:getEl(`#${id}`),
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
      if(!STRICT_MOCK_50_IDS.has(q.id||'')) badEligible=true;
      if(q.qualityStatus!=='verified') badQuality=true;
      if((q.examLevel||0)<2) badLevel=true;
    }
    wrongLen=(quiz.qs||[]).length!==50;
    return {counts,types:[...types].sort(),badLevel,badEligible,badQuality,wrongLen,ids:[...ids]};
  };

  result.version={version:PROJECT.version,updated:PROJECT.updated};
  result.auditRegistrySync=JSON.stringify(embeddedAuditRegistry)===JSON.stringify(legalAudit50);
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
    domIds:dupIds
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
  const audit50Missing=legalAudit50Ids.filter(id=>!SC.some(x=>x.id===id));
  const audit50SelectionMissing=legalAudit50SelectionIds.filter(id=>!legalAudit50Index.has(id));
  const audit50Duplicates=(legalAudit50.questions||[]).map(x=>x.id).reduce((m,id)=>(m[id]=(m[id]||0)+1,m),{});
  const audit50DupIds=Object.entries(audit50Duplicates).filter(([,n])=>n>1).map(([id])=>id);
  const audit50SourceMismatch=legalAudit50Ids.filter(id=>{
    const q=SC.find(x=>x.id===id);
    const base=legalAudit50Index.get(id)||{};
    return !q||
      q.source!==base.source||
      q.verifiedAt!==(base.verifiedAt||legalAudit50.rules.verifiedAt)||
      q.qualityStatus!=='verified'||
      q.legalBasisStatus!=='primary_verified'||
      !Array.isArray(q.primaryRefs)||!q.primaryRefs.length||
      !q.basisVerifiedAt||
      JSON.stringify(q.primaryRefs)!==JSON.stringify(base.primaryRefs||[])||
      JSON.stringify(q.supportingRefs||[])!==JSON.stringify(base.supportingRefs||[])||
      q.basisVerifiedAt!==(base.basisVerifiedAt||legalAudit50.rules.basisVerifiedAt);
  });
  const audit50SelectionBad=legalAudit50SelectionIds.filter(id=>{
    const q=SC.find(x=>x.id===id);
    return !q||
      q.qualityStatus!=='verified'||
      q.legalBasisStatus!=='primary_verified'||
      q.mockEligible!==true||
      (q.examLevel||0)<2||
      !Array.isArray(q.primaryRefs)||!q.primaryRefs.length||
      !q.basisVerifiedAt;
  });
  const audit50ExcludedIds=['V24-T-AC-01','V24-T-FI-01','V24-T-RT-01','V24-T-ST-01'];
  const audit50ExcludedBad=audit50ExcludedIds.filter(id=>{
    const q=SC.find(x=>x.id===id);
    const base=legalAudit50Index.get(id)||{};
    return !q||q.qualityStatus!=='verified'||q.mockEligible!==false||q.source!==base.source;
  });
  const priorAuditTotal=154;
  const selectedAuditQuestions=SC.filter(x=>legalAudit50SelectionIds.includes(x.id));
  result.legalAudit50={
    total:legalAudit50Ids.length,
    newlyAdded:Math.max(0,legalAudit50Ids.length-priorAuditTotal),
    selectionTotal:legalAudit50SelectionIds.length,
    duplicates:audit50DupIds,
    missing:audit50Missing,
    selectionMissing:audit50SelectionMissing,
    sourceMismatch:audit50SourceMismatch,
    selectionBad:audit50SelectionBad,
    excludedBad:audit50ExcludedBad,
    selectedByCat:Object.fromEntries(['宅建業法','権利関係','法令制限','税・その他'].map(cat=>[cat,selectedAuditQuestions.filter(x=>x.cat===cat).length])),
    selectedByLevel:Object.fromEntries([2,3,4].map(level=>[level,selectedAuditQuestions.filter(x=>x.examLevel===level).length])),
    bad:[...audit50SourceMismatch,...audit50SelectionBad,...audit50ExcludedBad]
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
    oldStateGetsPastExamHistory:Array.isArray(normalizeState(oldState).pastExamHistory),
    oldStateGetsPastExamWeak:Array.isArray(normalizeState(oldState).pastExamWeak),
    oldStateGetsPastExamDrafts:typeof normalizeState(oldState).pastExamDrafts==='object',
    oldBackupRestored:Array.isArray(state.mockHistory)&&Array.isArray(state.pastExamHistory)&&state.answers.length===1
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
  const allMockIds=mock50Runs.flatMap(run=>run.ids||[]);
  const uniqueMockIds=[...new Set(allMockIds)];
  const uniqueMockQuestions=uniqueMockIds.map(id=>SC.find(x=>x.id===id)).filter(Boolean);
  const mockSignatures=mock50Runs.map(run=>[...(run.ids||[])].sort().join('|'));
  const distinctMockSignatures=new Set(mockSignatures).size;
  const uniqueByCat=Object.fromEntries(['宅建業法','権利関係','法令制限','税・その他'].map(cat=>[cat,uniqueMockQuestions.filter(q=>q.cat===cat).length]));
  const poolUtilizationRate=legalAudit50SelectionIds.length?uniqueMockIds.length/legalAudit50SelectionIds.length:0;
  const usedSet=new Set(uniqueMockIds);
  const unusedSelectionIds=legalAudit50SelectionIds.filter(id=>!usedSet.has(id));
  result.mockChecks={miniMockNotSaved,savedCount,firstEntry,noDuplicateSave:state.mockHistory.length===0,mock50Count:mock50Sample?mock50Sample.counts:null,total:strictMock50Ready?mock50Runs.length>0?Object.values(mock50Runs[0].counts).reduce((n,v)=>n+v,0):0:0,mockRuns:mock50Runs,strictMock50Ready,strictMock50Started,uniqueQuestionCount:uniqueMockIds.length,uniqueByCat,distinctMockSignatures,poolUtilizationRate,unusedSelectionIds};

  state=normalizeState({});
  state.answers=Array.from({length:100},(_,i)=>({date:'2026-08-28',ok:i%2===0,type:'scenario',cat:i<40?'権利関係':i<70?'法令制限':i<90?'税・その他':'宅建業法',term:'',id:'A'+i,unit:'u',diff:'基礎',question:'Q'+i,chosen:'',correct:'',unsure:i<6}));
  result.nextAction=buildNextAction().title;

  state=normalizeState({});
  const pastExam=PAST_EXAMS[0];
  const almostAllCorrect=pastExam.answers.map((v,i)=>i===0?0:v);
  const pastGrade=gradePastExamAnswers(pastExam,almostAllCorrect);
  savePastExamResult(pastGrade,almostAllCorrect);
  renderPastExamHub();
  openPastExamSession(pastExam.id);
  setPastExamAnswer(0,pastExam.answers[0]);
  movePastExamQuestion(1);
  goPastExamQuestion(24);
  renderPastWeak();
  renderPastExamMini();
  startPastWeakRetry();
  currentPastWeakDraft=currentPastWeakItems.map(item=>Number(item.correct));
  const retryResult=gradePastWeakRetry();
  result.pastExam={
    count:PAST_EXAMS.length,
    years:PAST_EXAMS.map(x=>x.year),
    answerLengths:PAST_EXAMS.map(x=>Array.isArray(x.answers)?x.answers.length:0),
    allPdfUrlsFromRetio:PAST_EXAMS.every(x=>String(x.pdfUrl||'').startsWith('https://www.retio.or.jp/')),
    noEmbeddedQuestionText:PAST_EXAMS.every(x=>!('questions' in x)&&!('questionText' in x)&&!('choices' in x)&&!('options' in x)),
    savedHistory:Array.isArray(state.pastExamHistory)&&state.pastExamHistory.length===1,
    savedWeakCleared:Array.isArray(state.pastExamWeak)&&state.pastExamWeak.length===0,
    weakRetryCount:currentPastWeakItems.length,
    miniSummaryUpdated:hasText('#pastExamMiniSummary','採点履歴 1回'),
    hubRendered:typeof renderPastExamHub==='function'&&ids.includes('pastExamYearList'),
    viewerEmbedded:$('#pastExamViewer')&&String($('#pastExamViewer').src||'').startsWith('https://www.retio.or.jp/'),
    currentCardRendered:hasText('#pastExamCurrentCard','問25'),
    questionJumpRendered:typeof goPastExamQuestion==='function'&&ids.includes('pastExamAnswerGrid'),
    answerButtonSaved:getPastExamDraft(pastExam.id)[0]===pastExam.answers[0],
    retryWorked:!!retryResult&&retryResult.correct===retryResult.total,
    subjectLabelsOk:PAST_EXAM_SUBJECTS.length===50&&PAST_EXAM_SUBJECTS[0]==='権利関係'&&PAST_EXAM_SUBJECTS[14]==='法令制限'&&PAST_EXAM_SUBJECTS[22]==='税・その他'&&PAST_EXAM_SUBJECTS[25]==='宅建業法'&&PAST_EXAM_SUBJECTS[45]==='5問免除',
    firstGrade:{score:pastGrade.score,total:pastGrade.total,wrongItems:pastGrade.wrongItems.length}
  };

  const backup=backupJSON();
  const backupObj=JSON.parse(backup);
  restoreFromText(backup);
  result.backup={hasMockHistory:Array.isArray(backupObj.state.mockHistory),hasPastExamHistory:Array.isArray(backupObj.state.pastExamHistory),restoreWorks:Array.isArray(state.mockHistory)&&Array.isArray(state.pastExamHistory)};

  result.failures=[];
  if(PROJECT.version!=='2.11.1') result.failures.push('PROJECT.version is not 2.11.1');
  if(PROJECT.updated!=='2026-09-01') result.failures.push('PROJECT.updated is not 2026-09-01');
  const uiIds=Object.fromEntries(['startDue','dueCount','reviewScheduleMini','openAI','aiPlanMini','openOther','openReviewHub','openReadHub','openMockHub','openBeginner','openFieldGuide','subjectCards','dailyReadinessLabel','dailyDueCount','dailyNextTitle','openPastExamHub','openPastExamHub2','pastExamMiniSummary','pastExamYearList','pastExamAnswerGrid','pastExamViewer','pastExamCurrentCard','pastExamProgressLabel','pastWeakList'].map(id=>[id,ids.includes(id)]));
  const headerSection=html.split('</header>')[0]||html;
  const bodySection=html.split('</header>')[1]||html;
  const homeSection=bodySection.split('<div id="reviewHubModal"')[0]||bodySection;
  const quickSection=(homeSection.match(/<div class="quick">([\\s\\S]*?)<\\/div>/)||[])[1]||'';
  const quickButtonCount=(quickSection.match(/<button /g)||[]).length;
  const headerHasDict=headerSection.includes('openDictHeader');
  const homeHasReadinessCard=homeSection.includes('readinessCardTitle')||homeSection.includes('openReadiness2')||homeSection.includes('readinessLead')||homeSection.includes('readinessLast')||homeSection.includes('readinessDisclaimer');
  const homeHasDevCard=homeSection.includes('devPctMini')||homeSection.includes('devBarMini')||homeSection.includes('devNextMini')||homeSection.includes('完成までの進捗');
  const homeHasBackupCard=quickSection.includes('openBackup');
  const aiOldGuide=html.includes('ホームの「AIおすすめ5問」から開始できます。');
  const aiNewGuide=html.includes('AIコーチの「おすすめ5問へ」から次へ進めます。');
  const removedUiRefs={startDue2:html.includes('startDue2')||script.includes('startDue2'),openAI2:html.includes('openAI2')||script.includes('openAI2')};
  const directHandlerRegex=/\$\('#([^']+)'\)\.(onclick|onchange|oninput|onsubmit|onblur|onfocus)\s*=/g;
  const missingIdDirectHandlers=[];
  let directHandlerMatch;
  while((directHandlerMatch=directHandlerRegex.exec(script))!==null){
    const targetId=directHandlerMatch[1];
    if(!ids.includes(targetId)) missingIdDirectHandlers.push(targetId);
  }
  result.missingIdDirectHandlers=[...new Set(missingIdDirectHandlers)];
  if(!result.auditRegistrySync) result.failures.push('embedded audit registry mismatch');
  if(STORAGE_KEY!=='manabi_takken_v1') result.failures.push('STORAGE_KEY changed');
  if(!uiIds.startDue||!uiIds.dueCount||!uiIds.reviewScheduleMini||!uiIds.openAI||!uiIds.aiPlanMini||!uiIds.openOther||!uiIds.openReviewHub||!uiIds.openReadHub||!uiIds.openMockHub||!uiIds.openBeginner||!uiIds.openFieldGuide||!uiIds.subjectCards||!uiIds.dailyReadinessLabel||!uiIds.dailyDueCount||!uiIds.dailyNextTitle||!uiIds.openPastExamHub||!uiIds.openPastExamHub2||!uiIds.pastExamMiniSummary||!uiIds.pastExamYearList||!uiIds.pastExamAnswerGrid||!uiIds.pastExamViewer||!uiIds.pastExamCurrentCard||!uiIds.pastExamProgressLabel||!uiIds.pastWeakList) result.failures.push('ui ids missing');
  if(quickButtonCount!==6) result.failures.push('quick cards not 6');
  if(headerHasDict) result.failures.push('header dictionary shortcut still present');
  if(homeHasReadinessCard) result.failures.push('home readiness card still present');
  if(homeHasDevCard) result.failures.push('home development progress still present');
  if(homeHasBackupCard) result.failures.push('backup still in quick cards');
  if(aiOldGuide||!aiNewGuide) result.failures.push('AI import guidance text not updated');
  if(removedUiRefs.startDue2||removedUiRefs.openAI2) result.failures.push('removed ui refs still present');
  if(result.missingIdDirectHandlers.length) result.failures.push('missing direct handler targets: '+result.missingIdDirectHandlers.join(', '));
  if(result.examMeta.missingExamLevel.length) result.failures.push('examLevel missing');
  if(result.examMeta.missingQualityStatus.length) result.failures.push('qualityStatus missing');
  if(result.examMeta.missingMockEligible.length) result.failures.push('mockEligible missing');
  if(result.qualityInference.sourceOnly!=='needs_review') result.failures.push('inferQualityStatus source-only mismatch');
  if(result.qualityInference.verifiedExplicit!=='verified') result.failures.push('inferQualityStatus explicit verified mismatch');
  if(result.qualityInference.verifiedItemsMissingMeta.length) result.failures.push('verified items missing source or verifiedAt');
  if(result.legalAudit50.total<300) result.failures.push('legal audit pool below 300');
  if(result.legalAudit50.total-priorAuditTotal<150) result.failures.push('legal audit new audited questions below 150');
  if(result.legalAudit50.selectionTotal<150) result.failures.push('legal audit pool selection below 150');
  if(result.legalAudit50.duplicates.length) result.failures.push('legal audit 50 duplicates');
  if(result.legalAudit50.missing.length) result.failures.push('legal audit 50 missing ids');
  if(result.legalAudit50.selectionMissing.length) result.failures.push('legal audit 50 selection ids missing');
  if(result.legalAudit50.sourceMismatch.length) result.failures.push('legal audit 50 source mismatch');
  if(result.legalAudit50.selectionBad.length) result.failures.push('legal audit 50 selected items not verified or eligible');
  if(result.legalAudit50.excludedBad.length) result.failures.push('legal audit 50 excluded tax items mismatch');
  if(result.legalAudit50.bad.length) result.failures.push('legal audit 50 items not verified or eligible');
  if((result.examMeta.strictMock50Capacity['宅建業法']||0)<60||(result.examMeta.strictMock50Capacity['権利関係']||0)<45||(result.examMeta.strictMock50Capacity['法令制限']||0)<25||(result.examMeta.strictMock50Capacity['税・その他']||0)<20) result.failures.push('strict mock pool below v2.8 minimums');
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
  if(!result.compatibility.storageKeyOk||!result.compatibility.oldStateGetsMockHistory||!result.compatibility.oldStateGetsPastExamHistory||!result.compatibility.oldStateGetsPastExamWeak||!result.compatibility.oldStateGetsPastExamDrafts||!result.compatibility.oldBackupRestored) result.failures.push('compatibility broken');
  if(!result.backup.hasMockHistory||!result.backup.hasPastExamHistory||!result.backup.restoreWorks) result.failures.push('backup broken');
  if(result.pastExam.count!==3||result.pastExam.years.join(',')!=='2025,2024,2023') result.failures.push('past exam years broken');
  if(result.pastExam.answerLengths.some(x=>x!==50)) result.failures.push('past exam answers broken');
  if(!result.pastExam.allPdfUrlsFromRetio||!result.pastExam.noEmbeddedQuestionText) result.failures.push('past exam source policy broken');
  if(!result.pastExam.savedHistory||!result.pastExam.savedWeakCleared||!result.pastExam.retryWorked) result.failures.push('past exam persistence broken');
  if(!result.pastExam.hubRendered||!result.pastExam.miniSummaryUpdated||!result.pastExam.subjectLabelsOk||!result.pastExam.viewerEmbedded||!result.pastExam.currentCardRendered||!result.pastExam.questionJumpRendered||!result.pastExam.answerButtonSaved) result.failures.push('past exam ui broken');
  if(!result.mockChecks.miniMockNotSaved||!result.mockChecks.noDuplicateSave) result.failures.push('mock history broken');
  if(result.mockChecks.strictMock50Ready){
    if(result.mockChecks.savedCount!==100||result.mockChecks.total!==50) result.failures.push('mock history broken');
    if(!result.mockChecks.mockRuns.length||result.mockChecks.mockRuns.some(x=>x.wrongLen||x.badLevel||x.badEligible||x.badQuality||x.types.some(t=>t!=='scenario')||x.counts['宅建業法']!==20||x.counts['権利関係']!==14||x.counts['法令制限']!==8||x.counts['税・その他']!==8)) result.failures.push('mock50 composition broken');
    if(result.mockChecks.uniqueQuestionCount<120) result.failures.push('mock50 unique question count too low');
    if(result.mockChecks.poolUtilizationRate<0.8) result.failures.push('mock50 pool utilization too low');
    if(result.mockChecks.distinctMockSignatures<10) result.failures.push('mock50 signatures too few');
    if((result.mockChecks.uniqueByCat['宅建業法']||0)<50||(result.mockChecks.uniqueByCat['権利関係']||0)<38||(result.mockChecks.uniqueByCat['法令制限']||0)<20||(result.mockChecks.uniqueByCat['税・その他']||0)<16) result.failures.push('mock50 unique by cat too low');
    if(result.mockChecks.unusedSelectionIds.length>30) result.failures.push('mock50 unused selection ids too many');
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
