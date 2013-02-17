/* page_event_logger.js
 * include in html page to see what events page scripts are getting.
 */

(function()
{
// http://www.opera.com/docs/userjs/examples/

    function log(msg)
    {
        var h = "page logger: ";
	var s =  "main  : ";
	if (window != window.top)
	    s = "iframe: ";
	console.log(h + s + msg);
    }

    function handler(event)
    {
	if (event.target && event.target.tagName)
	    log("event: " + event.type + "<" + event.target.tagName + ">");
	else
	    log("event: " + event.type);
    }

    /* anything else ? */
    var events = ['mousemove', 'mouseover', 'mouseout', 'mouseenter',
		  'click', 'dblclick',
		  'keydown', 'keyup', 'keypress',
		  'blur', 'DOMFocusOut', 'DOMFocusIn', 'focusout', 'focusin',
		  'error', 'resize', 'message',
		  'load', 'readystatechange',
 		  'DOMContentLoaded', 'DOMFrameContentLoaded'];
    for (var i = 0; i < events.length; i++)
	window.addEventListener(events[i], handler, false);
    log("started");
    
})();
