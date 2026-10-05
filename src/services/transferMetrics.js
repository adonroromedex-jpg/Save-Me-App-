import { useStore } from '../store/useStore';
// Session-only timings; never store filenames, recipients, PINs, keys or content.
export function transferTimer(userId, kind, direction) {
  const start=performance.now(); let previous=start;
  const phases={};
  return {
    mark(name) { const now=performance.now(); phases[name]=Math.round(now-previous); previous=now; },
    finish(bytes) {
      const now=performance.now();
      if(useStore.getState().user?.id!==userId)return;
      useStore.getState().addTransferMetric({kind,direction,bytes,total:Math.round(now-start),
        prepare:phases.prepare||0,transfer:phases.transfer||0,validate:Math.round(now-previous),at:Date.now()});
    },
  };
}
