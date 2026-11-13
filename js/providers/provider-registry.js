import {audiusProvider} from './audius.js';

// Providers expose capabilities explicitly; metadata-only providers need not implement playback.
const providers=new Map([[audiusProvider.id,audiusProvider]]);
export function registerDiscoveryProvider(provider){
 if(!provider||typeof provider.id!=='string'||typeof provider.discover!=='function')throw new TypeError('A discovery provider needs an id and discover() method');
 providers.set(provider.id,provider);
}
export function getDiscoveryProvider(id){return providers.get(id)||null}
export async function discoverFromProviders(ids=['audius']){
 const selected=ids.map(id=>providers.get(id)).filter(provider=>provider&&typeof provider.discover==='function');
 const results=await Promise.all(selected.map(async provider=>{
  const tracks=await provider.discover();
  return tracks.map(track=>({...track,provider:track.provider||provider.id}));
 }));
 return results.flat();
}
