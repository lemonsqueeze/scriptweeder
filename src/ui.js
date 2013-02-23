function(){   // fake line, keep_editor_happy

    /********************************* Builtin ui *********************************/

    var default_ui_position = 'bottom_right';
    var default_autohide_main_button = false;
    var default_transparent_main_button = true;
    var default_fat_icons = false;
    var default_small_font = false;
    var default_menu_display_logic = 'auto';
    var default_show_scripts_in_main_menu = true;
    
    // can be used to display stuff in scriptkiddie menu from outside scripts.
    var enable_plugin_api = false;

    /********************************* UI Init *********************************/

    var main_ui = null;
    var autohide_main_button;
    var transparent_main_button;
    var fat_icons;
    var small_font;
    var disable_main_button;
    var menu_display_logic;		// auto   delay   click
    var menu_display_timer = null;
    var show_scripts_in_main_menu;
    var ui_position;
    var ui_hpos;
    var ui_vpos;
    
    var menu_request = false;		// external api request while not ready yet (opera button ...)
    var using_opera_button = false;	// seen external api request
    
    // called on script startup, no ui available at this stage.
    function register_ui()
    {
	disable_main_button = global_bool_setting('disable_main_button', false);
	
	// window.opera.scriptkiddie.toggle_menu() api for opera buttons etc...
	message_handlers['scriptkiddie_toggle_menu'] = api_toggle_menu;
	window.opera.scriptkiddie.toggle_menu = function() { window.postMessage('scriptkiddie_toggle_menu', '*'); };
    }

    // normal case : called only once after domcontentloaded.
    // however, can also be called from api_toggle_menu(). This could be anytime, do some checking.
    var init_ui_done = false;
    function init_ui(force)
    {
	ui_position = global_setting('ui_position', default_ui_position);
	ui_vpos = ui_position.slice(0, ui_position.indexOf('_'));
	ui_hpos = ui_position.slice(ui_position.indexOf('_') + 1);
	
	if (!init_ui_needed())
	    return;
	create_iframe();	// calls start_ui() when ready
	init_ui_done = true;
    }

    function init_ui_needed()
    {
	if (init_ui_done || !domcontentloaded)
	    return false;
	var not_needed = disable_main_button && !menu_request;	
	return (rescue_mode() || !not_needed);
    }
    
    // called only once when the injected iframe is ready to display stuff.
    function start_ui()
    {
	autohide_main_button = global_bool_setting('autohide_main_button', default_autohide_main_button);
	transparent_main_button = global_bool_setting('transparent_main_button', default_transparent_main_button);
	fat_icons = global_bool_setting('fat_icons', default_fat_icons);
	small_font = global_bool_setting('small_font', default_small_font);
	menu_display_logic = global_setting('menu_display_logic', default_menu_display_logic);
	show_scripts_in_main_menu = global_bool_setting('show_scripts_in_main_menu', default_show_scripts_in_main_menu);
	
	if (menu_display_logic == 'click')
	    window.addEventListener('click',  function (e) { close_menu(); }, false);
	
	set_class(idoc.body, ui_hpos);
	set_class(idoc.body, ui_vpos);
	
	repaint_ui_now();
	
	if (rescue_mode())
	    my_alert("Running in rescue mode, custom style disabled.");
    }
    
    function create_main_ui()
    {
	main_ui = new_widget("main_ui");
	set_unset_class(idoc.body, 'fat_icons', fat_icons);
	set_unset_class(idoc.body, 'small_font', small_font);
	if (!disable_main_button)
	    wakeup_lazy_widgets(main_ui);
    }

    function parent_main_ui()
    {
	idoc.body.appendChild(main_ui);
    }    

    /****************************** external api *****************************/

    // FIXME why does it take forever to show up ?!
    function api_toggle_menu()
    {
	// log("api_toggle_menu");
	using_opera_button = true;
	if (!main_ui)
	{
	    menu_request = true;	    
	    init_ui();	// safe to call multiple times
	    return;
	}	
	show_hide_menu(true, true);	
	// log("api_toggle_menu done");
    }

    /****************************** widget handlers *****************************/

    function checkbox_item_init(li, id, title, label, state, callback, klass)
    {
	li.id = id;
	if (klass)
	    li.className += klass;
	li.title = title;
	li.innerHTML += label; // hack
	setup_checkbox_item(li, state, callback);
    }

    function disable_checkbox(w)
    {
	w.querySelector('input').disabled = true;
	w.onclick = null;
    }
    
    function setup_checkbox_item(widget, current, f)
    {
	var checkbox = widget.getElementsByTagName('input')[0];
	widget.checkbox = checkbox;
	checkbox.checked = current;
	widget.onclick = f;
    }

    function scope_widget_init(widget)
    {	
	setup_radio_buttons(widget, "scope", scope, change_scope);
    }

    function setup_radio_buttons(widget, name, current, f)
    {
	var l = widget.getElementsByTagName('input');

	for (var i = 0; i < l.length; i++)
	{
	    var radio = l[i];
	    radio.name = name; // radio group
	    radio.checked = (current == i);
	    radio.number = i;
	    radio.onclick = function() { f(this.number); };

	    // take care of label if it's there
	    for (var t = radio.nextSibling; t; t = t.nextSibling)
	    {
		if (element_tag_is(t, 'label'))
		{
		    t.radio = radio;
		    t.onclick = function() { this.radio.checked = true; this.radio.onclick(); }
		    break;
		}
	    }
	}
    }
    
    function toggle_allow_inline(event)
    {
      block_inline_scripts = !block_inline_scripts;
      this.checkbox.checked = block_inline_scripts;
      find_element(nsmenu, "handle_noscript_tags").style.display = (block_inline_scripts ? 'block' : 'none');
      set_bool_setting('inline', block_inline_scripts);
      need_reload = true;
    }

    function toggle_handle_noscript_tags()
    {
      handle_noscript_tags = !handle_noscript_tags;
      this.checkbox.checked = handle_noscript_tags;
      set_bool_setting('nstags', handle_noscript_tags);
      need_reload = true;
    }

    /***************************** Options menu *******************************/

    function import_settings_init()
    {	this.onchange = file_loader(parse_settings_file); }

    function export_settings_onclick(e)
    {
	if (e.shiftKey)
	    export_settings(null, true);
	else
	    export_settings();
    }
    
    function load_custom_style_init()
    {
	var load_style = function(s, file)
	{
	    var setting;
	    if (file.match(/\.css$/))
		setting = 'css';
	    else if (file.match(/\.style$/))
		setting = 'style';
	    else
	    {
		my_alert(file + ":\nUnknown file type, should be a .style or .css");
		return;
	    }
	    
	    set_global_setting(setting, s);
	    set_global_setting(setting + '_file', file); // filename
	    alert("Loaded !");
	    need_reload = true;
	};
	this.onchange = file_loader(load_style);
    }

    function clear_saved_style_init()
    {	
	if (global_setting('css') == '' &&
	    global_setting('style') == '')
	{
	    this.disabled = true;
	    return;
	}
	var css_file =   (global_setting('css_file')   ? global_setting('css_file')   : "");
	var style_file = (global_setting('style_file') ? global_setting('style_file') : "");
	this.title = "Installed: " +  css_file + " " + style_file;
    }
    
    function clear_saved_style()
    {	
	set_global_setting('css', '');
	set_global_setting('style', '');
	set_global_setting('css_file', '');
	set_global_setting('style_file', '');	
	alert("Cleared !");
	need_reload = true;
    }

    function rescue_mode_link_init()
    {
	var label = (!rescue_mode() ? 'Rescue mode' : 'Leave rescue mode');
	var hash  = (!rescue_mode() ? '#scriptkiddie' : '#' );
	this.href = location.href.replace(/#.*/, '') + hash;
	this.innerText = label;	
	this.onclick = function() // why do we need this ?!
	{
	   location.href = this.href;
	   location.reload(false);
	}
    }    

    function edit_site_settings()
    {
	var w = new_widget("site_settings_editor");	
	switch_menu(w);
    }

    function site_settings_editor_init(w, for_mode)
    {
	if (!for_mode)
	    for_mode = 'block_all';
	foreach(modes, function(mode)
	{
	    var item = w.querySelector('li.' + mode);
	    set_unset_class(item, 'selected', mode == for_mode);
	    item.onclick = function() { site_settings_editor_init(w, mode); };
	});

	var sites = all_settings_for_mode(for_mode);
	var save_changes = function(str)
	{
	    var new_sites = textarea_lines_nows(str);
 	    // set the given ones
	    foreach(new_sites, function(site)
	    {
	       if (site != '')
		   set_global_setting(site + ':mode', for_mode);
	    });

	    // clear the removed ones
	    foreach(sites, function(site)
	    {
		if (new_sites.indexOf(site) == -1)
		    set_global_setting(site + ':mode', '');
	    });
	    
	    close_menu();
	};
	
	var editor = w.querySelector('.editor');
	editor_init(editor, sites.join('\n'), '', save_changes);
    }
    
    function edit_whitelist()
    {
	var w = new_editor_window("Whitelist",
				  raw_list_to_string(global_setting('whitelist')),
				  raw_list_to_string(array_to_list(default_global_whitelist)),
				  function(text)
        {
	   set_global_setting('whitelist', raw_string_to_list(text));
	   close_menu();
	});
	switch_menu(w);
    }

    function edit_blacklist()
    {
	var w = new_editor_window("Helper Blacklist",
				  raw_list_to_string(global_setting('helper_blacklist')),
				  raw_list_to_string(array_to_list(default_helper_blacklist)),			   
				  function(text)
        {
	   set_global_setting('helper_blacklist', raw_string_to_list(text));
	   close_menu();
	});
	switch_menu(w);
    }

    function editor_window_init(w, title, text, default_setting, save_callback)
    {
	w.querySelector('#menu_title').innerText = title;
	var editor = w.querySelector('.editor');
	editor_init(editor, text, default_setting, save_callback);
    }    

    // setting text works fine the first time but that's about it, so ...   
    function replace_textarea(t, text)
    {
	var n = new_widget("my_textarea");
	n.innerText = text;
	t.parentNode.replaceChild(n, t);
    }

    function editor_init(w, text, default_setting, save_callback)
    {
	function get_textarea() { return w.querySelector('textarea'); }
	
	replace_textarea(get_textarea(), text);
	w.querySelector('button.save').onclick = function()
	{
	    // note: textarea.textContent doesn't change after edits !
	    save_callback(get_textarea().innerText);
	};
	
	var b = w.querySelector('button.default');
	if (!default_setting)
	    b.style = "display:none";
	else
	{
	    b.style = "display:auto";	    
	    b.onclick = function(){  replace_textarea(get_textarea(), default_setting)  };
	}
    }    
    
    function select_iframe_logic_init(widget)
    {
	var select = widget.querySelector('select');
	select.options.value = iframe_logic;
	select.onchange = function(n)
	{
	    set_global_setting('iframe_logic', this.value);
	    need_reload = true;
	};       
    }

    function select_ui_position_init(widget)
    {
	var select = widget.querySelector('select');
	select.options.value = ui_position;
	select.onchange = function(n)
	{
	    set_global_setting('ui_position', this.value);
	    need_reload = true;
	};
    }


    function select_menu_display_logic_init(widget)
    {
	var select = widget.querySelector('select');
	select.options.value = menu_display_logic;
	select.onchange = function(n)
	{
	    set_global_setting('menu_display_logic', this.value);
	    need_reload = true;
	};
    }

    function select_reload_method_init(widget)
    {
	var select = widget.querySelector('select');
	select.options.value = reload_method;
	select.onchange = function(n)
	{
	   reload_method = this.value;
	   set_global_setting('reload_method', reload_method);
	};	
    }
    
    // returns toggled value, sets setting and updates this.checkbox
    function toggle_global_setting(w, value, setting)
    {
	value = !value;
	w.checkbox.checked = value;	// update ui
	set_global_bool_setting(setting, value);
	return value;
    }

    function toggle_show_scripts_in_main_menu(event)
    {
	show_scripts_in_main_menu = toggle_global_setting(this, show_scripts_in_main_menu, 'show_scripts_in_main_menu');
	need_repaint = true;
    }    
    
    function toggle_show_ui_in_iframes(event)
    {
	show_ui_in_iframes = toggle_global_setting(this, show_ui_in_iframes, 'show_ui_in_iframes');
	need_reload = true;
    }

    function toggle_autohide_main_button(event)
    {
	autohide_main_button = toggle_global_setting(this, autohide_main_button, 'autohide_main_button');
	need_repaint = true;
    }

    function toggle_transparent_main_button(event)
    {
	transparent_main_button = toggle_global_setting(this, transparent_main_button, 'transparent_main_button');
	need_repaint = true;
    }

    function toggle_fat_icons(event)
    {
	fat_icons = toggle_global_setting(this, fat_icons, 'fat_icons');
	need_repaint = true;
    }

    function toggle_small_font(event)
    {
	small_font = toggle_global_setting(this, small_font, 'small_font');
	need_repaint = true;
    }
    
    function toggle_disable_main_button(event)
    {
	disable_main_button = toggle_global_setting(this, disable_main_button, 'disable_main_button');
	need_repaint = true;
    }

    function disable_main_button_init(w)
    {
	if (using_opera_button)
	{
	    w.title = "";
	    return;
	}
	disable_checkbox(w);
    }
    
    function check_disable_button_ui_settings()
    {
	if (!disable_main_button)
	    return;
	// disable ui button settings then
	foreach(getElementsByClassName(this, 'button_ui_setting'), function(n)
		{   disable_checkbox(n);  });
    }
 
    
    function options_menu()
    {
	var w = new_widget("options_menu");
	switch_menu(w);	
    }
    
    /***************************** Details menu *******************************/

    function script_detail_status(w, h, s)
    {
	var status = "blocked";
	if (allowed_host(h))
	{
	    status = "allowed";
	    if (!s.loaded)
	    {
		status = "not_loaded";
		w.title = "Script allowed, but not loaded: syntax error, bad url, or something else is blocking it.";
	    }
	}
	return status;
    }

    function script_detail_iframe_status(w, hn, s)
    {
	var allowed = allowed_host(hn.name);
	var iframes = iframes_info(hn, allowed);
	if (iframes.allowed)	// iframes never null here
	    return 'iframe';
	return 'blocked_iframe';
    }

    function script_detail_init(w, hn, s, iframe, file_only)
    {
	var h = hn.name;
	var img = w.firstChild;
	var link = img.nextSibling;

	// truncate displayed url if necessary
	var label = truncate_left(strip_url_tail(s.url), 60);

	if (file_only)
	    label = truncate((split_url(s.url))[2], 25);
	
	link.innerText = label;
	link.href = s.url;
	var status = (iframe ? script_detail_iframe_status(w, hn, s) : script_detail_status(w, h, s));
	w.className += " " + status;       
    }
    
    function show_details()
    {
	var w = new_widget("details_menu");
	switch_menu(w);		
    }

    function details_menu_init(realmenu)
    {	    
	var menu = find_element(realmenu, "menu_content");
	var last = find_element(realmenu, "last_item");

	// FIXME show iframes urls somewhere
	foreach_host_node(function(host_node)
	{
	  var h = host_node.name;
	  var s = host_node.scripts;
	  
	  sort_scripts(s);
	  for (var j = 0; j < s.length; j++)
	  {
	      var w = new_script_detail(host_node, s[j], false, false);
	      menu.insertBefore(w, last);
	  }

	  var iframes = host_node.iframes;
	  for (var j = 0; j < iframes.length; j++)
	  {
	      var w = new_script_detail(host_node, iframes[j], true, false);
	      menu.insertBefore(w, last);
	  }
	  
	});	
    }    

    
    /****************************** Menu logic *********************************/

    var nsmenu = null;			// the current menu
    var need_reload = false;
    var need_repaint = false;

    function really_leaving_menu(e)
    {
	if (!mouseout_leaving_menu(e) ||
	    menu_display_logic == 'click')
	    return false;
	return true;
    }

    function close_menu(keep_menu)
    {
	show_hide_menu(false);
	switch_submenu(null);
	if (keep_menu != true) // explicit comparison, guard against weird calls
	    switch_menu(null);
	
	if (need_reload)
	    reload_page();
	if (need_repaint)
	{
	    need_repaint = false;
	    repaint_ui_now();
	}
    }
    
    function main_menu_onmouseout(e)
    {
	if (!really_leaving_menu(e))
	    return;
	close_menu(true);
    }

    function menu_onmouseout(e)
    {
	if (!really_leaving_menu(e))
	    return;
	close_menu();
    }

    function mouseout_menu_target(e, main_target, other_target)
    {
	var reltg = e.relatedTarget;
	if (!reltg)
	    return null;
	
	if (reltg.id == 'main_button')
	    return main_target; // moving back to button, doesn't count
	while (reltg != main_target && reltg != other_target &&
	       reltg.nodeName != 'HTML')
	    reltg = reltg.parentNode;
	return reltg;
    }
    
    function mouseout_leaving_menu(e)
    {
	var reltg = mouseout_menu_target(e, nsmenu, submenu)
	if (reltg == nsmenu || (submenu && reltg == submenu))
	    return false; // moving out of the div into a child layer
	return true;
    }    

    function switch_menu(menu)
    {
	show_hide_menu(false);
	nsmenu.parentNode.removeChild(nsmenu);
	nsmenu = menu;
	if (menu)
	{
	    parent_menu();
	    show_hide_menu(true);
	}
    }

    function show_hide_menu(show, toggle)
    {
	var create = !nsmenu;
	if (create)
	{
	    create_menu();
	    nsmenu.style.display = 'none';
	    parent_menu();	  
	}
	var d = (show ? 'inline-block' : 'none');	
	if (toggle)
	    d = (create || nsmenu.style.display == 'none' ? 'inline-block' : 'none');
	nsmenu.style.display = d;      
	resize_iframe();
    }

    function menu_shown()
    {
	return (nsmenu && nsmenu.style.display != 'none');
    }

    
    /****************************** Main menu *********************************/
    
    function create_menu()
    {
	nsmenu = new_widget("main_menu");
    }

    function block_all_settings_init(widget)
    {
	var w = find_element(widget, "block_inline_scripts");
	setup_checkbox_item(w, block_inline_scripts, toggle_allow_inline);	    
	    
	var w = find_element(widget, "right_item");
	w.innerText = " [" + get_size_kb(total_inline_size) + "k]";

	if (!block_inline_scripts)
	{
	    var w = find_element(widget, "handle_noscript_tags");
	    w.style = "display:none;";
	}
    }

    function mode_menu_item_oninit()
    {
	var for_mode = this.getAttribute('formode');
	if (for_mode == mode)
	    this.className += " selected";
	else
	    this.onclick = function() { set_mode(for_mode); }	
    }
    
    function main_menu_init(menu)
    {
	if (mode == 'block_all')
	    wakeup_lazy_widgets(menu);

	w = find_element(menu, "menu_title");
	w.title = version_full;
	
	// add host table
	if (mode != 'block_all')
	    add_host_table_after(menu.querySelector('li.' + mode));
	
	// FIXME put it back one day
	// plugin api
	// if (enable_plugin_api)
	// for (var prop in plugin_items)
	// if (plugin_items.hasOwnProperty(prop))
	// add_menu_item(nsmenu, plugin_items[prop], 0, null);
    }

    function parent_menu()
    {
	if (!main_ui.firstChild || ui_vpos == 'top') // no main button
	    main_ui.appendChild(nsmenu);
	else
	    main_ui.insertBefore(nsmenu, main_ui.lastChild);
    }

    var submenu = null;		// there can be only one.
    function switch_submenu(sub, position)
    {
	if (submenu)
	    submenu.parentNode.removeChild(submenu);
	submenu = sub;
	if (sub)
	{
	    idoc.body.appendChild(sub);
	    position_submenu(sub, position);
	}
	resize_iframe();	
    }
    
    function position_submenu(sub, position)
    {
	var tr = position.getBoundingClientRect();
	var mr = nsmenu.getBoundingClientRect();
	var left = (ui_hpos == 'right' ?
		    mr.left - sub.offsetWidth :
		    mr.right - 1);
	var top = tr.top;  // tr's top	
	if (top + sub.offsetHeight > main_ui.offsetHeight) // bottom screens out
	    top = main_ui.offsetHeight - sub.offsetHeight;

	// offsetHeight changes afterwards in bottom-left layout, wtf ?!	
	sub.realwidth = sub.offsetWidth;
	sub.realheight = sub.offsetHeight;
	
	sub.style = ("left:" + left + 'px;' + "top:" + top + 'px;');	    
    }

    // TODO: show iframes as well ?
    function host_table_row_onmouseover(event)
    {
	if (!show_scripts_in_main_menu)
	    return;
	var tr = this;
	var hn = tr.host_node;
	if (!hn.scripts.length &&
	    !(hn.iframes && hn.iframes.length))
	    return;
	if (!this.timer)
	    this.timer = iwin.setTimeout(function(){ scripts_submenu(tr) }, 600);
    }
    
    function scripts_submenu(tr)
    {
	if (!menu_shown() || !is_parented(tr))
	    return;
	var sub = new_widget("submenu");
	var menu = find_element(sub, "menu_content");
	var host = tr.host;
	var host_node = tr.host_node;
	var h = host_node.name;
	var s = host_node.scripts;

	// FIXME factor this and details_menu_init();
	sort_scripts(s);
	for (var j = 0; j < s.length; j++)
	{
	    var w = new_script_detail(host_node, s[j], false, true);
	    menu.appendChild(w);
	}

	var iframes = host_node.iframes;
	for (var j = 0; j < iframes.length; j++)
	{
	    var w = new_script_detail(host_node, iframes[j], true, true);
	    menu.appendChild(w);
	}
		
	switch_submenu(sub, tr);
    }    

    function host_table_row_onmouseout(e)
    {
	var target = mouseout_menu_target(e, this, submenu);
	if (target == submenu || target == this)
	    return;
	if (this.timer)
	{
	    iwin.clearTimeout(this.timer);
	    this.timer = null;
	}
	if (submenu)
	    switch_submenu(null);
    }    

    function host_table_row_onclick(event)
    {
	var h = this.host;
	var glob_icon_clicked = (event.target.parentNode.className.indexOf("allowed_globally") != -1);

	if (glob_icon_clicked)
	{
	    remove_host(h);
	    if (host_allowed_globally(h))
		global_remove_host(h);
	    else
		global_allow_host(h);
	}
	else
	{
	    if (allowed_host(h))
		remove_host(h);
	    else
		allow_host(h);
	    global_remove_host(h);	      
	}	 

	if (mode != 'filtered' && mode != 'relaxed')
	    set_mode_no_update('filtered');

	// blocking related/helper host in relaxed mode ? switch to filtered mode.
	// (related/helper hosts are always allowed in relaxed mode)
	if (mode == 'relaxed' && relaxed_mode_helper_host(h))
	    relaxed_mode_to_filtered_mode(h);
	  
	need_reload = true;
	repaint_ui_now();
    };

    function iframes_info(hn, allowed)
    {
	if (!hn.iframes || !hn.iframes.length)
	    return null;
	var n = hn.iframes.length;
	var title = n + " iframe" + (n>1 ? "s" : "");
	if (iframe_logic != 'filter')
	    title += ". use 'filter' iframe setting to block/allow in the menu.";
	
	if (iframe_logic == 'block_all')
	    allowed = false;
	if (iframe_logic == 'allow')
	    allowed = true;
	return {count:n, title:title, allowed:allowed};
    }

    function not_loaded_tooltip(hn, allowed)
    {
	var s = hn.scripts;
	var n = 0;
	for (var i = 0; i < s.length; i++)
	    if (!s[i].loaded)
		n++;
	if (!allowed || !n)
	    return null;
	
	var title = n + " script" + (n>1 ? "s" : "") + " not loaded.";
	if (n == s.length)
	{
	    // FIXME: find a smaller/less invasive icon
	    // image = "blocked";	    
	    title = "None loaded.";
	}
	title += " See details.";
	return title;
    }    
    
    function add_host_table_after(item)
    {
	var w = new_widget("host_table");	
	item.parentNode.insertBefore(w, item.nextSibling);
	var t = w.querySelector('table');
	sort_domains();

	var found_not_loaded = false;
	var tr = null;	
	foreach_host_node(function(hn, dn)
	{
	    var d = dn.name;
	    var h = hn.name;
	    var allowed = allowed_host(h);
	    var host_part = truncate_left(h.slice(0, h.length - d.length), 15);
	    var not_loaded = not_loaded_tooltip(hn, allowed);
	    var count = hn.scripts.length;
	    var helper = hn.helper_host;
	    var iframes = iframes_info(hn, allowed);

	    tr = new_widget("host_table_row");
	    tr = tr.firstChild.firstChild; // skip dummy <table> and <tbody> tags
	    tr.host = h;
	    tr.domain_node = dn;
	    tr.host_node = hn;
	    t.appendChild(tr);	    
	    
	    if (not_loaded)
	    {
		tr.childNodes[1].className += " not_loaded";
		tr.childNodes[1].title = not_loaded;
	    }
	    tr.childNodes[2].firstChild.checked = allowed;
	    tr.childNodes[3].innerText = host_part;
	    tr.childNodes[4].innerText = d;
	    if (helper)
		tr.childNodes[4].className += " helper";
	    if (iframes)
	    {
		count += iframes.count;
		var c = (iframes.allowed ? 'iframe' : 'blocked_iframe');
		tr.childNodes[5].className += " " + c;
		tr.childNodes[5].title = iframes.title;
	    }
	    if (host_allowed_globally(h))
	    {
		tr.childNodes[6].className += " visible";
		tr.childNodes[6].title = "Allowed globally";		
	    }
	    tr.childNodes[7].innerText = '[' + count + ']';		// scripts + iframes

	    if (not_loaded)
		found_not_loaded = true;	    
	});
	
//	if (tr && !found_not_loaded) // indent
//	    tr.childNodes[0].innerHTML = "&nbsp;&nbsp;";	
    }


    /**************************** Plugin API **********************************/

    // currently disabled ...
    // plugin api: can be used to display extra stuff in the menu from other scripts.
    // useful for debugging and hacking purposes when console.log() isn't ideal.
    function __setup_plugin_api()
    {
	var plugin_items = new Object();       
	
	// API for plugins to add items to noscript's menu
	window.scriptkiddie.add_item = function(name, value)
	{
            plugin_items[name] = value;
	    if (nsmenu)
		repaint_ui();	
	};
    }
    
    /***************************** Main ui *********************************/

    function menu_onmousedown()	// make text non selectable
    {	return false;	}
    
    function main_button_tooltip()
    {
        var tooltip = "[Inline scripts] " + total_inline +
	  (block_inline_scripts ? " blocked": "") +
	  " (" + get_size_kb(total_inline_size) + "k), " +
	  "[" + current_host + "] " + blocked_current_host;
	if (blocked_current_host != total_current_host)
	    tooltip += "/" + total_current_host;
	tooltip += " blocked";
	if (loaded_current_host)
	    tooltip += " (" + loaded_current_host + " loaded)";

        tooltip += ", [Other hosts] " + blocked_external;
	if (blocked_external != total_external)
	    tooltip += "/" + total_external; 
	tooltip += " blocked";
	if (loaded_external)
	    tooltip += " (" + loaded_external + " loaded)";
	return tooltip;
    }

    function main_button_init(div)
    {
	var tooltip = main_button_tooltip();
	div.title = tooltip;
	div.className += " " + mode;

	if (autohide_main_button && !rescue_mode())
	    div.className += " autohide";

	if (transparent_main_button)
	    div.querySelector('button').className = "tbutton";
	
	if (menu_display_logic == 'click')
	    div.onclick = function() { (nsmenu ? close_menu() : show_hide_menu(true)); }
	if (menu_display_logic == 'delay')
	{
	    div.onclick = div.onmouseover;
	    div.onmouseover = function()
	    {  menu_display_timer = iwin.setTimeout(main_button_onmouseover, 400); }  // canceled in onmouseout 
	}	
    }
    
    function main_button_onmouseover()
    {
	// console.log("button mouseover");
	if (menu_display_logic != 'click')
	    show_hide_menu(true);    // menu can disappear if we switch these two, strange
	check_changed_settings();
    }


    function main_button_onclick(e)
    {
	if (e.ctrlKey)  // ctrl+click -> toggle menu
	{
	    repaint_ui_now();
	    return;
	}
	    
	// cycle through the modes    	    
	if (mode == 'block_all')      set_mode('filtered');
	else if (mode == 'filtered')  set_mode('relaxed');
	else if (mode == 'relaxed')   set_mode('allow_all');
	else if (mode == 'allow_all') set_mode('block_all');
    }
    
    function main_button_onmouseout()
    {
	if (menu_display_timer)
	{
	    iwin.clearTimeout(menu_display_timer);	    
	    menu_display_timer = null;
	}
	if (need_reload)
	    reload_page();
    }
    
    /***************************** Repaint logic ******************************/

    var repaint_ui_count = 0;
    var repaint_ui_timer = null;
    function repaint_ui()
    {
	repaint_ui_count++;
	if (repaint_ui_timer)
	    return;
	repaint_ui_timer = iwin.setTimeout(repaint_ui_now, 500);
    }

    function repaint_ui_now()
    {
	repaint_ui_timer = null;
	//   debug: (note: can't call plugins' add_item() here (recursion))
	//   plugin_items.repaint_ui = "late events:" + repaint_ui_count;	

	if (submenu)
	    switch_submenu(null);
	
	// menu logic slightly more complicated than just calling
	// show_hide_menu() at the end -> no flickering at all this way!!
	var menu_shown = menu_request || (nsmenu && nsmenu.style.display != 'none');
	menu_request = false;	// external api menu request (opera button ...)

	var old = main_ui;
	create_main_ui();
	if (menu_shown)
	    create_menu();
	if (old)
	    old.parentNode.removeChild(old); // remove main_ui
	parent_main_ui();
	if (menu_shown)
	{
	    parent_menu();	
	    show_hide_menu(true);
	}
	else
	    resize_iframe();
    }

@include "scriptkiddie_style.js"

@include "scriptkiddie_widgets.js"

}   // keep_editor_happy