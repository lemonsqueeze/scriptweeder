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

    var bgproc;
    var bgproc_button = 'undef';

    function update_bgproc_button(force)
    {
	if (!bgproc)
	    return;
	
	var tmp = disable_main_button;
	disable_main_button = false; // just want to know if there's something to display
	var needed = (iframe || ui_needed());
	disable_main_button = tmp;
	
	var status = (needed ? 'on' : 'off');
	if (!force && bgproc_button == status)
	    return;
	bgproc.postMessage({mode:mode, button:disable_main_button, disabled:!needed});
	bgproc_button = status;
    }
    
    function bgproc_message_handler(e)
    {
	var m = e.data;
	debug_log("message from background process !");
	if (!bgproc)
	    bgproc = e.source;
	check_init();
	update_bgproc_button(true);
    }

    function init_extension_messaging()
    {
	opera.extension.onmessage = bgproc_message_handler; // regular msg handler fires also		
    }
    
}   // keep_editor_happy
