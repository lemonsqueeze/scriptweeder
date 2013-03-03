// ==UserScript==
// @name ScriptWeeder
// @author lemonsqueeze https://github.com/lemonsqueeze/scriptweeder
// @description Block unwanted javascript. noscript on steroids for opera !
// @license GNU GPL version 2 or later version.
// @published $Date$
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
    var version_number = "1.5.5";
    var version_type = "userjs";
    var version_date = "$Date$";
    var version_full = "scriptweeder " + version_type + " v" + version_number + ", " + version_date + ".";
    
@include "core.js"
@include "settings.js"    
@include "userjs_ui.js"
@include "utils.js"
@include "ui.js"

    /********************************* Defaults ************************************/

    var default_global_whitelist =
    { 'localhost':1,
      'maps.google.com':1,
      'maps.gstatic.com':1,
//    'ajax.googleapis.com':1,   // no need, relaxed mode will enable it
      's.ytimg.com':1,
      'code.jquery.com':1,
      'z-ecx.images-amazon.com':1,
      'st.deviantart.net':1,
      'static.tumblr.com':1,
      'codysherman.com':1
    };

    // Stuff we don't want to allow in relaxed mode which would otherwise be.
    var default_helper_blacklist =     // FIXME add ui to edit ?
    { 'apis.google.com':1,	// only used for google plus one
      'widgets.twimg.com':1,	// twitter
      'static.ak.fbcdn.net':1	// facebook
    };

    
    /********************************* Startup ************************************/    

    // quiet: no page redirect
    function startup_checks(quiet)
    {
	var start_page = "https://github.com/lemonsqueeze/scriptweeder/wiki/scriptweeder-extension-installed-!";
	if (in_iframe()) // don't redirect to start page in iframes.
	    return;
	
        // first run setup
        if ((location.href == start_page || quiet) && global_setting('mode') == '')
	{
	    set_global_setting('version_number', version_number);
	    set_global_setting('version_type', version_type);
	    set_global_setting('whitelist',		serialize_name_hash(default_global_whitelist) );
	    set_global_setting('helper_blacklist',	serialize_name_hash(default_helper_blacklist) );
	    set_global_setting('mode', default_mode);	    
	}
	
        // first run, send to start page
	if (global_setting('mode') == '') // will work with old settings
	    location.href = start_page;
	
	// upgrade from previous version
	if (global_setting('version_number') != version_number)
	{
	    var from = global_setting('version_number');
	    set_global_setting('version_number', version_number);

	    // 1.5.2 style upgrade
	    if (cmp_versions(from, "1.5.2") && global_setting('style') != '')
	    {
		set_global_setting('style', '');
		alert("ScriptWeeder 1.5.2 upgrade notice:\n\n" +
		      "The interface changed a bit, updated custom styles are available on the wiki page.");
	    }
	}

	// convert pre 1.5.1 list settings format
	if (global_setting('whitelist')[0] == '.')
	    convert_old_list_settings();
    }

    // to run safely as extension, only thing that should be done here is event registration.
    // see http://my.opera.com/community/forums/topic.dml?id=1621542
    // for userjs doesn't matter, we could init() here no problem.
    function boot()
    {
	// scriptweeder ui's iframe, don't run in there !
	if (in_iframe() && window.name == 'scriptweeder_iframe')	// TODO better way of id ?
	    return;
	if (location.hostname == "")	// bad url, opera's error page. 
	    return;
	
	setup_event_handlers();
	window.opera.scriptweeder = new Object();	// external api
	window.opera.scriptweeder.version = version_number;
	window.opera.scriptweeder.version_type = version_type;	
    }

    debug_log("start");
        
    if (forward_to_userjs())  // userjs detected, let it takeover and forward messages to it.
	return;
    
    boot();

})(window.document, window.location, opera, widget.preferences);
