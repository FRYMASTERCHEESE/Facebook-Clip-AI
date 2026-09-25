const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,x-upload-url,x-page-token',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
};
function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json;charset=UTF-8'}});
}
function gv(v){
  return /^v\d+\.\d+$/.test(String(v||'')) ? String(v) : 'v24.0';
}
async function bodyJson(req){try{return await req.json()}catch{return {}}}

export default {
  async fetch(request){
    if(request.method==='OPTIONS') return new Response(null,{headers:cors});
    const url=new URL(request.url);
    try{
      if(url.pathname==='/health') return json({ok:true});

      if(url.pathname==='/reels/start' && request.method==='POST'){
        const {pageId,pageToken,graphVersion}=await bodyJson(request);
        if(!pageId||!pageToken) return json({error:'Missing Page ID or Page token.'},400);
        const q=new URLSearchParams({upload_phase:'start',access_token:pageToken});
        const r=await fetch(`https://graph.facebook.com/${gv(graphVersion)}/${encodeURIComponent(pageId)}/video_reels`,{
          method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:q.toString()
        });
        const data=await r.json();
        if(!r.ok||data.error) return json(data,r.status||400);
        return json(data);
      }

      if(url.pathname==='/reels/upload' && request.method==='POST'){
        const uploadUrl=request.headers.get('x-upload-url');
        const pageToken=request.headers.get('x-page-token');
        if(!uploadUrl||!pageToken) return json({error:'Missing Facebook upload URL or Page token.'},400);
        const buf=await request.arrayBuffer();
        const r=await fetch(uploadUrl,{
          method:'POST',
          headers:{
            'Authorization':`OAuth ${pageToken}`,
            'offset':'0',
            'file_size':String(buf.byteLength),
            'content-type':'application/octet-stream'
          },
          body:buf
        });
        const text=await r.text();
        return new Response(text,{status:r.status,headers:{...cors,'content-type':r.headers.get('content-type')||'application/json'}});
      }

      if(url.pathname==='/reels/finish' && request.method==='POST'){
        const {pageId,pageToken,videoId,description,graphVersion}=await bodyJson(request);
        if(!pageId||!pageToken||!videoId) return json({error:'Missing Page ID, Page token or video ID.'},400);
        const q=new URLSearchParams({
          upload_phase:'finish',
          video_id:String(videoId),
          video_state:'PUBLISHED',
          description:description||'',
          access_token:pageToken
        });
        const r=await fetch(`https://graph.facebook.com/${gv(graphVersion)}/${encodeURIComponent(pageId)}/video_reels`,{
          method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:q.toString()
        });
        const data=await r.json();
        if(!r.ok||data.error) return json(data,r.status||400);
        return json(data);
      }

      return json({error:'Not found'},404);
    }catch(err){
      return json({error:err?.message||String(err)},500);
    }
  }
};