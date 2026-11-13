import {state,toast,makeId} from '../core.js';
import {add,put} from '../storage.js';

const table=(()=>{const values=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;values[n]=c>>>0}return values})();
function u16(value){return new Uint8Array([value&255,(value>>>8)&255])}
function u32(value){return new Uint8Array([value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255])}
function updateCrc(crc,bytes){let value=crc;for(let i=0;i<bytes.length;i++)value=table[(value^bytes[i])&255]^(value>>>8);return value>>>0}
async function crc32(blob){let crc=0xffffffff;if(blob.stream){const reader=blob.stream().getReader();for(;;){const part=await reader.read();if(part.done)break;crc=updateCrc(crc,part.value)}}else crc=updateCrc(crc,new Uint8Array(await blob.arrayBuffer()));return (crc^0xffffffff)>>>0}
function safeFilename(value){const cleaned=String(value||'audio').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,160);return cleaned||'audio'}
function zipDate(date){const year=Math.max(1980,Math.min(2107,date.getFullYear()));return {time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2),date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()}}
function header(name,crc,size,offset,stamp,central){const encoded=new TextEncoder().encode(name),parts=[];if(central){parts.push(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(stamp.time),u16(stamp.date),u32(crc),u32(size),u32(size),u16(encoded.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),encoded)}else parts.push(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(stamp.time),u16(stamp.date),u32(crc),u32(size),u32(size),u16(encoded.length),u16(0),encoded);return {parts,length:parts.reduce((sum,part)=>sum+part.length,0)}}
function artExtension(type){return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'})[type]||'bin'}
export async function exportLibraryBackup(){
 try{
  const now=new Date(),stamp=zipDate(now),entries=[];
  const manifest={format:'Auralis local library backup',version:1,createdAt:now.toISOString(),tracks:state.tracks.map((track,index)=>{
   const stem=String(index+1).padStart(5,'0')+'-'+safeFilename(track.name||track.title||'track.audio'),audioPath=track.blob instanceof Blob?'audio/'+stem:null,artworkPath=track.artwork instanceof Blob?'artwork/'+String(index+1).padStart(5,'0')+'.'+artExtension(track.artwork.type):null;
   if(audioPath)entries.push({name:audioPath,blob:track.blob});if(artworkPath)entries.push({name:artworkPath,blob:track.artwork});
   return {id:track.id,title:track.title||'',artist:track.artist||'',album:track.album||'',genre:track.genre||'',name:track.name||'',type:track.type||'',size:Number(track.size||track.blob?.size)||0,signature:track.signature||'',lastModified:track.lastModified||0,added:track.added||0,categories:track.categories||[],liked:!!track.liked,lyrics:track.lyrics||'',source:track.source||'local',provider:track.provider||'',providerId:track.providerId||'',providerUrl:track.providerUrl||'',artistId:track.artistId||'',artistUrl:track.artistUrl||'',duration:Number(track.duration)||0,artworkUrl:track.artworkUrl||'',audioPath,artworkPath,artworkType:track.artworkType||''}
  }),playlists:state.playlists,categories:state.categories,history:state.history,listeningSignals:state.listeningSignals,discoveryPreferences:state.discoveryPreferences,queueState:{queueIds:state.queueIds.filter(id=>{const track=state.tracks.find(item=>item.id===id)||state.catalogTracks.find(item=>item.id===id);return track&&track.provider!=='youtube'&&track.source!=='youtube'}),queueBaseIds:state.queueBaseIds.filter(id=>state.queueIds.includes(id)),currentTrackId:(state.tracks.find(item=>item.id===state.currentTrackId)||state.catalogTracks.find(item=>item.id===state.currentTrackId))?.provider!=='youtube'?state.currentTrackId:null,shuffle:state.shuffle,repeatMode:state.repeatMode},profileIdentity:(()=>{try{return localStorage.getItem('auralis-profile-identity-v1')}catch{return null}})(),preferences:state.prefs};
  entries.unshift({name:'manifest.json',blob:new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'})});
  const archiveCount=entries.length;if(archiveCount>65535)throw new Error('This library contains too many files for one backup');
  const localParts=[],centralParts=[];let offset=0;
  for(const entry of entries){const size=entry.blob.size;if(size>0xffffffff)throw new Error('A file is too large for the ZIP backup format');const crc=await crc32(entry.blob),local=header(entry.name,crc,size,0,stamp,false),central=header(entry.name,crc,size,offset,stamp,true);if(offset+local.length+size>0xffffffff)throw new Error('This backup is too large for the ZIP format');localParts.push(...local.parts,entry.blob);centralParts.push(...central.parts);offset+=local.length+size}
  const centralOffset=offset,centralSize=centralParts.reduce((sum,part)=>sum+part.length,0);if(centralOffset+centralSize>0xffffffff)throw new Error('This backup is too large for the ZIP format');
  const end=[u32(0x06054b50),u16(0),u16(0),u16(archiveCount),u16(archiveCount),u32(centralSize),u32(centralOffset),u16(0)],archive=new Blob([...localParts,...centralParts,...end],{type:'application/zip'}),url=URL.createObjectURL(archive),link=document.createElement('a');
  link.href=url;link.download='auralis-library-'+now.toISOString().slice(0,10)+'.zip';link.hidden=true;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Library backup exported')
 }catch(error){toast(error&&error.message?error.message:'Could not export the library backup')}
}
async function readStoredZip(file){
 const buffer=await file.arrayBuffer(),view=new DataView(buffer),bytes=new Uint8Array(buffer),files=new Map(),decoder=new TextDecoder();let offset=0,entries=0;
 while(offset+30<=view.byteLength&&view.getUint32(offset,true)===0x04034b50){
  const flags=view.getUint16(offset+6,true),method=view.getUint16(offset+8,true),compressed=view.getUint32(offset+18,true),uncompressed=view.getUint32(offset+22,true),nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true),nameStart=offset+30,name=decoder.decode(bytes.slice(nameStart,nameStart+nameLength)),dataStart=nameStart+nameLength+extraLength,dataEnd=dataStart+compressed;
  if(flags&0x0008)throw new Error('This backup uses unsupported ZIP data descriptors');if(method!==0||compressed!==uncompressed)throw new Error('Choose an Auralis library backup created by Export backup');if(dataEnd>view.byteLength)throw new Error('The backup file is incomplete');
  files.set(name,new Blob([bytes.slice(dataStart,dataEnd)]));offset=dataEnd;entries++;if(entries>100000)throw new Error('The backup contains too many files')
 }
 if(!entries)throw new Error('This ZIP does not contain an Auralis backup');const manifestFile=files.get('manifest.json');if(!manifestFile)throw new Error('The backup is missing its library manifest');const manifest=JSON.parse(await manifestFile.text());
 if(manifest.format!=='Auralis local library backup'||manifest.version!==1)throw new Error('This Auralis backup version is not supported');return {manifest,files}
}
export async function importLibraryBackup(file){
 if(!file)return;
 try{
  const {manifest,files}=await readStoredZip(file),categoryMap=new Map(),trackMap=new Map(),addedTracks=[];
  for(const source of manifest.categories||[]){let target=state.categories.find(item=>item.name.toLowerCase()===String(source.name||'').toLowerCase());if(!target){target={...source,id:state.categories.some(item=>item.id===source.id)?makeId():source.id||makeId()};await put('categories',target);state.categories.push(target)}categoryMap.set(source.id,target.id)}
  for(const source of manifest.tracks||[]){
   const blob=source.audioPath?files.get(source.audioPath):null,isStream=source.source==='stream'&&source.provider==='audius'&&source.providerId;if(!blob&&!isStream)continue;
   const duplicate=source.signature&&state.tracks.find(item=>item.signature===source.signature);if(duplicate){trackMap.set(source.id,duplicate.id);continue}
   const duplicateStream=isStream&&state.tracks.find(item=>item.source==='stream'&&item.provider==='audius'&&item.providerId===source.providerId);if(duplicateStream){trackMap.set(source.id,duplicateStream.id);continue}
   let id=source.id||makeId();if(state.tracks.some(item=>item.id===id))id=makeId();
   const track={...source,id,blob:blob||undefined,artwork:source.artworkPath?files.get(source.artworkPath)||null:null,source:isStream?'stream':'local',categories:(source.categories||[]).map(value=>categoryMap.get(value)||value),size:blob?.size||Number(source.size)||0};
   delete track.audioPath;delete track.artworkPath;await put('tracks',track);state.tracks.push(track);addedTracks.push(track);trackMap.set(source.id,id)
  }
  for(const source of manifest.playlists||[]){
   const name=String(source.name||'').trim();if(!name)continue;
   const id=state.playlists.some(item=>item.id===source.id)?makeId():source.id||makeId(),playlist={...source,id,trackIds:(source.trackIds||[]).map(trackId=>trackMap.get(trackId)||trackId).filter(id=>state.tracks.some(track=>track.id===id))};
   await put('playlists',playlist);state.playlists.push(playlist)
  }
  for(const item of manifest.history||[]){const trackId=trackMap.get(item.trackId)||item.trackId,snapshot=item.trackSnapshot?.source==='stream'?{...item.trackSnapshot,id:trackId}:null;if(!state.tracks.some(track=>track.id===trackId)&&!state.catalogTracks.some(track=>track.id===trackId)&&!snapshot)continue;if(snapshot&&!state.catalogTracks.some(track=>track.id===trackId)&&!state.tracks.some(track=>track.id===trackId))state.catalogTracks.push(snapshot);const copy={...item,trackId,...(snapshot?{trackSnapshot:snapshot}:{})};delete copy.id;const key=await add('history',copy);copy.id=key;state.history.unshift(copy)}
  for(const event of manifest.listeningSignals||[]){const copy={...event};delete copy.id;const key=await add('listeningSignals',copy);copy.id=key;state.listeningSignals.push(copy)}
  if(manifest.discoveryPreferences){state.discoveryPreferences=Object.assign(state.discoveryPreferences,manifest.discoveryPreferences);await put('settings',{key:'discoveryPreferences',value:state.discoveryPreferences})}
  if(manifest.queueState){const value=manifest.queueState;await put('settings',{key:'queueState',value});state.queueIds=(value.queueIds||[]).filter(id=>state.tracks.some(track=>track.id===id)||state.catalogTracks.some(track=>track.id===id));state.queueBaseIds=(value.queueBaseIds||[]).filter(id=>state.queueIds.includes(id));state.currentTrackId=state.queueIds.includes(value.currentTrackId)?value.currentTrackId:null;state.queueIndex=state.currentTrackId?state.queueIds.indexOf(state.currentTrackId):-1;state.shuffle=!!value.shuffle;state.repeatMode=['off','all','one'].includes(value.repeatMode)?value.repeatMode:'off'}
  if(typeof manifest.profileIdentity==='string'){try{localStorage.setItem('auralis-profile-identity-v1',manifest.profileIdentity)}catch(error){toast('Profile details could not be restored on this device')}}
  if(manifest.preferences){state.prefs=Object.assign(state.prefs,manifest.preferences);await put('settings',{key:'preferences',value:state.prefs})}
  state.tracks.sort((a,b)=>(a.added||0)-(b.added||0));state.playlists.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));state.history.sort((a,b)=>(b.startedAt||0)-(a.startedAt||0));state.refreshAll();toast('Backup restored · '+addedTracks.length+' songs added')
 }catch(error){toast(error&&error.message?error.message:'Could not restore this backup')}
 finally{$('backupImport').value=''}
}

