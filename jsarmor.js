(function(opera, scriptStorage) {
    var version = 'Noscript v1.34';

    /************************* Default Settings *******************************/

    var default_globally_allowed_hosts =
    ['ajax.googleapis.com', 's.ytimg.com', 'code.jquery.com', 'z-ecx.images-amazon.com', 'st.deviantart.net'];
    
    var cornerposition = 4;
    // 1 = top left, 2=top right , 3=bottom left , 4=bottom right etc.
    var blocksitescripts=false;

    // default mode for new pages:
    //   block_all, filtered, relaxed or allow_all    
    var default_mode = 'relaxed';

    // block inline scripts by default ?
    var default_block_inline_scripts = false;

    // when inline scripts are blocked, handle <noscript> tags
    // as if javascript was disabled in opera
    var default_handle_noscript_tags = true;
    
    /**************************************************************************/        

    // FIXME handle frames
    // if (window != window.top)
    //   running in frame

    // noscript ui's iframe, don't run in there
    if (window != window.top &&
	window.name == 'noscript_iframe')
	return; 

    if (global_setting('noscript') == '')
    {
	alert("Noscript:\nNo prior settings found.\n" +
	      "Setting global whitelist to:\n[" +
	      default_globally_allowed_hosts + "]");
	set_global_setting('noscript', '. ' + default_globally_allowed_hosts.join(' '));
    }    

    var current_host = location.hostname;
    var current_domain = get_domain(location.hostname);

    // FIXME: not used anymore. remove/rename.
    // local settings are per host
    function local_setting(name)
    {
	return global_setting(location.hostname + ':' + name);
    }

    function set_local_setting(name, value)
    {
	set_global_setting(location.hostname + ':' + name, value);
    }

    // scoped settings are either per page, site, domain, or global.
    var scope;                     // (0,     1,     2,      3)
    var scoped_prefixes =
      [strip_url_tail(location.href) + ':', location.hostname + ':', current_domain + ':', ''];
    function init_scope()
    {
	for (scope = 0; scope < 3; scope++)
	    if (scoped_setting('noscript_mode') != '')
		break;
    }

    function scoped_setting(name)
    {
	if (name == setting_hosts && scope == 3)
	    return global_setting(scoped_prefixes[1] + name);
	return global_setting(scoped_prefixes[scope] + name);
    }

    function set_scoped_setting(name, value)
    {	
	if (name == setting_hosts && scope == 3)
	{
	    set_global_setting(scoped_prefixes[1] + name, value);
	    return;
	}
	set_global_setting(scoped_prefixes[scope] + name, value);
    }

    // copy settings over and change scope.
    var scoped_settings =
      ['noscript_mode', 'noscript_inline', 'noscript_nstags', 'noscript_hosts'];
    function change_scope(new_scope)
    {
	if (scope == new_scope)
	    return;
	var old_scope = scope;
	for (var i = 0; i < scoped_settings.length; i++)
	{
	    scope = old_scope;
	    var s = scoped_setting(scoped_settings[i]);
	    // FIXME: should we remove them all ?
	    //        for (; scope < new_scope; scope++) 
	    if (new_scope > scope) // remove more specific setting
		set_scoped_setting(scoped_settings[i], '');
	    scope = new_scope;
	    set_scoped_setting(scoped_settings[i], s);
	}
    }
    
    function global_setting(name)
    {
	// to view content -> opera:webstorage  
	var o=scriptStorage.getItem(name);
	if (o == null)
	    return '';
	return o;
    }

    function set_global_setting(name, value)
    {
	scriptStorage.setItem(name, value);
    }

    var button_image = null;

    init_scope();
    
    // block_all, filtered, relaxed, allow_all    
    var mode = scoped_setting('noscript_mode');
    // FIXME: setting_hosts is constant now. replace it.
    var setting_hosts = 'noscript_hosts';
    if (mode == '')
	mode = default_mode; 
    set_mode_no_update(mode);

    var block_inline_scripts;
    var c = scoped_setting('noscript_inline');
    if (c == '')
      block_inline_scripts = default_block_inline_scripts;
    else
      block_inline_scripts = (c != 'y');

    var handle_noscript_tags;

    function toggle_allow_inline(event)
    {
      block_inline_scripts = !block_inline_scripts;
      this.checkbox.checked = block_inline_scripts;
      this.nextSibling.style = "display:" + (block_inline_scripts ? "block;" : "none;");
      set_scoped_setting('noscript_inline', (block_inline_scripts ? 'n' : 'y'));
      need_reload = true;
    }

    function toggle_handle_noscript_tags()
    {
      handle_noscript_tags = !handle_noscript_tags;
      this.checkbox.checked = handle_noscript_tags;
      set_scoped_setting('noscript_nstags', (handle_noscript_tags ? 'y' : 'n'));
      need_reload = true;
    }

    function reload_page()
    {
	location.reload();
    }
    
    function new_style(str)
    {
	var pa= idoc.getElementsByTagName('head')[0] ;
	var el= idoc.createElement('style');
	el.type= 'text/css';
	el.media= 'screen';
	el.appendChild(idoc.createTextNode(str));
	pa.appendChild(el);
	return el;
    }
    
    function show_details()
    {	
	var nsdetails = idoc.createElement('div');
	nsdetails.align = 'left';
	nsdetails.style="border-width: 2px; border-style: outset; border-color: gray; background:#abb9ca;";
//        nsdetails.style.display = 'inline-block';

	nsdetails.onmouseout = function(e)
	{
	   if (!mouseout_leaving_menu(e, nsdetails))
	       return;	   
	   td.removeChild(nsdetails);
	   resize_iframe();	   
	};
	
	var item = add_menu_item(nsdetails, "Scripts:");
	item.align = 'center';
	item.style = 'background-color:#0000ff; color:#ffffff; font-weight:bold;';
	add_menu_separator(nsdetails);	

	foreach_host_node(function(host_node)
	{
	  var h = host_node.name;
	  var s = host_node.scripts;
	  // var item = add_menu_item(nsdetails, h + ":");	  

	  sort_scripts(s);
	  for (var j = 0; j < s.length; j++)
	  {
	      var item = add_link_menu_item(nsdetails, s[j].url, strip_http(s[j].url), 2);
	      // script status
	      var icon = new_icon();
	      var image = 'Transfer Stopped';
	      if (allowed_host(h))
	      {
		  image = 'Transfer Success';
		  if (!s[j].loaded)
		  {
		      image = 'Transfer Size Mismatch';
		      icon.title = "Script allowed, but not loaded: syntax error, bad url, or something else is blocking it.";
		  }
	      }
	      set_icon_image(icon, image);

	      item.insertBefore(icon, item.childNodes[0]);
	  }	  
	});
	
	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(nsdetails);

	show_hide_menu(false);
        nsdetails.style.display = 'inline-block';
    }

    function mouseout_leaving_menu(e, menu)
    {
	// if (!e)
	//    var e = window.event;
	
	// object we're moving out of
	// var tg = (window.event) ? e.srcElement : e.target;
	// if (tg != nsdetails) // moving out of one its children.
	//  return; we actually need that case!
	
	// e.relatedTarget: object we're moving to.
	var reltg = e.relatedTarget;
	if (reltg)
	{
	    while (reltg != menu && reltg.nodeName != 'HTML')
		reltg = reltg.parentNode;
	    if (reltg == menu)
		return false; // moving out of the div into a child layer
	}
	return true;
    }
    
    function set_mode_no_update(new_mode)
    {
      mode = new_mode;

      // filtered default settings: allow current host
      if (new_mode == 'filtered' && scoped_setting(setting_hosts) == '')
	  allow_host(current_host);
      
      set_scoped_setting('noscript_mode', mode);
      if (button_image)
	  set_icon_mode(button_image, mode);
    }
    
    function set_mode(new_mode)
    {
      set_mode_no_update(new_mode);
      show_hide_menu(false);
      reload_page();
    }    

    function allow_host(host)
    {
	var l = scoped_setting(setting_hosts);
	l = (l == '' ? '.' : l);
	if (list_contains(l, host))
	    return;
	set_scoped_setting(setting_hosts, l + ' ' + host);
    }

    function global_allow_host(host)
    {
	var l = global_setting('noscript');
	l = (l == '' ? '.' : l);	
	if (list_contains(l, host))
	    return;
	set_global_setting('noscript', l + ' ' + host);
    }
    
    function remove_host(host)
    {
	var l = scoped_setting(setting_hosts);
	l = l.replace(' ' + host, '');
	set_scoped_setting(setting_hosts, l);
    }

    function global_remove_host(host)
    {
      var l = global_setting('noscript');
      l = l.replace(' ' + host, '');
      set_global_setting('noscript', l);
    }

    function url_hostname(url)
    {
        var t = document.createElement('a');
        t.href = url;
        return t.hostname;
    }

    // strip http(s):// from url
    function strip_http(u)
    {
	var i = u.indexOf('://');
	if (i != -1)
	    return u.slice(i+3);
	return u;
    }

    // split url into [dir, file, tail]
    function split_url(u)
    {
	u = strip_http(u);
	var a = u.match(/^([^?&:]*)\/([^/?&:]*)(.*)$/);
	if (!a)
	    alert("noscript.js: shouldn't happen");
	return a.slice(1);
    }
    
    function strip_url_tail(u)
    {
	var a = split_url(u);
	return a[0] + '/' + a[1]; // dir + file
    }

    function is_prefix(p, str)
    {
	return (str.slice(0, p.length) == p);
    }
    
    function get_domain(h)
    {
      var i = h.lastIndexOf(".");
      var j = h.lastIndexOf(".", i-1);
      if (i - j == 3 && h.length - i == 3) // .co.uk style domain
	  j = h.lastIndexOf(".", j-1); 
      if (j != -1)
	  return h.slice(j+1);     
      return h;
    }
    
    // return true if d1 and d2 are "related domains"
    // Ex: media-imdb.com is related to imdb.com
    function related_domains(d1, d2)
    {
	if (d2.length > d1.length)
	    return related_domains(d2, d1);
	var name = d2.slice(0, d2.indexOf("."));
	if (d1.indexOf(name) != -1)
	    return true;
	if (name.length > 2 &&
	    d1.slice(0, 3) == name.slice(0, 3))
	    return true;
	return false;
    }

    // googleapis
    function helper_domain(d)
    {
	if (d.indexOf("apis") != -1 ||
	    d.indexOf("cdn") != -1 ||
	    d.indexOf("img") != -1 ||
	    d == "google.com" ||
	    d == "googlecode.com" ||
	    d == "gstatic.com")
	    return true;
	return false;
    }

    function helper_host(h)
    {
	return (is_prefix("api.", h) ||
		is_prefix("apis.", h) ||
		is_prefix("code.", h));
    }

    function list_contains(list, str)
    {
      return (list && list.indexOf(' ' + str) != -1);
    }

    function host_allowed_globally(host)
    {
	var l = global_setting('noscript');
	return list_contains(l, host);
    }
    
    function host_allowed_locally(host)
    {
	var l = scoped_setting(setting_hosts);
	return list_contains(l, host);
    }
    
    function filtered_mode_allowed_host(host)
    {
	return (
	    host_allowed_globally(host) ||
	    host_allowed_locally(host));
    }

    // allow related and helper domains
    function relaxed_mode_allowed_host(host)
    {
	var dn = get_domain_node(get_domain(host));
	if (dn.related || dn.helper ||
	    helper_host(host))
	    return true;
	
	return filtered_mode_allowed_host(host);
    }

    // switch to filtered mode for this site,
    // allow every host allowed in relaxed mode, except host
    function relaxed_mode_to_filtered_mode(host)
    {
	if (scope == 3)  // FIXME: should we handle others ?
	    change_scope(1);
	set_mode_no_update('filtered');
	
	foreach_host_node(function(hn)
	{
	  var h = hn.name;
	  if (relaxed_mode_allowed_host(h))
	  {
	      if (h == host)
		  remove_host(h);
	      else
		  allow_host(h);
	  }
	});      
    }
    
    function allowed_host(host)
    {
      if (mode == 'block_all') return false; 
      if (mode == 'filtered')  return filtered_mode_allowed_host(host);
      if (mode == 'relaxed')   return relaxed_mode_allowed_host(host); 
      if (mode == 'allow_all') return true;
      alert('noscript.js: mode="' + mode + '", this should not happen!');
    }

    function check_handle_noscript_tags()
    {
	handle_noscript_tags = scoped_setting('noscript_nstags');
	if (handle_noscript_tags == '')
	    handle_noscript_tags = default_handle_noscript_tags;
	else
	    handle_noscript_tags = (handle_noscript_tags == 'y');
	if (!handle_noscript_tags)
	    return;
	
	// javascript is blocked on this page, 
	// interpret <noscript> tags as if javascript was disabled in opera	    
	
	for (var j = document.getElementsByTagName('noscript'); j[0];
	     j = document.getElementsByTagName('noscript')) 
	{
	    var nstag = document.createElement('wasnoscript');
	    nstag.innerHTML = j[0].innerText;
	    
	    j[0].parentNode.replaceChild(nstag, j[0]);
	    // once reparenting is done, we have to get tags again
	    // otherwise it misses some. weird ...		
	}
    }
    
    function new_icon(image)
    {
      var icon = idoc.createElement('img');
      icon.style = "width:22px;height:22px; vertical-align:middle;";
      if (image)
	  set_icon_image(icon, image);
      return icon;	
    }

    function set_icon_image(icon, image_name)
    {
	icon.style.background = "-o-skin('" + image_name + "')";
    }
    
    function new_icon_mode(mode)
    {
	var icon = new_icon();
	set_icon_mode(icon, mode);
	return icon;
    }

    function set_icon_mode(icon, mode)
    {
      var image;
      if (mode == 'block_all') 	image = "Smiley Pacman";
      if (mode == 'filtered') 	image = "Smiley Cool";
      if (mode == 'relaxed') 	image = "Smiley Tongue";
      if (mode == 'allow_all') 	image = "Smiley Cry";
      set_icon_image(icon, image);
    }
    
    function add_menu_item(nsmenu, text, indent, f, child)
    {
      var item = idoc.createElement('div');
      item.className = 'noscript_item';
      if (child)
	  item.appendChild(child);
      if (indent)
	  item.style = "padding-left:" + (indent * 10) + "px;";
      item.innerHTML += text;
      if (f)
      {
//	item.onmouseover = function(){ this.style.backgroundColor = '#dddddd'; };
	item.onmouseover = function(){ this.style.backgroundColor = '#fa4'; };
	item.onmouseout  = function(){ this.style.backgroundColor = 'transparent'; };
	item.onclick = f;
      }
      // make text non selectable
      item.onmousedown = function(){ return false; };
      nsmenu.appendChild(item);
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

    function add_table_item(table, col1, col2, col3, col4, col5, col6, f, color)
    {
	var tr = idoc.createElement('tr');
	var s = "";
	s += "<td width=1%></td>";
	s += "<td width=1%>" + to_html(col1) + "</td>";
	s += "<td width=1%>" + to_html(col2) + "</td>";
	s += "<td>" + to_html(col3) + "</td>";
	s += "<td width=1%>" + to_html(col4) + "</td>";
	s += "<td width=1%>" + to_html(col5) + "</td>";
	s += "<td width=1%>" + to_html(col6) + "</td>";
	tr.innerHTML = s;
//	tr.childNodes[0].style = "padding-left:" + (indent * 10) + "px;";
	tr.childNodes[3].style = "color: #888888; text-align:right;";
	if (color != '')
	    tr.childNodes[4].style.color = color;
	tr.childNodes[6].style = "text-align:right;";
	if (f)
	{
//	    tr.onmouseover = function(){ this.style.backgroundColor = '#dddddd'; };
	    tr.onmouseover = function(){ this.style.backgroundColor = '#fa4'; };
	    tr.onmouseout  = function(){ this.style.backgroundColor = 'transparent'; };
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
	d.style = "float:right;";
	d.innerText = text;
	parent.appendChild(d);
	return d;
    }

    function add_radio_button(parent, text, target_scope)
    {
	var r = idoc.createElement('input');
	r.type = 'radio';
	r.name = 'radio_group';
	r.scope = target_scope;
	r.checked = (scope == target_scope);
	r.onclick = function() { change_scope(this.scope); };
	//r.style = "float:right;";

	var t = idoc.createElement('label');
	t.radio = r;
	t.innerText = text;
	t.onclick = function() { this.radio.checked = true; this.radio.onclick(); }	
	//t.style = "float:right;";	

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
      //  width: 90%;
      div.style = "height: 1px; display: block; background-color: #555555; margin-left: auto; margin-right: auto;";
      menu.appendChild(div);
    }

    function make_checkbox(checked)
    {
      var c = idoc.createElement('input');
      c.type = 'checkbox';
      c.defaultChecked = checked;
      return c;
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
	var image = 'Transfer Size Mismatch';
	icon.title = n + " script" + (n>1 ? "s" : "") + " not loaded.";
	if (n == s.length)
	{
	    // FIXME: find a smaller/less invasive icon
	    // image = 'Transfer Stopped';	    
	    icon.title = "None loaded.";
	}
	icon.title += " See details.";
	set_icon_image(icon, image);
	return icon;
    }

    function show_global_icon()
    { this.firstChild.style = "visibility: visible;";  }
    function hide_global_icon()
    { this.firstChild.style = "visibility: hidden;";  }
    
    function set_global_icon_ui(icon, visible)
    {
	var td = icon.parentNode;
	if (visible)
	{
	    td.onmouseout = null;
	    td.onmouseover = null;
	    return;
	}
	icon.style.visibility = "hidden";
	td.onmouseout = hide_global_icon;
	td.onmouseover = show_global_icon;	
    }
    
    function init_global_icon(icon, h)
    {
	icon.className = "noscript_global";
	icon.title = "Allowed Globally";
	if (!host_allowed_globally(h))
	{
	    icon.style = "visibility: hidden;";
	    icon.parentNode.onmouseover = show_global_icon;
	    icon.parentNode.onmouseout = hide_global_icon;
	}
    }

    function list_to_string(list)
    {
	var d = '';
	var comma = '';
	var a=list.split(' ');
	for (var i = 0; i < a.length; i++)
	{ 
	    if (a[i] != '.')
	    {
		d = d + comma + "'" + a[i] + "'";
		comma = ', ';
	    }
	}
	return '[' + d + ']';
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
	  set_global_icon_ui(this.icon, host_allowed_globally(h))

	  if (mode != 'filtered' && mode != 'relaxed')
	      set_mode_no_update('filtered');

	  // blocking related/helper host in relaxed mode ? switch to filtered mode.
	  // (related/helper hosts are always allowed in relaxed mode)
	  if (mode == 'relaxed' &&
	      (relaxed_mode_allowed_host(h) && !filtered_mode_allowed_host(h)))
	      relaxed_mode_to_filtered_mode(h);
	  
	  need_reload = true;
	};

	var table = idoc.createElement('table');
	table.id = "noscript_ftable";
	table.cellSpacing = 0;
	nsmenu.appendChild(table);

	sort_domains();

	var found_not_loaded = false;
	var item = null;
	foreach_host_node(function (hn, dn)
	{
	    var d = dn.name;
	    var h = hn.name;
	    var checkbox = make_checkbox(allowed_host(h));
	    var host_part = h.slice(0, h.length - d.length);
	    var not_loaded = icon_not_loaded(hn, checkbox.checked);
	    var count = "[" + hn.scripts.length + "]";
	    var color = (dn.related || dn.helper ? '#000' : '');
	    var icon = idoc.createElement('img');	    
	    item = add_table_item(table, not_loaded, checkbox, host_part, d, icon, count, f, color);
	    
	    icon = item.childNodes[5].firstChild;
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
    
    var nsmenu;
    var need_reload = false;
    function create_menu()
    {
	nsmenu = idoc.createElement('div');
	nsmenu.align = 'left';
	nsmenu.style="color: #333; border-radius: 5px; border-width: 2px; border-style: outset; border-color: gray;" +
	// "background:#abb9ca;" +
        "background: #ccc;" +
	// "background: #efebe7;" +
	"box-shadow: 8px 10px 10px rgba(0,0,0,0.5), inset 2px 3px 3px rgba(255,255,255,0.75);";
	
        nsmenu.style.display = 'none';

	nsmenu.onmouseout = function(e)
	{
	  if (!mouseout_leaving_menu(e, nsmenu))
	      return;

	  show_hide_menu(false);
	  if (need_reload)
	      reload_page();
	};
	
	var item = add_menu_item(nsmenu, "Noscript Settings ...");
	item.title = version + ". Click to view global settings.";
	item.align = 'center';
	item.className = 'noscript_title'
        // item.style = 'background-color:#0000ff; color:#ffffff; font-weight:bold;';
	item.onclick = function(event)
	{       
  	  if (!event.ctrlKey)
	  {
	    var d = list_to_string(global_setting('noscript'));
	    alert("Noscript \nGlobal whitelist: \n" + d);
	  
	    return;
	  }
	  var d = list_to_string(scoped_setting(setting_hosts));
	  alert("Noscript \nHosts allowed for this page: \n" + d);
	};

	item = add_menu_item(nsmenu, "Set for", 0, null);
	add_radio_button(item, "Page", 0);
	add_radio_button(item, "Site", 1);
	add_radio_button(item, "Domain", 2);	
	add_radio_button(item, "Global", 3);

	var checkbox = make_checkbox(block_inline_scripts);
	var label = "Block Inline Scripts";
	item = add_menu_item(nsmenu, label, 0, toggle_allow_inline, checkbox);
	item.checkbox = item.firstChild;
	add_right_aligned_text(item, " [" + get_size_kb(total_inline_size) + "k]");

	var checkbox = make_checkbox(handle_noscript_tags);
	var label = "Pretend Javascript Disabled";
	item = add_menu_item(nsmenu, label, 2, toggle_handle_noscript_tags, checkbox);
	item.checkbox = item.firstChild;
	item.title = "Interpret noscript tags as if javascript was disabled in opera."
	if (!block_inline_scripts)
	    item.style = "display:none;";	    

	add_menu_separator(nsmenu);
	add_menu_item(nsmenu, "External Scripts:");	
	add_menu_item(nsmenu, "Block All", 0, function(){ set_mode('block_all'); }, new_icon_mode('block_all'));
	add_menu_item(nsmenu, "Filter By Host", 0, function(){ set_mode('filtered'); }, new_icon_mode('filtered'));
	if (mode != 'relaxed')
	    add_ftable(nsmenu);
	
	add_menu_item(nsmenu, "Relaxed", 0, function(){ set_mode('relaxed'); }, new_icon_mode('relaxed'));
	if (mode == 'relaxed')
	    add_ftable(nsmenu);
	
	add_menu_item(nsmenu, "Allow All", 0, function(){ set_mode('allow_all'); }, new_icon_mode('allow_all'));
	add_menu_item(nsmenu, "Details ...", 0, show_details);

	for (var i = 0; i < plugin_items.length; i++)
	    add_menu_item(nsmenu, plugin_items[i], 0, null);	
	
	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(nsmenu);	
    }

    function show_hide_menu(show, toggle)
    {
      if (!nsmenu)
	  create_menu();
      var d = (show ? 'inline-block' : 'none');
      if (toggle) 
	  d = (nsmenu.style.display == 'none' ? 'inline-block' : 'none');
      nsmenu.style.display = d;
      resize_iframe();
    }
    
    function new_script(url)
    {
	var o = new Object();
	o.url = url;
	return o;
    }

    function sort_scripts(s)
    {
	s.sort(function(s1,s2){ return (s1.url < s2.url ? -1 : 1); });
    }
    
    // External scripts are stored in a 3 level tree (domain/host/script)
    // Ex: domain_nodes[0].hosts[0].scripts[0]
    // Domain/Host name: domain_nodes[0].name etc
    // FIXME: can't we use some kind of hash table ??
    var domain_nodes = [];

    function get_domain_node(domain, create)
    {
	for (var i = 0; i < domain_nodes.length; i++)
	{
	    if (domain_nodes[i].name == domain)
		return domain_nodes[i];
	}
	if (!create)
	    return null;
	var n = new Object();
	n.name = domain;
	n.related = related_domains(domain, current_domain);
	n.helper = helper_domain(domain);
	n.hosts = [];
	domain_nodes.push(n);
	return n;
    }

    function get_host_node(host, domain_node, create)
    {
	var hosts = domain_node.hosts;
	for (var i = 0; i < hosts.length; i++)
	{
	    if (hosts[i].name == host)
		return hosts[i];
	}
	if (!create)
	    return null;
	var n = new Object();
	n.name = host;
	n.scripts = [];
	hosts.push(n);
	return n;
    }

    function add_script(url, host)
    {
	var domain = get_domain(host);
	var s = new_script(url);

	var domain_node = get_domain_node(domain, true);
	var host_node = get_host_node(host, domain_node, true);
	host_node.scripts.push(s);
	return s;
    }

    // call f(host_node, domain_node) for every hosts
    function foreach_host_node(f)
    {
	for (var i = 0; i < domain_nodes.length; i++)
	{
	    var hosts = domain_nodes[i].hosts;
	    for (var j = 0; j < hosts.length; j++)
		f(hosts[j], domain_nodes[i]);
	}
    }

    function sort_domains()
    {
	// set domains' helper_host
	foreach_host_node(function(hn, dn)
	{
	  var h = hn.name;
	  if (helper_host(h))
	      dn.helper_host = true;	      
	});	
	
	domain_nodes.sort(function(d1,d2)
	{
	    // current domain goes first
	    if (d1.name == current_domain || d2.name == current_domain)
		return (d1.name == current_domain ? -1 : 1);
	    // then related domains 
	    if (d1.related ^ d2.related)
		return (d1.related ? -1 : 1);
	    // then helper domains
	    if (d1.helper ^ d2.helper)
		return (d1.helper ? -1 : 1);
	    // then domains with helper hosts
	    if (d1.helper_host ^ d2.helper_host)
		return (d1.helper_host ? -1 : 1);
	    return (d1.name < d2.name ? -1 : 1);
	});
    }

    var blocked_current_host = 0;
    var loaded_current_host = 0;
    var total_current_host = 0;
    
    var blocked_external = 0;
    var loaded_external = 0;
    var total_external = 0;

    var total_inline = 0;
    var total_inline_size = 0;

    function get_size_kb(x)
    {
	var k = new String(x / 1000);
	var d = k.indexOf('.');
	if (d)
	    return k.slice(0, d + 2);
	return k;
    }

    var beforescript_alert = false;
    
    // Handler for both inline *and* external scripts
    opera.addEventListener('BeforeScript',
    function(e)
    {
      if (e.element.src) // external script
	  return;
      
      total_inline++;
      total_inline_size += e.element.text.length;
      
      // FIXME: remove after we're done testing
      if (nsmenu && !beforescript_alert)
      {
	  alert("noscript.js: BeforeScript after DOM loaded");
	  beforescript_alert = true;
      }
      
      if (block_inline_scripts)
	e.preventDefault();
    }, false);

    var beforeexternalscript_alert = false;
    
    opera.addEventListener('BeforeExternalScript',
    function(e)
    {
        if (e.element.tagName != 'SCRIPT' && e.element.tagName != 'script')
	{
	  alert("noscript.js: BeforeExternalScript: non 'SCRIPT' tagname: " + e.element.tagName);
	  return;
        }

	// FIXME: remove after we're done testing
	if (nsmenu && !beforeexternalscript_alert)
	{
	    alert("noscript.js: BeforeExternalScript after DOM loaded");
	    beforeexternalscript_alert = true;
	}

	var url = e.element.src;
	var host = url_hostname(url);
	var script = add_script(url, host);
	var allowed = allowed_host(host);
	
	if (host == current_host)
	{
	  total_current_host++;
	  if (!allowed)
	      blocked_current_host++;
	}
	else
	{
	  total_external++;
	  if (!allowed)
	      blocked_external++;
	}
	
	// find out which scripts are actually loaded,
	// this way we can find out if *something else* is blocking (blocked content, hosts file ...)
	// awesome!
	e.element.onload = function(le)
	{
//	  alert("noscript.js: in load handler! script:" + le.target.src);

	  if (host == current_host)
	      loaded_current_host++; 
	  else
	      loaded_external++;
	  script.loaded = 1; // what a hack, javascript rules!
	}	
	
        if (!allowed)
	    e.preventDefault();
    },
    false);


    if (window.noscript)
	alert("window.noscript exists!!!");
    // FIXME: when adding frame support, fix this.
    window.noscript = new Object();    

    var plugin_items = [];
    var plugin_alert = false;
    // API for plugins to add items to noscript's menu    
    window.noscript.add_item = function(text)
    {
	//console.log("noscript: plugin added item: " + text);
	plugin_items.push(text);

	if (nsmenu && !plugin_alert)
	{
	    plugin_alert = true;
	    alert("noscript.js: New plugin item after DOM loaded.");
	}
	
    };

    function populate_iframe()
    {
	iframe.contentWindow.name = 'noscript_iframe';
	idoc = iframe.contentWindow.document;

	// set doctype, we want strict mode, not quirks mode!
	idoc.open();
	idoc.write("<!DOCTYPE HTML>\n<html><head></head><body></body></html>");
	idoc.close();
	
	var noscript_style =
"\n\
#noscript_table { position:fixed;width:auto;height:auto;background:transparent;white-space:nowrap;z-index:99999999;direction:ltr;font-family:sans-serif; font-size:small; margin-bottom:0px; }  \n\
#noscript_table > tr > td { text-align: right; padding: 0px 0px 0px 0px;} \n\
#noscript_ftable { width:100%; } \n\
#noscript_ftable > tr > td { padding: 0px 0px 1px 0px;} \n\
.noscript_title { background-color:#d80; color:#ffffff; font-weight:bold; } \n\
#noscript_button { border-width: 2px; padding: 1px 8px; margin: 0px 0px 0px 0px; float: none; } \n\
#noscript_table div { width: auto; } \n\
input[type=radio]:checked { visibility:visible; } \n\
input[type=radio]         { visibility:hidden; } \n\
.noscript_global { padding: 0px 3px; width:14px; height:14px; vertical-align:middle; \
    background: -o-skin('RSS'); } \n\
";

	// -o-linear-gradient(top, #FFFFFF 0px, #CCCCCC 100%) #E5E5E5;
	
	new_style(noscript_style);
	
	var table = idoc.createElement('table');
	table.id = 'noscript_table';
	table.border = 0;
	table.cellSpacing = 0;
	table.cellPadding = 0;	
	// background:-o-skin("Browser Window Skin")        

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
	r.id = 'noscript_button';
	r.title = tooltip;
	button_image = new_icon_mode(mode);
	r.appendChild(button_image);
	r.onmouseover = function() { show_hide_menu(true); };
        r.onclick = function(event)
	{
	  // cycle through the modes
	  // FIXME: should wait until shift is released to reload page
	  if (mode == 'block_all')      set_mode_no_update('filtered');
	  else if (mode == 'filtered')  set_mode_no_update('relaxed');
	  else if (mode == 'relaxed')  set_mode_no_update('allow_all');
	  else if (mode == 'allow_all') set_mode_no_update('block_all');
	  need_reload = true;
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

	ibody = idoc.getElementsByTagName('body')[0];
	ibody.appendChild(table);
	ibody.style.margin = '0px';

//	iframe.style = "width:" + table.clientWidth +
//	"px; height:" + table.clientHeight + "px;";

	resize_iframe();
    }

    function resize_iframe()
    {
	var content = ibody.firstChild;
	//iframe.style.width = content.clientWidth + 'px';
	//iframe.style.height = content.clientHeight + 'px';
	iframe.style.width = content.scrollWidth + 'px';
	iframe.style.height = content.scrollHeight + 'px';
    }
    
    var iframe = null;
    var idoc = null;
    var ibody = null;
    document.addEventListener('DOMContentLoaded',
    function()
    {
        if (!domain_nodes.length && !total_inline) 
            return;

	if (block_inline_scripts)
	    check_handle_noscript_tags();
	
	iframe = document.createElement('iframe');
	iframe.id = 'noscript_iframe';
	iframe.style = "position:fixed !important;width:auto !important;height:auto !important;background:transparent !important;white-space:nowrap !important;z-index:99999999 !important;direction:ltr !important;font-family:sans-serif !important; font-size:small !important; margin-bottom:0px !important;" +
	
// "width: 300px !important; height: 100px !important;"
	"margin-top: 0px !important; margin-right: 0px !important; margin-bottom: 0px !important; margin-left: 0px !important; padding-top: 0px !important; padding-right: 0px !important; padding-bottom: 0px !important; padding-left: 0px !important; border-top-width: 0px !important; border-right-width: 0px !important; border-bottom-width: 0px !important; border-left-width: 0px !important; border-top-style: none !important; border-right-style: none !important; border-bottom-style: none !important; border-left-style: none !important; background-color: transparent !important; visibility: visible !important; content: normal !important; outline-width: medium !important; outline-style: none !important; background-image: none !important; min-width: 0px !important; min-height: 0px !important; " +
	
//	"border: 1px solid #CCC !important; " +	
	(cornerposition < 3 ? 'top': 'bottom') + ':1px !important;' + (cornerposition % 2 == 1 ? 'left': 'right') + ':1px !important;';
	iframe.scrolling="no";
//	iframe.frameborder="0";
	iframe.allowtransparency="true";
	//iframe.class="aomi"
	//iframe.src=""; id="i0" title="about:blank

	iframe.onload = populate_iframe;
	var body = document.getElementsByTagName('body')[0];
	body.appendChild(iframe);
    },
    false);
})(opera, opera.scriptStorage);
