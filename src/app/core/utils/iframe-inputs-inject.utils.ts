// Utility to generate swipe detection script for injection into iframes/freeboardsk
// All thresholds are configurable via options
export interface SwipeScriptConfig {
  instanceId?: string;
  minDist?: number;
  maxDur?: number;
  minVelocity?: number;
  axisDominance?: number;
  deadzoneMs?: number;
  purityRatio?: number;
  lockThreshold?: number;
  directionLockAngle?: number;
  reversalPrimaryThreshold?: number;
}

const DEFAULTS = {
  minDist: 230,
  maxDur: 550,
  minVelocity: 1.5, // require even faster swipe (1500px/s)
  axisDominance: 1.8,
  deadzoneMs: 160,
  purityRatio: 0.80,
  lockThreshold: 28,
  directionLockAngle: 25,
  reversalPrimaryThreshold: 34,
};

export function generateSwipeScript(config: SwipeScriptConfig): string {
  const opts = { ...DEFAULTS, ...config };
  // Inline script as string, interpolating config
  return `(() => {
    if (window.__kipSwipeInit) return; window.__kipSwipeInit = true;
    const instanceId='${opts.instanceId}';
    let pointerId=null; let startX=0; let startY=0; let startT=0; let peakPrimary=0; let peakCross=0; let cancelled=false;
    let lockedAxis=null; let lockedPrimarySign=0; let reversed=false;
    const minDist=${opts.minDist};
    const maxDur=${opts.maxDur};
    const minVelocity=${opts.minVelocity};
    const axisDominance=${opts.axisDominance};
    const deadzoneMs=${opts.deadzoneMs};
    const purityRatio=${opts.purityRatio};
    const lockThreshold=${opts.lockThreshold};
    const directionLockAngle=${opts.directionLockAngle};
    const reversalPrimaryThreshold=${opts.reversalPrimaryThreshold};
    function reset(){pointerId=null; cancelled=false; lockedAxis=null; lockedPrimarySign=0; reversed=false;}
    function onDown(e){ if(pointerId!==null) return; pointerId=e.pointerId; startX=e.clientX; startY=e.clientY; startT=performance.now(); peakPrimary=0; peakCross=0; cancelled=false; lockedAxis=null; lockedPrimarySign=0; reversed=false; }
    function track(e){ if(e.pointerId!==pointerId||cancelled) return; const dx=e.clientX-startX; const dy=e.clientY-startY; const adx=Math.abs(dx); const ady=Math.abs(dy); const primary=adx>ady?adx:ady; const cross=adx>ady?ady:adx; peakPrimary=Math.max(peakPrimary,primary); peakCross=Math.max(peakCross,cross);
      if(!lockedAxis && primary>=lockThreshold){ lockedAxis = adx>ady?'x':'y'; lockedPrimarySign = lockedAxis==='x' ? (Math.sign(dx)||1) : (Math.sign(dy)||1); }
      if(lockedAxis){
        const angleRad = Math.atan2(lockedAxis==='x'?ady:adx, lockedAxis==='x'?adx:ady); // angle from primary axis
        const angleDeg = angleRad * 180 / Math.PI;
        if(angleDeg > directionLockAngle){ cancelled=true; return; }
        if(lockedAxis==='x' && Math.sign(dx) && Math.sign(dx)!==lockedPrimarySign && Math.abs(dx) > reversalPrimaryThreshold){ reversed=true; cancelled=true; return; }
        if(lockedAxis==='y' && Math.sign(dy) && Math.sign(dy)!==lockedPrimarySign && Math.abs(dy) > reversalPrimaryThreshold){ reversed=true; cancelled=true; return; }
      }
      if (!cancelled && peakCross>42 && peakCross*axisDominance>peakPrimary) { cancelled=true; }
    }
    function onUp(e){ if(e.pointerId!==pointerId) return; const endT=performance.now(); const dt=endT-startT; const dx=e.clientX-startX; const dy=e.clientY-startY; const adx=Math.abs(dx); const ady=Math.abs(dy); const dist=Math.hypot(dx,dy); const velocity=dist/dt; const primary=adx>ady?adx:ady; const cross=adx>ady?ady:adx; const purity= primary? (primary/dist):0; if(!cancelled && !reversed && dt>=deadzoneMs && dt<=maxDur && dist>=minDist && velocity>=minVelocity && purity>=purityRatio && primary/Math.max(cross,1)>=axisDominance){ if(adx>ady){ window.parent.postMessage({gesture: dx>0?'swiperight':'swipeleft', eventData:{dx,dy,duration:dt,velocity,instanceId}}, '*'); } else { window.parent.postMessage({gesture: dy>0?'swipedown':'swipeup', eventData:{dx,dy,duration:dt,velocity,instanceId}}, '*'); } } reset(); }
    function onCancel(e){ if(e.pointerId===pointerId) reset(); }
    document.addEventListener('pointerdown', onDown, {passive:true});
    document.addEventListener('pointermove', track, {passive:true});
    document.addEventListener('pointerup', onUp, {passive:true});
    document.addEventListener('pointercancel', onCancel, {passive:true});
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','E','F','N'].includes(event.key)) {
        window.parent.postMessage({ type:'keydown', keyEventData:{ key:event.key, ctrlKey:event.ctrlKey, shiftKey:event.shiftKey, instanceId }}, '*');
      }
    });
  })();`;
}
