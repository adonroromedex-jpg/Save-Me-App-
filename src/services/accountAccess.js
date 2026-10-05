import {useStore} from '../store/useStore';
// Gallery selection can return while the privacy lock is visible. Keep the selected
// app-private source, but never import, encrypt or display it for a different account.
export function waitForAccountUnlock(userId){
  return new Promise((resolve,reject)=>{
    let stop=()=>{};
    const check=()=>{
      const state=useStore.getState();
      if(state.user?.id!==userId || !state.isAuthenticated){stop();reject(new Error('Sesyon an chanje. Chwazi fichye a ankò nan kont ou.'));return;}
      if(!state.isLocked){stop();resolve();}
    };
    stop=useStore.subscribe(check);check();
  });
}
