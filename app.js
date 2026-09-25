import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

const $ = (id) => document.getElementById(id);
const videoInput = $('videoInput');
const preview = $('preview');
const startTime = $('startTime');
const endTime = $('endTime');
const clipLength = $('clipLength');
const autoPick = $('autoPick');
const createReel = $('createReel');
const progressBar = $('progressBar');
const status = $('status');
const topic = $('topic');
const caption = $('caption');
const hashtags = $('hashtags');
const generateCopy = $('generateCopy');
const copyPost = $('copyPost');
const downloadBox = $('downloadBox');
const downloadLink = $('downloadLink');
const workerUrl = $('workerUrl');
const pageId = $('pageId');
const pageToken = $('pageToken');
const saveConnection = $('saveConnection');
const testConnection = $('testConnection');
const publishReel = $('publishReel');
const facebookStatus = $('facebookStatus');

let inputFile = null;
let inputUrl = null;
let reelBlob = null;
let reelUrl = null;
let ffmpeg = null;

function setStatus(message, pct = null) {
  status.textContent = message;
  if (pct !== null) progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

async function ensureFFmpeg() {
  if (ffmpeg?.loaded) return ffmpeg;
  setStatus('Loading video engine…', 8);
  ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({progress}) => {
    if (Number.isFinite(progress)) progressBar.style.width = `${Math.round(progress*100)}%`;
  });
  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ffmpeg;
}

videoInput.addEventListener('change', () => {
  const file = videoInput.files?.[0];
  if (!file) return;
  inputFile = file;
  if (inputUrl) URL.revokeObjectURL(inputUrl);
  inputUrl = URL.createObjectURL(file);
  preview.src = inputUrl;
  preview.style.display = 'block';
  preview.onloadedmetadata = () => {
    const d = Number(preview.duration) || 30;
    startTime.max = d;
    endTime.max = d;
    startTime.value = '0';
    endTime.value = String(Math.min(d, Number(clipLength.value)||30).toFixed(1));
    autoPick.disabled = false;
    createReel.disabled = false;
    setStatus('Video ready. Auto-pick a clip or set your own start/end.', 0);
  };
});

autoPick.addEventListener('click', () => {
  if (!inputFile || !Number.isFinite(preview.duration)) return;
  const d = preview.duration;
  const target = Math.min(d, Number(clipLength.value)||30);
  const start = Math.max(0, (d-target)*0.25);
  startTime.value = start.toFixed(1);
  endTime.value = Math.min(d, start+target).toFixed(1);
  preview.currentTime = start;
  setStatus(`Selected a ${Math.round(target)} second Reel section.`, 0);
});

clipLength.addEventListener('change', () => autoPick.click());

function filenameExt(name='') {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : 'mp4';
}

createReel.addEventListener('click', async () => {
  if (!inputFile) return;
  const start = Math.max(0, Number(startTime.value)||0);
  const end = Math.max(start+.2, Number(endTime.value)||start+30);
  const duration = end-start;
  createReel.disabled = true;
  publishReel.disabled = true;
  downloadBox.classList.add('hidden');
  try {
    const ff = await ensureFFmpeg();
    const inName = `input.${filenameExt(inputFile.name)}`;
    try { await ff.deleteFile(inName); } catch {}
    try { await ff.deleteFile('facebook-reel.mp4'); } catch {}
    await ff.writeFile(inName, await fetchFile(inputFile));
    setStatus('Creating vertical 9:16 Facebook Reel…', 15);
    await ff.exec([
      '-ss', start.toFixed(3), '-i', inName, '-t', duration.toFixed(3),
      '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24',
      '-c:a', 'aac', '-b:a', '128k',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      'facebook-reel.mp4'
    ]);
    const data = await ff.readFile('facebook-reel.mp4');
    reelBlob = new Blob([data.buffer], {type:'video/mp4'});
    if (reelUrl) URL.revokeObjectURL(reelUrl);
    reelUrl = URL.createObjectURL(reelBlob);
    downloadLink.href = reelUrl;
    downloadLink.download = 'facebook-reel.mp4';
    downloadBox.classList.remove('hidden');
    publishReel.disabled = false;
    setStatus('Facebook Reel ready. No watermark was added.', 100);
  } catch (err) {
    console.error(err);
    setStatus(`Could not create Reel: ${err?.message || err}`, 0);
  } finally {
    createReel.disabled = false;
  }
});

generateCopy.addEventListener('click', () => {
  const t = (topic.value || inputFile?.name?.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ') || 'This moment').trim();
  caption.value = `${t} 👀\n\nWatch to the end and tell me what you think.`;
  const words = t.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>3).slice(0,3);
  hashtags.value = ['#FacebookReels','#Reels', ...words.map(w=>`#${w}`)].join(' ');
});

copyPost.addEventListener('click', async () => {
  await navigator.clipboard.writeText(`${caption.value.trim()}\n\n${hashtags.value.trim()}`.trim());
  copyPost.textContent = 'Copied';
  setTimeout(()=>copyPost.textContent='Copy caption + hashtags',1200);
});

function cleanWorkerUrl() {
  return workerUrl.value.trim().replace(/\/+$/,'');
}
function connection() {
  return {
    workerUrl: cleanWorkerUrl(),
    pageId: pageId.value.trim(),
    pageToken: pageToken.value.trim(),
  };
}

saveConnection.addEventListener('click', () => {
  const c = connection();
  sessionStorage.setItem('fbclip.workerUrl', c.workerUrl);
  sessionStorage.setItem('fbclip.pageId', c.pageId);
  sessionStorage.setItem('fbclip.pageToken', c.pageToken);
  facebookStatus.textContent = 'Saved for this browser session only.';
});

function restoreConnection() {
  workerUrl.value = sessionStorage.getItem('fbclip.workerUrl') || '';
  pageId.value = sessionStorage.getItem('fbclip.pageId') || '';
  pageToken.value = sessionStorage.getItem('fbclip.pageToken') || '';
}
restoreConnection();

async function callWorker(path, options={}) {
  const base = cleanWorkerUrl();
  if (!base) throw new Error('Add your Worker URL first.');
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {raw:text}; }
  if (!res.ok) throw new Error(data?.error?.message || data?.error || data?.raw || `HTTP ${res.status}`);
  return data;
}

testConnection.addEventListener('click', async () => {
  const c = connection();
  if (!c.pageId || !c.pageToken) {
    facebookStatus.textContent = 'Add your Page ID and Page access token first.';
    return;
  }
  facebookStatus.textContent = 'Testing Facebook Page connection…';
  try {
    const data = await callWorker('/page', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({pageId:c.pageId, pageToken:c.pageToken})
    });
    facebookStatus.textContent = `Connected to Page: ${data.name || c.pageId}`;
  } catch (err) {
    facebookStatus.textContent = `Connection failed: ${err.message}`;
  }
});

publishReel.addEventListener('click', async () => {
  if (!reelBlob) return;
  const c = connection();
  if (!c.workerUrl || !c.pageId || !c.pageToken) {
    facebookStatus.textContent = 'Add Worker URL, Page ID and Page token first.';
    return;
  }
  publishReel.disabled = true;
  try {
    facebookStatus.textContent = 'Starting Facebook Reel upload…';
    const init = await callWorker('/reels/start', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({pageId:c.pageId, pageToken:c.pageToken})
    });
    if (!init.video_id || !init.upload_url) throw new Error('Facebook did not return an upload session.');

    facebookStatus.textContent = 'Uploading Reel video…';
    const upload = await fetch(`${cleanWorkerUrl()}/reels/upload`, {
      method:'POST',
      headers:{
        'x-upload-url': init.upload_url,
        'x-page-token': c.pageToken,
        'content-type':'video/mp4'
      },
      body: reelBlob
    });
    const uploadText = await upload.text();
    if (!upload.ok) {
      let msg = uploadText;
      try { msg = JSON.parse(uploadText)?.error || uploadText; } catch {}
      throw new Error(String(msg));
    }

    facebookStatus.textContent = 'Publishing Reel…';
    const description = `${caption.value.trim()}\n\n${hashtags.value.trim()}`.trim();
    const done = await callWorker('/reels/finish', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({
        pageId:c.pageId,
        pageToken:c.pageToken,
        videoId:init.video_id,
        description
      })
    });

    facebookStatus.textContent = done.success === false
      ? 'Facebook received the Reel but did not confirm publication.'
      : 'Facebook Reel published successfully.';
  } catch (err) {
    console.error(err);
    facebookStatus.textContent = `Publish failed: ${err.message}`;
  } finally {
    publishReel.disabled = false;
  }
});
