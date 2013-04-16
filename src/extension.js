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
    
    function get_icon_from_css(mode, fatal)
    {
	var data_re = new RegExp(".*'(data:image/png;base64,[^']*)'.*");
	function findit(selector)
	{
	    var m = get_style().match(new RegExp(selector + ".*'data:image/png;base64,[^']*'", 'g'));
	    if (!m)
		return null;
	    return m[m.length - 1].replace(data_re, '$1'); // get the last one.
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

    var extension_button;
    function update_extension_button(force)
    {
	if (in_iframe() ||
	    (!force && !extension_button)) // not talking to extension (yet) - userjs_only
	    return;
	
	var needed = something_to_display();	
	var status = (needed ? mode : 'off');
	if (!force && extension_button == status) // already in the right state
	    return;

	// when button is not disabled, extension still needs disabled icon for next tab switch
	var disabled_icon = get_icon_from_css('disabled', false);	
	var icon = (needed ? get_icon_from_css(mode, true) : disabled_icon);
	window.postMessage({scriptweeder:true, debug:debug_mode,			// userjs_only
		            mode:mode, icon:icon, button:disable_main_button,
		            disabled:!needed, disabled_icon:disabled_icon}, '*');
	extension_button = status;
    }
    
    function extension_message_handler(e)
    {
	var m = e.data;
	debug_log("message from extension !");
	check_init();
	update_extension_button(true);
    }

    function init_extension_messaging()
    {
	// userjs_only stuff
	message_handlers["scriptweeder background process:"] = extension_message_handler;
	window.setTimeout(prevent_userjs_lockout, 500);
    }
    
}   // keep_editor_happy
