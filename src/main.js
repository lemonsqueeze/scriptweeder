// ==UserScript==
// @name jsarmor
// @author lemonsqueeze https://github.com/lemonsqueeze/jsarmor
// @description Block unwanted javascript. NoScript on steroids for opera !
// @license GNU GPL version 2 or later version.
// @published 2012-10-08 11:00
// ==/UserScript==


// This file is put together from the different bits and pieces in the repository.
// Besides code there's css, html and encoded images in there, so it looks a little
// like an extension all packed into one file.
// You can edit it directly if you really want, but if you're going to be hacking
// this thing i'd suggest cloning the repo and working in there instead.
// Then you can just type 'make' and it'll regenerate the whole thing.

// When running as userjs, document and window.document are the same,
// but when running as an extension they're 2 different things, beware !
(function(document, location, opera, scriptStorage)
{
    var version_number = "1.5.0";
    var version_type = "userjs";
    var version_full = "jsarmor v"+ version_number + " (" + version_type + ")";
    
@include "core.js"
@include "settings.js"    
@include "userjs_ui.js"
@include "utils.js"
@include "ui.js"

    /********************************* Defaults ************************************/

    var default_global_whitelist =
    ['maps.google.com',
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

    function main()
    {
	// jsarmor ui's iframe, don't run in there !
	if (window != window.top && window.name == 'jsarmor_iframe')	// TODO better way of id ?
	    return;

	debug_log("start");	
	init();
	
	// first run
	if (global_setting('whitelist') == '')
	{	    
	    var load_defaults = confirm(
		"jsarmor up and running !\n\n" +
		"Main button will show up at the bottom right of pages using javascript.\n\n" +
		"Click [OK] to load default settings, or [Cancel] to start from scratch. " +
		"(can change your mind later either way).");

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

    main();

})(window.document, window.location, window.opera, window.opera.scriptStorage);
