// ==UserScript==
// @name jsarmor
// @author lemonsqueeze https://github.com/lemonsqueeze/jsarmor
// @description Block unwanted javascript. NoScript on steroids for opera !
// @published 2012-10-08 11:00
// ==/UserScript==

/* This script is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 */


// Watch out, when running as userjs, document and window.document are the same,
// but when running as an extension they're 2 different things!
(function(document, location, opera, scriptStorage) {    
    var version = 'jsarmor v2.0';

    /************************* Default Settings *******************************/
    
    var default_globally_allowed_hosts =
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
    var helper_blacklist =     // FIXME add ui to edit ?
    { "apis.google.com": 1,    // only used for google plus one
      "widgets.twimg.com": 1,  // twitter
      "static.ak.fbcdn.net": 1 // facebook
    };
    
    // icon set to use: 'native' or 'opera_11'
    var icon_set = 'opera_11';
    
    var cornerposition = 4;
    // 1 = top left, 2=top right , 3=bottom left , 4=bottom right etc.
    var blocksitescripts=false;

    // default mode for new pages:
    //   block_all, filtered, relaxed or allow_all    
    var default_mode = 'relaxed';

    // block inline scripts by default for block_all mode ?
    var default_block_inline_scripts = true;

    // when inline scripts are blocked, handle <noscript> tags
    // as if javascript was disabled in opera
    var default_handle_noscript_tags = true;

    // whether to show jsarmor ui inside frames / iframes
    var default_iframe_ui = false;

    var help_url = "https://github.com/lemonsqueeze/jsarmor/wiki";

    // can be used to display stuff in jsarmor menu from outside scripts.
    var enable_plugin_api = false;

    // 0: block all   1: ask parent   2: normal page
    var default_iframe_logic = 1;

    
    /********************************* Globals *********************************/

    /** stuff load_global_settings() takes care of **/
    var current_host;
    var current_domain;    
    var block_inline_scripts = false;
    var handle_noscript_tags = false;
    var iframe_logic;

    
    /** other stuff **/
    var button_image = null;
    var icons;
    
    /********************************* Init ************************************/    
    
    // jsarmor ui's iframe, don't recurse !
    if (window != window.top &&
	window.name == 'noscript_iframe')
	return;

    // guard against race conditions which come up when running as extension.
    // see init_handlers();
    var init = false;
    {
	init_handlers();	
	check_script_storage();
	init_icons();
	load_global_settings();
    }
    init = true;
    
    if (global_setting('whitelist') == '')
    {
	// FIXME: need a nice way to edit this.
	alert("Welcome to jsarmor !\n\n" +
	      "jsarmor's button will show up at the bottom right of pages using javascript.\n\n" +
	      "The initial global whitelist is set to:\n\n[" +
	      default_globally_allowed_hosts.join(', ') + "]");
	set_global_setting('whitelist',
			   '. ' + default_globally_allowed_hosts.join(' '));
    }

    function load_global_settings()
    {
	load_global_context(location.hostname);
	init_iframe_logic();
    }
    
    // can be used to check on another page's settings.
    // (normal page settings that is, without iframe logic kicking in)
    // call clear_domain_nodes() afterwards to discard store changes.
    function load_global_context(host)
    {
	current_host = url;
	current_domain = get_domain(url);
	
	init_scope();
	init_mode();
    }

    
    /************************* Loading/Saving Settings ************************/

    function check_script_storage()
    {
	if (!scriptStorage)
	{
	    location.href = "opera:config#PersistentStorage|UserJSStorageQuota";
	    alert("Welcome to jsarmor !\n\n" +
		  "Script storage is currently disabled.\n" +
		  "For jsarmor to work, set quota to\n" +
		  "                 1000\n" +
		  "on the following page.");
	}
    }
    
    function scoped_setting(scope, name)
    {
	// to view content -> opera:webstorage  
	var o=scriptStorage.getItem(scoped_prefixes[scope] + name);
	if (o == null)
	    return '';
	return o;
    }

    var timestamp;			// settings timestamp    
    function set_scoped_setting(scope, name, value)
    {
	// don't bother if nothing actually changed.
	if (scoped_setting(scope, name) == value)
	    return;
	scriptStorage.setItem(scoped_prefixes[scope] + name, value);
	// update timestamp, so other instances can detect changes
	timestamp = 0 + Date.now();
	//alert("timestamp: " + timestamp);
	scriptStorage.setItem(scoped_prefixes[scope] + 'time', timestamp);
    }

    var scope;				// scoped settings are either per
					// page, site, domain, or global.
					//  (0,     1,     2,      3)
    
    var scoped_prefixes;		// prefixes
    
    function init_scope()
    {
	scoped_prefixes =
	[strip_url_tail(location.href) + ':', current_host + ':', current_domain + ':', ''];
	
	for (scope = 0; scope < 3; scope++)
	    if (setting('mode') != '')
		break;
	timestamp = setting('time');
    }

    var scoped_settings = ['mode', 'inline', 'nstags', 'hosts'];
    
    // copy settings over and change scope.
    function change_scope(new_scope)
    {
	if (scope == new_scope)
	    return;
	var old_scope = scope;
	for (var i = 0; i < scoped_settings.length; i++)
	{
	    scope = old_scope;
	    var s = setting(scoped_settings[i]);
	    // FIXME: should we remove them all ?
	    //        for (; scope < new_scope; scope++) 
	    if (new_scope > scope) // remove more specific setting
		set_setting(scoped_settings[i], '');
	    scope = new_scope;
	    set_setting(scoped_settings[i], s);
	}
    }

    function check_changed_settings()
    {
	var t = setting('time');
	if (t == timestamp)
	    return;		// nothing changed
	timestamp = t;
	load_global_settings(); // reload settings
	if (main_table)
	    repaint_ui_now();
	// FIXME: could reload page to use new settings if user wants to.
    }

    // Settings api
    function setting(name)
    {
	if (name == 'hosts' && scope == 3)
	    return scoped_setting(1, name);
	return scoped_setting(scope, name);
    }

    function set_setting(name, value)
    {	
	if (name == 'hosts' && scope == 3)
	    set_scoped_setting(1, name, value);
	else
	    set_scoped_setting(scope, name, value);
    }

    function global_setting(name)
    {
	return scoped_setting(3, name);
    }

    function set_global_setting(name, value)
    {
	set_scoped_setting(3, name, value);
    }

    function global_bool_setting(name, default_value)
    {
	var c = global_setting(name);
	c = (c == '' ? default_value : c == 'y');
	return c;
    }

    function set_global_bool_setting(name, val)
    {
	set_global_setting(name, (val ? 'y' : 'n'));	
    }
    
    function bool_setting(name, default_value)
    {
	var c = setting(name);
	c = (c == '' ? default_value : c == 'y');
	return c;
    }

    function set_bool_setting(name, val)
    {
	set_setting(name, (val ? 'y' : 'n'));	
    }
    
    // all hosts settings should be accessed through these so default val get translated
    function hosts_setting()
    {
       var hosts = setting('hosts');
       if (hosts == '') // current host allowed by default in filtered mode
           hosts = '. ' + current_host;
       return hosts;
    }
    
    function set_hosts_setting(hosts)
    {
       if (hosts == '. ' + current_host)
           hosts = '';
       set_setting('hosts', hosts);
    }


    /**************************** Mode and page stuff *************************/
    
    function reload_page()
    {
	// All of these reload from server ...
	//   location.reload(false);
	//   history.go(0);
	//   location.href = location.href;

	// Hack: simulate click on a link to reload from cache !
	var a = document.createElement('a');
	a.href = location.href;
	// a.innerText = 'this page';
	document.body.appendChild(a);
	
	// simulateClick() from
	// https://developer.mozilla.org/samples/domref/dispatchEvent.html
	var evt = document.createEvent("MouseEvents");
	evt.initMouseEvent("click", true, true, window,
			   0, 0, 0, 0, 0, false, false, false, false, 0, null);
	a.dispatchEvent(evt);	
    }
    
    function new_style(str)
    {
	var el= idoc.createElement('style');
	el.type= 'text/css';
	el.media= 'screen';
	el.appendChild(idoc.createTextNode(str));
	idoc.head.appendChild(el);
	return el;
    }

    function check_handle_noscript_tags()
    {
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
    
    function set_mode_no_update(new_mode)
    {
      if (mode != new_mode)
	  set_setting('mode', new_mode);
      mode = new_mode;
      
      if (new_mode == 'block_all')
      {
	  block_inline_scripts = bool_setting('inline',
					      default_block_inline_scripts);
	  handle_noscript_tags = bool_setting('nstags',
					      default_handle_noscript_tags);	  
      }      

      if (button_image)
	  set_icon_mode(button_image, mode);
    }

    // Set mode, repaint ui, and flag for reload
    function set_mode(new_mode)
    {
	set_mode_no_update(new_mode);
	need_reload = true;
	repaint_ui_now();
    }    

    var mode;				// block_all, filtered, relaxed, allow_all
    
    function init_mode()
    {
	mode = setting('mode');
	if (mode == '')
	    mode = default_mode; 
	set_mode_no_update(mode);
    }

    /***************************** iframe handling **************************/
    
    function init_iframe_logic()
    {
	iframe_logic = global_setting('iframe');
	if (iframe_logic == '')
	    iframe_logic = default_iframe_logic; 

	// running in iframe ? switch mode depending on iframe_logic	
	// FIXME: add way to override with page setting *only*, that should be safe.
	if (window != window.top)
	{
	    if (iframe_logic == 0)  // block all
		set_mode_no_update('block_all');	    
	    if (iframe_logic == 1)  // ask parent
	    {
		FIXME get parent hostname somehow;
		
		// does our parent allow us ?
		load_global_context(parent_hostname);
		var allowed = allowed_host(location.hostname);		
		clear_domain_nodes();	// wipe out hosts nodes this will have created
		load_global_context(location.hostname);

		if (!allowed)
		    set_mode_no_update('block_all');
		// else: allowed. treat it as a normal page: current mode applies.
	    }
	    // (iframe_logic == 2) treat as normal page: nothing to do, easy.
	}
    }

    // find iframes in the page and add their host so it shows up in the menu.
    function add_iframe_hosts()
    {
	// FIXME: what do we do with normal frames ?
	var iframes = document.getElementsByTagName('iframe');
	for (var j = 0; j < iframes.length; j++)
	{
	    var f = iframes[j];
	    // FIXME check what happens with weird urls (injected iframe, relative, local file ...)
	    var host = url_hostname(f.src);
	    add_iframe(f.src, host);
	}
    }

    function add_iframe(url, host)
    {
	var domain = get_domain(host);
	var i = new_script(url); // iframe really

	var domain_node = get_domain_node(domain, true);
	var host_node = get_host_node(host, domain_node, true);
	host_node.iframes.push(i);
	return s;
    }

    function iframe_icon(hn)
    {
	if (!hn.iframes)
	    return null;

	var n = hn.iframes.length;
	var icon = new_icon();
	icon.title = n + " iframe" + (n>1 ? "s" : "");
	//icon.title += " See details.";
	set_icon_image(icon, "iframe");
	return icon;
    }

    // FIXME iframe placeholder ?
    // FIXME get notified about new iframes
    // that should do it:
    //   DOMNodeInserted
    //   DOMNodeRemoved
    //   then repaint_ui()    
    
    
    /***************************** Domain, url utils **************************/    
    
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
	// FIXME: can't we just use the builtin parser like url_hostname() ?
	//        http://www.joezimjs.com/javascript/the-lazy-mans-url-parsing/
	u = strip_http(u);
	var a = u.match(/^([^/]*)\/([^/?&:]*)(.*)$/);
	if (!a)
	    alert("jsarmor.js: split_url(): shouldn't happen");
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
// too much crap gets in with this one (cdn.optimizely.com, cdn.demdex.com ...)
//		is_prefix("cdn.", h) ||
		is_prefix("code.", h));
    }
    
    /***************************** Host filtering *****************************/    
    
    function allow_host(host)
    {
	var l = hosts_setting();
	if (list_contains(l, host))
	    return;
	set_hosts_setting(l + ' ' + host);
    }

    function global_allow_host(host)
    {
	var l = global_setting('whitelist');
	l = (l == '' ? '.' : l);	
	if (list_contains(l, host))
	    return;
	set_global_setting('whitelist', l + ' ' + host);
    }
    
    function remove_host(host)
    {
	var l = hosts_setting();
	l = l.replace(' ' + host, '');
	set_hosts_setting(l);
    }

    function global_remove_host(host)
    {
      var l = global_setting('whitelist');
      l = l.replace(' ' + host, '');
      set_global_setting('whitelist', l);
    }
    
    function host_allowed_globally(host)
    {
	var l = global_setting('whitelist');
	return list_contains(l, host);
    }
    
    function host_allowed_locally(host)
    {
	var l = hosts_setting();
	return list_contains(l, host);
    }
    
    function filtered_mode_allowed_host(host)
    {
	return (
	    host_allowed_globally(host) ||
	    host_allowed_locally(host));
    }

    // cached in host_node.helper_host
    // dn arg optional
    function relaxed_mode_helper_host(host, dn)
    {
	dn = (dn ? dn : get_domain_node(get_domain(host)));
	return (dn.related ||
		((dn.helper || helper_host(host)) &&
		 !helper_blacklist[host]));
    }
    
    // allow related and helper domains
    function relaxed_mode_allowed_host(host)
    {	
	return (relaxed_mode_helper_host(host) ||
		filtered_mode_allowed_host(host));
    }

    // switch to filtered mode for this site,
    // allow every host allowed in relaxed mode, except host
    function relaxed_mode_to_filtered_mode(host)
    {
	if (scope == 3)  // FIXME: should we handle others ?
	    change_scope(1);
	set_mode('filtered');
	
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
      alert('jsarmor.js: mode="' + mode + '", this should not happen!');
    }

    /****************************** Misc utils ********************************/

    function list_contains(list, str)
    {
      return (list && list.indexOf(' ' + str) != -1);
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

    function raw_list_to_string(list)
    {
	var d = '';
	var comma = '';
	var a = list.split(' ');
	for (var i = 0; i < a.length; i++)
	{ 
	    if (a[i] != '.')
	    {
		d = d + comma + a[i];
		comma = '\n';
	    }
	}
	return d;
    }

    // suitable for textarea input
    function raw_string_to_list(str)
    {
	var a = str.split('\r\n'); // eeew
	var l = '. ';
	var sep = '';
	for (var i = 0; i < a.length; i++)
	{
	    if (a[i] != '')
	    {  // no blank lines
		l = l + sep + a[i];
		sep = ' ';
	    }
	}
	return l;
    }    

    function get_size_kb(x)
    {
	var k = new String(x / 1000);
	var d = k.indexOf('.');
	if (d)
	    return k.slice(0, d + 2);
	return k;
    }
    
    /****************************** UI primitives *****************************/

    function init_icons()
    {
    
      var native_icons = {
        "allowed":		"-o-skin('Transfer Success')",
	"blocked":		"-o-skin('Transfer Stopped')",
	"not_loaded":		"-o-skin('Transfer Size Mismatch')",
	"iframe":		"-o-skin('Menu Info')", // FIXME check how it looks in opera 12
	"allowed_globally":	"-o-skin('RSS')",      
	"block_all":		"-o-skin('Smiley Pacman')",
	"filtered":		"-o-skin('Smiley Cool')",
	"relaxed":		"-o-skin('Smiley Tongue')",
	"allow_all":		"-o-skin('Smiley Cry')"
      };

      var opera_11_icons = {
        "allowed":		'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAAVdEVYdENyZWF0aW9uIFRpbWUAMTkvNS8wOcYlgL0AAAGASURBVDiNpZPLK0RRHMc/xz3FxmNBSEosBkVXSpQyFqRYTB4Lq2ujbCby/AuUZDESCyuWUwwp2ciwF3cjbMjWCoW45xoLznXnwcL86tSv7+/7e/+OSCQSZCM5WXkDUitCCA+c3c0dAcYB8xuygeXF0NuG5ujKhacIwexubhEQ9zmmig10LobeHrSf9FuVMv5y5tsWB5o04M0gHC2wHFeajivJ9KzWKHVlIRxXmuFogZU2A6WMid/SdgbGaKzoI08WcXZ3ADABbCZVoFxpKleiXElNcQdaLy806W2Y4+X9kdX4iMa9Nr0AjjJwlEFL1TBT3TsMNc/jKAOrbQUQLBwM8PT67PEytCBtwDy5ihEobaerfhSzsoeS/ErWTya5vb/20+30AK4RATYA1o5m+EgIOgKDbJ1GiF/GgJ+sQEQrSXcwsFJ9jm+Nwdp+jq9iqTO1t8M3TZnvwJVB4FgHObzYS6XYQNAPJFWgpXepzuJrVf5TjuxPX25qTtop/1ey/o2ftG6clPyKKlYAAAAASUVORK5CYII=")',
	"blocked":		'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAAVdEVYdENyZWF0aW9uIFRpbWUAMTkvNS8wOcYlgL0AAAEHSURBVDiNpZNBagIxFIa/iAfoIRSKLXRc1YUL3XXRCwjCFC9QjzK9gOiqV+huNm66Mou2COMhPIB56aImTTIwgvND4OUlf/K/lz/KWksbdFqxga4LlFI+eViMX4BXIDunNPDWW23Xbo9TrnygFIfF+AYoA2IKDUx7q+3R8brhqjXSROa8VgJDl/A9qOajHCMZRrgwsmo+yms9sCdZhlf13z+jq6vZYzhdApv4ACNN0rFG0lISBfGGSwd4/PvAiI5qTRH3QdcVnKQA1m6+f35oElS4IPLBz9P9juZnBNCDj6+h48VWNjKplZJKNzIJKZECh+/pbc7fU4VWLu7K/caXnFr5WrT+jb97bZAgYc+wFgAAAABJRU5ErkJggg==")',
	"not_loaded":		'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADBQTFRFAAAA////AAAAAAAAAAAAAAAAAAAAAAAAkAAAlwAAtAAAvgAAyAAA0QAA2AAA3QAA7lpb0AAAAAh0Uk5TAAAMEx4wP0EqzeGOAAAAQElEQVQIW2MShAImBigAMT7JQxk2Rz5AGP8/KUAZH6FS/z/gZJzaBxO5+wDCMAtiQDPnzH2oCM9eqBrG9wIMDABr1Bip1wrS4AAAAABJRU5ErkJggg==")',
	"allowed_globally":	'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABV0RVh0Q3JlYXRpb24gVGltZQAxOS81LzA5xiWAvQAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAI4SURBVDiNlZNNSFRRGIafe+feuToqDWL5U4wmM+Mm0magsM20qEXSImgRhgTR376gTYtoWbQuMpcpuW0RrUIIwdCEMQO1CY0w/6AmlTv3zpyfFre8CVp44CzO4bzP974f5zNWHnUnXNfI+z5x9rAch2Ispjst1zXyhh2LJ44ksasd0Pq/4rJXZnWmEHddN2/5PoHY8NArcyA8YBeIYYLlEN3XyoGOJF8np+IWgF0VRS9PY195C4D+XkAvTaKmh9GbSyFAK6iU0D/miTYeBcD6c6/KIixUn8SoT2KmepAfhhETA9udCA9T6hCgpEYJjTdwBqMhReRwjkh7DqOuiUj2KkZzhvKrO2h/I4SoAGAC6N8A++wDzLYcojBCabCPyrugstlyjOj5xyiht7aWhAAlNVIoIgcz2F0XqbrwBOfcQ/ypl5Re3w8eNqSwjl9DCoUUCiXVdoASGm+0H7k6B0DkUIaay0NUFt7jjfYD4HRfh5rmwIXcIYI78pSfz3rZeH4D7W9iOLXEeu5RGhtC+5sARDO9O0UAJTTVp29T19ePkrD+4lbQ5UQWsyFNaWwwOLdmd3dQfeISdmuWWO4mfmEcsRzEsdOnKH+eCACNaZQMNKEDpVE6glgKBJXFmaAnH98EoqYOvE/j4X8yqrYcGDN3T+r6ljRUPMTaPLpc+uc8GE4NdmM70nIoLs5imUoW19e+xGv3t2EnOncV/oVAygobqwuYShYtS4lO4bv54rfZPY2zqWTRUrLrF4hoKuU62VtvAAAAAElFTkSuQmCC")',
	"block_all":		"-o-skin('Smiley Pacman')",
	"filtered":		"-o-skin('Smiley Cool')",
	"relaxed":		"-o-skin('Smiley Tongue')",
	"allow_all":		"-o-skin('Smiley Cry')"
      };

      icons = native_icons;
      var tmp = eval(icon_set + '_icons');
      if (typeof(tmp) != "object")
	  alert("jsarmor:\n\nerror initializing icons !");
      else
	  icons = tmp;
    }
    
    function new_icon(image)
    {
      var icon = idoc.createElement('img');
      icon.style = "width:22px;height:22px; vertical-align:middle;";
      if (image)
	  set_icon_image(icon, image);
      return icon;	
    }

    function icon_background_prop(image_name)
    {
	return icons[image_name] + " no-repeat center";
    }
    
    function set_icon_image(icon, image_name)
    {
	icon.style.background = icon_background_prop(image_name);
	icon.style.backgroundSize = "contain";
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
      item.className = 'noscript_item';
      if (child)
	  item.appendChild(child);
      if (indent)
	  item.style = "padding-left:" + (indent * 10 + 2) + "px;";
      item.innerHTML += text;
      if (f)
      {
	item.onmouseover = function(){ this.style.backgroundColor = '#ddd'; };
//	item.onmouseover = function(){ this.style.backgroundColor = '#fa4'; };
	item.onmouseout  = function(){ this.style.backgroundColor = 'transparent'; };
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
	{
	    item.style = "background-color:#fa4;";
	    //item.style = "background-color:#ddd;";
	    item.onmouseover = null;
	    item.onmouseout = null;
	}
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

    function add_table_item(table, col1, col2, col3, col4, col5, col6, col7, f, color)
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
//	tr.childNodes[0].style = "padding-left:" + (indent * 10) + "px;";
	tr.childNodes[3].style = "color: #888888; text-align:right;";
	if (color != '')
	    tr.childNodes[4].style.color = color;
	tr.childNodes[7].style = "text-align:right;";
	if (f)
	{
	    tr.onmouseover = function(){ this.style.backgroundColor = '#ddd'; };
//	    tr.onmouseover = function(){ this.style.backgroundColor = '#fa4'; };
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

    function add_radio_button(parent, text, current, target, f)
    {
	var r = idoc.createElement('input');
	r.type = 'radio';
	r.name = 'radio_group';
	r.number = target;
	r.checked = (current == target);
	r.onclick = function() { f(this.number); };
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

    function toggle_allow_inline(event)
    {
      block_inline_scripts = !block_inline_scripts;
      this.checkbox.checked = block_inline_scripts;
      this.nextSibling.style.display = (block_inline_scripts ? 'block' : 'none');
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

    /***************************** Settings menu *******************************/

    function edit_whitelist()
    {
	var nsmenu = idoc.createElement('div');
	nsmenu.id = 'noscript_menu';
	nsmenu.align = 'left';
	nsmenu.style="color: #333; border-radius: 5px; border-width: 2px; border-style: outset; border-color: gray;" +
	// "background:#abb9ca;" +
        "background: #ccc;" +
	// "background: #efebe7;" +
	"box-shadow: 8px 10px 10px rgba(0,0,0,0.5), inset 2px 3px 3px rgba(255,255,255,0.75);";

	var close_menu = function()
	{
	   td.removeChild(nsmenu);
	   resize_iframe();
	};
	
	var item = add_menu_item(nsmenu, "Global Whitelist");
	
	var text = idoc.createElement('textarea');
	text.rows = 15;
	text.cols = 40;
	// how do we add padding to this thing ??
	text.innerText = raw_list_to_string(global_setting('whitelist'));
	nsmenu.appendChild(text);

	var div = idoc.createElement('div');
	nsmenu.appendChild(div);		
	var button = idoc.createElement('button');
	button.innerText = "Save";
	button.onclick = function()
	{
	  set_global_setting('whitelist', raw_string_to_list(text.innerText));
	  close_menu();
	}
	div.appendChild(button);
	
	var button = idoc.createElement('button');
	button.innerText = "Cancel";
	button.onclick = close_menu;
	div.appendChild(button);	
	
	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(nsmenu);
	//idoc.body.appendChild(nsmenu);
	resize_iframe();
    }

    function is_default_bool_setting(k, val)
    {
	var check = function(c, default_value)
	{
	    c = (c == '' ? default_value : c == 'y');
	    return (c == default_value);
	};
	
	return ((k == 'inline' && check(val, default_block_inline_scripts)) ||
		(k == 'nstags' && check(val, default_handle_noscript_tags)));
    }
    
    // old settings names, not used anymore but could still be around after upgrade.
    function is_old_setting(k)
    {
	return (k == 'time' ||
		k === 'timestamp' ||
		is_prefix("noscript_", k));
    }
    
    function print_setting(host, settings)
    {
	var s = "";
	var prefix = (host == '' ? "" : host + ":")
	for (k in settings)
	{
	    var val = settings[k];
	    if (!is_old_setting(k) &&			// old names, not used anymore.
		!(host != '' && val == '') &&		// empty host setting
		!is_default_bool_setting(k, val)	// don't bother with default values
	       )
		s += (prefix + k + ":" + val + "\n");
	}
	return s;
    }

    function get_all_settings_by_host(glob, host_settings)
    {
	for (k in scriptStorage)
	{
	    var key = k;
	    var settings = glob;
	    if (key.indexOf(':') != -1)
	    {   // host:key format
		var host = k.slice(0, k.indexOf(':'));
		key = k.slice(k.indexOf(':') + 1);
		settings = host_settings[host];
		if (!settings)
		{
		    settings = {};
		    host_settings[host] = settings;
		}		
	    }
	    settings[key] = scriptStorage.getItem(k);
	}
    }
    
    function export_settings()
    {
	var glob = {};
	var host_settings = {};
	var s = "";
	get_all_settings_by_host(glob, host_settings)

	s += version + "\n\n";
	s += print_setting('', glob);
	s += "\nhost settings:\n";
	
	var hosts = get_keys(host_settings).sort();
	for (var i in hosts)
	{
	    var host = hosts[i];
	    var settings = print_setting(host, host_settings[host]);
	    // if there are still old settings lingering, we could end up with an empty string.
	    if (settings != "") 
		s += settings;
	}

	var url = "data:text/plain;base64," + btoa(s);
	location.href = url;
    }

    // make sure file looks like a valid settings file
    function import_check_file(a)
    {
	if (!is_prefix("jsarmor", a[0]))
	    return false;
	for (var i = 1; i < a.length; i++)
	{
	    if (a[i] != '' &&
	        a[i].indexOf(':') == -1)
		return false;
	}
	return true;
    }

    function import_settings(a)
    {
	var hosts_section = false;
	for (var i = 1; i < a.length; i++)
	{
	    var s = a[i];
	    if (s == 'host settings:')
	    {
		hosts_section = true;
		continue;
	    }
	    var j = s.indexOf(':');
	    if (j == -1)
		continue;
	    var parts = s.split(':');
	    var name = parts[0];
	    var val = parts[1];
	    if (hosts_section)
	    {
		name = parts[0] + ':' + parts[1];
		val = parts[2];
	    }
	    scriptStorage.setItem(name, val);
	}
    }
    
    function load_file(e)
    {
	var files = e.target.files; // FileList object
	var f = files[0];
	var reader = new FileReader();
	
	reader.onload = function(e)
	{
	    var s  = e.target.result;
	    var a = s.split('\n');
	    if (!import_check_file(a))
	    {
		alert("jsarmor:\n\nThis file doesn't look like a valid settings file.");
		return;
	    }
	    // clear settings.
	    scriptStorage.clear();
	    import_settings(a);
	    alert("jsarmor:\n\nLoaded !");
	};
	
	reader.readAsBinaryString(f);
	//reader.readAsText(f);
    }

    // or use Object.keys(obj) if browser supports it.
    function get_keys(obj)
    {
	var keys = [];
	for(var key in obj)
	    keys.push(key);
	return keys;
    }

    function reset_settings()
    {
	if (!confirm("WARNING: All settings will be cleared !\n\nContinue ?"))
	    return;
	scriptStorage.clear();
    }

    
    function options_menu()
    {
	var nsdetails = idoc.createElement('div');
	nsdetails.align = 'left';
	nsdetails.style="color: #333; border-radius: 5px; border-width: 2px; border-style: outset; border-color: gray;" +
	// "background:#abb9ca;" +
        "background: #ccc;" +
	// "background: #efebe7;" +
	"box-shadow: 8px 10px 10px rgba(0,0,0,0.5), inset 2px 3px 3px rgba(255,255,255,0.75);";
	nsdetails.style.minWidth = "250px";
//        nsdetails.style.display = 'inline-block';

	// FIXME: sane menu logic to handle different menus
	var need_reload = false;
	nsdetails.onmouseout = function(e)
	{
	   if (!mouseout_leaving_menu(e, nsdetails))
	       return;	   
	   td.removeChild(nsdetails);
	   resize_iframe();
	   if (need_reload)
	       reload_page();
	};
	
	var item = add_menu_item(nsdetails, "Options");
	item.align = 'center';
	item.className = 'noscript_title';

	var wrap = function(f)
	{ return function()
	  {
	    td.removeChild(nsdetails);
	    f();
	  };
	};
	
	var item = add_menu_item(nsdetails, "Edit whitelist...", 2, wrap(edit_whitelist));

	var item = add_menu_item(nsdetails, "iframe logic", 2);
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
	var checkbox = make_checkbox(global_bool_setting("iframe_ui", default_iframe_ui));
	var item = add_menu_item(nsdetails, "Show jsarmor interface for each iframe", 0, f, checkbox);
	item.checkbox = item.firstChild;       

	var item = add_menu_item(nsdetails, "Reload method", 2);	
	
	add_menu_separator(nsdetails);	

	var item = add_menu_item(nsdetails, "Help", 0, function() { location.href = help_url; });
	var item = add_menu_item(nsdetails, "Clear all settings", 0, reset_settings);	
	
	// Import Settings
	var form = idoc.createElement('form');
	form.id = "import_form";
	form.innerHTML = "<input type=file id=import_btn autocomplete=off >Import Settings...";
	var item = add_menu_item(nsdetails, "", 0, function() {}, form);
	item.firstChild.firstChild.onchange = load_file;

	var item = add_menu_item(nsdetails, "Export Settings...", 0, export_settings);	
	var item = add_menu_item(nsdetails, "About");		

	var td = idoc.getElementById('td_nsmenu');
	td.appendChild(nsdetails);

	//show_hide_menu(false);
	resize_iframe();
        nsdetails.style.display = 'inline-block';
    }    
    
    /***************************** Details menu *******************************/
    
    function show_details()
    {	
	var nsdetails = idoc.createElement('div');
	nsdetails.align = 'left';
	nsdetails.style="color: #333; border-radius: 5px; border-width: 2px; border-style: outset; border-color: gray;" +
	// "background:#abb9ca;" +
        "background: #ccc;" +
	// "background: #efebe7;" +
	"box-shadow: 8px 10px 10px rgba(0,0,0,0.5), inset 2px 3px 3px rgba(255,255,255,0.75);";
	
//        nsdetails.style.display = 'inline-block';

	nsdetails.onmouseout = function(e)
	{
	   if (!mouseout_leaving_menu(e, nsdetails))
	       return;	   
	   td.removeChild(nsdetails);
	   resize_iframe();	   
	};
	
	var item = add_menu_item(nsdetails, "Scripts");
	item.align = 'center';
	item.className = 'noscript_title'

	// FIXME show iframes urls somewhere
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
	td.appendChild(nsdetails);

	item = add_menu_item(nsdetails, "Options ...", 0, function()
			     {
			       td.removeChild(nsdetails);
			       options_menu();
			     });
	
	show_hide_menu(false);
        nsdetails.style.display = 'inline-block';
    }
   
    /****************************** Main menu *********************************/
        
    var nsmenu = null;
    var need_reload = false;
    function create_menu()
    {
	nsmenu = idoc.createElement('div');
	nsmenu.id = 'noscript_menu';
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
	
	var item = add_menu_item(nsmenu, "JSArmor");
	item.title = version + ". Click to view global settings.";
	item.align = 'center';
	item.className = 'noscript_title'
        // item.style = 'background-color:#0000ff; color:#ffffff; font-weight:bold;';
	item.onclick = function(event)
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
	
	item = add_menu_item(nsmenu, "Set for: ", 0, null);
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
	    var checkbox = make_checkbox(block_inline_scripts);
	    var label = "Block Inline Scripts";
	    item = add_menu_item(nsmenu, label, 1, toggle_allow_inline, checkbox);
	    item.checkbox = item.firstChild;
	    add_right_aligned_text(item, " [" + get_size_kb(total_inline_size) + "k]");
	
	    var checkbox = make_checkbox(handle_noscript_tags);
	    var label = "Pretend Javascript Disabled";
	    item = add_menu_item(nsmenu, label, 1, toggle_handle_noscript_tags, checkbox);
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
  	    if (reltg.id == 'noscript_button')
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
	  set_global_icon_ui(this.icon, host_allowed_globally(h))

	  if (mode != 'filtered' && mode != 'relaxed')
	      set_mode('filtered');

	  // blocking related/helper host in relaxed mode ? switch to filtered mode.
	  // (related/helper hosts are always allowed in relaxed mode)
	  if (mode == 'relaxed' && relaxed_mode_helper_host(h))
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
	foreach_host_node(function(hn, dn)
	{
	    var d = dn.name;
	    var h = hn.name;
	    var checkbox = make_checkbox(allowed_host(h));
	    var host_part = h.slice(0, h.length - d.length);
	    var not_loaded = icon_not_loaded(hn, checkbox.checked);
	    var count = "[" + hn.scripts.length + "]";
	    var color = (hn.helper_host ? '#000' : '');
	    var icon = idoc.createElement('img');   // globally allowed icon
	    var iframes = iframe_icon(hn);
	    item = add_table_item(table, not_loaded, checkbox, host_part, d, icon, iframes, count, f, color);
	    
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
    
    /***************************** Main table *********************************/
    
    var main_table = null;
    function create_main_table()
    {
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
    
    /**************************** Injected iframe logic ***********************/
    
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
\n\
#import_form {display:inline-block;position:relative;overflow:hidden;vertical-align:text-bottom} \n\
#import_btn {display:block;position:absolute;top:0;right:0;margin:0;border:0;opacity:0} \n\
\n\
input[type=radio]         { display:none; } \n\
input[type=radio] + label:hover   { background-color: #ddd; } \n\
input[type=radio] + label { \n\
	box-shadow:inset 0px 1px 0px 0px #ffffff; \n\
	border-radius:6px; \n\
	border:1px solid #dcdcdc; \n\
	background-color: #c7c7c7;  \n\
	display:inline-block; \n\
	padding:1px 5px; \n\
	text-decoration:none; } \n\
input[type=radio]:checked + label { background-color: #fa4; } \n\
.noscript_global { padding: 0px 3px; width:14px; height:14px; vertical-align:middle; \
    background:" + icon_background_prop("allowed_globally") + "; background-size:contain; } \n	\
";

	// -o-linear-gradient(top, #FFFFFF 0px, #CCCCCC 100%) #E5E5E5;
	
	new_style(noscript_style);
	idoc.body.style.margin = '0px';
	create_main_table();
	parent_main_table();
	resize_iframe();
    }

    function resize_iframe()
    {
	var content = idoc.body.firstChild;
	//iframe.style.width = content.clientWidth + 'px';
	//iframe.style.height = content.clientHeight + 'px';
	iframe.style.width = content.scrollWidth + 'px';
	iframe.style.height = content.scrollHeight + 'px';
    }    	    
    
    var iframe = null;
    var idoc = null;
    function create_iframe()
    {
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
	document.body.appendChild(iframe);
    }

    
    /**************************** Scripts store *******************************/
    
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
	n.helper_host = relaxed_mode_helper_host(host, domain_node); // caching
	hosts.push(n);
	return n;
    }

    function clear_domain_nodes()
    {
	domain_nodes = [];
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

    function find_script(url, host)
    {
	var domain = get_domain(host);	
	var domain_node = get_domain_node(domain, false);
	if (!domain_node)
	{
	    alert("jsarmor.js: get_domain_node() failed! should not happen.");
	    return null;
	}
	var host_node = get_host_node(host, domain_node, false);
	var scripts = host_node.scripts;
	for (var i = scripts.length - 1; i >= 0; i--)
	    if (scripts[i].url == url)
		return scripts[i];
	alert("jsarmor.js: find_script(): should not happen.");
	return null;
    }

    // call f(host_node, domain_node) for every hosts
    function _foreach_host_node(f)
    {
	for (var i = 0; i < domain_nodes.length; i++)
	{
	    var hosts = domain_nodes[i].hosts;
	    for (var j = 0; j < hosts.length; j++)
		f(hosts[j], domain_nodes[i]);
	}
    }

    // same but in relaxed mode order:
    // helper hosts first, then the rest
    function foreach_host_node(f)
    {
	_foreach_host_node(function (hn, dn)
	{
	    if (hn.helper_host)
		f(hn, dn);
	});

	_foreach_host_node(function (hn, dn)
	{
	    if (!hn.helper_host)
		f(hn, dn);
	});
    }

    function sort_domains()
    {
	domain_nodes.sort(function(d1,d2)
	{
	    // current domain goes first
	    if (d1.name == current_domain || d2.name == current_domain)
		return (d1.name == current_domain ? -1 : 1);
	    // then related domains 
	    if (d1.related ^ d2.related)
		return (d1.related ? -1 : 1);
	    // Note: sorting between helper/non helper host done in foreach_host_node()
	    // then blacklisted helper domains
	    if (d1.helper ^ d2.helper)
		return (d1.helper ? -1 : 1);	    
	    return (d1.name < d2.name ? -1 : 1);
	});
    }

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
    
    /****************************** Handlers **********************************/
    
    var blocked_current_host = 0;
    var loaded_current_host = 0;
    var total_current_host = 0;
    
    var blocked_external = 0;
    var loaded_external = 0;
    var total_external = 0;

    var total_inline = 0;
    var total_inline_size = 0;

    // Handler for both inline *and* external scripts
    function beforescript_handler(e)
    {
      if (e.element.src) // external script
	  return;
      
      total_inline++;
      total_inline_size += e.element.text.length;
      
      if (main_table)
	  repaint_ui();
      
      if (block_inline_scripts)
	e.preventDefault();
    }

    function beforeextscript_handler(e)				 
    {
        if (e.element.tagName.toLowerCase() != 'script')
	{
	  alert("jsarmor.js: BeforeExternalScript: non <script>: " + e.element.tagName);
	  return;
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

        if (!allowed)
	    e.preventDefault();
	if (main_table)
	    repaint_ui();
    }

    // Find out which scripts are actually loaded,
    // this way we can find out if *something else* is blocking
    // (blocked content, bad url, syntax error...). Awesome!    
    function beforeload_handler(ev)
    {
	var e = ev.event.target;
        if (!e || !e.tagName || e.tagName.toLowerCase() != 'script' || !e.src)
	    return; // not an external script.	    
	var host = url_hostname(e.src);
	var script = find_script(e.src, host);

	if (host == current_host)
	    loaded_current_host++; 
	else
	    loaded_external++;
	script.loaded = 1;

	if (nsmenu)
	    repaint_ui();
    }
    
    function domcontentloaded_handler()
    {
	add_iframe_hosts();
	
        if (!domain_nodes.length && !total_inline) 
            return;  // no scripts ? exit.

	if (block_inline_scripts)
	    check_handle_noscript_tags();

	// display ui in frame / iframe ?
	if (window != window.top &&
	    !global_bool_setting("iframe_ui", default_iframe_ui))
	    return;
	
	create_iframe();
    }

    /**************************** Handlers setup ***************************/
    
    function init_handlers()
    {
    	opera.addEventListener('BeforeScript',	       wrap_handler(beforescript_handler), false);
	opera.addEventListener('BeforeExternalScript', wrap_handler(beforeextscript_handler), false);
	opera.addEventListener('BeforeEvent.load',     wrap_handler(beforeload_handler), false);
	document.addEventListener('DOMContentLoaded',  wrap_handler(domcontentloaded_handler), false);
    }

    function wrap_handler(h)
    {
	return function(e){ call_handler(h, e); };
    }
    
    function call_handler(h, e)
    {
	if (!init)
	    alert("jsarmor\n\nevent received before init finished !!!\nIgnoring.");
	else
	    h(e);
    }
    
})(window.document, window.location, window.opera, window.opera.scriptStorage);

