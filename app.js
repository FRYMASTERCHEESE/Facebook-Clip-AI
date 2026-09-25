import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

const $ = id => document.getElementById(id);
const els = Object.fromEntries([
  'metaAppId','graphVersion','workerUrl','saveSetup','connectFacebook','disconnectFacebook',
  'pageSelect','connectionStatus','topStatus','sourceAutoTab','sourceOwnTab','autoSourcePanel',
  'ownSourcePanel','topic','clipLength','directorStyle','montageCount','burnCaption','originalSoundtrack','sourceInfo','ownVideo','preview','rightsConfirm',
  'fullAutoButton','progressBar','autoStatus','resultCard','resultText','downloadLink',
  'caption','hashtags','regenerateCopy'
].map(id => [id,$(id)]));

let ffmpeg = null;
let facebookUserToken = '';
let pages = [];
let selectedPage = null;
let ownFile = null;
let sourceMode = 'auto';
let sourceMeta = null;
let reelBlob = null;
let reelUrl = null;

function setProgress(pct, text) {
  els.progressBar.style.width = `${Math.max(0,Math.min(100,pct))}%`;
  if (text) els.autoStatus.textContent = text;
}
function safeWords(text='') {
  return String(text).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
}
function titleCase(text='') {
  return String(text).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().split(' ').map(x=>x?x[0].toUpperCase()+x.slice(1):x).join(' ');
}
function generateCopy() {
  const raw = els.topic.value.trim() || sourceMeta?.title || ownFile?.name?.replace(/\.[^.]+$/,'') || 'Amazing moment';
  const t = titleCase(raw).slice(0,90);
  const style=els.directorStyle?.value||'cinematic';
  const opener={
    cinematic:'This moment looks incredible 👀',
    documentary:'A closer look at nature 🌿',
    dramatic:'Wait until you see this 👀',
    calm:'A peaceful moment from nature 🌿',
    cute:'This is too cute ❤️'
  }[style] || 'Watch this 👀';
  const sourceCredit = sourceMeta?.credit ? `\n\nSource notes:\n${sourceMeta.credit}` : '';
  els.caption.value = `${opener}\n\n${t}\n\nWhat do you think?${sourceCredit}`;
  const words=safeWords(raw).filter(w=>w.length>3).slice(0,4);
  els.hashtags.value=[...new Set(['#FacebookReels','#Reels',...words.map(w=>`#${w}`)])].join(' ');
}
els.regenerateCopy.addEventListener('click', generateCopy);

function saveSetup() {
  localStorage.setItem('fbclip.appId', els.metaAppId.value.trim());
  localStorage.setItem('fbclip.graphVersion', els.graphVersion.value.trim() || 'v24.0');
  localStorage.setItem('fbclip.workerUrl', els.workerUrl.value.trim().replace(/\/+$/,''));
  els.connectionStatus.textContent = 'Setup saved on this device.';
}
els.saveSetup.addEventListener('click', saveSetup);

function restoreSetup() {
  els.metaAppId.value = localStorage.getItem('fbclip.appId') || '';
  els.graphVersion.value = localStorage.getItem('fbclip.graphVersion') || 'v24.0';
  els.workerUrl.value = localStorage.getItem('fbclip.workerUrl') || '';
}
restoreSetup();

function sdkUrl() {
  return 'https://connect.facebook.net/en_US/sdk.js';
}
async function ensureFacebookSdk() {
  const appId = els.metaAppId.value.trim();
  if (!appId) throw new Error('Add your Meta App ID first.');
  if (window.FB) {
    try { FB.getLoginStatus(()=>{}); return; } catch {}
  }
  await new Promise((resolve,reject)=>{
    window.fbAsyncInit = () => {
      FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: els.graphVersion.value.trim() || 'v24.0'
      });
      resolve();
    };
    const s=document.createElement('script');
    s.src=sdkUrl(); s.async=true; s.defer=true; s.crossOrigin='anonymous';
    s.onerror=()=>reject(new Error('Could not load the Facebook SDK.'));
    document.head.appendChild(s);
  });
}
function fbLogin() {
  return new Promise((resolve,reject)=>{
    FB.login(res=>{
      if (!res?.authResponse?.accessToken) return reject(new Error('Facebook connection was cancelled or not approved.'));
      resolve(res.authResponse.accessToken);
    }, {scope:'pages_show_list,pages_read_engagement,pages_manage_posts', return_scopes:true});
  });
}
function fbApi(path) {
  return new Promise((resolve,reject)=>{
    FB.api(path,'GET',res=>{
      if (!res || res.error) return reject(new Error(res?.error?.message || 'Facebook API request failed.'));
      resolve(res);
    });
  });
}
async function loadPages() {
  const data = await fbApi('/me/accounts?fields=id,name,access_token&limit=100');
  pages = Array.isArray(data.data) ? data.data.filter(x=>x.id && x.name && x.access_token) : [];
  els.pageSelect.innerHTML = pages.length
    ? '<option value="">Choose a Page…</option>' + pages.map((p,i)=>`<option value="${i}">${escapeHtml(p.name)}</option>`).join('')
    : '<option value="">No Pages available</option>';
  els.pageSelect.disabled = !pages.length;
}
function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
els.connectFacebook.addEventListener('click', async ()=>{
  saveSetup();
  els.connectionStatus.textContent='Opening Facebook connection…';
  try {
    await ensureFacebookSdk();
    facebookUserToken = await fbLogin();
    await loadPages();
    els.connectionStatus.textContent = pages.length
      ? `Connected. Choose one of your ${pages.length} Facebook Page${pages.length===1?'':'s'}.`
      : 'Connected, but no manageable Pages were returned.';
    els.topStatus.textContent='● Facebook connected';
    els.connectFacebook.classList.add('hidden');
    els.disconnectFacebook.classList.remove('hidden');
  } catch(err) {
    els.connectionStatus.textContent=`Connection failed: ${err.message}`;
  }
});
els.disconnectFacebook.addEventListener('click', ()=>{
  facebookUserToken=''; pages=[]; selectedPage=null;
  els.pageSelect.innerHTML='<option value="">Connect Facebook first</option>';
  els.pageSelect.disabled=true;
  els.connectFacebook.classList.remove('hidden');
  els.disconnectFacebook.classList.add('hidden');
  els.topStatus.textContent='● Facebook not connected';
  els.connectionStatus.textContent='Disconnected from this browser session.';
});
els.pageSelect.addEventListener('change', ()=>{
  const i=Number(els.pageSelect.value);
  selectedPage = Number.isInteger(i) && pages[i] ? pages[i] : null;
  if (selectedPage) {
    els.connectionStatus.textContent=`Selected Page: ${selectedPage.name}`;
    localStorage.setItem('fbclip.lastPageName',selectedPage.name);
  }
});

function setSourceMode(mode) {
  sourceMode=mode;
  els.sourceAutoTab.classList.toggle('active',mode==='auto');
  els.sourceOwnTab.classList.toggle('active',mode==='own');
  els.autoSourcePanel.classList.toggle('hidden',mode!=='auto');
  els.ownSourcePanel.classList.toggle('hidden',mode!=='own');
  sourceMeta=null;
}
els.sourceAutoTab.addEventListener('click',()=>setSourceMode('auto'));
els.sourceOwnTab.addEventListener('click',()=>setSourceMode('own'));

els.ownVideo.addEventListener('change',()=>{
  ownFile=els.ownVideo.files?.[0]||null;
  if (!ownFile) return;
  const url=URL.createObjectURL(ownFile);
  els.preview.src=url;
  els.preview.style.display='block';
  els.topic.value ||= ownFile.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
  sourceMeta={kind:'own',title:ownFile.name,credit:''};
  generateCopy();
});

async function findPublicDomainVideos(topic,wanted=3) {
  const q = new URLSearchParams({
    action:'query',
    format:'json',
    origin:'*',
    generator:'search',
    gsrsearch:`${topic} filetype:video`,
    gsrnamespace:'6',
    gsrlimit:'40',
    prop:'imageinfo',
    iiprop:'url|mime|size|extmetadata'
  });
  const r=await fetch(`https://commons.wikimedia.org/w/api.php?${q}`);
  if (!r.ok) throw new Error('Wikimedia search failed.');
  const data=await r.json();
  const items=Object.values(data?.query?.pages||{});
  const allowed=[];
  const seen=new Set();
  for (const item of items) {
    const ii=item.imageinfo?.[0];
    if (!ii?.url || !String(ii.mime||'').startsWith('video/')) continue;
    if (seen.has(ii.url)) continue;
    const meta=ii.extmetadata||{};
    const license=[
      meta.LicenseShortName?.value,
      meta.UsageTerms?.value,
      meta.Copyrighted?.value
    ].filter(Boolean).join(' ');
    const isPD = /\bCC0\b|public\s*domain|PublicDomainMark|PDM/i.test(license);
    if (!isPD) continue;
    const size=Number(ii.size)||0;
    if (size && size>90*1024*1024) continue;
    seen.add(ii.url);
    allowed.push({
      title:item.title?.replace(/^File:/,'')||topic,
      url:ii.url,
      mime:ii.mime,
      size,
      license:meta.LicenseShortName?.value || meta.UsageTerms?.value || 'Public Domain / CC0',
      pageUrl:`https://commons.wikimedia.org/wiki/${encodeURIComponent((item.title||'').replace(/ /g,'_'))}`
    });
    if(allowed.length>=wanted) break;
  }
  if (!allowed.length) throw new Error('No Public Domain/CC0 video was found for that topic. Try a broader topic or use your own video.');
  return allowed;
}

async function downloadSource(src,index=0) {
  const r=await fetch(src.url);
  if (!r.ok) throw new Error('Could not download one of the selected Public Domain/CC0 sources.');
  const blob=await r.blob();
  const ext = src.mime?.includes('webm') ? 'webm' : src.mime?.includes('ogg') ? 'ogv' : 'mp4';
  return new File([blob],`source-${index}.${ext}`,{type:src.mime||blob.type||'video/mp4'});
}


function directorHook(){
  const raw=(els.topic.value||'Amazing Moment').trim();
  const style=els.directorStyle?.value||'cinematic';
  const prefix={
    cinematic:'WATCH THIS',
    documentary:'NATURE MOMENT',
    dramatic:'INCREDIBLE',
    calm:'PEACEFUL MOMENT',
    cute:'TOO CUTE'
  }[style]||'WATCH THIS';
  return `${prefix}: ${raw}`.slice(0,54);
}

function styleFilter(style='cinematic'){
  if(style==='documentary') return 'eq=contrast=1.04:saturation=1.03:brightness=0.01';
  if(style==='dramatic') return 'eq=contrast=1.12:saturation=1.10:brightness=-0.02';
  if(style==='calm') return 'eq=contrast=0.98:saturation=0.94:brightness=0.03';
  if(style==='cute') return 'eq=contrast=1.02:saturation=1.12:brightness=0.03';
  return 'eq=contrast=1.08:saturation=1.06:brightness=0.01';
}

async function makeTitlePng(text){
  const canvas=document.createElement('canvas');
  canvas.width=720; canvas.height=1280;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,720,1280);
  ctx.font='900 48px Arial, sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  const words=String(text||'').split(/\\s+/).filter(Boolean);
  const lines=[]; let line='';
  for(const word of words){
    const test=line?`${line} ${word}`:word;
    if(ctx.measureText(test).width<600) line=test;
    else{if(line) lines.push(line); line=word;}
    if(lines.length>=2) break;
  }
  if(line && lines.length<3) lines.push(line);
  const boxH=lines.length*64+44, y=1010;
  ctx.fillStyle='rgba(0,0,0,.64)';
  ctx.fillRect(38,y-boxH/2,644,boxH);
  ctx.fillStyle='#fff';
  ctx.shadowColor='rgba(0,0,0,.85)';
  ctx.shadowBlur=12;
  lines.forEach((ln,i)=>ctx.fillText(ln,360,y-(lines.length-1)*32+i*64));
  return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
}

function writeAscii(view,offset,text){
  for(let i=0;i<text.length;i++) view.setUint8(offset+i,text.charCodeAt(i));
}
function createOriginalWav(seconds,style='cinematic'){
  const sampleRate=22050;
  const count=Math.max(1,Math.floor(seconds*sampleRate));
  const buf=new ArrayBuffer(44+count*2);
  const view=new DataView(buf);
  writeAscii(view,0,'RIFF'); view.setUint32(4,36+count*2,true);
  writeAscii(view,8,'WAVE'); writeAscii(view,12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true); view.setUint16(34,16,true);
  writeAscii(view,36,'data'); view.setUint32(40,count*2,true);

  const base={cinematic:55,documentary:82,dramatic:48,calm:110,cute:132}[style]||55;
  for(let i=0;i<count;i++){
    const t=i/sampleRate;
    const fade=Math.min(1,t/1.5,(seconds-t)/1.5);
    const wobble=1+0.03*Math.sin(2*Math.PI*0.09*t);
    let s=
      Math.sin(2*Math.PI*base*wobble*t)*0.18+
      Math.sin(2*Math.PI*(base*1.5)*t)*0.08+
      Math.sin(2*Math.PI*(base*2.02)*t)*0.04;
    if(style==='dramatic') s+=Math.sin(2*Math.PI*0.7*t)*0.06;
    if(style==='cute') s+=Math.sin(2*Math.PI*(base*3)*t)*0.035;
    s*=Math.max(0,fade)*0.55;
    view.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*32767,true);
  }
  return new Blob([buf],{type:'audio/wav'});
}

async function createDirectorMontage(files,totalSeconds,style,addTitle=true,addSound=true){
  const ff=await ensureFFmpeg();
  const usable=Array.from(files||[]).filter(Boolean);
  if(!usable.length) throw new Error('No usable source clips were downloaded.');
  const per=Math.max(3,totalSeconds/usable.length);
  const segments=[];
  setProgress(38,`AI Director is styling ${usable.length} clips…`);

  for(let i=0;i<usable.length;i++){
    const file=usable[i];
    const inName=`director-${i}.${extFrom(file)}`;
    const outName=`segment-${i}.mp4`;
    try{await ff.deleteFile(inName)}catch{}
    try{await ff.deleteFile(outName)}catch{}
    await ff.writeFile(inName,await fetchFile(file));

    const scale = i%2===0 ? 'scale=760:1352' : 'scale=790:1404';
    const filter=`${scale}:force_original_aspect_ratio=increase,crop=720:1280,${styleFilter(style)},fps=30`;
    try{
      await ff.exec([
        '-i',inName,'-t',per.toFixed(2),
        '-vf',filter,'-an',
        '-c:v','libx264','-preset','ultrafast','-crf','21',
        '-pix_fmt','yuv420p',outName
      ]);
      segments.push(outName);
    }catch(err){ console.warn('Skipping source clip',err); }
  }

  if(!segments.length) throw new Error('The browser could not convert the selected sources. Try another topic.');

  const list='director-list.txt', silent='director-silent.mp4', visual='director-visual.mp4', final='facebook-reel.mp4';
  for(const name of [list,silent,visual,final,'title.png','director.wav']){try{await ff.deleteFile(name)}catch{}}
  await ff.writeFile(list,new TextEncoder().encode(segments.map(x=>`file '${x}'`).join('\\n')));
  await ff.exec(['-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',silent]);

  if(addTitle){
    const png=await makeTitlePng(directorHook());
    await ff.writeFile('title.png',await fetchFile(png));
    await ff.exec([
      '-i',silent,'-loop','1','-i','title.png',
      '-filter_complex',"[0:v][1:v]overlay=0:0:enable='between(t,0,4.2)'",
      '-t',String(totalSeconds),
      '-c:v','libx264','-preset','ultrafast','-crf','20',
      '-pix_fmt','yuv420p','-an','-movflags','+faststart',visual
    ]);
  }else{
    await ff.exec(['-i',silent,'-c','copy','-movflags','+faststart',visual]);
  }

  if(addSound){
    const wav=createOriginalWav(totalSeconds,style);
    await ff.writeFile('director.wav',await fetchFile(wav));
    await ff.exec([
      '-i',visual,'-i','director.wav','-t',String(totalSeconds),
      '-map','0:v:0','-map','1:a:0',
      '-c:v','copy','-c:a','aac','-b:a','128k',
      '-movflags','+faststart','-shortest',final
    ]);
  }else{
    await ff.exec(['-i',visual,'-c','copy','-movflags','+faststart',final]);
  }

  const out=await ff.readFile(final);
  return new Blob([out.buffer],{type:'video/mp4'});
}

async function readVideoMeta(file){
  return await new Promise(resolve=>{
    const v=document.createElement('video');
    const u=URL.createObjectURL(file);
    let done=false;
    const finish=(x)=>{if(done)return;done=true;URL.revokeObjectURL(u);resolve(x)};
    v.preload='metadata';
    v.onloadedmetadata=()=>finish({width:v.videoWidth||0,height:v.videoHeight||0,duration:v.duration||0});
    v.onerror=()=>finish({width:0,height:0,duration:0});
    v.src=u;
    setTimeout(()=>finish({width:0,height:0,duration:0}),3000);
  });
}

async function ensureFFmpeg() {
  if (ffmpeg?.loaded) return ffmpeg;
  setProgress(28,'Loading the free video engine… first run can take longer.');
  ffmpeg = new FFmpeg();
  ffmpeg.on('progress',({progress})=>{
    if(Number.isFinite(progress)) els.progressBar.style.width=`${Math.max(30,Math.round(progress*75))}%`;
  });
  const base='https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,'text/javascript'),
    wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,'application/wasm')
  });
  return ffmpeg;
}
function extFrom(file) {
  const m=(file?.name||'').match(/\.([a-z0-9]+)$/i);
  return m?m[1].toLowerCase():'mp4';
}
async function createVerticalReel(file) {
  const ff=await ensureFFmpeg();
  const inName=`input.${extFrom(file)}`;
  try{await ff.deleteFile(inName)}catch{}
  try{await ff.deleteFile('facebook-reel.mp4')}catch{}
  await ff.writeFile(inName,await fetchFile(file));
  const duration=String(Math.max(10,Math.min(60,Number(els.clipLength.value)||30)));
  const meta=await readVideoMeta(file);
  const ratio=meta.width && meta.height ? meta.width/meta.height : 0;
  const fastCopy=(extFrom(file)==='mp4' || extFrom(file)==='m4v') && Math.abs(ratio-(9/16))<0.025;

  if(fastCopy){
    setProgress(42,'Fast path: preserving your original vertical video quality…');
    try{
      await ff.exec(['-i',inName,'-t',duration,'-c','copy','-movflags','+faststart','facebook-reel.mp4']);
      const out=await ff.readFile('facebook-reel.mp4');
      return new Blob([out.buffer],{type:'video/mp4'});
    }catch(err){ console.warn('Fast path unavailable, using normal encode.',err); }
  }

  setProgress(42,'Creating a full-screen 9:16 Facebook Reel…');
  await ff.exec([
    '-i',inName,'-t',duration,
    '-map','0:v:0','-map','0:a?',
    '-vf','scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30',
    '-c:v','libx264','-preset','ultrafast','-crf','21',
    '-c:a','aac','-b:a','160k',
    '-pix_fmt','yuv420p','-movflags','+faststart',
    'facebook-reel.mp4'
  ]);
  const out=await ff.readFile('facebook-reel.mp4');
  return new Blob([out.buffer],{type:'video/mp4'});
}

function workerBase() {
  return els.workerUrl.value.trim().replace(/\/+$/,'');
}
async function workerJson(path,body) {
  const base=workerBase();
  if(!base) throw new Error('Add your Worker URL in Step 1.');
  const r=await fetch(`${base}${path}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  const text=await r.text();
  let data; try{data=JSON.parse(text)}catch{data={raw:text}}
  if(!r.ok || data?.error) throw new Error(data?.error?.message || data?.error || data?.raw || `HTTP ${r.status}`);
  return data;
}
async function publishReel(blob) {
  if(!selectedPage) throw new Error('Choose a Facebook Page first.');
  const pageToken=selectedPage.access_token;
  setProgress(78,`Starting upload to ${selectedPage.name}…`);
  const init=await workerJson('/reels/start',{
    pageId:selectedPage.id,
    pageToken,
    graphVersion:els.graphVersion.value.trim()||'v24.0'
  });
  if(!init.video_id || !init.upload_url) throw new Error('Facebook did not return a Reel upload session.');

  setProgress(84,'Uploading Reel video to Facebook…');
  const upload=await fetch(`${workerBase()}/reels/upload`,{
    method:'POST',
    headers:{
      'x-upload-url':init.upload_url,
      'x-page-token':pageToken,
      'content-type':'video/mp4'
    },
    body:blob
  });
  const uploadText=await upload.text();
  if(!upload.ok) {
    let msg=uploadText;
    try{msg=JSON.parse(uploadText)?.error?.message || JSON.parse(uploadText)?.error || uploadText}catch{}
    throw new Error(String(msg));
  }

  setProgress(93,'Publishing Reel on your Facebook Page…');
  const description=`${els.caption.value.trim()}\n\n${els.hashtags.value.trim()}`.trim();
  return await workerJson('/reels/finish',{
    pageId:selectedPage.id,
    pageToken,
    videoId:init.video_id,
    description,
    graphVersion:els.graphVersion.value.trim()||'v24.0'
  });
}

els.fullAutoButton.addEventListener('click',async()=>{
  if(!selectedPage) return setProgress(0,'Connect Facebook and choose a Page first.');
  if(!els.rightsConfirm.checked) return setProgress(0,'Tick the rights/source confirmation first.');
  let file=null;
  sourceMeta=null;
  els.fullAutoButton.disabled=true;
  els.resultCard.classList.add('hidden');

  try{
    if(sourceMode==='auto'){
      const t=els.topic.value.trim();
      if(!t) throw new Error('Enter a topic first.');
      const wanted=Math.max(2,Math.min(4,Number(els.montageCount.value)||3));
      setProgress(7,`AI Director is finding ${wanted} Public Domain/CC0 clips…`);
      const sources=await findPublicDomainVideos(t,wanted);

      const credit=sources.map((s,i)=>`${i+1}. ${s.license} • Wikimedia Commons • ${s.pageUrl}`).join('\n');
      sourceMeta={kind:'director',title:t,credit,sources};
      els.sourceInfo.innerHTML=`Found <strong>${sources.length}</strong> reusable clip${sources.length===1?'':'s'}. Building a fresh montage.`;

      const files=[];
      for(let i=0;i<sources.length;i++){
        setProgress(16+(i/sources.length)*15,`Downloading source ${i+1} of ${sources.length}…`);
        try{files.push(await downloadSource(sources[i],i))}catch(err){console.warn(err)}
      }
      if(!files.length) throw new Error('No source clips could be downloaded.');

      generateCopy();
      const total=Math.max(12,Math.min(45,Number(els.clipLength.value)||24));
      reelBlob=await createDirectorMontage(
        files,
        total,
        els.directorStyle?.value||'cinematic',
        Boolean(els.burnCaption?.checked),
        Boolean(els.originalSoundtrack?.checked)
      );
    }else{
      if(!ownFile) throw new Error('Choose your own video first.');
      file=ownFile;
      sourceMeta={kind:'own',title:ownFile.name,credit:''};
      generateCopy();
      reelBlob=await createVerticalReel(file);
    }
    if(reelUrl) URL.revokeObjectURL(reelUrl);
    reelUrl=URL.createObjectURL(reelBlob);
    els.downloadLink.href=reelUrl;

    await publishReel(reelBlob);

    setProgress(100,`Done — Reel published to ${selectedPage.name}.`);
    els.resultText.textContent=`Published to ${selectedPage.name}. A local download copy is also ready.`;
    els.resultCard.classList.remove('hidden');
  }catch(err){
    console.error(err);
    setProgress(0,`Stopped: ${err.message}`);
  }finally{
    els.fullAutoButton.disabled=false;
  }
});

['topic','directorStyle'].forEach(id=>{
  const el=document.getElementById(id);
  el?.addEventListener('change',()=>{if((els.topic.value||'').trim()) generateCopy();});
});

(function prewarmVideoEngine(){
  const c=navigator.connection;
  if(c?.saveData || /2g/.test(c?.effectiveType||'')) return;
  const start=()=>ensureFFmpeg().catch(()=>{});
  if('requestIdleCallback' in window) requestIdleCallback(start,{timeout:8000});
  else setTimeout(start,5000);
})();
