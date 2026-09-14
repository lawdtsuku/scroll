// Keep offline updates recoverable even if the main application fails to start.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
