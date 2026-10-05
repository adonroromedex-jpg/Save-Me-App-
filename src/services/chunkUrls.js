// URLs keep their 15-second lifetime; only metadata batching changes.
// File bytes still download/decrypt at most three chunks at a time.
export function chunkUrlReader(storage,path,parts,now=()=>performance.now()){
  let signed=[],signedAt=-Infinity,pending=null;
  return async index=>{
    if(!Number.isInteger(index)||index<0||index>=parts)throw new Error('Invalid chunk index');
    if(!signed[index] || now()-signedAt>=10000){
      if(!pending)pending=(async()=>{
        const first=Math.floor(index/24)*24;
        const paths=Array.from({length:Math.min(24,parts-first)},(_,n)=>`${path}/${first+n}.bin`);
        const started=now();
        const {data,error}=await storage.createSignedUrls(paths,15);if(error)throw error;
        if(!Array.isArray(data)||data.length!==paths.length)throw new Error('Incomplete signed URLs');
        const next=[];
        data.forEach((entry,n)=>{if(entry.error||!entry.signedUrl)throw new Error('Telechajman pa otorize.');next[first+n]=entry.signedUrl;});
        signed=next;signedAt=started;
      })().finally(()=>{pending=null;});
      await pending;
    }
    if(!signed[index])throw new Error('Missing chunk URL');
    return signed[index];
  };
}
