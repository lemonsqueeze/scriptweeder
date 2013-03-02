function(){   // fake line, keep_editor_happy
    
    /**************************** Extension messaging ***************************/

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
	if (in_iframe() || !bgproc)
	    return;
	
	var needed = something_to_display();	
	var status = (needed ? mode : 'off');
	if (!force && extension_button == status) // already in the right state
	    return;

	// when button is not disabled, bgprocess still needs disabled icon for next tab switch
	var disabled_icon = get_icon_from_css('disabled', false);	
	var icon = (needed ? get_icon_from_css(mode, true) : disabled_icon);
	bgproc.postMessage({debug:debug_mode, mode:mode, icon:icon, button:disable_main_button,
		            disabled:!needed, disabled_icon:disabled_icon});
	extension_button = status;
    }

    var bgproc;    
    function extension_message_handler(e) 
    {
	var m = e.data;
	debug_log("message from background process !");
	if (!bgproc)
	    bgproc = e.source;
	check_init();
	update_extension_button(true);
    }

    function init_extension_messaging()
    {
	opera.extension.onmessage = extension_message_handler; // regular msg handler fires also		
    }
    
}   // keep_editor_happy
