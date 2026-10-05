import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { loadProfilePhoto } from '../services/profilePhoto';
export default function useOwnAvatar() {
 const id=useStore(s=>s.user?.id),locked=useStore(s=>s.isLocked),revision=useStore(s=>s.profileRevision);
 const [uri,setUri]=useState(null);
 useEffect(()=>{let active=true;setUri(null);if(id&&!locked)loadProfilePhoto(id).then(value=>{if(active)setUri(value);}).catch(()=>{});return()=>{active=false;};},[id,locked,revision]);
 return uri;
}
