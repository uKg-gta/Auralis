function fallbackName(file){return String(file.name||'').replace(/\.[^.]+$/,'')}
function textValue(bytes,encoding=3){
 let value='';
 try{
  if(encoding===0)value=new TextDecoder('windows-1252').decode(bytes);
  else if(encoding===1)value=new TextDecoder('utf-16').decode(bytes);
  else if(encoding===2)value=new TextDecoder('utf-16be').decode(bytes);
  else value=new TextDecoder('utf-8').decode(bytes);
 }catch(error){value=new TextDecoder().decode(bytes)}
 return value.replace(/\u0000/g,'').trim()
}
function u32be(view,offset){return view.getUint32(offset,false)}
function syncSafe(view,offset){return ((view.getUint8(offset)&127)<<21)|((view.getUint8(offset+1)&127)<<14)|((view.getUint8(offset+2)&127)<<7)|(view.getUint8(offset+3)&127)}
function readId3(bytes,result){
 if(bytes.length<10||String.fromCharCode(...bytes.slice(0,3))!=='ID3')return;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),version=view.getUint8(3),flags=view.getUint8(5),limit=Math.min(bytes.length,10+syncSafe(view,6));let offset=10;
 if(flags&0x40&&offset+4<limit){const ext=version===4?syncSafe(view,offset):u32be(view,offset);offset+=4+ext}
 while(offset+(version===2?6:10)<=limit){
  const id=String.fromCharCode(...bytes.slice(offset,offset+(version===2?3:4)));if(!/^[A-Z0-9]{3,4}$/.test(id))break;
  const header=version===2?6:10,size=version===2?(bytes[offset+3]<<16)|(bytes[offset+4]<<8)|bytes[offset+5]:version===4?syncSafe(view,offset+4):u32be(view,offset+4);
  if(size<=0||offset+header+size>limit)break;
  const payload=bytes.slice(offset+header,offset+header+size);const key=({TIT2:'title',TT2:'title',TPE1:'artist',TP1:'artist',TALB:'album',TAL:'album',TCON:'genre',TCO:'genre'})[id];
  if(key&&payload.length>1&&!result[key])result[key]=textValue(payload.slice(1),payload[0]);
  if((id==='USLT'||id==='ULT')&&payload.length>4&&!result.lyrics){const encoding=payload[0],body=payload.slice(4);let end=body.length;if(encoding===1||encoding===2){for(let p=0;p+1<body.length;p+=2)if(body[p]===0&&body[p+1]===0){end=p;break}end=Math.min(body.length,end+2)}else{const p=body.indexOf(0);if(p>=0)end=p+1}result.lyrics=textValue(body.slice(end),encoding)}
  if((id==='APIC'||id==='PIC')&&payload.length>8&&!result.artwork){
   let pos=1,mime='image/jpeg';if(id==='PIC'){const fmt=String.fromCharCode(...payload.slice(pos,pos+3));pos+=3;mime=fmt==='PNG'?'image/png':'image/jpeg'}else{let end=payload.indexOf(0,pos);if(end<0)end=pos;mime=textValue(payload.slice(pos,end))||mime;pos=end+1}
   pos++;const enc=payload[0],terminator=enc===1||enc===2?new Uint8Array([0,0]):new Uint8Array([0]);let descEnd=pos;
   if(enc===1||enc===2){while(descEnd+1<payload.length&&(payload[descEnd]!==0||payload[descEnd+1]!==0))descEnd+=2;descEnd+=2}else{while(descEnd<payload.length&&payload[descEnd]!==0)descEnd++;descEnd++}
   if(descEnd<payload.length){const data=payload.slice(descEnd);if(data.length)result.artwork=new Blob([data],{type:mime})}
  }
  offset+=header+size;
 }
}
function parseId3v1(bytes,result){
 if(bytes.length<128)return;const start=bytes.length-128;if(String.fromCharCode(...bytes.slice(start,start+3))!=='TAG')return;
 const fields=[['title',3,30],['artist',33,30],['album',63,30]];
 fields.forEach(([key,offset,length])=>{if(!result[key])result[key]=textValue(bytes.slice(start+offset,start+offset+length),0)})
}
function parseComments(bytes,start,result){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=start;
 if(offset+8>bytes.length)return;const vendorLength=view.getUint32(offset,true);offset+=4+vendorLength;if(offset+4>bytes.length)return;
 const count=Math.min(view.getUint32(offset,true),2000);offset+=4;
 for(let i=0;i<count;i++){if(offset+4>bytes.length)break;const length=view.getUint32(offset,true);offset+=4;if(length>bytes.length-offset)break;const entry=textValue(bytes.slice(offset,offset+length));offset+=length;const eq=entry.indexOf('=');if(eq<1)continue;const key=entry.slice(0,eq).toLowerCase(),value=entry.slice(eq+1);if(key==='title'&&!result.title)result.title=value;if(key==='artist'&&!result.artist)result.artist=value;if(key==='album'&&!result.album)result.album=value;if(key==='genre'&&!result.genre)result.genre=value;if((key==='lyrics'||key==='unsyncedlyrics')&&!result.lyrics)result.lyrics=value}
}
function parseFlac(bytes,result){
 if(String.fromCharCode(...bytes.slice(0,4))!=='fLaC')return;let offset=4,last=false;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 while(!last&&offset+4<=bytes.length){const header=view.getUint8(offset);last=!!(header&128);const type=header&127,size=(view.getUint8(offset+1)<<16)|(view.getUint8(offset+2)<<8)|view.getUint8(offset+3);const start=offset+4,end=start+size;if(end>bytes.length)break;
  if(type===4)parseComments(bytes.slice(start,end),0,result);
  if(type===6&&size>32&&!result.artwork){let p=start+4,mimeLen=view.getUint32(p,false);p+=4;const mime=textValue(bytes.slice(p,p+mimeLen));p+=mimeLen;const descLen=view.getUint32(p,false);p+=4+descLen+16;const dataLen=view.getUint32(p,false);p+=4;if(dataLen>0&&p+dataLen<=end)result.artwork=new Blob([bytes.slice(p,p+dataLen)],{type:mime||'image/jpeg'})}
  offset=end;
 }
}
function parseOgg(bytes,result){
 const asciiAt=(offset,value)=>{if(offset+value.length>bytes.length)return false;for(let i=0;i<value.length;i++)if(bytes[offset+i]!==value.charCodeAt(i))return false;return true};
 for(let offset=0;offset+8<bytes.length;offset++){
  if(asciiAt(offset,'OpusTags'))parseComments(bytes.slice(offset+8),0,result);
  else if(bytes[offset]===3&&asciiAt(offset+1,'vorbis'))parseComments(bytes.slice(offset+7),0,result);
 }
}
function parseWave(bytes,result){
 if(String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WAVE')return;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=12;
 while(offset+8<=bytes.length){const id=String.fromCharCode(...bytes.slice(offset,offset+4)),size=view.getUint32(offset+4,true),start=offset+8,end=Math.min(bytes.length,start+size);
  if(id==='LIST'&&String.fromCharCode(...bytes.slice(start,start+4))==='INFO'){let p=start+4;while(p+8<=end){const key=String.fromCharCode(...bytes.slice(p,p+4)),len=view.getUint32(p+4,true),val=textValue(bytes.slice(p+8,Math.min(end,p+8+len)),0);if(key==='INAM'&&!result.title)result.title=val;if(key==='IART'&&!result.artist)result.artist=val;if(key==='IPRD'&&!result.album)result.album=val;if(key==='IGNR'&&!result.genre)result.genre=val;p+=8+len+(len%2)}}
  offset=start+size+(size%2)
 }
}
function atomType(bytes,offset){return String.fromCharCode(...bytes.slice(offset+4,offset+8))}
function parseMp4(bytes,result){
 if(bytes.length<16)return;
 function walk(start,end,depth){
  if(depth>8)return;let offset=start;
  while(offset+8<=end){let size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,false),header=8;if(size===1&&offset+16<=end){const high=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset+8,false),low=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset+12,false);size=high*4294967296+low;header=16}else if(size===0)size=end-offset;if(size<header||offset+size>end)break;
   const type=atomType(bytes,offset),body=offset+header,atomEnd=offset+size;
   if(type==='ilst'){let p=body;while(p+8<=atomEnd){const itemSize=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(p,false),itemType=atomType(bytes,p);if(itemSize<8||p+itemSize>atomEnd)break;let q=p+8;while(q+16<=p+itemSize){const dsize=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(q,false);if(dsize<16||q+dsize>p+itemSize)break;if(atomType(bytes,q)==='data'){const kind=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(q+8,false),data=bytes.slice(q+16,q+dsize),copyright=String.fromCharCode(0xa9);if(itemType===copyright+'nam'&&!result.title)result.title=textValue(data,kind===2?2:3);if(itemType===copyright+'ART'&&!result.artist)result.artist=textValue(data,kind===2?2:3);if(itemType===copyright+'alb'&&!result.album)result.album=textValue(data,kind===2?2:3);if(itemType===copyright+'gen'&&!result.genre)result.genre=textValue(data,kind===2?2:3);if(itemType===copyright+'lyr'&&!result.lyrics)result.lyrics=textValue(data,kind===2?2:3);if(itemType==='covr'&&!result.artwork)result.artwork=new Blob([data],{type:kind===14?'image/png':'image/jpeg'})}q+=dsize}p+=itemSize}}
   else if(['moov','udta','meta','ilst','trak','mdia','minf','stbl'].includes(type)){walk(body+(type==='meta'?4:0),atomEnd,depth+1)}
   offset=atomEnd;
  }
 }
 walk(0,bytes.length,0);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 for(let offset=4;offset+4<=bytes.length;offset++){if(bytes[offset]!==109||bytes[offset+1]!==111||bytes[offset+2]!==111||bytes[offset+3]!==118)continue;const start=offset-4,size=view.getUint32(start,false);if(size>=8&&start+size<=bytes.length)walk(start,start+size,0)}
}
export async function parseAudioMetadata(file){
 const result={title:'',artist:'Unknown artist',album:'',genre:'',lyrics:'',artwork:null,artworkType:''};
 const size=Math.min(file.size,6*1024*1024),head=new Uint8Array(await file.slice(0,size).arrayBuffer());
 if(head.length>=3&&String.fromCharCode(...head.slice(0,3))==='ID3')readId3(head,result);
 if(!result.title&&!result.artist&&file.size>=128){const tail=new Uint8Array(await file.slice(Math.max(0,file.size-128)).arrayBuffer());parseId3v1(tail,result)}
 if(file.name.toLowerCase().endsWith('.flac'))parseFlac(head,result);
 if(file.name.toLowerCase().endsWith('.ogg')||file.name.toLowerCase().endsWith('.opus'))parseOgg(head,result);
 if(file.name.toLowerCase().endsWith('.wav'))parseWave(head,result);
 if(file.name.toLowerCase().endsWith('.m4a')||file.name.toLowerCase().endsWith('.mp4')){parseMp4(head,result);if(!result.title||!result.album||!result.artwork){const tail=new Uint8Array(await file.slice(Math.max(0,file.size-size),file.size).arrayBuffer());parseMp4(tail,result)}}
 if(!result.title){const raw=fallbackName(file),parts=raw.split(' - ');if(parts.length>1){if(result.artist==='Unknown artist')result.artist=parts[0];result.title=parts.slice(1).join(' - ')}else result.title=raw||'Untitled track'}
 if(!result.artist||result.artist==='Unknown artist'){const parts=fallbackName(file).split(' - ');if(parts.length>1)result.artist=parts[0];else result.artist='Unknown artist'}
 result.title=result.title.trim()||'Untitled track';result.artist=result.artist.trim()||'Unknown artist';result.album=(result.album||'').trim();result.genre=(result.genre||'').split(/[;,/]/)[0].trim();
 result.artworkType=result.artwork?.type||'';return result
}

