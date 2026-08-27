const fs=require('fs');
const path=require('path');
const vm=require('vm');

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const scriptMatch=html.match(/<script>([\s\S]*)<\/script>/);
if(!scriptMatch) throw new Error('script not found');
const script=scriptMatch[1];

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
const stubEl=() => ({
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
  const dup=(arr,key)=>Object.entries(arr.reduce((m,x)=>{const k=key(x);m[k]=(m[k]||0)+1;return m;},{})).filter(([,v])=>v>1).map(([k])=>k);
  const isHidden=s=>document.querySelector(s).classList.contains('hidden');
  const hasText=(s,text)=>document.querySelector(s).innerHTML.includes(text)||document.querySelector(s).textContent.includes(text);
  const finishPlainQuiz=()=>{quiz.score=Math.min(quiz.qs.length,Math.max(0,Math.floor(quiz.qs.length/2)));finishQuiz();};
  const makeAnswer=(q,ok=true)=>({date:'2026-08-28',ok,type:q.type,cat:q.cat||'共通',term:q.term||'',id:q.id||'',unit:unitIdOf(q),diff:q.diff||'',question:q.q||'',chosen:q.a||'',correct:q.a||'',unsure:false});

  const result={};
  result.version={version:PROJECT.version,updated:PROJECT.updated};
  result.storageKey=STORAGE_KEY;
  result.counts={
    terms:G.length,
    phrases:PHRASES.length,
    breakdowns:BREAKDOWNS.length,
    questions:SC.length,
    byCat:SC.reduce((m,x)=>(m[x.cat]=(m[x.cat]||0)+1,m),{})
  };
  result.guides={
    rights:Object.keys(RIGHTS_GUIDES||{}).length,
    missing:Object.entries(RIGHTS_GUIDES||{}).filter(([,g])=>!g.lead||!g.easy||!g.example||!g.exam||!g.trap||!g.check||!g.check.q||!g.check.a||!Array.isArray(g.check.w)||g.check.w.length!==3).map(([id])=>id)
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

  buildUnitQuiz('法令制限',LIMITS_UNITS[0].id,5,'法令上の制限｜単元別5問');
  finishPlainQuiz();
  const limitMeta={...quiz.meta};
  continueFiveQuestions(limitMeta);
  result.continueKeepsUnit={
    sameSource:quiz.meta.source==='unit',
    sameCat:quiz.meta.cat==='法令制限',
    sameUnit:quiz.meta.unitId===LIMITS_UNITS[0].id
  };

  startMock20();
  finishQuiz();
  result.noContinueMiniMock=isHidden('#quizContinueActions');

  startMock50();
  quiz.score=30;
  quiz.results=quiz.qs.map((q,i)=>({id:q.id||'',cat:q.cat,unit:unitIdOf(q),ok:i<30,unsure:false,q:q.q}));
  finishQuiz();
  result.noContinueFullMock=isHidden('#quizContinueActions');

  startQuiz([termQuestion(G[0])],G[0].name+'｜確認問題');
  finishQuiz();
  result.noContinueSingleTerm=isHidden('#quizContinueActions');

  const guide=getRightsGuide('capacity')||Object.values(RIGHTS_GUIDES||{})[0];
  startQuiz([guideQuestion(guide)],'権利関係｜確認1問');
  finishQuiz();
  result.noContinueGuideCheck=isHidden('#quizContinueActions');

  const lawPool=SC.filter(x=>x.cat==='宅建業法').slice(0,6).map(scenarioQuestion);
  state=normalizeState({});
  const unseenFive=pickPreferredQuestions(lawPool,5,{excludeKeys:[]});
  result.unseenPriority={
    allUnseenWhenEnough:unseenFive.every(q=>!answerRecencyMap()[questionKey(q)])
  };
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
  startMock20();
  quiz.score=10;
  quiz.results=quiz.qs.map((q,i)=>({id:q.id||'',cat:q.cat,unit:unitIdOf(q),ok:i<10,unsure:false,q:q.q}));
  finishQuiz();
  const miniMockNotSaved=state.mockHistory.length===0;
  startMock50();
  quiz.score=33;
  quiz.results=quiz.qs.map((q,i)=>({id:q.id||'',cat:q.cat,unit:unitIdOf(q),ok:i<33,unsure:i<3,q:q.q}));
  finishQuiz();
  const savedCount=state.mockHistory.length;
  const firstEntry=state.mockHistory[0];
  finishQuiz();
  result.mockChecks={
    miniMockNotSaved,
    savedCount,
    firstEntry,
    noDuplicateSave:state.mockHistory.length===savedCount,
    mock50Count:startMock50(), total:quiz.qs.length
  };

  state=normalizeState({});
  state.answers=Array.from({length:100},(_,i)=>({date:'2026-08-28',ok:i%2===0,type:'scenario',cat:i<40?'権利関係':i<70?'法令制限':i<90?'税・その他':'宅建業法',term:'',id:'A'+i,unit:'u',diff:'基礎',question:'Q'+i,chosen:'',correct:'',unsure:i<6}));
  result.nextAction=buildNextAction().title;

  const backup=backupJSON();
  const backupObj=JSON.parse(backup);
  restoreFromText(backup);
  result.backup={
    hasMockHistory:Array.isArray(backupObj.state.mockHistory),
    restoreWorks:Array.isArray(state.mockHistory)
  };

  return result;
})()
`,context);

console.log(JSON.stringify(context.__qa,null,2));
