function(){   // fake line, keep_editor_happy

    /**************************** Extension messaging ***************************/

    // not super robust, and won't match if there's a \n in the css.
    function get_css_prop(selector, prop, fatal)
    {
	var pat = selector + ".*" + prop + " *: *([^;]*) *;";
	var re = new RegExp(pat, 'g');
	var m = get_style().match(re);
	assert(m || !fatal, "get_css_prop(" + selector + ", " + prop + ") failed");
	if (!m)
	    return null;
	return m[m.length - 1].replace(re, '$1');
    }
    
    function get_icon_from_css(mode, fatal)
    {
        function findit(selector)
        {
	    var re = new RegExp(selector + ".*'(data:image/png;base64,[^']*)'", 'g');
            var m = get_style().match(re);
            if (!m)
                return null;
            return m[m.length - 1].replace(re, '$1'); // get the last one.
        }
	
	// look for toolbar specific rule first:   #toolbar_button.<mode> img
	var data_url = findit("#toolbar_button." + mode + "[ \t]+img");
	if (data_url)
	    return data_url;
	
	// then main button rule:  #main_button.<mode> img 
	data_url = findit("#main_button." + mode + "[ \t]+img");
	if (data_url)
	    return data_url;	

	// generic rule then: .<mode> img
	data_url = findit("." + mode + "[ \t]+img");
	if (data_url)
	    return data_url;
	assert(!fatal, "There's a problem with this style, couldn't find toolbar button image for " + mode + " mode.");
	return "";
    }


    function update_extension_button(force)
    {
	if (in_iframe() || !bgproc)
	    return;
	update_extension_button_icon(force);
	update_extension_button_badge(force);
    }

    var extension_button;    
    function update_extension_button_icon(force)
    {	
	var needed = something_to_display();	
	var status = (needed ? mode : 'off');
	if (!force && extension_button == status) // already in the right state
	    return;

	var msg = { button:disable_main_button, debug:debug_mode, mode:mode, disabled:!needed };
	if (disable_main_button) // using extension button, send icons
	{
	    // when button is not disabled, bgprocess still needs disabled icon for next tab switch
	    msg.disabled_icon = get_icon_from_css('disabled', false);	
	    msg.icon = (needed ? get_icon_from_css(mode, true) : msg.disabled_icon);
	    msg.tooltip = main_button_tooltip();
	}
	bgproc.postMessage(msg);	
	extension_button = status;
    }

    var extension_button_badge;
    function update_extension_button_badge(force)
    {
	if (!disable_main_button ||	// not using extension button, don't bother
	    !something_to_display())	// not needed -> tb button is disabled
	    return;
	
	var o = update_badge_object();
	var needed = o.needed;
	var status = '' + o.needed + o.n + o.tooltip;
	if (!force && extension_button_badge == status) // already in the right state
	    return;
	
	var color = (!needed ? '#000' : get_css_prop('.badge_' + o.className, 'background-color', true));		
	bgproc.postMessage({
	      tooltip: o.tooltip,
	      badge:
		{
		  display: (needed ? 'block' : 'none'),
		  color: '#ffffff',
		  backgroundColor: color,
		  textContent: o.n
		}
	    });
	extension_button_badge = status;
    }
    
    var bgproc;
    var msg_header_bgproc_request = "scriptweeder bgproc mode request:";
    function extension_message_handler(e) 
    {
	var m = e.data;
	debug_log("message from background process !");
	if (!bgproc)
	    bgproc = e.source;
	if (m == msg_header_bgproc_request)
	{
	    check_init();
	    update_extension_button(true);
	}
    }

    /**************************** userjs messaging ***************************/

    var bgproc;
    function ujsfwd_before_message(ujs_event)
    {
	var e = ujs_event.event;
	var m = e.data;
	debug_log("[msg] " + m);
	
	if (m == "scriptweeder bgproc to injected script:")  // hello from bgproc
	{
	    bgproc = e.source;
	    ujs_event.preventDefault(); // keep this private
	    return;
	}       	
	
	if (m && m.scriptweeder) // from userjs, forward to bgproc
	{
	    debug_log("forwarding to bgproc");
	    bgproc.postMessage(m);
	    ujs_event.preventDefault(); // keep this private
	}
	// other msg, leave alone
    }
    
    function ujsfwd_guard()
    {
	// userjs should have caught this one and cancelled it, something funny is going on !    
	//if (m == "scriptweeder background process:")
	//{
	my_alert("WARNING there is something wrong here !\n\n" +
		 "If the userjs version of scriptweeder is installed then it's not working properly, " +
		 "otherwise there's a script on this page trying to pass as scriptweeder !");
	opera.extension.onmessage = null;
	//}
    }
    

    function check_userjs_version()
    {
	var userjs_version = window.opera.scriptweeder.version;
	var pair = userjs_version + ':' + version_number;
	if (userjs_version != version_number &&
	    global_setting('warn_userjs_version') != pair)
	{
	    set_global_setting('warn_userjs_version', pair);
	    my_alert("userjs and extension versions differ:\n" +
		     userjs_version + " vs " + version_number + "\n" +
		     "This may not work, installing matching versions is recommended.");
	}
    }
    
    function forward_to_userjs()
    {
	if (!window.opera.scriptweeder) // userjs is not running
	    return false;

	opera.extension.onmessage = ujsfwd_guard;
	// this is enough for userjs beforeEvent to fire,
	// so no need to forward anything in this direction.
	window.opera.addEventListener('BeforeEvent.message', ujsfwd_before_message, false);
	debug_log("userjs detected, handing over and forwarding");
	
	window.setTimeout(check_userjs_version, 10); // don't do it during async startup
	return true;
    }
    
    function init_extension_messaging()
    {
	opera.extension.onmessage = extension_message_handler; // regular msg handler fires also		
    }
    
}   // keep_editor_happy
