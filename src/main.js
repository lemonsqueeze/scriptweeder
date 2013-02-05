// ==UserScript==
// @name jsarmor
// @author lemonsqueeze https://github.com/lemonsqueeze/jsarmor
// @description Block unwanted javascript. NoScript on steroids for opera !
// @published 2012-10-08 11:00
// ==/UserScript==

/* This script is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 */


// When running as userjs, document and window.document are the same,
// but when running as an extension they're 2 different things, beware !
(function(document, location, opera, scriptStorage)
{
    var version = 'jsarmor v1.5.0 (dev)';

@include "core.js"
@include "settings.js"    
@include "core_ui.js"
@include "utils.js"
@include "builtin_ui.js"

    /********************************* Startup ************************************/    

    function main()
    {
	// jsarmor ui's iframe, don't run in there !
	if (window != window.top && window.name == 'jsarmor_iframe') // FIXME better way of id ?
	    return;
	
	init();
	
	if (global_setting('whitelist') == '')
	{
	    // FIXME: need a nice way to edit this.
	    alert("Welcome to jsarmor !\n\n" +
		  "jsarmor's button will show up at the bottom right of pages using javascript.\n\n" +
		  "The initial global whitelist is set to:\n\n[" +
		  default_globally_allowed_hosts.join(', ') + "]");
	    set_global_setting('whitelist',
			       '. ' + default_globally_allowed_hosts.join(' '));
	}
    }

    main();

})(window.document, window.location, window.opera, window.opera.scriptStorage);
