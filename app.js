const $=id=>document.getElementById(id);
const els=Object.fromEntries([
  'metaAppId','graphVersion','workerUrl','pixabayKey','pexelsKey','dvidsKey','saveSetup','connectFacebook','disconnectFacebook',
  'pageSelect','connectionStatus','topStatus','sourceAutoTab','sourceStickTab','sourceOwnTab','autoSourcePanel','stickSourcePanel','ownSourcePanel',
  'topic','findFreshVideo','sourceInfo','directVideoUrl','loadDirectVideo','stickTopic','stickDuration','stickAction','stickBackground','stickText','generateStickVideo','stickInfo','ownVideo','rightsConfirm','createPreview','progressBar','autoStatus',
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

  if(sourceMode==='stick'||/\bstick ?man|stickman\b/.test(combined)){
    const name=titleCase(raw||'Stick Man Animation');
    return {
      title:name,
      intro:`Watch this original ${name} Stick Man animation created as a vertical Reel.`,
      cta:'What should the Stick Man do next?',
      tags:['#StickMan','#StickmanAnimation','#Animation','#FunnyAnimation','#OriginalAnimation','#AnimationReels']
    };
  }

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
      title:'United States Military & War',
      intro:'Watch a fresh vertical Reel focused on the United States military and war theme, featuring modern colour footage selected to closely match your search.',
      cta:'Which U.S. military topic should we feature next?',
      tags:['#UnitedStatesMilitary','#USMilitary','#AmericanMilitary','#Military','#MilitaryReels','#UnitedStates','#WarTopic']
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
  localStorage.setItem('fbclip.pexelsKey',els.pexelsKey.value.trim());
  localStorage.setItem('fbclip.dvidsKey',els.dvidsKey.value.trim());
  els.connectionStatus.textContent='Setup saved on this device.';
}
els.saveSetup.addEventListener('click',saveSetup);
function restoreSetup(){
  els.metaAppId.value=localStorage.getItem('fbclip.appId')||META_APP_ID;
  els.graphVersion.value=localStorage.getItem('fbclip.graphVersion')||'v24.0';
  els.workerUrl.value=localStorage.getItem('fbclip.workerUrl')||'';
  els.pixabayKey.value=localStorage.getItem('fbclip.pixabayKey')||'';
  els.pexelsKey.value=localStorage.getItem('fbclip.pexelsKey')||'';
  els.dvidsKey.value=localStorage.getItem('fbclip.dvidsKey')||'';
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
    els.topStatus.textContent='● Facebook connected • v12';
    els.connectFacebook.classList.add('hidden');
    els.disconnectFacebook.classList.remove('hidden');
  }catch(err){els.connectionStatus.textContent=`Connection failed: ${err.message}`;}
});
els.disconnectFacebook.addEventListener('click',()=>{
  pages=[];selectedPage=null;
  els.pageSelect.innerHTML='<option value="">Connect Facebook first</option>';els.pageSelect.disabled=true;
  els.connectFacebook.classList.remove('hidden');els.disconnectFacebook.classList.add('hidden');
  els.topStatus.textContent='● Facebook not connected • v12';els.connectionStatus.textContent='Disconnected from this browser session.';
});
els.pageSelect.addEventListener('change',()=>{
  const i=Number(els.pageSelect.value);selectedPage=Number.isInteger(i)&&pages[i]?pages[i]:null;
  if(selectedPage) els.connectionStatus.textContent=`Selected Page: ${selectedPage.name}`;
});


function setSourceMode(mode){
  sourceMode=mode;
  els.sourceAutoTab.classList.toggle('active',mode==='auto');
  els.sourceStickTab.classList.toggle('active',mode==='stick');
  els.sourceOwnTab.classList.toggle('active',mode==='own');
  els.autoSourcePanel.classList.toggle('hidden',mode!=='auto');
  els.stickSourcePanel.classList.toggle('hidden',mode!=='stick');
  els.ownSourcePanel.classList.toggle('hidden',mode!=='own');
  selectedFile=null;selectedSource=null;
  clearPreview();
}
els.sourceAutoTab.addEventListener('click',()=>setSourceMode('auto'));
els.sourceStickTab.addEventListener('click',()=>setSourceMode('stick'));
els.sourceOwnTab.addEventListener('click',()=>setSourceMode('own'));


function stickPalette(name='blue'){
  const palettes={
    blue:['#071a33','#0e4a86','#54a8ff'],
    sunset:['#351447','#f05a5a','#ffc46b'],
    city:['#101826','#26364f','#7aa7d9'],
    park:['#173b2a','#2f7a4d','#8ed081'],
    dark:['#06070c','#16172a','#8f5cff']
  };
  return palettes[name]||palettes.blue;
}
function roundedRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function drawStickFigure(ctx,x,y,scale,pose,color='#fff',accent='#4ea2ff'){
  const t=pose.t||0;
  const headR=34*scale;
  const body=125*scale;
  const limb=88*scale;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.lineWidth=14*scale;ctx.fillStyle=color;
  ctx.beginPath();ctx.arc(x,y-headR,headR,0,Math.PI*2);ctx.stroke();
  const neckY=y;
  const hipY=y+body;
  ctx.beginPath();ctx.moveTo(x,neckY);ctx.lineTo(x,hipY);ctx.stroke();
  const armSwing=Math.sin(t*6)*0.7;
  const legSwing=Math.sin(t*6+Math.PI)*0.65;
  const action=pose.action||'funny';
  let lArm=armSwing,rArm=-armSwing,lLeg=legSwing,rLeg=-legSwing;
  if(action==='dance'){lArm=1.3+Math.sin(t*8)*.4;rArm=-1.3+Math.cos(t*8)*.4;lLeg=Math.sin(t*8)*.8;rLeg=-lLeg;}
  if(action==='fight'){lArm=.25+Math.sin(t*10)*.25;rArm=-1.0;lLeg=.25;rLeg=-.25;}
  if(action==='hero'){lArm=1.15;rArm=-1.15;lLeg=.15;rLeg=-.15;}
  if(action==='football'){lArm=.4;rArm=-.4;lLeg=1.0*Math.sin(t*7);rLeg=-.35;}
  const shoulderY=y+18*scale;
  function limbLine(ax,ay,ang,len){ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+Math.sin(ang)*len,ay+Math.cos(ang)*len);ctx.stroke();}
  limbLine(x,shoulderY,lArm,limb);
  limbLine(x,shoulderY,rArm,limb);
  limbLine(x,hipY,lLeg,limb*1.05);
  limbLine(x,hipY,rLeg,limb*1.05);
  ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x,hipY+10*scale,10*scale,0,Math.PI*2);ctx.fill();
}
function drawStickBackground(ctx,w,h,name,t){
  const [a,b,c]=stickPalette(name);
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,a);g.addColorStop(.58,b);g.addColorStop(1,c);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.globalAlpha=.16;ctx.fillStyle='#fff';
  for(let i=0;i<14;i++){const x=((i*137+t*28)% (w+180))-90;const y=120+(i%6)*220;ctx.beginPath();ctx.arc(x,y,18+(i%4)*8,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  if(name==='city'){
    ctx.fillStyle='rgba(0,0,0,.35)';
    for(let i=0;i<9;i++){const bw=80+(i%3)*30,bh=260+(i%4)*120;ctx.fillRect(i*135,h-bh-80,bw,bh);}
  }else if(name==='park'){
    ctx.fillStyle='rgba(25,80,35,.55)';ctx.fillRect(0,h-310,w,310);
    for(let i=0;i<5;i++){ctx.fillStyle='#4e7f48';ctx.beginPath();ctx.arc(90+i*220,h-330,110,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6d4a35';ctx.fillRect(75+i*220,h-330,30,170);}
  }
}
function wrapCanvasText(ctx,text,maxWidth,maxLines=3){
  const words=String(text||'').split(/\s+/).filter(Boolean),lines=[];let line='';
  for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width<=maxWidth)line=test;else{if(line)lines.push(line);line=word;}if(lines.length>=maxLines-1)break;}
  if(line&&lines.length<maxLines)lines.push(line);return lines;
}
function drawStickCaption(ctx,w,h,text){
  ctx.save();ctx.font='900 62px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  const lines=wrapCanvasText(ctx,text,w-150,3);const lh=72,boxH=lines.length*lh+54,y=170;
  ctx.fillStyle='rgba(0,0,0,.55)';roundedRect(ctx,55,y-boxH/2,w-110,boxH,34);ctx.fill();
  ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=10;
  lines.forEach((ln,i)=>ctx.fillText(ln,w/2,y-(lines.length-1)*lh/2+i*lh));ctx.restore();
}
function addCartoonAudio(audioCtx,dest,duration,action){
  const master=audioCtx.createGain();master.gain.value=.34;master.connect(dest);
  const now=audioCtx.currentTime;
  const count=Math.max(5,Math.floor(duration*1.6));
  for(let i=0;i<count;i++){
    const start=now+.35+i*(duration-.7)/count;
    const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
    osc.type=i%2?'triangle':'sine';
    const base=action==='fight'?180:action==='dance'?330:action==='football'?240:270;
    osc.frequency.setValueAtTime(base+(i%5)*55,start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(70,base/2),start+.13);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.45,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+.16);
    osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+.18);
  }
  const bed=audioCtx.createOscillator(),bedGain=audioCtx.createGain();
  bed.type='sine';bed.frequency.value=82;bedGain.gain.value=.045;bed.connect(bedGain);bedGain.connect(master);bed.start(now);bed.stop(now+duration+.2);
}
function bestRecorderMime(){
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  return types.find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||'';
}
async function generateStickManVideo(){
  if(searchBusy) return;
  const topic=(els.stickTopic.value.trim()||els.topic.value.trim()||'Funny Stick Man').slice(0,90);
  const dialogue=(els.stickText.value.trim()||topic).slice(0,90);
  const duration=Math.max(6,Math.min(20,Number(els.stickDuration.value)||12));
  const action=els.stickAction.value||'funny';
  const bg=els.stickBackground.value||'blue';
  if(!window.MediaRecorder) return setProgress(0,'This browser does not support the Stick Man video recorder. Try the latest Chrome.');
  searchBusy=true;els.generateStickVideo.disabled=true;clearPreview();
  setProgress(8,'Drawing your original Stick Man Reel…');
  try{
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d');
    const videoStream=canvas.captureStream(30);
    const AC=window.AudioContext||window.webkitAudioContext;
    const audioCtx=AC?new AC():null;
    const dest=audioCtx?audioCtx.createMediaStreamDestination():null;
    if(audioCtx&&dest){await audioCtx.resume();addCartoonAudio(audioCtx,dest,duration,action);}
    const mixed=new MediaStream([...videoStream.getVideoTracks(),...(dest?dest.stream.getAudioTracks():[])]);
    const mime=bestRecorderMime();
    const recorder=new MediaRecorder(mixed,{mimeType:mime||undefined,videoBitsPerSecond:3600000,audioBitsPerSecond:128000});
    const chunks=[];recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=()=>reject(recorder.error||new Error('Stick Man recorder failed.'));});
    recorder.start(500);
    const start=performance.now();
    await new Promise(resolve=>{
      const draw=now=>{
        const elapsed=(now-start)/1000,t=Math.min(duration,elapsed),p=t/duration;
        drawStickBackground(ctx,1080,1920,bg,t);
        const ground=1510;
        ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(70,ground+250);ctx.lineTo(1010,ground+250);ctx.stroke();
        let x1=300,x2=760,y=1150;
        if(action==='run'){x1=180+p*700;x2=520+p*480;}
        if(action==='fight'){x1=360+Math.sin(t*4)*25;x2=720+Math.cos(t*4)*25;}
        if(action==='dance'){y=1150+Math.sin(t*7)*35;}
        if(action==='hero'){y=1120-Math.sin(Math.min(1,p)*Math.PI)*120;}
        drawStickFigure(ctx,x1,y,1.45,{t,action},'#fff','#60b5ff');
        drawStickFigure(ctx,x2,y+20,1.30,{t:t+.7,action},'#fff','#ff7aa8');
        if(action==='football'){
          const bx=540+Math.sin(t*4)*180,by=1540-Math.abs(Math.sin(t*4))*180;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,by,34,0,Math.PI*2);ctx.fill();
        }
        drawStickCaption(ctx,1080,1920,dialogue);
        ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='700 38px Arial';ctx.textAlign='center';ctx.fillText('Original Stick Man Reel',540,1810);
        setProgress(10+Math.round(p*68),`Creating Stick Man video… ${Math.min(duration,Math.ceil(t))}/${duration}s`);
        if(elapsed>=duration){resolve();return;}
        requestAnimationFrame(draw);
      };requestAnimationFrame(draw);
    });
    recorder.stop();await stopped;
    mixed.getTracks().forEach(t=>t.stop());
    if(audioCtx) await audioCtx.close().catch(()=>{});
    const blob=new Blob(chunks,{type:recorder.mimeType||mime||'video/webm'});
    const isMp4=/mp4/i.test(blob.type);const ext=isMp4?'mp4':'webm';
    const file=new File([blob],`stick-man-${Date.now()}.${ext}`,{type:blob.type});
    selectedFile=file;ownFile=null;
    selectedSource={kind:'stick',provider:'Stick Man Creator',title:topic,tags:`stick man animation ${topic}`,user:'Original browser animation',pageURL:'',width:1080,height:1920,duration,size:file.size};
    els.topic.value=topic;els.stickInfo.textContent=`Created original Stick Man video: 1080×1920 • ${duration}s • ${formatBytes(file.size)} • ${blob.type||'video'}`;
    generateCopy();
    setProgress(82,'Stick Man video created. Opening preview…');
    await createPreview();
    if(!isMp4) els.previewInfo.textContent += ' This browser recorded WebM; preview works, but Facebook may prefer MP4. Latest Chrome may provide MP4 recording.';
  }catch(err){setProgress(0,`Stick Man creation stopped: ${err.message}`);}finally{searchBusy=false;els.generateStickVideo.disabled=false;}
}
els.generateStickVideo.addEventListener('click',generateStickManVideo);
els.stickTopic.addEventListener('input',()=>{if(!els.stickText.value.trim())els.stickText.value=els.stickTopic.value.trim();els.topic.value=els.stickTopic.value.trim();if(els.topic.value.trim())generateCopy();});

els.ownVideo.addEventListener('change',()=>{
  ownFile=els.ownVideo.files?.[0]||null;
  if(!ownFile) return;
  if(!/\.m4?v$/i.test(ownFile.name)&&ownFile.type!=='video/mp4'){
    ownFile=null;els.ownVideo.value='';
    return setProgress(0,'For the fast preview-first version, choose an MP4/M4V video.');
  }
  selectedFile=ownFile;
  selectedSource={kind:'own',provider:'Own video',title:ownFile.name,size:ownFile.size};
  els.topic.value ||= ownFile.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
  els.sourceInfo.textContent=`Selected your video: ${ownFile.name} • ${formatBytes(ownFile.size)}`;
  generateCopy();
  clearPreview();
});

function oldLooking(text=''){
  return /black\s*(?:and|&)\s*white|monochrome|grayscale|grey\s*scale|vintage|retro|archive|archival|old\s*film|film\s*grain|sepia|\b(?:18|19)\d{2}\b/i.test(text);
}

function topicSearchPlan(topic=''){
  const t=String(topic).toLowerCase().trim();
  const military=/\b(war|military|battle|combat|army|navy|marine|marines|air force|soldier|soldiers|troop|troops|tank|tanks)\b/i;
  const us=/\b(united states|u\.?s\.?a?|american|america)\b/i;
  const space=/\b(space|nasa|rocket|rockets|astronaut|astronauts|moon|mars|satellite|launch)\b/i;

  if(us.test(t)&&military.test(t)){
    return {label:'United States military',queries:['american military soldiers','us army soldiers','united states military'],required:[military],providers:['dvids','pexels','pixabay']};
  }
  if(military.test(t)){
    return {label:topic,queries:[`${topic} soldiers`,`${topic} military`,topic],required:[military],providers:['dvids','pexels','pixabay']};
  }
  if(space.test(t)){
    return {label:topic,queries:[topic],required:[space],providers:['nasa','pexels','pixabay']};
  }
  if(/\b(lion|lions|tiger|tigers|wildlife|animal|animals)\b/i.test(t)){
    return {label:topic,queries:[topic,`${topic} wildlife`],required:[/\b(lion|lions|tiger|tigers|wildlife|animal|animals)\b/i],providers:['pexels','pixabay']};
  }
  if(/\b(puppy|puppies|dog|dogs|kitten|kittens|cat|cats|pet|pets)\b/i.test(t)){
    return {label:topic,queries:[topic,`${topic} pet`],required:[/\b(puppy|puppies|dog|dogs|kitten|kittens|cat|cats|pet|pets)\b/i],providers:['pexels','pixabay']};
  }
  if(/\b(nature|waterfall|forest|ocean|beach|mountain|landscape)\b/i.test(t)){
    return {label:topic,queries:[topic],required:[/\b(nature|waterfall|forest|ocean|beach|mountain|landscape)\b/i],providers:['pexels','pixabay','nasa']};
  }
  const tokens=safeWords(topic).filter(w=>w.length>2&&!SEO_STOPWORDS.has(w)).map(w=>w.endsWith('s')&&w.length>4?w.slice(0,-1):w);
  return {label:topic,queries:[topic],tokens,required:[],providers:['pexels','pixabay','nasa']};
}

function candidateMatchesTopic(c,topic){
  const text=`${c?.title||''} ${c?.tags||''} ${c?.description||''}`.toLowerCase();
  const plan=topicSearchPlan(topic);
  if(plan.required?.length && !plan.required.every(re=>re.test(text))) return false;
  if(plan.tokens?.length && !plan.tokens.some(tok=>text.includes(tok))) return false;
  return true;
}

function pickPixabayRendition(hit){
  const vids=Object.values(hit?.videos||{}).filter(v=>v?.url&&Number(v.width)>0&&Number(v.height)>0);
  const vertical=vids.filter(v=>v.height>v.width&&v.width>=720&&v.height>=1280&&v.width/v.height>0.48&&v.width/v.height<0.65&&Number(v.size||0)<=45*1024*1024);
  if(!vertical.length) return null;
  vertical.sort((a,b)=>Math.abs((a.width||0)-1080)-Math.abs((b.width||0)-1080) || Number(a.size||0)-Number(b.size||0));
  return vertical[0];
}

async function pixabayCandidates(query,page=1){
  const key=els.pixabayKey.value.trim();
  if(!key) return [];
  const q=new URLSearchParams({key,q:query,video_type:'film',safesearch:'true',order:'latest',page:String(page),per_page:'80',min_width:'720',min_height:'1280'});
  const r=await fetch(`https://pixabay.com/api/videos/?${q}`);
  if(!r.ok) return [];
  const data=await r.json();
  return (Array.isArray(data.hits)?data.hits:[]).map(hit=>{
    const v=pickPixabayRendition(hit); if(!v) return null;
    return {provider:'Pixabay',id:`pixabay:${hit.id}`,title:hit.tags||query,tags:hit.tags||query,user:hit.user||'Pixabay contributor',pageURL:hit.pageURL,videoURL:v.url,width:v.width,height:v.height,duration:Number(hit.duration||0),size:Number(v.size||0)};
  }).filter(Boolean);
}

async function pexelsCandidates(query,page=1){
  const key=els.pexelsKey.value.trim();
  if(!key) return [];
  const q=new URLSearchParams({query,orientation:'portrait',size:'medium',page:String(page),per_page:'80'});
  const r=await fetch(`https://api.pexels.com/v1/videos/search?${q}`,{headers:{Authorization:key}});
  if(!r.ok) return [];
  const data=await r.json();
  const out=[];
  for(const hit of (data.videos||[])){
    const files=(hit.video_files||[]).filter(v=>v?.link&&Number(v.width)>0&&Number(v.height)>0&&v.height>v.width&&v.width>=720&&v.height>=1280&&String(v.file_type||'').includes('mp4'));
    if(!files.length) continue;
    files.sort((a,b)=>Math.abs((a.width||0)-1080)-Math.abs((b.width||0)-1080));
    const v=files[0];
    out.push({provider:'Pexels',id:`pexels:${hit.id}`,title:query,tags:query,user:hit.user?.name||'Pexels contributor',pageURL:hit.url,videoURL:v.link,width:v.width,height:v.height,duration:Number(hit.duration||0),size:0});
  }
  return out;
}

function twoYearsAgoIso(){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-2);return d.toISOString().replace(/\.\d{3}Z$/,'Z');}

async function dvidsCandidates(query,page=1){
  const key=els.dvidsKey.value.trim();
  if(!key) return [];
  const q=new URLSearchParams({api_key:key,q:query,type:'video',hd:'1',aspect_ratio:'portrait',sort:'publishdate',sortdir:'desc',max_results:'25',page:String(page),from_duration:'5',to_duration:'60',from_publishdate:twoYearsAgoIso()});
  const r=await fetch(`https://api.dvidshub.net/search?${q}`);
  if(!r.ok) return [];
  const data=await r.json();
  return (data.results||[]).map(hit=>({provider:'DVIDS',id:hit.id,title:hit.title||query,tags:hit.keywords||query,description:hit.short_description||'',user:hit.credit||hit.unit_name||'DVIDS',pageURL:hit.url,duration:Number(hit.duration||0),assetId:hit.id}));
}

async function hydrateDvids(c){
  const key=els.dvidsKey.value.trim(); if(!key||!c.assetId) return null;
  const r=await fetch(`https://api.dvidshub.net/asset?${new URLSearchParams({id:c.assetId,api_key:key})}`);
  if(!r.ok) return null;
  const data=await r.json(); const a=data.results||{};
  const files=(a.files||[]).filter(f=>f?.src&&String(f.type||'').includes('mp4')&&Number(f.height)>Number(f.width)&&Number(f.width)>=720&&Number(f.size||0)<=45*1024*1024);
  if(!files.length) return null;
  files.sort((x,y)=>Math.abs((x.width||0)-1080)-Math.abs((y.width||0)-1080) || Number(x.size||0)-Number(y.size||0));
  const f=files[0];
  return {...c,videoURL:f.src,width:f.width,height:f.height,size:Number(f.size||0),duration:Number(a.duration||c.duration||0),description:a.description||c.description||'',user:Array.isArray(a.credit)?a.credit.map(x=>[x.rank,x.name].filter(Boolean).join(' ')).join(', '):(a.credit||c.user)};
}

async function nasaCandidates(query,page=1){
  const q=new URLSearchParams({q:query,media_type:'video',page:String(page)});
  const r=await fetch(`https://images-api.nasa.gov/search?${q}`);
  if(!r.ok) return [];
  const data=await r.json(); const items=data.collection?.items||[];
  return items.slice(0,25).map(item=>{const d=item.data?.[0]||{};return {provider:'NASA',id:`nasa:${d.nasa_id||Math.random()}`,title:d.title||query,tags:(d.keywords||[]).join(' ')||query,description:d.description||'',user:'NASA',pageURL:d.nasa_id?`https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`:'https://images.nasa.gov/',duration:0,nasaId:d.nasa_id};}).filter(x=>x.nasaId);
}

async function hydrateNasa(c){
  if(!c.nasaId) return null;
  const r=await fetch(`https://images-api.nasa.gov/asset/${encodeURIComponent(c.nasaId)}`);
  if(!r.ok) return null;
  const data=await r.json();
  const urls=(data.collection?.items||[]).map(x=>x.href).filter(Boolean).filter(u=>/\.mp4(?:\?|$)/i.test(u));
  for(const u of urls){
    try{
      const f=await fetchVideoFile(u,`nasa-${c.nasaId}.mp4`);
      const m=await videoMeta(f);
      if(m.height>m.width&&m.width>=720&&m.height>=1280&&f.size<=45*1024*1024) return {...c,_file:f,videoURL:u,width:m.width,height:m.height,duration:m.duration,size:f.size};
    }catch{}
  }
  return null;
}

async function fetchVideoFile(url,name='source.mp4'){
  const r=await fetch(url);
  if(!r.ok) throw new Error(`Video download failed (${r.status}).`);
  const blob=await r.blob();
  if(blob.size>45*1024*1024) throw new Error('Video is larger than the 45 MB fast-upload limit.');
  return new File([blob],name,{type:blob.type&&blob.type.includes('video')?blob.type:'video/mp4'});
}

async function prepareCandidate(c){
  if(c.provider==='DVIDS') c=await hydrateDvids(c);
  if(c.provider==='NASA') c=await hydrateNasa(c);
  if(!c) return null;
  let file=c._file||null;
  if(!file){try{file=await fetchVideoFile(c.videoURL,`${c.provider.toLowerCase()}-${String(c.id).replace(/[^a-z0-9_-]/gi,'-')}.mp4`);}catch{return null;}}
  const meta=await videoMeta(file);
  if(!(meta.height>meta.width&&meta.width>=720&&meta.height>=1280)) return null;
  const score=await colorScore(file); if(score<0.08) return null;
  return {candidate:{...c,width:meta.width,height:meta.height,duration:meta.duration||c.duration,size:file.size,colorScore:score},file};
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

  generateCopy(); saveSetup(); searchBusy=true;
  els.findFreshVideo.disabled=true; els.findAnother.disabled=true; clearPreview();

  try{
    const plan=topicSearchPlan(topic);
    const providers=plan.providers.filter(p=>{
      if(p==='pixabay') return Boolean(els.pixabayKey.value.trim());
      if(p==='pexels') return Boolean(els.pexelsKey.value.trim());
      if(p==='dvids') return Boolean(els.dvidsKey.value.trim());
      if(p==='nasa') return true;
      return false;
    });
    if(!providers.length) throw new Error('Add at least one source key (Pixabay/Pexels/DVIDS), or use your own/direct MP4 URL.');

    for(const provider of providers){
      for(const query of plan.queries){
        for(let page=1;page<=2;page++){
          setProgress(8,`Searching ${provider.toUpperCase()} for “${query}”…`);
          let results=[];
          if(provider==='pixabay') results=await pixabayCandidates(query,page);
          else if(provider==='pexels') results=await pexelsCandidates(query,page);
          else if(provider==='dvids') results=await dvidsCandidates(query,page);
          else if(provider==='nasa') results=await nasaCandidates(query,page);

          results=results.filter(c=>!seenVideoIds.has(c.id)&&!oldLooking(`${c.title||''} ${c.tags||''} ${c.description||''}`)&&Number(c.duration||0)<=60&&candidateMatchesTopic(c,topic));

          for(const c of results){
            seenVideoIds.add(c.id);
            setProgress(20,`Checking ${c.provider} video for vertical format, colour and size…`);
            const ready=await prepareCandidate(c);
            if(!ready) continue;
            selectedFile=ready.file; selectedSource=ready.candidate;
            els.sourceInfo.innerHTML=`Selected from <strong>${escapeHtml(selectedSource.provider)}</strong> for <strong>${escapeHtml(topic)}</strong>: <strong>${escapeHtml(selectedSource.width)}×${escapeHtml(selectedSource.height)}</strong> • ${escapeHtml(Number(selectedSource.duration||0).toFixed(0))} sec • ${escapeHtml(formatBytes(selectedFile.size))}<div class="source-credit">Credit: ${escapeHtml(selectedSource.user||selectedSource.provider)} • <a href="${escapeHtml(selectedSource.pageURL||'#')}" target="_blank" rel="noopener">Source page</a></div>`;
            generateCopy(); setProgress(35,'Relevant fresh colour video ready. Press CREATE PREVIEW.'); return;
          }
        }
      }
    }
    throw new Error(`No available source found a fresh vertical colour video that closely matched “${topic}”. Try a broader phrase or add another source key.`);
  }catch(err){setProgress(0,err.message);}finally{searchBusy=false;els.findFreshVideo.disabled=false;els.findAnother.disabled=false;}
}
els.findFreshVideo.addEventListener('click',findFresh);
els.findAnother.addEventListener('click',async()=>{selectedFile=null;selectedSource=null;clearPreview();await findFresh();if(selectedFile) await createPreview();});

els.loadDirectVideo.addEventListener('click',async()=>{
  const url=els.directVideoUrl.value.trim();
  if(!url) return setProgress(0,'Paste a direct MP4 URL first.');
  if(!/^https:\/\//i.test(url)) return setProgress(0,'Use an HTTPS direct video URL.');
  try{
    setProgress(12,'Loading authorized direct video…');
    const file=await fetchVideoFile(url,'authorized-direct.mp4');
    const meta=await videoMeta(file);
    if(!(meta.height>meta.width)) throw new Error('That video is not vertical. Use a vertical Reel source.');
    selectedFile=file;
    selectedSource={provider:'Authorized URL',kind:'direct',id:`direct:${await blobHash(file)}`,title:els.topic.value.trim()||'Authorized video',tags:els.topic.value.trim(),user:'Authorized source',pageURL:url,width:meta.width,height:meta.height,duration:meta.duration,size:file.size};
    generateCopy();
    els.sourceInfo.textContent=`Authorized direct video selected: ${meta.width}×${meta.height} • ${Number(meta.duration||0).toFixed(0)} sec • ${formatBytes(file.size)}`;
    setProgress(35,'Direct video ready. Press CREATE PREVIEW.');
  }catch(err){setProgress(0,`Direct video stopped: ${err.message}`);}
});

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
  if(sourceMode==='stick'&&!selectedFile) return setProgress(0,'Create a Stick Man video first.');
  if(sourceMode==='own'&&!ownFile) return setProgress(0,'Choose your MP4 video first.');
  const file=sourceMode==='own'?ownFile:selectedFile;
  selectedFile=file;
  if(!file) return setProgress(0,'No video is selected.');
  const meta=await videoMeta(file);
  if((sourceMode==='auto'||sourceMode==='stick') && !(meta.height>meta.width)) return setProgress(0,'This Reel source is not vertical.');
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
    const upload=await fetch(`${workerBase()}/reels/upload`,{method:'POST',headers:{'x-upload-url':init.upload_url,'x-page-token':pageToken,'content-type':blob.type||'video/mp4'},body:blob});
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

els.topic.addEventListener('input',()=>{if(sourceMode!=='stick'&&els.topic.value.trim())generateCopy();});
els.topic.addEventListener('change',()=>{selectedFile=null;selectedSource=null;searchPage=1;seenVideoIds.clear();clearPreview();if(els.topic.value.trim())generateCopy();});
