// ==UserScript==
// @name scriptweeder
// @author lemonsqueeze https://github.com/lemonsqueeze/scriptweeder
// @description Block unwanted javascript. kickass noscript for opera !
// @license GNU GPL version 2 or later version.
// @published 2013-02-12
// ==/UserScript==


// This file is put together from the different bits and pieces in the repository.
// Some parts like the ui layout are generated from sources that are much nicer to
// work with. You can edit it directly if you want, but if you're going to be hacking
// this thing i'd suggest cloning the repository and working in there instead.
// Then you can just type 'make' and it'll regenerate the whole thing.

// When running as userjs, document and window.document are the same,
// but when running as an extension they're 2 different things, beware !
(function(document, location, opera, scriptStorage)
{
    var version_number = "1.5.0";
    var version_type = "userjs";
    var version_full = "scriptweeder v"+ version_number + " (" + version_type + ")";
    
@include "core.js"
@include "settings.js"    
@include "userjs_ui.js"
@include "utils.js"
@include "ui.js"

    /********************************* Defaults ************************************/

    var default_global_whitelist =
    ['localhost',
     'maps.google.com',
     'maps.gstatic.com',
//     'ajax.googleapis.com',   // no need, relaxed mode will enable it
     's.ytimg.com',
     'code.jquery.com',
     'z-ecx.images-amazon.com',
     'st.deviantart.net',
     'static.tumblr.com',
     'codysherman.com'
    ];

    // Stuff we don't want to allow in relaxed mode which would otherwise be.
    var default_helper_blacklist =     // FIXME add ui to edit ?
    [ 'apis.google.com',	// only used for google plus one
      'widgets.twimg.com',	// twitter
      'static.ak.fbcdn.net'	// facebook
    ];

    
    /********************************* Startup ************************************/    

    function startup_checks()
    {	
	// first run
	if (global_setting('whitelist') == '')
	{	    
	    var load_defaults = confirm(
		"scriptweeder up and running !\n\n" +
		"Click ok to start with useful defaults for the global whitelist/blacklist, " +
		"or cancel to start from scratch.");

	    set_global_setting('version_number', version_number);
	    set_global_setting('version_type', version_type);	    
	    if (load_defaults)
	    {
		set_global_setting('whitelist',		array_to_list(default_global_whitelist) );
		set_global_setting('helper_blacklist',	array_to_list(default_helper_blacklist) );
	    }
	    else
	    {
		set_global_setting('whitelist',		array_to_list([]) );
		set_global_setting('helper_blacklist',	array_to_list([]) );
	    }
	}

	// upgrade from 1.44 or before
	if (global_setting('version_number') == '')
	{
	    set_global_setting('version_number', version_number);
	    set_global_setting('version_type', version_type);
	    // didn't exist:
	    set_global_setting('helper_blacklist',	array_to_list(default_helper_blacklist) );
	}
	
    }

    // to run safely as extension, only thing that can be done here is event registration.
    // see http://my.opera.com/community/forums/topic.dml?id=1621542
    // for userjs doesn't matter, we could init() here no problem.
    function boot()
    {
	// scriptweeder ui's iframe, don't run in there !
	if (window != window.top && window.name == 'scriptweeder_iframe')	// TODO better way of id ?
	    return; 
	if (location.hostname == "")	// bad url, opera's error page. 
	    return;
	
	setup_event_handlers();
	debug_log("start");	
    }
    
    boot();

})(window.document, window.location, window.opera, window.opera.scriptStorage);
