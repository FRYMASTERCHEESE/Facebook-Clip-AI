import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

const $ = id => document.getElementById(id);
const els = Object.fromEntries([
  'metaAppId','graphVersion','workerUrl','saveSetup','connectFacebook','disconnectFacebook',
  'pageSelect','connectionStatus','topStatus','sourceAutoTab','sourceOwnTab','autoSourcePanel',
  'ownSourcePanel','topic','clipLength','directorStyle','montageCount','burnCaption','originalSoundtrack','sourceInfo','ownVideo','preview','rightsConfirm',
  'uploadCount','fastUploadMode','fullAutoButton','progressBar','autoStatus','resultCard','resultText','downloadLink',
  'caption','hashtags','regenerateCopy'
].map(id => [id,$(id)]));

const META_APP_ID = '39365842192999950';
const META_LOGIN_CONFIG_ID = '4635831679973280';

let ffmpeg = null;
let facebookUserToken = '';
let pages = [];
let selectedPage = null;
let ownFile = null;
let sourceMode = 'auto';
let sourceMeta = null;
let reelBlob = null;
let reelUrl = null;
let batchRunning = false;

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
function generateCopy(batchIndex=0,batchTotal=1) {
  const raw = els.topic.value.trim() || sourceMeta?.title || ownFile?.name?.replace(/\.[^.]+$/,'') || 'Amazing moment';
  const t = titleCase(raw).slice(0,90);
  const style=els.directorStyle?.value||'cinematic';
  const openers={
    cinematic:['Wait for the best part 👀','This gets better as it goes 🔥','Watch closely — you might miss it 👀','Would you have expected this? 👀'],
    documentary:['Look closely at what happens here 🌿','A detail most people miss 👀','This is worth a closer look 🌿','Did you know this happens? 👀'],
    dramatic:['Wait until you see this 👀','This gets intense fast 🔥','You will want to watch this one 👀','What a moment 😮'],
    calm:['A peaceful moment worth watching 🌿','Take a moment and enjoy this 🌿','A calm scene for your feed ✨','This is strangely relaxing 🌿'],
    cute:['Try not to smile at this ❤️','The ending made this even better 🥹','This little moment made our day ❤️','Would this make you smile too? ❤️']
  };
  const pool=openers[style]||openers.cinematic;
  const opener=pool[Math.abs(Number(batchIndex)||0)%pool.length];
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
  els.metaAppId.value = localStorage.getItem('fbclip.appId') || META_APP_ID;
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
    }, {config_id:META_LOGIN_CONFIG_ID});
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

async function findPublicDomainVideos(topic,wanted=3,excludeUrls=new Set(),offset=0) {
  const q = new URLSearchParams({
    action:'query',
    format:'json',
    origin:'*',
    generator:'search',
    gsrsearch:`${/\b(black and white|historic|history|archive|vintage|ww1|ww2|war)\b/i.test(topic) ? topic : topic + ' color'} filetype:video`,
    gsrnamespace:'6',
    gsrlimit:'40',
    gsroffset:String(Math.max(0,Number(offset)||0)),
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
    if (seen.has(ii.url) || excludeUrls.has(ii.url)) continue;
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

function directorHook(batchIndex=0,batchTotal=1){
  const raw=(els.topic.value||'Amazing Moment').trim();
  const style=els.directorStyle?.value||'cinematic';
  const prefix={
    cinematic:'WATCH THIS',
    documentary:'NATURE MOMENT',
    dramatic:'INCREDIBLE',
    calm:'PEACEFUL MOMENT',
    cute:'TOO CUTE'
  }[style]||'WATCH THIS';
  const suffix=batchTotal>1?` • ${batchIndex+1}/${batchTotal}`:'';
  return `${prefix}: ${raw}${suffix}`.slice(0,46);
}


function styleFilter(style='cinematic'){
  if(style==='documentary') return 'eq=contrast=1.06:saturation=1.10:brightness=0.02';
  if(style==='dramatic') return 'eq=contrast=1.12:saturation=1.18:brightness=-0.01';
  if(style==='calm') return 'eq=contrast=1.00:saturation=1.02:brightness=0.04';
  if(style==='cute') return 'eq=contrast=1.03:saturation=1.18:brightness=0.04';
  return 'eq=contrast=1.08:saturation=1.14:brightness=0.02';
}


async function makeTitlePng(text){
  const canvas=document.createElement('canvas');
  canvas.width=1080; canvas.height=1920;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,1080,1920);
  ctx.font='900 54px Arial, sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  const words=String(text||'').split(/\s+/).filter(Boolean);
  const lines=[]; let line='';
  for(const word of words){
    const test=line?`${line} ${word}`:word;
    if(ctx.measureText(test).width<850) line=test;
    else { if(line) lines.push(line); line=word; }
    if(lines.length>=2) break;
  }
  if(line && lines.length<3) lines.push(line);
  const lineH=70;
  const boxH=lines.length*lineH+34;
  const y=1640;
  ctx.fillStyle='rgba(0,0,0,.58)';
  roundRect(ctx,70,y-boxH/2,940,boxH,30);
  ctx.fill();
  ctx.fillStyle='#fff';
  ctx.shadowColor='rgba(0,0,0,.85)';
  ctx.shadowBlur=10;
  lines.forEach((ln,i)=>ctx.fillText(ln,540,y-(lines.length-1)*lineH/2+i*lineH));
  return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function writeAscii(view,offset,text){
  for(let i=0;i<text.length;i++) view.setUint8(offset+i,text.charCodeAt(i));
}

function createOriginalWav(seconds,style='cinematic',variant=0){
  const sampleRate=44100;
  const channels=2;
  const count=Math.max(1,Math.floor(seconds*sampleRate));
  const buf=new ArrayBuffer(44+count*channels*2);
  const view=new DataView(buf);
  writeAscii(view,0,'RIFF'); view.setUint32(4,36+count*channels*2,true);
  writeAscii(view,8,'WAVE'); writeAscii(view,12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*channels*2,true);
  view.setUint16(32,channels*2,true); view.setUint16(34,16,true);
  writeAscii(view,36,'data'); view.setUint32(40,count*channels*2,true);

  const base=({cinematic:62,documentary:84,dramatic:52,calm:112,cute:136}[style]||62)+(Number(variant)||0)*1.25;
  for(let i=0;i<count;i++){
    const t=i/sampleRate;
    const fade=Math.min(1,t/1.2,(seconds-t)/1.4);
    const wobble=1+0.025*Math.sin(2*Math.PI*0.08*t);
    let s =
      Math.sin(2*Math.PI*base*wobble*t)*0.30+
      Math.sin(2*Math.PI*(base*1.5)*t)*0.12+
      Math.sin(2*Math.PI*(base*2.03)*t)*0.06;
    if(style==='dramatic') s += Math.sin(2*Math.PI*0.7*t)*0.08;
    if(style==='cute') s += Math.sin(2*Math.PI*(base*3)*t)*0.05;
    s*=Math.max(0,fade)*0.8;
    const left=Math.max(-1,Math.min(1,s*(0.98+0.02*Math.sin(2*Math.PI*0.13*t))))*32767;
    const right=Math.max(-1,Math.min(1,s*(0.98+0.02*Math.cos(2*Math.PI*0.11*t))))*32767;
    const off=44+i*4;
    view.setInt16(off,left,true);
    view.setInt16(off+2,right,true);
  }
  return new Blob([buf],{type:'audio/wav'});
}

async function createDirectorMontage(files,totalSeconds,style,addTitle=true,addSound=true,batchIndex=0,batchTotal=1,fastMode=true){
  const ff=await ensureFFmpeg();
  const usable=Array.from(files||[]).filter(Boolean);
  if(!usable.length) throw new Error('No usable source clips were downloaded.');
  const per=Math.max(3,totalSeconds/usable.length);
  const segments=[];
  const fps=fastMode?24:30;
  const crf=fastMode?'26':'22';
  const renderFilter = (style) => `[0:v]split=2[bgsrc][fgsrc];[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:2,${styleFilter(style)}[bg];[fgsrc]scale=1080:1920:force_original_aspect_ratio=decrease,${styleFilter(style)}[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${fps},format=yuv420p[v]`;
  setProgress(38,`AI Director is styling ${usable.length} clips…`);

  for(let i=0;i<usable.length;i++){
    const file=usable[i];
    const inName=`director-${i}.${extFrom(file)}`;
    const outName=`segment-${i}.mp4`;
    try{await ff.deleteFile(inName)}catch{}
    try{await ff.deleteFile(outName)}catch{}
    await ff.writeFile(inName,await fetchFile(file));

    try{
      await ff.exec([
        '-i',inName,'-t',per.toFixed(2),
        '-filter_complex',renderFilter(style),
        '-map','[v]','-an',
        '-c:v','libx264','-preset','ultrafast','-crf',crf,
        ...(fastMode?['-maxrate','2800k','-bufsize','5600k']:['-maxrate','5000k','-bufsize','10000k']),
        '-pix_fmt','yuv420p','-movflags','+faststart',outName
      ]);
      segments.push(outName);
    }catch(err){ console.warn('Skipping source clip',err); }
  }

  if(!segments.length) throw new Error('The browser could not convert the selected sources. Try another topic.');

  const list='director-list.txt', silent='director-silent.mp4', visual='director-visual.mp4', final='facebook-reel.mp4';
  for(const name of [list,silent,visual,final,'title.png','director.wav']){try{await ff.deleteFile(name)}catch{}}
  await ff.writeFile(list,new TextEncoder().encode(segments.map(x=>`file '${x}'`).join('\n')));
  await ff.exec(['-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',silent]);

  if(addTitle){
    const png=await makeTitlePng(directorHook(batchIndex,batchTotal));
    await ff.writeFile('title.png',await fetchFile(png));
    await ff.exec([
      '-i',silent,'-loop','1','-i','title.png',
      '-filter_complex',"[0:v][1:v]overlay=0:0:enable='between(t,0,3.2)'",
      '-t',String(totalSeconds),
      '-c:v','libx264','-preset','ultrafast','-crf',crf,
      ...(fastMode?['-maxrate','2800k','-bufsize','5600k']:['-maxrate','5000k','-bufsize','10000k']),
      '-pix_fmt','yuv420p','-an','-movflags','+faststart',visual
    ]);
  }else{
    await ff.exec(['-i',silent,'-c','copy','-movflags','+faststart',visual]);
  }

  if(addSound){
    const wav=createOriginalWav(totalSeconds,style,batchIndex);
    await ff.writeFile('director.wav',await fetchFile(wav));
    await ff.exec([
      '-i',visual,'-i','director.wav','-t',String(totalSeconds),
      '-map','0:v:0','-map','1:a:0',
      '-c:v','copy','-c:a','aac','-b:a',fastMode?'128k':'160k','-ar','44100','-ac','2','-af','volume=4.2,alimiter=limit=0.97',
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
  const classWorkerURL = new URL('./ffmpeg-worker.js', import.meta.url).href;
  await ffmpeg.load({
    classWorkerURL,
    coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,'text/javascript'),
    wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,'application/wasm')
  });
  return ffmpeg;
}
function extFrom(file) {
  const m=(file?.name||'').match(/\.([a-z0-9]+)$/i);
  return m?m[1].toLowerCase():'mp4';
}

async function createVerticalReel(file,batchIndex=0,batchTotal=1,fastMode=true) {
  const ff=await ensureFFmpeg();
  const inName=`input.${extFrom(file)}`;
  try{await ff.deleteFile(inName)}catch{}
  try{await ff.deleteFile('facebook-reel.mp4')}catch{}
  await ff.writeFile(inName,await fetchFile(file));
  const duration=String(Math.max(10,Math.min(60,Number(els.clipLength.value)||30)));
  const meta=await readVideoMeta(file);
  const ratio=meta.width && meta.height ? meta.width/meta.height : 0;
  const fastCopy=batchTotal===1 && (extFrom(file)==='mp4' || extFrom(file)==='m4v') && meta.width===1080 && meta.height===1920 && Math.abs(ratio-(9/16))<0.025;

  if(fastCopy){
    setProgress(42,'Fast path: preserving your original vertical video quality…');
    try{
      await ff.exec(['-i',inName,'-t',duration,'-c','copy','-movflags','+faststart','facebook-reel.mp4']);
      const out=await ff.readFile('facebook-reel.mp4');
      return new Blob([out.buffer],{type:'video/mp4'});
    }catch(err){ console.warn('Fast path unavailable, using normal encode.',err); }
  }

  setProgress(42,'Creating a Facebook-ready 9:16 Reel with boosted sound…');
  const fps=fastMode?24:30;
  const crf=fastMode?'26':'22';
  const totalWanted=Number(duration)||30;
  const maxStart=Math.max(0,(meta.duration||0)-totalWanted);
  const start=batchTotal>1 && maxStart>0 ? Math.min(maxStart,(maxStart*Math.max(0,batchIndex))/(Math.max(1,batchTotal-1))) : 0;
  const seek=start>0?['-ss',start.toFixed(2)]:[];
  await ff.exec([
    ...seek,'-i',inName,'-t',duration,
    '-filter_complex',`[0:v]split=2[bgsrc][fgsrc];[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:2[bg];[fgsrc]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${fps},format=yuv420p[v]`,
    '-map','[v]','-map','0:a?',
    '-c:v','libx264','-preset','ultrafast','-crf',crf,
    ...(fastMode?['-maxrate','2800k','-bufsize','5600k']:['-maxrate','5000k','-bufsize','10000k']),
    '-c:a','aac','-b:a',fastMode?'128k':'160k','-ar','44100','-ac','2','-af','volume=1.8,alimiter=limit=0.97',
    '-pix_fmt','yuv420p','-movflags','+faststart',
    'facebook-reel.mp4'
  ]);
  const out=await ff.readFile('facebook-reel.mp4');
  return new Blob([out.buffer],{type:'video/mp4'});
}


async function blobHash(blob){
  const buf=await blob.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',buf);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function ledgerKey(){
  return `fbclip.uploadLedger.${selectedPage?.id||'unknown'}`;
}
function readLedger(){
  let ledger={};
  try{ledger=JSON.parse(localStorage.getItem(ledgerKey())||'{}')||{}}catch{}
  const now=Date.now();
  for(const [k,v] of Object.entries(ledger)){
    const age=now-Number(v?.time||0);
    if((v?.status==='done' && age>30*24*60*60*1000) || (v?.status!=='done' && age>30*60*1000)) delete ledger[k];
  }
  localStorage.setItem(ledgerKey(),JSON.stringify(ledger));
  return ledger;
}
function writeLedger(ledger){
  localStorage.setItem(ledgerKey(),JSON.stringify(ledger));
}
async function claimUpload(blob){
  const hash=await blobHash(blob);
  const ledger=readLedger();
  const old=ledger[hash];
  if(old?.status==='done') throw new Error('Duplicate upload blocked — this exact Reel was already published from this device.');
  if(old && Date.now()-Number(old.time||0)<30*60*1000) throw new Error('Duplicate upload blocked — this Reel is already uploading or was just attempted.');
  ledger[hash]={status:'pending',time:Date.now()};
  writeLedger(ledger);
  return hash;
}
function markUpload(hash,status,videoId=''){
  const ledger=readLedger();
  ledger[hash]={status,time:Date.now(),videoId};
  writeLedger(ledger);
}
function releaseUpload(hash){
  const ledger=readLedger();
  delete ledger[hash];
  writeLedger(ledger);
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
async function publishReel(blob,batchIndex=0,batchTotal=1) {
  if(!selectedPage) throw new Error('Choose a Facebook Page first.');
  const pageToken=selectedPage.access_token;
  const label=batchTotal>1?` (${batchIndex+1}/${batchTotal})`:'';
  const hash=await claimUpload(blob);
  let stage='claimed';
  let init=null;
  try{
    setProgress(78,`Starting upload${label} to ${selectedPage.name}…`);
    init=await workerJson('/reels/start',{
      pageId:selectedPage.id,
      pageToken,
      graphVersion:els.graphVersion.value.trim()||'v24.0'
    });
    if(!init.video_id || !init.upload_url) throw new Error('Facebook did not return a Reel upload session.');
    stage='started';

    setProgress(84,`Uploading Reel${label} to Facebook…`);
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
    stage='uploaded';

    setProgress(93,`Publishing Reel${label} on your Facebook Page…`);
    const description=`${els.caption.value.trim()}\n\n${els.hashtags.value.trim()}`.trim();
    stage='finishing';
    const result=await workerJson('/reels/finish',{
      pageId:selectedPage.id,
      pageToken,
      videoId:init.video_id,
      description,
      graphVersion:els.graphVersion.value.trim()||'v24.0'
    });
    markUpload(hash,'done',init.video_id);
    return result;
  }catch(err){
    if(stage==='claimed' || stage==='started' || stage==='uploaded') releaseUpload(hash);
    else markUpload(hash,'uncertain',init?.video_id||'');
    throw err;
  }
}

els.fullAutoButton.addEventListener('click',async()=>{
  if(batchRunning) return setProgress(0,'A batch is already running. Duplicate start blocked.');
  if(!selectedPage) return setProgress(0,'Connect Facebook and choose a Page first.');
  if(!els.rightsConfirm.checked) return setProgress(0,'Tick the rights/source confirmation first.');
  const batchTotal=Math.max(1,Math.min(10,Number(els.uploadCount?.value)||1));
  const fastMode=Boolean(els.fastUploadMode?.checked);
  const usedSourceUrls=new Set();
  let completed=0;
  batchRunning=true;
  sourceMeta=null;
  els.fullAutoButton.disabled=true;
  els.resultCard.classList.add('hidden');

  try{
    if(sourceMode==='own' && !ownFile) throw new Error('Choose your own video first.');
    if(sourceMode==='auto' && !els.topic.value.trim()) throw new Error('Enter a topic first.');

    for(let batchIndex=0;batchIndex<batchTotal;batchIndex++){
      const batchLabel=batchTotal>1?`Reel ${batchIndex+1} of ${batchTotal}`:'Reel';
      setProgress(3,`${batchLabel}: preparing…`);

      if(sourceMode==='auto'){
        const t=els.topic.value.trim();
        const wanted=Math.max(2,Math.min(4,Number(els.montageCount.value)||3));
        setProgress(7,`${batchLabel}: finding Public Domain/CC0 clips…`);
        let sources=[];
        try{
          sources=await findPublicDomainVideos(t,wanted,usedSourceUrls,batchIndex*8);
        }catch(err){
          sources=await findPublicDomainVideos(t,wanted,new Set(),batchIndex*4);
        }
        sources.forEach(s=>usedSourceUrls.add(s.url));

        const credit=sources.map((s,i)=>`${i+1}. ${s.license} • Wikimedia Commons • ${s.pageUrl}`).join('\n');
        sourceMeta={kind:'director',title:t,credit,sources};
        els.sourceInfo.innerHTML=`${batchLabel}: found <strong>${sources.length}</strong> reusable clips. Building a fresh montage.`;

        const files=[];
        for(let i=0;i<sources.length;i++){
          setProgress(16+(i/sources.length)*15,`${batchLabel}: downloading source ${i+1} of ${sources.length}…`);
          try{files.push(await downloadSource(sources[i],i))}catch(err){console.warn(err)}
        }
        if(!files.length) throw new Error(`${batchLabel}: no source clips could be downloaded.`);

        generateCopy(batchIndex,batchTotal);
        const total=Math.max(12,Math.min(45,Number(els.clipLength.value)||24));
        reelBlob=await createDirectorMontage(
          files,total,els.directorStyle?.value||'cinematic',
          Boolean(els.burnCaption?.checked),Boolean(els.originalSoundtrack?.checked),
          batchIndex,batchTotal,fastMode
        );
      }else{
        sourceMeta={kind:'own',title:ownFile.name,credit:''};
        generateCopy(batchIndex,batchTotal);
        reelBlob=await createVerticalReel(ownFile,batchIndex,batchTotal,fastMode);
      }

      if(reelUrl) URL.revokeObjectURL(reelUrl);
      reelUrl=URL.createObjectURL(reelBlob);
      els.downloadLink.href=reelUrl;

      await publishReel(reelBlob,batchIndex,batchTotal);
      completed++;
      setProgress(Math.min(99,Math.round((completed/batchTotal)*100)),`${batchLabel}: published successfully.`);
    }

    setProgress(100,`Done — ${completed} Reel${completed===1?'':'s'} published to ${selectedPage.name}. Duplicate protection stayed on.`);
    els.resultText.textContent=`Published ${completed} of ${batchTotal} Reel${batchTotal===1?'':'s'} to ${selectedPage.name}. The last local download copy is ready.`;
    els.resultCard.classList.remove('hidden');
  }catch(err){
    console.error(err);
    setProgress(0,`Stopped after ${completed} successful upload${completed===1?'':'s'}: ${err.message}`);
  }finally{
    batchRunning=false;
    els.fullAutoButton.disabled=false;
  }
});

['topic' ,'directorStyle'].forEach(id=>{
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
