const $=id=>document.getElementById(id);
const els=Object.fromEntries([
  'metaAppId','graphVersion','workerUrl','pixabayKey','saveSetup','connectFacebook','disconnectFacebook',
  'pageSelect','connectionStatus','topStatus','sourceAutoTab','sourceOwnTab','autoSourcePanel','ownSourcePanel',
  'topic','findFreshVideo','sourceInfo','ownVideo','rightsConfirm','createPreview','progressBar','autoStatus',
  'previewStage','reelPreview','previewInfo','findAnother','uploadReel','caption','hashtags','regenerateCopy'
].map(id=>[id,$(id)]));

const META_APP_ID='39365842192999950';
const META_LOGIN_CONFIG_ID='4635831679973280';
let pages=[];
let selectedPage=null;
let sourceMode='auto';
let ownFile=null;
let selectedFile=null;
let selectedSource=null;
let previewUrl='';
let searchPage=1;
let searchBusy=false;
let uploadBusy=false;
const seenVideoIds=new Set();

function setProgress(pct,text){
  els.progressBar.style.width=`${Math.max(0,Math.min(100,pct))}%`;
  if(text) els.autoStatus.textContent=text;
}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function safeWords(text=''){return String(text).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);}
function titleCase(text=''){return String(text).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().split(' ').map(x=>x?x[0].toUpperCase()+x.slice(1):x).join(' ');}
function formatBytes(n=0){
  n=Number(n)||0;
  if(n<1024*1024) return `${(n/1024).toFixed(0)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}
const SEO_STOPWORDS=new Set(['the','and','for','with','from','this','that','your','into','over','under','about','video','reel','reels','facebook','short','watch','latest','fresh']);

function hashTag(text=''){
  const clean=String(text).replace(/&/g,' and ').replace(/[^a-zA-Z0-9]+/g,' ').trim();
  if(!clean) return '';
  const parts=clean.split(/\s+/).filter(Boolean);
  return '#'+parts.map(p=>p.charAt(0).toUpperCase()+p.slice(1).toLowerCase()).join('');
}

function seoProfile(raw=''){
  const lower=String(raw).toLowerCase();
  const source=String(selectedSource?.tags||selectedSource?.title||'').toLowerCase();
  const combined=`${lower} ${source}`;

  if(/\b(world war (?:1|i)|ww1|first world war)\b/.test(combined)){
    return {
      title:'World War I History',
      intro:'Explore World War I history through a short visual Reel covering the people, places and military history connected to the conflict.',
      cta:'Which part of World War I history should we cover next?',
      tags:['#WorldWarI','#WWIHistory','#MilitaryHistory','#WarHistory','#HistoryReels','#HistoricalFootage']
    };
  }
  if(/\b(world war (?:2|ii)|ww2|second world war)\b/.test(combined)){
    return {
      title:'World War II History',
      intro:'Explore World War II history through a short visual Reel covering the people, places and military history connected to the conflict.',
      cta:'Which part of World War II history should we cover next?',
      tags:['#WorldWarII','#WWIIHistory','#MilitaryHistory','#WarHistory','#HistoryReels','#HistoricalFootage']
    };
  }
  if((/\bunited states\b/.test(combined)||/\bu\.?s\.?\b/.test(combined)||/\bamerican\b/.test(combined)) && /\b(war|military|battle|army|navy|air force|marines)\b/.test(combined)){
    return {
      title:'United States War History',
      intro:'Explore United States war and military history in this short visual Reel, with a focus on the events, places and stories connected to America’s military past.',
      cta:'Which part of U.S. military history should we cover next?',
      tags:['#UnitedStatesHistory','#AmericanHistory','#MilitaryHistory','#WarHistory','#USMilitary','#HistoryReels','#HistoricalFootage']
    };
  }
  if(/\b(war|military|battle|army|navy|air force|marines)\b/.test(combined)){
    return {
      title:titleCase(raw||'Military History'),
      intro:`Explore ${titleCase(raw||'military history')} in this short visual Reel focused on the people, places and stories behind the topic.`,
      cta:'Which part of this history should we cover next?',
      tags:['#MilitaryHistory','#WarHistory','#HistoryReels','#HistoricalFootage','#History']
    };
  }
  if(/\b(lion|tiger|elephant|leopard|cheetah|wildlife|animal|animals)\b/.test(combined)){
    return {
      title:titleCase(raw||'Wildlife'),
      intro:`Watch ${titleCase(raw||'wildlife')} up close in this fresh vertical Reel featuring a striking wildlife moment.`,
      cta:'What animal should we feature next?',
      tags:['#Wildlife','#WildlifeVideo','#Animals','#Nature','#AnimalReels','#NatureReels']
    };
  }
  if(/\b(puppy|puppies|dog|dogs|kitten|kittens|cat|cats|pet|pets)\b/.test(combined)){
    return {
      title:titleCase(raw||'Cute Pets'),
      intro:`Enjoy this fresh ${titleCase(raw||'pet')} Reel featuring a fun, adorable moment worth watching to the end.`,
      cta:'Which pet should we feature next?',
      tags:['#CuteAnimals','#Pets','#PetVideos','#DogsAndCats','#AnimalReels','#FeelGood']
    };
  }
  if(/\b(nature|mountain|ocean|beach|forest|waterfall|landscape|new zealand|travel)\b/.test(combined)){
    return {
      title:titleCase(raw||'Nature'),
      intro:`Take a quick look at ${titleCase(raw||'nature')} in this fresh vertical Reel featuring scenery and outdoor moments.`,
      cta:'Where should we feature next?',
      tags:['#Nature','#NatureReels','#TravelVideo','#Scenery','#ExploreMore','#BeautifulPlaces']
    };
  }
  if(/\b(car|cars|supercar|truck|motorcycle|bike|vehicle)\b/.test(combined)){
    return {
      title:titleCase(raw||'Cars'),
      intro:`Check out ${titleCase(raw||'cars')} in this fresh vertical Reel made for automotive fans.`,
      cta:'What vehicle should we feature next?',
      tags:['#Cars','#CarVideos','#Automotive','#CarReels','#Motorsport','#Vehicles']
    };
  }
  if(/\b(football|soccer|rugby|basketball|tennis|cricket|sport|sports)\b/.test(combined)){
    return {
      title:titleCase(raw||'Sports'),
      intro:`Watch this ${titleCase(raw||'sports')} Reel featuring a fresh sports moment.`,
      cta:'What sport should we feature next?',
      tags:['#Sports','#SportsReels','#SportsVideo','#GameDay','#Athletes']
    };
  }

  const cleanTitle=titleCase(raw||'Amazing Moment').slice(0,90);
  return {
    title:cleanTitle,
    intro:`Discover ${cleanTitle} in this fresh vertical Reel. Watch the full clip and tell us what stood out to you.`,
    cta:'What should we feature next?',
    tags:['#FacebookReels','#Reels','#ShortVideo','#TrendingTopics']
  };
}

function generateCopy(){
  const raw=els.topic.value.trim()||selectedSource?.tags||selectedSource?.title||ownFile?.name?.replace(/\.[^.]+$/,'')||'Amazing moment';
  const profile=seoProfile(raw);
  const sourceWords=safeWords(selectedSource?.tags||raw).filter(w=>w.length>3&&!SEO_STOPWORDS.has(w));
  const dynamic=[];

  dynamic.push(hashTag(profile.title));
  if(raw && raw.toLowerCase()!==profile.title.toLowerCase()) dynamic.push(hashTag(raw));

  for(const w of sourceWords){
    if(dynamic.length>=4) break;
    dynamic.push(hashTag(w));
  }

  const tags=[...new Set([
    '#FacebookReels',
    '#Reels',
    ...profile.tags,
    ...dynamic
  ].filter(Boolean))].slice(0,9);

  els.caption.value=`${profile.title} 🎥\n\n${profile.intro}\n\n${profile.cta}`;
  els.hashtags.value=tags.join(' ');
}

els.regenerateCopy.addEventListener('click',generateCopy);

function saveSetup(){
  localStorage.setItem('fbclip.appId',els.metaAppId.value.trim());
  localStorage.setItem('fbclip.graphVersion',els.graphVersion.value.trim()||'v24.0');
  localStorage.setItem('fbclip.workerUrl',els.workerUrl.value.trim().replace(/\/+$/,''));
  localStorage.setItem('fbclip.pixabayKey',els.pixabayKey.value.trim());
  els.connectionStatus.textContent='Setup saved on this device.';
}
els.saveSetup.addEventListener('click',saveSetup);
function restoreSetup(){
  els.metaAppId.value=localStorage.getItem('fbclip.appId')||META_APP_ID;
  els.graphVersion.value=localStorage.getItem('fbclip.graphVersion')||'v24.0';
  els.workerUrl.value=localStorage.getItem('fbclip.workerUrl')||'';
  els.pixabayKey.value=localStorage.getItem('fbclip.pixabayKey')||'';
}
restoreSetup();

async function ensureFacebookSdk(){
  const appId=els.metaAppId.value.trim();
  if(!appId) throw new Error('Add your Meta App ID first.');
  if(window.FB) return;
  await new Promise((resolve,reject)=>{
    window.fbAsyncInit=()=>{FB.init({appId,cookie:true,xfbml:false,version:els.graphVersion.value.trim()||'v24.0'});resolve();};
    const s=document.createElement('script');
    s.src='https://connect.facebook.net/en_US/sdk.js';s.async=true;s.defer=true;s.crossOrigin='anonymous';
    s.onerror=()=>reject(new Error('Could not load Facebook SDK.'));
    document.head.appendChild(s);
  });
}
function fbLogin(){
  return new Promise((resolve,reject)=>FB.login(res=>{
    if(!res?.authResponse?.accessToken) reject(new Error('Facebook connection was cancelled or not approved.'));
    else resolve(res.authResponse.accessToken);
  },{config_id:META_LOGIN_CONFIG_ID}));
}
function fbApi(path){
  return new Promise((resolve,reject)=>FB.api(path,'GET',res=>{
    if(!res||res.error) reject(new Error(res?.error?.message||'Facebook API request failed.'));
    else resolve(res);
  }));
}
async function loadPages(){
  const data=await fbApi('/me/accounts?fields=id,name,access_token&limit=100');
  pages=Array.isArray(data.data)?data.data.filter(x=>x.id&&x.name&&x.access_token):[];
  els.pageSelect.innerHTML=pages.length?'<option value="">Choose a Page…</option>'+pages.map((p,i)=>`<option value="${i}">${escapeHtml(p.name)}</option>`).join(''):'<option value="">No Pages available</option>';
  els.pageSelect.disabled=!pages.length;
}
els.connectFacebook.addEventListener('click',async()=>{
  saveSetup();
  els.connectionStatus.textContent='Opening Facebook connection…';
  try{
    await ensureFacebookSdk();
    await fbLogin();
    await loadPages();
    els.connectionStatus.textContent=pages.length?`Connected. Choose one of your ${pages.length} Facebook Pages.`:'Connected, but no manageable Pages were returned.';
    els.topStatus.textContent='● Facebook connected';
    els.connectFacebook.classList.add('hidden');
    els.disconnectFacebook.classList.remove('hidden');
  }catch(err){els.connectionStatus.textContent=`Connection failed: ${err.message}`;}
});
els.disconnectFacebook.addEventListener('click',()=>{
  pages=[];selectedPage=null;
  els.pageSelect.innerHTML='<option value="">Connect Facebook first</option>';els.pageSelect.disabled=true;
  els.connectFacebook.classList.remove('hidden');els.disconnectFacebook.classList.add('hidden');
  els.topStatus.textContent='● Facebook not connected';els.connectionStatus.textContent='Disconnected from this browser session.';
});
els.pageSelect.addEventListener('change',()=>{
  const i=Number(els.pageSelect.value);selectedPage=Number.isInteger(i)&&pages[i]?pages[i]:null;
  if(selectedPage) els.connectionStatus.textContent=`Selected Page: ${selectedPage.name}`;
});

function setSourceMode(mode){
  sourceMode=mode;
  els.sourceAutoTab.classList.toggle('active',mode==='auto');
  els.sourceOwnTab.classList.toggle('active',mode==='own');
  els.autoSourcePanel.classList.toggle('hidden',mode!=='auto');
  els.ownSourcePanel.classList.toggle('hidden',mode!=='own');
  selectedFile=null;selectedSource=null;
  clearPreview();
}
els.sourceAutoTab.addEventListener('click',()=>setSourceMode('auto'));
els.sourceOwnTab.addEventListener('click',()=>setSourceMode('own'));
els.ownVideo.addEventListener('change',()=>{
  ownFile=els.ownVideo.files?.[0]||null;
  if(!ownFile) return;
  if(!/\.m4?v$/i.test(ownFile.name)&&ownFile.type!=='video/mp4'){
    ownFile=null;els.ownVideo.value='';
    return setProgress(0,'For the fast preview-first version, choose an MP4/M4V video.');
  }
  selectedFile=ownFile;
  selectedSource={kind:'own',title:ownFile.name,size:ownFile.size};
  els.topic.value ||= ownFile.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
  els.sourceInfo.textContent=`Selected your video: ${ownFile.name} • ${formatBytes(ownFile.size)}`;
  generateCopy();
  clearPreview();
});

function oldLooking(text=''){
  return /black\s*(?:and|&)\s*white|monochrome|grayscale|grey\s*scale|vintage|retro|archive|archival|historic|historical|old\s*film|film\s*grain|sepia|world\s*war|ww[12]|\b(?:18|19)\d{2}\b/i.test(text);
}
function pickVerticalRendition(hit){
  const vids=Object.values(hit?.videos||{}).filter(v=>v?.url&&Number(v.width)>0&&Number(v.height)>0);
  const vertical=vids.filter(v=>v.height>v.width&&v.width>=1000&&v.height>=1700&&v.width/v.height>0.50&&v.width/v.height<0.62&&Number(v.size||0)<=35*1024*1024);
  if(!vertical.length) return null;
  vertical.sort((a,b)=>Number(a.size||0)-Number(b.size||0));
  return vertical[0];
}
async function pixabaySearch(topic,page=1){
  const key=els.pixabayKey.value.trim();
  if(!key) throw new Error('Add your free Pixabay API key in Step 1 first.');
  const q=new URLSearchParams({
    key,q:topic,video_type:'film',safesearch:'true',order:'latest',page:String(page),per_page:'80',min_width:'720',min_height:'1280'
  });
  const r=await fetch(`https://pixabay.com/api/videos/?${q}`);
  if(!r.ok){
    const t=await r.text();
    throw new Error(t||`Pixabay search failed (${r.status}).`);
  }
  const data=await r.json();
  return Array.isArray(data.hits)?data.hits:[];
}
async function downloadCandidate(hit,rendition){
  let url=rendition.url;
  url+=url.includes('?')?'&download=1':'?download=1';
  const r=await fetch(url);
  if(!r.ok) throw new Error('Could not download this stock video.');
  const blob=await r.blob();
  return new File([blob],`pixabay-${hit.id}.mp4`,{type:'video/mp4'});
}
function waitEvent(el,name,timeout=8000){
  return new Promise((resolve,reject)=>{
    const done=()=>{clearTimeout(t);el.removeEventListener(name,done);resolve();};
    const t=setTimeout(()=>{el.removeEventListener(name,done);reject(new Error(`Timed out waiting for ${name}`));},timeout);
    el.addEventListener(name,done,{once:true});
  });
}
async function colorScore(file){
  const url=URL.createObjectURL(file);
  const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='metadata';v.src=url;
  try{
    await waitEvent(v,'loadedmetadata',8000);
    const duration=Number.isFinite(v.duration)&&v.duration>0?v.duration:4;
    const times=[0.22,0.5,0.78].map(x=>Math.min(Math.max(.05,duration*x),Math.max(.05,duration-.05)));
    const c=document.createElement('canvas');c.width=160;c.height=90;const ctx=c.getContext('2d',{willReadFrequently:true});
    let colorful=0,total=0;
    for(const t of times){
      try{v.currentTime=t;await waitEvent(v,'seeked',5000);}catch{}
      try{ctx.drawImage(v,0,0,c.width,c.height);}catch{continue;}
      const d=ctx.getImageData(0,0,c.width,c.height).data;
      for(let i=0;i<d.length;i+=32){
        const r=d[i],g=d[i+1],b=d[i+2];const spread=Math.max(r,g,b)-Math.min(r,g,b);
        if(spread>18) colorful++;total++;
      }
    }
    return total?colorful/total:1;
  }catch{return 1;}finally{URL.revokeObjectURL(url);}
}
async function videoMeta(file){
  const url=URL.createObjectURL(file);const v=document.createElement('video');v.preload='metadata';v.src=url;
  try{await waitEvent(v,'loadedmetadata',8000);return {width:v.videoWidth||0,height:v.videoHeight||0,duration:v.duration||0};}
  catch{return {width:0,height:0,duration:0};}
  finally{URL.revokeObjectURL(url);}
}
async function findFresh(){
  if(searchBusy) return;
  const topic=els.topic.value.trim();
  if(!topic) return setProgress(0,'Enter a topic first.');
  saveSetup();searchBusy=true;els.findFreshVideo.disabled=true;els.findAnother.disabled=true;
  clearPreview();
  try{
    for(let pageTry=0;pageTry<3;pageTry++){
      const page=searchPage++;
      setProgress(8,`Searching newest colour videos… page ${page}`);
      const hits=await pixabaySearch(topic,page);
      const candidates=hits.filter(hit=>{
        if(seenVideoIds.has(hit.id)) return false;
        if(oldLooking(`${hit.tags||''} ${hit.user||''}`)) return false;
        if(Number(hit.duration||0)>60||Number(hit.duration||0)<5) return false;
        return Boolean(pickVerticalRendition(hit));
      });
      for(const hit of candidates){
        seenVideoIds.add(hit.id);
        const rendition=pickVerticalRendition(hit);
        setProgress(20,`Checking a fresh ${rendition.width}×${rendition.height} video for colour…`);
        let file;
        try{file=await downloadCandidate(hit,rendition);}catch{continue;}
        const score=await colorScore(file);
        if(score<0.06) continue;
        const meta=await videoMeta(file);
        selectedFile=file;
        selectedSource={kind:'pixabay',id:hit.id,title:hit.tags||topic,tags:hit.tags||topic,user:hit.user||'Pixabay contributor',pageURL:hit.pageURL,width:meta.width||rendition.width,height:meta.height||rendition.height,duration:meta.duration||hit.duration,size:file.size,colorScore:score};
        els.sourceInfo.innerHTML=`Fresh colour video selected: <strong>${escapeHtml(selectedSource.width)}×${escapeHtml(selectedSource.height)}</strong> • ${escapeHtml((selectedSource.duration||0).toFixed(0))} sec • ${escapeHtml(formatBytes(file.size))}<div class="source-credit">Video by ${escapeHtml(selectedSource.user)} via <a href="${escapeHtml(selectedSource.pageURL)}" target="_blank" rel="noopener">Pixabay</a>.</div>`;
        generateCopy();
        setProgress(35,'Fresh colour video ready. Press CREATE PREVIEW.');
        return;
      }
    }
    throw new Error('I could not find a fresh vertical colour 1080p-style video for that topic. Try a broader topic.');
  }catch(err){setProgress(0,err.message);}
  finally{searchBusy=false;els.findFreshVideo.disabled=false;els.findAnother.disabled=false;}
}
els.findFreshVideo.addEventListener('click',findFresh);
els.findAnother.addEventListener('click',async()=>{selectedFile=null;selectedSource=null;clearPreview();await findFresh();if(selectedFile) await createPreview();});

function clearPreview(){
  els.uploadReel.disabled=true;
  els.previewStage.classList.add('hidden');
  els.findAnother.classList.add('hidden');
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}
  els.reelPreview.removeAttribute('src');els.reelPreview.load();
}
async function createPreview(){
  if(!els.rightsConfirm.checked) return setProgress(0,'Tick the rights/source confirmation first.');
  if(sourceMode==='auto'&&!selectedFile){await findFresh();if(!selectedFile)return;}
  if(sourceMode==='own'&&!ownFile) return setProgress(0,'Choose your MP4 video first.');
  const file=sourceMode==='auto'?selectedFile:ownFile;
  selectedFile=file;
  if(!file) return setProgress(0,'No video is selected.');
  const meta=await videoMeta(file);
  if(sourceMode==='auto' && !(meta.height>meta.width)) return setProgress(0,'This automatic source is not vertical. Tap Find another fresh video.');
  if(previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl=URL.createObjectURL(file);
  els.reelPreview.src=previewUrl;els.reelPreview.style.display='block';
  els.previewStage.classList.remove('hidden');
  els.findAnother.classList.toggle('hidden',sourceMode!=='auto');
  els.uploadReel.disabled=false;
  els.previewInfo.textContent=`THIS exact file will upload: ${meta.width||'?'}×${meta.height||'?'} • ${Number(meta.duration||0).toFixed(0)} sec • ${formatBytes(file.size)}. Press play and check the picture AND sound first.`;
  generateCopy();
  setProgress(55,'Preview ready. Nothing has been uploaded. Listen and watch it first.');
}
els.createPreview.addEventListener('click',createPreview);

function workerBase(){return els.workerUrl.value.trim().replace(/\/+$/,'');}
async function workerJson(path,body){
  const base=workerBase();if(!base)throw new Error('Add your Worker URL in Step 1.');
  const r=await fetch(`${base}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={raw:text}}
  if(!r.ok||data?.error) throw new Error(data?.error?.message||data?.error||data?.raw||`HTTP ${r.status}`);
  return data;
}
async function blobHash(blob){const d=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function ledgerKey(){return `fbclip.uploadLedger.${selectedPage?.id||'unknown'}`;}
function readLedger(){let x={};try{x=JSON.parse(localStorage.getItem(ledgerKey())||'{}')||{}}catch{};return x;}
function writeLedger(x){localStorage.setItem(ledgerKey(),JSON.stringify(x));}
async function claimUpload(blob){
  const hash=await blobHash(blob),ledger=readLedger(),old=ledger[hash];
  if(old?.status==='done') throw new Error('Duplicate upload blocked — this exact Reel was already uploaded from this device.');
  if(old&&Date.now()-Number(old.time||0)<30*60*1000) throw new Error('Duplicate upload blocked — this Reel is already uploading or was just attempted.');
  ledger[hash]={status:'pending',time:Date.now()};writeLedger(ledger);return hash;
}
function markUpload(hash,status,videoId=''){const ledger=readLedger();ledger[hash]={status,time:Date.now(),videoId};writeLedger(ledger);}
function releaseUpload(hash){const ledger=readLedger();delete ledger[hash];writeLedger(ledger);}
async function publishReel(blob){
  if(!selectedPage) throw new Error('Connect Facebook and choose your Page first.');
  const pageToken=selectedPage.access_token;const hash=await claimUpload(blob);let stage='claimed',init=null;
  try{
    setProgress(68,`Starting upload to ${selectedPage.name}…`);
    init=await workerJson('/reels/start',{pageId:selectedPage.id,pageToken,graphVersion:els.graphVersion.value.trim()||'v24.0'});
    if(!init.video_id||!init.upload_url) throw new Error('Facebook did not return a Reel upload session.');
    stage='started';setProgress(76,`Uploading ${formatBytes(blob.size)} directly to Facebook…`);
    const upload=await fetch(`${workerBase()}/reels/upload`,{method:'POST',headers:{'x-upload-url':init.upload_url,'x-page-token':pageToken,'content-type':'video/mp4'},body:blob});
    const uploadText=await upload.text();if(!upload.ok){let msg=uploadText;try{msg=JSON.parse(uploadText)?.error?.message||uploadText}catch{};throw new Error(String(msg));}
    stage='uploaded';setProgress(92,'Facebook has the video. Publishing the Reel…');
    const description=`${els.caption.value.trim()}\n\n${els.hashtags.value.trim()}`.trim();
    stage='finishing';await workerJson('/reels/finish',{pageId:selectedPage.id,pageToken,videoId:init.video_id,description,graphVersion:els.graphVersion.value.trim()||'v24.0'});
    markUpload(hash,'done',init.video_id);setProgress(100,`Published successfully to ${selectedPage.name}.`);
  }catch(err){if(stage==='claimed'||stage==='started'||stage==='uploaded')releaseUpload(hash);else markUpload(hash,'uncertain',init?.video_id||'');throw err;}
}
els.uploadReel.addEventListener('click',async()=>{
  if(uploadBusy)return;
  if(!selectedFile)return setProgress(0,'Create and preview a Reel first.');
  if(!selectedPage)return setProgress(0,'Connect Facebook and choose a Page first.');
  uploadBusy=true;els.uploadReel.disabled=true;els.createPreview.disabled=true;els.findAnother.disabled=true;
  try{await publishReel(selectedFile);}catch(err){setProgress(0,`Upload stopped: ${err.message}`);}finally{uploadBusy=false;els.uploadReel.disabled=false;els.createPreview.disabled=false;els.findAnother.disabled=false;}
});

els.topic.addEventListener('change',()=>{selectedFile=null;selectedSource=null;searchPage=1;seenVideoIds.clear();clearPreview();if(els.topic.value.trim())generateCopy();});
