function(){   // fake line, keep_editor_happy
    
    /**************************** Extension messaging ***************************/
    
    // userjs_only: prevent lockout if extension goes away and we were using its button.
    function prevent_userjs_lockout()
    {
	if (extension_button || !disable_main_button || !something_to_display())
	    return;
	disable_main_button = false;	
	set_global_bool_setting('disable_main_button', false);
	set_global_setting('ui_position', 'bottom_right');
	set_global_setting('menu_display_logic', 'auto');
	init_ui();
    }

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
	if (in_iframe() ||
	    (!force && !extension_button)) // not talking to extension (yet) - userjs_only
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
	msg.scriptweeder = true;
	window.postMessage(msg, '*');	// userjs_only
	extension_button = status;
    }
    
    var extension_button_badge;
    function update_extension_button_badge(force)
    {
	if (!disable_main_button) // not using extension button, don't bother
	    return;
	
	var o = badge_object();
	var needed = (badge_logic != 'off');
	var status = (needed ? o.n + o.tooltip : 'off');
	if (!force && extension_button_badge == status) // already in the right state
	    return;

	var color = (!needed ? '#000' : get_css_prop('.badge_' + o.className, 'background-color', true));
	window.postMessage({				// userjs_only
	      scriptweeder:true,
	      tooltip: o.tooltip,
	      badge:
		{
		  display: (needed ? 'block' : 'none'),
		  color: '#ffffff',
		  backgroundColor: color,
		  textContent: o.n
		}
	    }, '*');
	extension_button_badge = status;
    }    

    var msg_header_bgproc_request = "scriptweeder bgproc mode request:";
    function extension_message_handler(e)
    {
	var m = e.data;
	debug_log("message from extension !");
	if (m == msg_header_bgproc_request)
	{
	    check_init();
	    update_extension_button(true);
	}
    }
    
    function init_extension_messaging()
    {
	// userjs_only stuff
	message_handlers["scriptweeder bgproc mode request:"] = extension_message_handler;
	window.setTimeout(prevent_userjs_lockout, 500);
    }
    
}   // keep_editor_happy
