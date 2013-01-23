    var cornerposition = 4;
    // 1 = top left, 2=top right , 3=bottom left , 4=bottom right etc.

    // can be used to display stuff in jsarmor menu from outside scripts.
    var enable_plugin_api = false;

    /********************************* Globals *********************************/

    var button_image = null;

    /***************************** iframe handling **************************/

    function iframe_icon(hn)
    {
	if (!hn.iframes || !hn.iframes.length)
	    return null;

	var n = hn.iframes.length;
	var icon = new_icon();
	icon.title = n + " iframe" + (n>1 ? "s" : "");
	//icon.title += " See details.";
	set_icon_image(icon, "iframe");
	return icon;
    }

    /****************************** UI primitives *****************************/

    function new_icon(image)
    {
      var icon = idoc.createElement('img');
      if (image)
	  set_icon_image(icon, image);
      return icon;	
    }

    function set_icon_image(icon, image_name)
    {
	icon.className = image_name;
    }
    
    function new_icon_mode(mode)
    {
	var icon = new_icon();
	set_icon_mode(icon, mode);
	return icon;
    }

    function set_icon_mode(icon, mode)
    {
      set_icon_image(icon, mode);
    }
    
    function add_menu_item(nsmenu, text, indent, f, child)
    {
      var item = idoc.createElement('div');
      item.className = 'jsarmor_item';
      if (child)
	  item.appendChild(child);
      if (indent)				// CSSFIXME find a better way
	  item.className += " indent" + indent;
      item.innerHTML += text;
      if (f)
      {
	  item.className += " highlight";
	  item.onclick = f;
      }
      // make text non selectable
      item.onmousedown = function(){ return false; };
      nsmenu.appendChild(item);
      return item;
    }

    function add_mode_menu_item(nsmenu, title, tmode)
    {
	var handler = function() { set_mode(tmode); };
	var item = add_menu_item(nsmenu, title, 0, handler, new_icon_mode(tmode));
	if (mode == tmode)
	    item.className = " current_mode";
	return item;
    }

    function to_html(e)
    {
	if (!e)
	    return "";
	if (e.outerHTML)
	    return e.outerHTML;
	
	var d = idoc.createElement('div');
	d.innerText = e;
	return d.innerHTML;
    }

    function add_table_item(table, col1, col2, col3, col4, col5, col6, col7, f, helper_host)
    {
	var tr = idoc.createElement('tr');
	var s = "";
	s += "<td width=1%></td>";
	s += "<td width=1%>" + to_html(col1) + "</td>";
	s += "<td width=1%>" + to_html(col2) + "</td>";
	s += "<td width=1%>" + to_html(col3) + "</td>";
	s += "<td>" + to_html(col4) + "</td>";
	s += "<td width=1%>" + to_html(col5) + "</td>";
	s += "<td width=1%>" + to_html(col6) + "</td>";
	s += "<td width=1%>" + to_html(col7) + "</td>";
	tr.innerHTML = s;
	tr.childNodes[3].className = 'host_part';
	tr.childNodes[4].className = 'domain_part';
	if (helper_host)
	    tr.childNodes[4].className += ' helper_host';
	tr.childNodes[7].className = 'script_count';
	if (f)
	{
	    tr.className = 'highlight';
	    tr.onclick = f;
	}
	// make text non selectable
	tr.onmousedown = function(){ return false; };
	table.appendChild(tr);
	return tr;
    }

    function add_right_aligned_text(parent, text)
    {
	var d = idoc.createElement('div');
	d.className = 'inline_script_size';
	d.innerText = text;
	parent.appendChild(d);
	return d;
    }

    function add_radio_button(parent, text, current, target, f)
    {
	var r = idoc.createElement('input');
	r.type = 'radio';
	r.name = 'radio_group';
	r.number = target;
	r.checked = (current == target);
	r.onclick = function() { f(this.number); };

	var t = idoc.createElement('label');
	t.radio = r;
	t.innerText = text;
	t.onclick = function() { this.radio.checked = true; this.radio.onclick(); }	

	parent.appendChild(r);	
	parent.appendChild(t);	
    }

    function add_link_menu_item(menu, url, label, indent)
    {
	var max_item_length = 60;
	// truncate displayed url if too long
	if (label.length > max_item_length) { label = label.slice(0, max_item_length) + "..."; }       
	var link = '<a href="' + url + '">' + label + '</a>';
	return add_menu_item(menu, link, indent);
    }
    
    function add_menu_separator(menu)
    {
      var div = idoc.createElement('div');
      div.className = 'separator';
      menu.appendChild(div);
    }

    function new_checkbox(checked)
    {
      var c = idoc.createElement('input');
      c.type = 'checkbox';
      c.defaultChecked = checked;
      return c;
    }

    function new_button(text, f)
    {
	var button = idoc.createElement('button');
	button.innerText = text;
	button.onclick = f;
	return button;
    }

    function new_textarea(text)
    {
	var a = idoc.createElement('textarea');
	// how do we add padding to this thing ??
	a.innerText = text;
	return a;
    }

    function icon_not_loaded(hn, allowed)
    {
	var s = hn.scripts;
	var n = 0;
	for (var i = 0; i < s.length; i++)
	    if (!s[i].loaded)
		n++;
	if (!allowed || !n)
	    return null;
	
	var icon = new_icon();
	var image = "not_loaded";
	icon.title = n + " script" + (n>1 ? "s" : "") + " not loaded.";
	if (n == s.length)
	{
	    // FIXME: find a smaller/less invasive icon
	    // image = "blocked";	    
	    icon.title = "None loaded.";
	}
	icon.title += " See details.";
	set_icon_image(icon, image);
	return icon;
    }

    function init_global_icon(icon, host)
    {
	icon.title = "Allowed Globally";
	icon.className = 'global_icon';
	if (host_allowed_globally(host))
	    icon.className += ' visible';	
    }

    function toggle_allow_inline(event)
    {
      block_inline_scripts = !block_inline_scripts;
      this.checkbox.checked = block_inline_scripts;
      idoc.getElementById('handle_nstags').style.display = (block_inline_scripts ? 'block' : 'none');
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

    function edit_css_url()
    {
	var nsmenu = new_menu("css url to use");

	var close_menu = function()
	{
	   td.removeChild(nsmenu);
	   resize_iframe();
	};
	
	var text = new_textarea(global_setting('css'));
	nsmenu.appendChild(text);

	var div = idoc.createElement('div');
	nsmenu.appendChild(div);		
	var button = new_button("Save", function()
				{
				   set_global_setting('css', text.innerText);
				   close_menu();
				});
	div.appendChild(button);
	
	var button = new_button("Cancel", close_menu);
	div.appendChild(button);	
	
	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(nsmenu);
	resize_iframe();
    }

    function edit_style()
    {
	var nsmenu = new_menu("style");

	var close_menu = function()
	{
	   td.removeChild(nsmenu);
	   resize_iframe();
	};

	var style = global_setting('style');
	style = (style == '' ? builtin_style : style);
	var text = new_textarea(style);
	nsmenu.appendChild(text);

	var div = idoc.createElement('div');
	nsmenu.appendChild(div);		
	var button = new_button("Save", function()
				{
				   set_global_setting('style', text.innerText);
				   close_menu();
				});
	div.appendChild(button);
	
	var button = new_button("Cancel", close_menu);
	div.appendChild(button);	
	
	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(nsmenu);
	resize_iframe();
    }
    
    function edit_whitelist()
    {
	var nsmenu = new_menu("Global Whitelist");

	var close_menu = function()
	{
	   td.removeChild(nsmenu);
	   resize_iframe();
	};
	
	var text = new_textarea(raw_list_to_string(global_setting('whitelist')));
	nsmenu.appendChild(text);
	
	var div = idoc.createElement('div');
	nsmenu.appendChild(div);		
	var button = new_button("Save", function()
	    {
	       set_global_setting('whitelist', raw_string_to_list(text.innerText));
	       close_menu();
	    });
	div.appendChild(button);
	
	var button = new_button("Cancel", close_menu);
	div.appendChild(button);
	
	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(nsmenu);
	resize_iframe();
    }

    function options_menu()
    {
	var menu = new_menu("Options");
	menu.id = "options_menu";

	// FIXME: sane menu logic to handle different menus
	var need_reload = false;
	menu.onmouseout = function(e)
	{
	   if (!mouseout_leaving_menu(e, menu))
	       return;	   
	   td.removeChild(menu);
	   resize_iframe();
	   if (need_reload)
	       reload_page();
	};
	
	function remove_menu_and(f)
	{ return function()
	  {
	    td.removeChild(menu);
	    f();
	  };
	}
	
	var item = add_menu_item(menu, "Edit whitelist...", 2, remove_menu_and(edit_whitelist));
	
	if (enable_external_css)
	    var item = add_menu_item(menu, "Custom stylesheet...", 2, remove_menu_and(edit_css_url));
	
	var item = add_menu_item(menu, "Edit style...", 2, remove_menu_and(edit_style));	
	
	var item = add_menu_item(menu, "iframe logic", 2);
	var set_iframe_logic = function (n)
	{
	    iframe_logic = n;
	    set_global_setting('iframe', iframe_logic);
	    need_reload = true;
	};
	add_radio_button(item, " Block all ",   iframe_logic, 0, set_iframe_logic);
	add_radio_button(item, " Ask parent ",  iframe_logic, 1, set_iframe_logic);
	add_radio_button(item, " Normal page ", iframe_logic, 2, set_iframe_logic);
	
	// show ui in iframes
	var f = function(event)
	{
	   var new_val = !global_bool_setting("iframe_ui", default_iframe_ui);
	   set_global_bool_setting("iframe_ui", new_val);
	   // update ui
	   this.checkbox.checked = new_val;
	   need_reload = true;
	};	
	var checkbox = new_checkbox(global_bool_setting("iframe_ui", default_iframe_ui));
	var item = add_menu_item(menu, "Show jsarmor interface for each iframe", 0, f, checkbox);
	item.checkbox = item.firstChild;       

	var item = add_menu_item(menu, "Reload method", 2);	
	
	add_menu_separator(menu);	

	var item = add_menu_item(menu, "Help", 0, function() { location.href = help_url; });
	var item = add_menu_item(menu, "Clear all settings", 0, reset_settings);	
	
	// Import Settings
	var form = idoc.createElement('form');
	form.id = "import_form";
	form.innerHTML = "<input type=file id=import_btn autocomplete=off >Import Settings...";
	var item = add_menu_item(menu, "", 0, function() {}, form);
	item.firstChild.firstChild.onchange = load_file;

	var item = add_menu_item(menu, "Export Settings...", 0, export_settings);	
	var item = add_menu_item(menu, "About");		

	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(menu);

	resize_iframe();
        menu.style.display = 'inline-block';
    }    
    
    /***************************** Details menu *******************************/
    
    function show_details()
    {	
	var menu = new_menu("Scripts");
	menu.onmouseout = function(e)
	{
	   if (!mouseout_leaving_menu(e, menu))
	       return;	   
	   td.removeChild(menu);
	   resize_iframe();	   
	};
	
	// FIXME show iframes urls somewhere
	foreach_host_node(function(host_node)
	{
	  var h = host_node.name;
	  var s = host_node.scripts;
	  // var item = add_menu_item(menu, h + ":");	  

	  sort_scripts(s);
	  for (var j = 0; j < s.length; j++)
	  {
	      var item = add_link_menu_item(menu, s[j].url, strip_http(s[j].url), 2);
	      // script status
	      var icon = new_icon();
	      var image = "blocked";
	      if (allowed_host(h))
	      {
		  image = "allowed";
		  if (!s[j].loaded)
		  {
		      image = "not_loaded";
		      icon.title = "Script allowed, but not loaded: syntax error, bad url, or something else is blocking it.";
		  }
	      }
	      set_icon_image(icon, image);

	      item.insertBefore(icon, item.childNodes[0]);
	  }	  
	});
	
	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(menu);

	item = add_menu_item(menu, "Options ...", 0, function()
			     {
			       td.removeChild(menu);
			       options_menu();
			     });
	
	show_hide_menu(false);
        menu.style.display = 'inline-block';
    }
   
    /****************************** Main menu *********************************/

    function new_menu(title)
    {
	var menu = idoc.createElement('div');
	menu.className = 'jsarmor_menu';
	if (title != "")
	{
	    var item = add_menu_item(menu, title);
	    item.className = 'jsarmor_title';
	}	
	return menu;
    }

    var nsmenu = null;			// the main menu
    var need_reload = false;

    function create_menu()
    {
	nsmenu = new_menu("JSArmor");
	nsmenu.style.display = 'none';
	nsmenu.onmouseout = function(e)
	{
	  if (!mouseout_leaving_menu(e, nsmenu))
	      return;
	  show_hide_menu(false);
	  if (need_reload)
	      reload_page();
	};

	var title = nsmenu.firstChild;
	title.title = version + ". Click to view global settings.";
	title.onclick = function(event)
	{       
  	  if (!event.ctrlKey)
	  {
	    var d = list_to_string(global_setting('whitelist'));
	    alert("jsarmor \nGlobal whitelist: \n" + d);
	  
	    return;
	  }
	  var d = list_to_string(hosts_setting());
	  alert("jsarmor \nHosts allowed for this page: \n" + d);
	};
	
	var item = add_menu_item(nsmenu, "Set for: ", 0, null);
	add_radio_button(item, " Page ",   scope, 0, change_scope);
	add_radio_button(item, " Site ",   scope, 1, change_scope);
	add_radio_button(item, " Domain ", scope, 2, change_scope);	
	add_radio_button(item, " Global ", scope, 3, change_scope);

//	add_menu_separator(nsmenu);
//	add_menu_item(nsmenu, "External Scripts:");	
	item = add_mode_menu_item(nsmenu, "Block All", 'block_all');
	item.title = "Block all scripts.";

	if (mode == 'block_all')
	{
	    var checkbox = new_checkbox(block_inline_scripts);
	    var label = "Block Inline Scripts";
	    item = add_menu_item(nsmenu, label, 1, toggle_allow_inline, checkbox);
	    item.checkbox = item.firstChild;
	    add_right_aligned_text(item, " [" + get_size_kb(total_inline_size) + "k]");
	
	    var checkbox = new_checkbox(handle_noscript_tags);
	    var label = "Pretend Javascript Disabled";
	    item = add_menu_item(nsmenu, label, 1, toggle_handle_noscript_tags, checkbox);
	    item.id = "handle_nstags";
	    item.checkbox = item.firstChild;
	    item.title = "Interpret noscript tags as if javascript was disabled in opera."
	    if (!block_inline_scripts)
		item.style += "display:none;";
	}

	item = add_mode_menu_item(nsmenu, 'Filtered', 'filtered');
	item.title = "Select which scripts to run. (current site allowed by default, inline scripts always allowed.)"
	if (mode == 'filtered')
	    add_ftable(nsmenu);

	item = add_mode_menu_item(nsmenu, 'Relaxed', 'relaxed');
	item.title = "Allow related and helper domains.";
	if (mode == 'relaxed')
	    add_ftable(nsmenu);

	item = add_mode_menu_item(nsmenu, 'Allow All', 'allow_all');
	item.title = "Allow everything ..."
	if (mode == 'allow_all')
	    add_ftable(nsmenu);

	add_menu_item(nsmenu, "Details ...", 0, show_details);

	// plugin api
	if (enable_plugin_api)
	    for (var prop in plugin_items)
		if (plugin_items.hasOwnProperty(prop))
		    add_menu_item(nsmenu, plugin_items[prop], 0, null);
    }

    function parent_menu()
    {
	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(nsmenu);		
    }

    function show_hide_menu(show, toggle)
    {
      if (!nsmenu)
      {
	  create_menu();
	  parent_menu();
      }
      var d = (show ? 'inline-block' : 'none');
      if (toggle)
	  d = (nsmenu.style.display == 'none' ? 'inline-block' : 'none');
      nsmenu.style.display = d;
      resize_iframe();
    }

    function mouseout_leaving_menu(e, menu)
    {
	var reltg = e.relatedTarget;
	if (reltg)
	{
  	    if (reltg.id == 'jsarmor_button')
		return false; // moving back to button, doesn't count
	    while (reltg != menu && reltg.nodeName != 'HTML')
		reltg = reltg.parentNode;
	    if (reltg == menu)
		return false; // moving out of the div into a child layer
	}
	return true;
    }

    function add_ftable(nsmenu)
    {
	var f = function(event)
	{
	  var h = this.host;
	  var icon_clicked = (event.target.tagName == 'IMG');

	  if (icon_clicked)
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

	  // update ui
	  this.checkbox.checked = filtered_mode_allowed_host(h);
	  init_global_icon(this.icon, h)

	  if (mode != 'filtered' && mode != 'relaxed')
	      set_mode('filtered');

	  // blocking related/helper host in relaxed mode ? switch to filtered mode.
	  // (related/helper hosts are always allowed in relaxed mode)
	  if (mode == 'relaxed' && relaxed_mode_helper_host(h))
	      relaxed_mode_to_filtered_mode(h);
	  
	  need_reload = true;
	};

	var table = idoc.createElement('table');
	table.id = "jsarmor_ftable";
	nsmenu.appendChild(table);

	sort_domains();
	
	var found_not_loaded = false;
	var item = null;
	foreach_host_node(function(hn, dn)
	{
	    var d = dn.name;
	    var h = hn.name;
	    var checkbox = new_checkbox(allowed_host(h));
	    var host_part = h.slice(0, h.length - d.length);
	    var not_loaded = icon_not_loaded(hn, checkbox.checked);
	    var count = "[" + hn.scripts.length + "]";
	    var helper = hn.helper_host;
	    var icon = idoc.createElement('img');   // globally allowed icon
	    var iframes = iframe_icon(hn);
	    item = add_table_item(table, not_loaded, checkbox, host_part, d, iframes, icon, count, f, helper);
	    
	    icon = item.childNodes[6].firstChild;
	    init_global_icon(icon, h);
	    
	    item.checkbox = item.childNodes[2].firstChild;
	    item.icon = icon;
	    item.host = h;

	    if (not_loaded)
		found_not_loaded = true;
	});
	
	if (item && !found_not_loaded) // indent
	    item.childNodes[0].innerHTML = "&nbsp;&nbsp;";
    }
    
    /***************************** Main table *********************************/
    
    var main_table = null;
    function create_main_table()
    {
	var table = idoc.createElement('table');
	table.id = 'jsarmor_table';	
	// useful for debugging layout:     table.border = 1;
	
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

        var r = idoc.createElement('button');
	r.id = 'jsarmor_button';
	r.title = tooltip;
	button_image = new_icon_mode(mode);
	r.appendChild(button_image);
	r.onmouseover = function()
	{
	  // console.log("button mouseover");
	  show_hide_menu(true);    // menu can disappear if we switch these two, strange
	  check_changed_settings();
	};
        r.onclick = function(event)
	{
	  // cycle through the modes
	  if (mode == 'block_all')      set_mode('filtered');
	  else if (mode == 'filtered')  set_mode('relaxed');
	  else if (mode == 'relaxed')  set_mode('allow_all');
	  else if (mode == 'allow_all') set_mode('block_all');
	};
	r.onmouseout = function(e)
	{
	  if (need_reload)
	      reload_page();	      
	};

	var tr = idoc.createElement('tr');
	var td = idoc.createElement('td');
	td.id = 'td_nsmenu';
	
	tr.appendChild(td);
        table.appendChild(tr);

	var tr = idoc.createElement('tr');
	var td = idoc.createElement('td');
	td.appendChild(r);
	tr.appendChild(td);
        table.appendChild(tr);

	main_table = table;
    }

    function parent_main_table()
    {
	idoc.body.appendChild(main_table);
    }

    /***************************** Repaint logic ******************************/

    var repaint_ui_count = 0;
    var repaint_ui_timer = null;
    function repaint_ui()
    {
	repaint_ui_count++;
	if (repaint_ui_timer)
	    return;
	repaint_ui_timer = window.setTimeout(repaint_ui_now, 500);
    }

    function repaint_ui_now()
    {
	repaint_ui_timer = null;	
	//   debug: (note: can't call plugins' add_item() here (recursion))
	//   plugin_items.repaint_ui = "late events:" + repaint_ui_count;	

	// menu logic slightly more complicated than just calling
	// show_hide_menu() at the end -> no flickering at all this way!!
	var menu_shown = nsmenu && nsmenu.style.display != 'none';	
	create_main_table();
	if (menu_shown)
	    create_menu();	
	idoc.body.removeChild(idoc.body.firstChild); // remove main_table
	parent_main_table();
	if (menu_shown)
	{
	    parent_menu();	
	    show_hide_menu(true);
	}
    }

    var builtin_style =
"/* jsarmor stylesheet */\n\
\n\
body			{ margin:0px; }\n\
\n\
/* the main table: contains everything (main button, menu ...)  */\n\
#jsarmor_table		{ position:fixed; width:auto; height:auto; background:transparent; \n\
			  white-space:nowrap; z-index:99999999; direction:ltr; font-family:sans-serif;  \n\
			  font-size:small;  margin-bottom:0px; \n\
			}\n\
#jsarmor_table > tr > td { text-align: right; padding: 0px 0px 0px 0px;}\n\
#jsarmor_table div	{ width: auto; } \n\
\n\
/* main button */\n\
#jsarmor_button		{ border-width: 2px; padding: 1px 8px; margin: 0px 0px 0px 0px; float: none; } \n\
\n\
/*************************************************************************************************************/\n\
\n\
/* main menu */\n\
.jsarmor_menu		{ color: #333; border-radius: 5px; border-width: 2px; border-style: outset; border-color: gray;\n\
			  background: #ccc;  padding: 1px 1px; text-align:left;\n\
			  box-shadow: 8px 10px 10px rgba(0,0,0,0.5), inset 2px 3px 3px rgba(255,255,255,0.75);\n\
			}\n\
.jsarmor_menu div	{ padding:0px 1px 0px 1px; } \n\
.jsarmor_title		{ color:#ffffff; font-weight:bold; text-align:center; background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAYCAYAAAA7zJfaAAAAAXNSR0IArs4c6QAAAAZiS0dEAAAAAAAA+UO7fwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB90BFRUGLEa8gbIAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAUElEQVQI102KOwqAQBDFsm+9/3Fs9RqChdgIVjYi6nxsLLYJCYSc+xTLgFhHhD8t0m5kAQo39Jojj0RuLzquQLUkUuG3qtJmJ9plOyua9uADjaopUrsHkrMAAAAASUVORK5CYII=) repeat-x; } \n\
\n\
/* host table */\n\
#jsarmor_ftable		{ width:100%; } \n\
#jsarmor_ftable > tr > td	{ padding: 0px 0px 1px 0px;} \n\
\n\
/* menu items */\n\
.indent1		{ padding-left:12px }\n\
.indent2		{ padding-left:22px }\n\
.highlight:hover	{ background-color:#ddd; }\n\
\n\
/* mode menu item */\n\
.current_mode		{ background-color:#fa4 }\n\
\n\
/* hostnames display */\n\
.host_part		{ color:#888; text-align:right; }\n\
.helper_host		{ color:#000; }\n\
.script_count		{ text-align:right; }\n\
.inline_script_size	{ float:right; }\n\
\n\
/* 'script allowed globally' icon */\n\
.global_icon		{ visibility:hidden; padding: 0px 3px; width:14px; height:14px; vertical-align:middle;\n\
			  background-size:contain; \n\
			  background:-o-skin('RSS'); }\n\
.global_icon.visible	{ visibility:visible; }\n\
td:hover > .global_icon	{ visibility:visible; } \n\
\n\
/*************************************************************************************************************/\n\
/* Options menu */\n\
\n\
#options_menu		{ min-width:250px; }\n\
\n\
.separator	{ height: 1px; display: block; background-color: #555555; margin-left: auto; margin-right: auto; }\n\
\n\
/* import file (make form and button look like a menuitem) */\n\
#import_form	{ display:inline-block; position:relative; overflow:hidden; vertical-align:text-bottom }\n\
#import_btn	{ display:block; position:absolute; top:0; right:0; margin:0; border:0; opacity:0 }\n\
\n\
/*************************************************************************************************************/\n\
/* generic stuff */\n\
\n\
table					{ border-spacing:0px; border-collapse: collapse; }\n\
\n\
/* radio buttons (scope etc) */\n\
input[type=radio]			{ display:none; } \n\
input[type=radio] + label:hover		{ background-color: #ddd; } \n\
input[type=radio] + label		{ box-shadow:inset 0px 1px 0px 0px #ffffff; border-radius:6px; \n\
					  border:1px solid #dcdcdc; background-color: #c7c7c7;  \n\
					  display:inline-block; padding:1px 5px; text-decoration:none; \n\
					} \n\
input[type=radio]:checked + label	{ background-color: #fa4; } \n\
\n\
/* icons */\n\
img { width:22px; height:22px; vertical-align:middle; background-size:contain; }\n\
\n\
img.allowed		{ background:-o-skin('Transfer Success'); }\n\
img.blocked		{ background:-o-skin('Transfer Stopped'); }\n\
img.not_loaded		{ background:-o-skin('Transfer Size Mismatch'); }\n\
img.iframe		{ background:-o-skin('Menu Info'); }\n\
img.allowed_globally	{ background:-o-skin('RSS'); }\n\
img.block_all		{ background:-o-skin('Smiley Pacman'); }\n\
img.filtered		{ background:-o-skin('Smiley Cool'); }\n\
img.relaxed		{ background:-o-skin('Smiley Tongue'); }\n\
img.allow_all		{ background:-o-skin('Smiley Cry'); }\n\
\n\
textarea		{ width:400px; height:300px; }\n\
";

    /**************************** Plugin API **********************************/

    // plugin api: can be used to display extra stuff in the menu from other scripts.
    // useful for debugging and hacking purposes when console.log() isn't ideal.
    if (enable_plugin_api)
    {
	var plugin_items = new Object();
	
	if (window.noscript)
	    alert("jsarmor.js: window.noscript exists!!!");
	// FIXME: this isn't great for seeing what happens in iframes ...
	window.noscript = new Object();	
	
	// API for plugins to add items to noscript's menu
	window.noscript.add_item = function(name, value)
	{
	    //console.log("noscript: plugin added item: " + name + " : " + text);
            plugin_items[name] = value;
	    if (nsmenu)
		repaint_ui();	
	};
    }

