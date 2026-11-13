import {getAudiusDiscoveryCandidates} from '../features/catalog.js';
export const audiusProvider={
 id:'audius',
 capabilities:{search:true,discovery:true,streaming:true,metadata:true},
 discover:getAudiusDiscoveryCandidates
};
