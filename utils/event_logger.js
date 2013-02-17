// userjs to log all events.
// BeforeScript / BeforeExternalScript events are reported as well
//
// Useful to see what's going on in iframes for instance
// (log header shows page/iframe event origin)

(function()
{
    /*
    if (window != window.top && window.name == 'noscript_iframe')
    {
	log("ignoring jsamor iframe");
	return;
    }
    */
    
    function log(msg)
    {
	var header = (window == window.top ? "main  : " : "iframe: ");
	console.log(header + msg);
    }

    function beforescript(e)
    {
	if (e.element.src) // external script
	    return;	
	log("before     script");
    }

    function beforeexternalscript(e)
    {	log("before ext script: " + e.element.src);   }
    
    function domcontentloaded()
    {	log("DOMContentLoaded");    }
    
    function beforeevent(e)
    {
	if (e.event.target && e.event.target.tagName)
	    log("event: " + e.event.type + "<" + e.event.target.tagName + ">");
	else
	    log("event: " + e.event.type);
    }

    window.opera.addEventListener('BeforeEvent', beforeevent, false);
    document.addEventListener('DOMContentLoaded', domcontentloaded, false);
    window.opera.addEventListener('BeforeScript', beforescript,	false);
    window.opera.addEventListener('BeforeExternalScript', beforeexternalscript,	false);
    
    log("started");
    
})();
