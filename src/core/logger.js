/* Toggleable logger wrapper.
   Usage:
     window.LOG.setEnabled(true) // show logs
     LOG.info('message')
   Optional: LOG.patchConsole(true) to gate console.* behind LOG.enabled.
*/
(function(){
    const state = { enabled: false, patched: false };
    const api = {
        setEnabled(flag){ state.enabled = !!flag; },
        isEnabled(){ return !!state.enabled; },
        log(){ if (state.enabled) console.log.apply(console, arguments); },
        info(){ if (state.enabled) console.info.apply(console, arguments); },
        warn(){ if (state.enabled) console.warn.apply(console, arguments); },
        error(){ console.error.apply(console, arguments); }, // never suppress errors
        patchConsole(flag){
            if (flag && !state.patched){
                const raw = { log: console.log, info: console.info, warn: console.warn };
                console.log = function(){ if (state.enabled) raw.log.apply(console, arguments); };
                console.info = function(){ if (state.enabled) raw.info.apply(console, arguments); };
                console.warn = function(){ if (state.enabled) raw.warn.apply(console, arguments); };
                state.patched = true;
            }
        }
    };
    if (typeof window !== 'undefined') window.LOG = api;
})();


