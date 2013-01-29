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


// When running as userjs, document and window.document are the same,
// but when running as an extension they're 2 different things, beware !
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
    
    
    // default mode for new pages:
    //   block_all, filtered, relaxed or allow_all    
    var default_mode = 'relaxed';

    // block inline scripts by default for block_all mode ?
    var default_block_inline_scripts = true;

    // when inline scripts are blocked, handle <noscript> tags
    // as if javascript was disabled in opera
    var default_handle_noscript_tags = true;

    // 0: block all   1: ask parent   2: normal page
    var default_iframe_logic = 1;

    
    /********************************* Globals *********************************/

    /** stuff load_global_settings() takes care of **/
    var current_host;
    var current_domain;    
    var block_inline_scripts = false;
    var handle_noscript_tags = false;
    var iframe_logic;
    
    
    /********************************* Init ************************************/    
    
    // jsarmor ui's iframe, don't recurse !
    if (window != window.top &&
	window.name == 'jsarmor_iframe')
	return;
    
    var init = false;			// see call_handler();
    if (true)
    {
	init_handlers();
	check_script_storage();
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
	current_host = host;
	current_domain = get_domain(host);
	
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
	if (main_ui) //UIFIXME
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

    /**************************** Import/export settings *************************/
    
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
	var prefix = (host == '' ? "" : host + ":");
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

    function reset_settings()
    {
	if (!confirm("WARNING: All settings will be cleared !\n\nContinue ?"))
	    return;
	scriptStorage.clear();
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
// UIFIXME
//      if (button_image)
//	  set_icon_mode(button_image, mode);
    }

// UIFIXME
    // Set mode, repaint ui, and flag for reload
    function set_mode(new_mode)
    {
	set_mode_no_update(new_mode);
	need_reload = true;
	repaint_ui_now();
    }    

    var mode;				// current_mode
    var modes = [ 'block_all', 'filtered', 'relaxed', 'allow_all' ];
    
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
	
	if (window == window.top)
	    return;
	
	// running in iframe. switch mode depending on iframe_logic
	// FIXME: add way to override with page setting *only*, which should be safe enough
	
	if (iframe_logic == 0)  // block all
	    set_mode_no_update('block_all');	    
	if (iframe_logic == 1)  // ask parent
	{
	    //FIXME find a real solution to get parent hostname somehow;
	    //alert("In iframe parent logic!\n" + document.referrer);
	    console.log("my window.name: " + window.name);
	    return;
	    if (!is_prefix("jsarmor:", window.name))
	    {
		alert("jsarmor, running inside iframe:\n\n we're screwed. (window.name=" + window.name + ")");
		return;
	    }
	    var o = window.name.indexOf(':');
	    var parent_hostname = window.name.slice(o + 1);
	    alert("got window:" + parent_hostname);
	    
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
	    //alert("in parent");
	    f.contentWindow.name = "yoeuoeuoue";
	    //f.contentWindow.name = "jsarmor:" + current_host;
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
	return i;
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
	    my_alert("split_url(): shouldn't happen");
	return a.slice(1);
    }
    
    function strip_url_tail(u)
    {
	var a = split_url(u);
	return a[0] + '/' + a[1]; // dir + file
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
      my_alert('mode="' + mode + '", this should not happen!');
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
	n.iframes = [];
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
	    my_alert("get_domain_node() failed! should not happen.");
	    return null;
	}
	var host_node = get_host_node(host, domain_node, false);
	var scripts = host_node.scripts;
	for (var i = scripts.length - 1; i >= 0; i--)
	    if (scripts[i].url == url)
		return scripts[i];
	my_alert("find_script(): should not happen.");
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
      
      if (main_ui) //UIFIXME
	  repaint_ui();
      
      if (block_inline_scripts)
	e.preventDefault();
    }

    function beforeextscript_handler(e)				 
    {
        if (!element_tag_is(e.element, 'script'))
	{
	  my_alert("BeforeExternalScript: non <script>: " + e.element.tagName);
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
	if (main_ui) // UIFIXME
	    repaint_ui();
    }

    // Find out which scripts are actually loaded,
    // this way we can find out if *something else* is blocking
    // (blocked content, bad url, syntax error...). Awesome!    
    function beforeload_handler(ev)
    {
	var e = ev.event.target;
        if (!e || !e.tagName || !element_tag_is(e, 'script') || !e.src)
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

//UIFIXME    
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

    // guard against race conditions which come up when running as extension.    
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


    /********************************* Core ui *********************************/

    // whether to show jsarmor ui inside frames / iframes
    var default_iframe_ui = false;

    var help_url = "https://github.com/lemonsqueeze/jsarmor/wiki";

    // use stored custom style and layout ?
    var enable_custom_style = false;
    var enable_custom_layout = false;

    // load style from an external css.
    // *note* this only works locally, won't work on remote sites.
    // this is really nice for testing as you can just edit your css file directly.
    // - set this to true, reload.
    // - save jsarmor.css somewhere, put its address as a 'file:///...' url
    //   in options menu, edit css url
    // - open a good local html for testing, (test_offline/ in the repo has one)
    // - edit css file, just reload to test changes !
    //   (switch opera to offline mode for instantaneous reloads!)
    // to revert set back to false, or set blank url.
    var enable_external_css = false;


    /********************************* Style *********************************/

    // inject style as plain text with a <style> element.
    function new_style(str)
    {
	var el = idoc.createElement('style');
	el.type = 'text/css';
	el.media = 'screen';
	el.appendChild(idoc.createTextNode(str));
	idoc.head.appendChild(el);
	return el;
    }

    // use external css for styling.
    function add_css_link(url)
    {
	var link = idoc.createElement('link');
	link.rel = "stylesheet";
	link.type = "text/css";
	link.href = url;
	idoc.head.appendChild(link);
    }

    /****************************** Widget API *************************/

    // cache of widget nodes so we don't have to use innerHTML everytime
    //var cached_widgets;
    
    // layout of interface used in jsarmor's iframe
    function init_layout()
    {
	//cached_widgets = new Object();

	// allow uppercase widget names, will be convenient later on...
	var n = widgets_layout;
	for (var i in widgets_layout)
	    n[i.toUpperCase()] = widgets_layout[i];
	widgets_layout = n;
	
	// use custom layout ?
	//var html = (enable_custom_layout ? global_setting('html') : '');
	//html = (html != '' ? html : builtin_html);
	
	// special classes
	idoc.body.className = "body";
    }

    // create ui elements from html strings in widgets_layout. this one is for normal
    // (single node) widgets. nested widgets are created as well unless they have the
    // "lazy" attribute.
    function new_widget(name)
    {
	var wrap = new_wrapped_widget(name);
	if (wrap.children.length > 1)
	    my_alert("new_widget(" + name + "):\n" +
		     "this isn't a single node widget, call new_wrapped_widget() instead !");
	return wrap.firstChild;
    }

    // widgets with the "lazy" attribute are not created until this is called.
    function wakeup_lazy_widgets(tree)
    {
	create_nested_widgets(tree, true);
    }

    // FIXME we should know widget_name, we created these things !
    // FIXME add placeholder_id arg, this only works for unique placeholders ...
    function parent_widget(widget, widget_name, tree) 
    {
	var l = tree.getElementsByTagName(widget_name);
	for (var i = 0; i < l.length; i++)
	{
	    var n = l[i];
	    if (!n.hasAttribute('lazy'))
		continue;
	    replace_widget(widget, n);
	    return;
	}
	my_alert("parent_widget() couldn't find placeholder for " + widget_name);
    }
    
    
    /**************************** Internal widget functions ***********************/

    // FIXME check for duplicate ids ?
    
    // same as new_widget() but returns the <widget> wrapper. this is necessary if
    // the widget is actually a forest... (.forest is set on the div in this case)
    // placeholder is optional (the new widget gets its its attributes)
    function new_wrapped_widget(name, placeholder)
    {
	name = name.toLowerCase();
	// do we have this guy in cache ? use that then
	//if (cached_widgets[name])
	// return cached_widgets[name].cloneNode(true);

	var layout = widgets_layout[name];
	if (!layout)
	{
	    my_alert("new_widget(" + name + "): the layout for this widget is missing!");
	    return null;
	}		    

	// otherwise create a new one...
	var d = idoc.createElement('foo');
	d.innerHTML = layout;
	var wrap = d.firstChild;	// the <widget> element
	if (!wrap)
	{
	    my_alert("new_widget(" + name + "):\n" +
		     "couldn't create this guy, check the html in widgets_layout.");
	    return null;
	}
	var content = wrap.firstChild;	
	if (wrap.children.length > 1)
	    wrap.forest = true;

	setup_widget_event_handlers(wrap, name);
	call_oninit_handlers(wrap);
	create_nested_widgets(wrap, false);
	init_widget(wrap, content, name, placeholder);
	
	// cached_widgets[id] = d.firstChild;
	//return widget.cloneNode(true);
	return wrap;
    }

    // copy attributes from placeholder, and call init handler if needed:
    // if widget "foo" has the 'init' attribute, then foo_init(widget) is called.
    // we could call function foo_init() automatically if it exists, but that would open a nice hole:
    // if the page's scripts have such a handler and we didn't define one, now it'd get called !
    function init_widget(wrap, content, name, ph)
    {
	// for empty widgets, pass attributes in wrap instead
	content = (content ? content : wrap);
	if (ph)
	{
	    for (var i = 0; i < ph.attributes.length; i++)
	    {
		var a = ph.attributes[i];
		if (a.value.charAt(0) == "`")  // "`" means eval attribute 
		    content[a.name] = eval(a.value.slice(1));
		else
		    content[a.name] = a.value;
	    }
	}

	if (wrap.hasAttribute('init'))
	{
	    var fname = name.toLowerCase() + "_init";	    
	    (eval(fname))(content);
	}
    }

    function call_oninit_handlers(widget)
    {
	foreach_node(widget, function(node)
	{
	    if (node.oninit)
		(node.oninit)(node);
	});
    }    
    
    function is_widget_placeholder(widget)
    {
	return (widgets_layout[widget.tagName] != null);
    }

    function create_nested_widgets(widget, ignore_lazy)
    {
	// NodeLists are live so we can't walk and change the tree at the same time.
	// so get all the nodes to replace first, then do it.
	var from = [], to = [];
	foreach_node(widget, function(n)
        {
	    if (!is_widget_placeholder(n) ||
		(!ignore_lazy && n.hasAttribute('lazy')))
		return;
	    from.push(n);
	    to.push(new_wrapped_widget(n.tagName, n));
	});

	for (var i = 0; i < to.length; i++)
	    replace_wrapped_widget(to[i], from[i]);
    }

    function wrapped_widget_name(wrapped)
    {
	return wrapped.getAttribute('name');
    }
    
    function replace_wrapped_widget(to, from)
    {
	// sanity check ...
	if (from.children.length)
	    my_alert("found a <" + wrapped_widget_name(to) +
		     "> placeholder widget with children, this really shouldn't be happening !");
	    
	if (!to.firstChild) // empty widget ...
	{
	    from.parentNode.removeChild(from);
	    return;
	}
	    
	if (!to.forest) // simple case: only one node
	{
	    from.parentNode.replaceChild(to.firstChild, from);
	    return;
	}

	while (to.children.length)
	    from.parentNode.insertBefore(to.firstChild, from);
	from.parentNode.removeChild(from);
    }

    // replace placeholder with actual widget    
    function replace_widget(to, from)
    {
	replace_wrapped_widget(to.parentNode, from);
    }

    //FIXME add the others
    var is_handler_attribute = { 'oninit':1, 'onclick':1, 'onmouseover':1, 'onmouseout':1, 'onmousedown':1, 'onload':1};


    // if we load some html like <div onclick="f"> it won't work because the handler
    // will get evaluated in global context, which we do not own as userjs script.
    // so we have a little plumbing to do here ...
    // handler values can be left empty: <div onclick> means <div onclick="widgetname_onclick()">
    function setup_widget_event_handlers(widget, name)
    {
	function create_handler(expr)
	{
	    return eval(expr);  // direct function call
	    // return eval("function(){" + expr + "}");
	}	
	
	var l = widget.getElementsByTagName('*');
	for (var i = 0; i < l.length; i++)
	{
	    var node = l[i];
	    for (var j = 0; j < node.attributes.length; j++)
	    {
		var a = node.attributes[j];
		if (is_handler_attribute[a.name])
		{
		    if (a.value != "")
			node[a.name] = create_handler(a.value);
		    else
			node[a.name] = eval(name + "_" + a.name);
		    console.log(name + ": handler " + a.name + " = ...");
		    
                    // call oninit handlers.
		    // FIXME: this is probably not the best order to do things in
		    //if (a.name == 'oninit')
		    //(node.oninit)();
		}
	    }
	}
    }

/*
    function add_widget(widget_id, parent_id)
    {
	var p = get_widget(parent_id);
	var w = new_widget(widget_id);
	p.appendChild(w);
	return w;
    }
 */

    /**************************** Injected iframe logic ***********************/

    // interface style used in jsarmor's iframe
    function init_style()
    {
	if (enable_external_css)
	{
	    // use external .css file ?
	    var css = global_setting('css');
	    if (css != '')
	    {
		add_css_link(css);
		return;
	    }
	}

	// use custom style ?
	var style = (enable_custom_style ? global_setting('style') : '');
	style = (style == '' ? builtin_style : style);
	new_style(style);
    }
    
    function populate_iframe()
    {
	iframe.contentWindow.name = 'jsarmor_iframe';
	idoc = iframe.contentWindow.document;

	// set doctype, we want strict mode, not quirks mode!
	idoc.open();
	idoc.write("<!DOCTYPE HTML>\n<html><head></head><body></body></html>");
	idoc.close();

	init_style();
	init_layout();	
	create_main_ui();
	parent_main_ui();
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
	iframe.id = 'jsarmor_iframe';
	iframe.style = "position:fixed !important;width:auto !important;height:auto !important;background:transparent !important;white-space:nowrap !important;z-index:99999999 !important;direction:ltr !important;font-family:sans-serif !important; font-size:small !important; margin-bottom:0px !important;" +
	
// "width: 300px !important; height: 100px !important;"
	"margin-top: 0px !important; margin-right: 0px !important; margin-bottom: 0px !important; margin-left: 0px !important; padding-top: 0px !important; padding-right: 0px !important; padding-bottom: 0px !important; padding-left: 0px !important; border-top-width: 0px !important; border-right-width: 0px !important; border-bottom-width: 0px !important; border-left-width: 0px !important; border-top-style: none !important; border-right-style: none !important; border-bottom-style: none !important; border-left-style: none !important; background-color: transparent !important; visibility: visible !important; content: normal !important; outline-width: medium !important; outline-style: none !important; background-image: none !important; min-width: 0px !important; min-height: 0px !important; " +
	
//	"border: 1px solid #CCC !important; " +	
	(cornerposition < 3 ? 'top': 'bottom') + ':1px !important;' + (cornerposition % 2 == 1 ? 'left': 'right') + ':1px !important;';
	iframe.scrolling="no";
	iframe.allowtransparency="true";
	
	iframe.onload = populate_iframe;
	document.body.appendChild(iframe);
    }


    /**************************** Node functions *******************************/

    function element_tag_is(el, tag)
    {
	return (el.tagName &&
		el.tagName.toLowerCase() == tag);
    }

    // FIXME, optimize all this
    function get_by_id(parent, id)
    {
	var root_node = get_root_node(parent);
	if (root_node && element_tag_is(root_node, "html"))
	    return idoc.getElementById(id);

	// unparented, do it by hand ...
	if (!parent)
	    alert("parent is null !!");
	l = parent.getElementsByTagName("*");
	for (var i = 0; i < l.length; i++)
	    if (l[i].id == id)
		return l[i];
	return null;
    }
    
    // find element in parent with that id or class_name
    function find_element(parent, class_name)
    {
	return _find_element(parent, class_name, false, "find_element");
    }

    function _find_element(parent, class_name, unique, fname)
    {
	var id = get_by_id(parent, class_name);
	if (id)
	    return id;
	
	// try className then ...
	var l = getElementsByClassName(parent, class_name);
	if (l.length == 1)
	    return l[0];
	if (!l.length)
	{
	    my_alert(fname +"(" + class_name + "):\n couldn't find element by that name !");
	    return null;
	}
	if (unique)	// should be unique ?
	{
	    my_alert(fname +"(" + class_name + "): multiple matches !");
	    return null;
	}
	return l[0];	// return first match.
    }

    
    function getElementsByClassName(node, classname)
    {
	if (node.getElementsByClassName) { // use native implementation if available
	    return node.getElementsByClassName(classname);
	} else {
	    return (function getElementsByClass(searchClass,node) {
		    if ( node == null )
			node = idoc;
		    var pattern = new RegExp("(^|\\s)"+searchClass+"(\\s|$)"), i, j;

		    // does parent itself match ?
		    if (pattern.test(node.className))
			return [node];
			
		    var classElements = [];
		    var els = node.getElementsByTagName("*");
		    var elsLen = els.length;
		    for (i = 0, j = 0; i < elsLen; i++) {
			if ( pattern.test(els[i].className) ) {
			    classElements[j] = els[i];
			    j++;
			}
		    }
		    return classElements;
		})(classname, node);
	}
    }

    function get_root_node(n)
    {
	var p = null;
	for (; n && p != n; n = n.parentNode)
	    p = n;
	return n;
    }

    function replace_nodes_if(matches, root, new_node)
    {
	foreach_child(root, function(n)
	  {
	      if (matches(n))
		  n.parentNode.replaceChild(new_node(n), n);
	  });
	
	foreach_child(root, function(n)
	  {
	      replace_nodes_if(matches, n, new_node);
	  });    
    }

    function foreach_child(n, f)
    {
	foreach(n.children, f);
    }

    function foreach_node(n, f)
    {
	f(n);
	foreach_down_node(n, f);
    }

    function foreach_down_node(n, f)
    {
	foreach(n.getElementsByTagName('*'), f);
    }

    /**************************** List utils *******************************/

    function foreach(l, f)
    {
	try
	{
	    for (var i = 0; i < l.length; i++)
		f(l[i]);
	}
	catch(e)
	{
	    if (e != "stop_foreach")
		throw(e);
	}
    }

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

    
    /**************************** String functions *******************************/
    
    function is_prefix(p, str)
    {
	return (str.slice(0, p.length) == p);
    }
    
    /**************************** Misc utils *******************************/

    function get_size_kb(x)
    {
	var k = new String(x / 1000);
	var d = k.indexOf('.');
	if (d)
	    return k.slice(0, d + 2);
	return k;
    }
    
    function my_alert(msg)
    {
	alert("jsarmor:\n\n" + msg);
    }

    // or use Object.keys(obj) if browser supports it.
    function get_keys(obj)
    {
	var keys = [];
	for(var key in obj)
	    keys.push(key);
	return keys;
    }
    


    /********************************* Builtin ui *********************************/

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
      item.className = 'menu_item';
      if (child)
	  item.appendChild(child);
      if (indent)				// CSSFIXME find a better way
	  item.className += " indent" + indent;
      item.innerHTML += text;
      if (f)
      {
	  item.className += " active";
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
	    item.className = " selected";
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
	tr.childNodes[3].className = 'host';
	tr.childNodes[4].className = 'domain';
	if (helper_host)
	    tr.childNodes[4].className += ' helper';
	tr.childNodes[7].className = 'script_count';
	if (f)
	{
	    tr.className = 'active';
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

    function checkbox_item_init(li)
    {
	li.innerHTML += li.label; // hack
	setup_checkbox_item(li, li.state, li.callback);
    }
    
    function setup_checkbox_item(widget, current, f)
    {
	var checkbox = widget.getElementsByTagName('input')[0];
	widget.checkbox = checkbox;
	checkbox.checked = current;
	widget.onclick = f;
    }

    function init_scope_buttons(widget)
    {	
	setup_radio_buttons(widget, scope, change_scope);
    }

    function setup_radio_buttons(widget, current, f)
    {
	var l = widget.getElementsByTagName('input');

	for (var i = 0; i < l.length; i++)
	{
	    var radio = l[i];
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
	icon.className = 'img_global';
	if (host_allowed_globally(host))
	    icon.className += ' visible';	
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
	menu.className = 'main_menu';
	if (title != "")
	{
	    var item = add_menu_item(menu, title);
	    item.className = 'title';
	}	
	return menu;
    }

    var nsmenu = null;			// the main menu
    var need_reload = false;

    function main_menu_onmouseout(e)
    {
	if (!mouseout_leaving_menu(e, nsmenu))
	    return;
	show_hide_menu(false);
	if (need_reload)
	    reload_page();
    }

    function menu_title_init()
    {
	this.title = version;
    }
    
    function create_menu()
    {
	nsmenu = new_widget("main_menu");
	nsmenu.style.display = 'none';
	
	//var scope_item = find_element(nsmenu, "scope");
	//setup_radio_buttons(scope_item, scope, change_scope)

	if (mode == 'block_all')
	{
	    var w = find_element(nsmenu, "block_all_settings");
	    wakeup_lazy_widgets(w);	    
	    var w = find_element(nsmenu, "block_inline_scripts");	    
	    setup_checkbox_item(w, block_inline_scripts, toggle_allow_inline);	    
	    
	    var w = find_element(nsmenu, "right_item");
	    w.innerText = " [" + get_size_kb(total_inline_size) + "k]";

	    if (!block_inline_scripts)
	    {
		var w = find_element(nsmenu, "handle_noscript_tags");
		w.style = "display:none;";
	    }
	}
	if (false)
	{	
	    var w = find_element(nsmenu, "block_inline_scripts");
	    w.style = "display:block;";	    
	    setup_checkbox_item(w, block_inline_scripts, toggle_allow_inline);

	    var w = find_element(nsmenu, "inline_scripts_size");
	    w.innerText = " [" + get_size_kb(total_inline_size) + "k]";

	    var w = find_element(nsmenu, "handle_noscript_tags");
	    setup_checkbox_item(w, handle_noscript_tags, toggle_handle_noscript_tags);
	    if (block_inline_scripts)
		w.style = "display:block;";
	}

	function setup_mode_item_handler(w, mode)
	{
	    w.onclick = function() { set_mode(mode); };
	}
	
	// take care of mode menu items.
	for (var i = 0; i < modes.length; i++)
	{
	    // get item for this mode, wherever it is.
	    var w = find_element(nsmenu, modes[i]);
	    if (modes[i] == mode)
		w.className += " selected";
	    else
		setup_mode_item_handler(w, modes[i]);

	    // now add host table	    
	    if (mode == 'block_all' ||
		modes[i] != mode)	// is it current mode ?
		continue;
	    add_host_table_after(w);
	}
	
	var w = find_element(nsmenu, "details_item");
	w.onclick = show_details;

	// FIXME put it back
	// plugin api
	// if (enable_plugin_api)
	// for (var prop in plugin_items)
	// if (plugin_items.hasOwnProperty(prop))
	// add_menu_item(nsmenu, plugin_items[prop], 0, null);
    }

    function parent_menu()
    {
	parent_widget(nsmenu, "main_menu", main_ui);
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

    function add_host_table_after(item)
    {
	var t = new_widget("host_table");
	item.parentNode.insertBefore(t, item.nextSibling);

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
	    var global_icon = idoc.createElement('img');   // globally allowed icon
	    var iframes = iframe_icon(hn);

	    var tr = new_widget("host_table_row");
	    t.appendChild(tr);
	    
	    if (not_loaded)
		tr.childNodes[1].className += " not_loaded";
	    tr.childNodes[2].firstChild.checked = allowed_host(h);
	    tr.childNodes[3].innerText = host_part;
	    tr.childNodes[4].innerText = d;
	    if (helper)
		tr.childNodes[4].className += " helper";
	    if (iframes)
		tr.childNodes[5].className += " iframe";
	    if (host_allowed_globally(h))
		tr.childNodes[6].className = "allowed_globally";
	    tr.childNodes[7].innerText = count;
	    
	});
	
//	if (item && !found_not_loaded) // indent
//	    item.childNodes[0].innerHTML = "&nbsp;&nbsp;";	
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
    
    /***************************** Main table *********************************/

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
	var img = find_element(div, "main_button_image");
	set_icon_mode(img, mode);
    }
    
    function main_button_onmouseover()
    {
	// console.log("button mouseover");
	show_hide_menu(true);    // menu can disappear if we switch these two, strange
	check_changed_settings();
    }
    
    function main_button_onclick()
    {
	// cycle through the modes
	if (mode == 'block_all')      set_mode('filtered');
	else if (mode == 'filtered')  set_mode('relaxed');
	else if (mode == 'relaxed')  set_mode('allow_all');
	else if (mode == 'allow_all') set_mode('block_all');
    }
    
    function main_button_onmouseout()
    {
	if (need_reload)
	    reload_page();
    }
    
    
    var main_ui = null;
    function create_main_ui()
    {
	main_ui = new_widget("main");
    }

    function parent_main_ui()
    {
	idoc.body.appendChild(main_ui);
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
	create_main_ui();
	if (menu_shown)
	    create_menu();	
	idoc.body.removeChild(idoc.body.lastChild); // remove main_ui
	parent_main_ui();
	if (menu_shown)
	{
	    parent_menu();	
	    show_hide_menu(true);
	}
    }


    

    var builtin_style = 
"/* jsarmor stylesheet */  \n\
body			{ margin:0px; }  \n\
#main			{ position:fixed; width:auto; height:auto; background:transparent;   \n\
			  white-space:nowrap; z-index:99999999; direction:ltr;   \n\
			  font-size:small;  margin-bottom:0px; }  \n\
  \n\
/* main button */  \n\
#main_button		{ direction:rtl; border-width: 2px; margin: 0; float: none; }   \n\
  \n\
/*************************************************************************************************************/  \n\
  \n\
/* host table */  \n\
#jsarmor_ftable		{ width:100%; }   \n\
#jsarmor_ftable > tr > td	{ padding: 0px 0px 1px 0px;}   \n\
  \n\
/* menu items */  \n\
/*  \n\
.indent1		{ padding-left:12px }  \n\
.indent2		{ padding-left:22px }  \n\
*/  \n\
.active:hover		{ background-color:#ddd; }  \n\
  \n\
  \n\
/* hostnames display */  \n\
.host_part		{ color:#888; text-align:right; }  \n\
.helper			{ color:#000; }  \n\
.script_count		{ text-align:right; }  \n\
.right_item		{ float:right; }  \n\
  \n\
/* 'script allowed globally' icon */  \n\
.img_global		{ visibility:hidden; padding: 0px 3px; width:14px; height:14px; vertical-align:middle;  \n\
			  background-size:contain;   \n\
			  background:-o-skin('RSS'); }  \n\
.img_global.visible	{ visibility:visible; }  \n\
td:hover > .img_global	{ visibility:visible; }   \n\
  \n\
  \n\
/*************************************************************************************************************/  \n\
/* generic stuff */  \n\
  \n\
table					{ border-spacing:0px; border-collapse: collapse; }  \n\
  \n\
/* radio buttons (scope etc) */  \n\
input[type=radio]			{ display:none; }   \n\
input[type=radio] + label:hover		{ background-color: #ddd; }   \n\
input[type=radio] + label		{ box-shadow:inset 0px 1px 0px 0px #ffffff; border-radius:6px;   \n\
					  border:1px solid #dcdcdc; background-color: #c7c7c7;    \n\
					  display:inline-block; padding:1px 5px; text-decoration:none;   \n\
					}   \n\
input[type=radio]:checked + label	{ background-color: #fa4; }   \n\
  \n\
/* icons */  \n\
#main_button img { width:22px; height:22px; vertical-align:middle; background-size:contain; }   \n\
  \n\
img.allowed		{ background:-o-skin('Transfer Success'); }  \n\
img.blocked		{ background:-o-skin('Transfer Stopped'); }  \n\
img.not_loaded		{ background:-o-skin('Transfer Size Mismatch'); }  \n\
img.iframe		{ background:-o-skin('Menu Info'); }  \n\
img.allowed_globally	{ background:-o-skin('RSS'); }  \n\
img.block_all		{ background:-o-skin('Smiley Pacman'); }  \n\
img.filtered		{ background:-o-skin('Smiley Cool'); }  \n\
img.relaxed		{ background:-o-skin('Smiley Tongue'); }  \n\
img.allow_all		{ background:-o-skin('Smiley Cry'); }  \n\
  \n\
.menu {  \n\
	padding: 1px 1px; text-align:left;  \n\
	box-shadow: 8px 10px 10px rgba(0,0,0,0.5), inset 2px 3px 3px rgba(255,255,255,0.75);  \n\
	border-radius: 5px; border-width: 2px; border-style: outset; border-color: gray;  \n\
	display:table;  \n\
	font-size:small;  \n\
}  \n\
.menu, #jsarmor_ftable { background: #ccc; }  \n\
  \n\
/* title */  \n\
h1	{ color:#fff; font-weight:bold; font-size: 1em; text-align: center;  \n\
	  margin:0;  \n\
	  background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAYCAYAAAA7zJfaAAAAAXNSR0IArs4c6QAAAAZiS0dEAAAAAAAA+UO7fwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB90BFRUGLEa8gbIAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAUElEQVQI102KOwqAQBDFsm+9/3Fs9RqChdgIVjYi6nxsLLYJCYSc+xTLgFhHhD8t0m5kAQo39Jojj0RuLzquQLUkUuG3qtJmJ9plOyua9uADjaopUrsHkrMAAAAASUVORK5CYII=) repeat-x;}  \n\
  \n\
.menu ul			{ padding:0; margin:0 }  \n\
.menu ul ul			{ margin-left:1em }  \n\
.menu li			{ list-style:none }  \n\
.menu > ul > li:hover		{ background:#ddd }  \n\
.menu > ul > li:first-child	{ background:inherit }  \n\
  \n\
/* mode menu item */  \n\
.selected, .menu .selected:hover {  \n\
	background-color: #fa4;  \n\
	padding: 1px; /* for highlighting */  \n\
}  \n\
  \n\
/*  \n\
li.allowed::before, li.blocked::before, li.not_loaded::before, li.iframe::before, li.allowed_globally::before,  \n\
li.block_all::before, li.filtered::before, li.relaxed::before, li.allow_all::before {transform:scale(1.1); display:inline-block; vertical-align:middle}  \n\
*/  \n\
  \n\
  \n\
td.allowed::before		{ content:-o-skin('Transfer Success'); }  \n\
td.blocked::before		{ content:-o-skin('Transfer Stopped'); }  \n\
td.not_loaded::before		{ content:-o-skin('Transfer Size Mismatch'); }  \n\
td.iframe			{ content:-o-skin('Menu Info'); }  \n\
td.allowed_globally		{ content:-o-skin('RSS'); }  \n\
td.not_allowed_globally:hover	{ content:-o-skin('RSS'); }  \n\
  \n\
li.block_all::before		{ content:-o-skin('Smiley Pacman');}  \n\
li.filtered::before		{ content:-o-skin('Smiley Cool'); }  \n\
li.relaxed::before		{ content:-o-skin('Smiley Tongue'); }  \n\
li.allow_all::before		{ content:-o-skin('Smiley Cry'); }  \n\
  \n\
  \n\
/* #main_button img { background:-o-skin('Smiley Tongue'); } */  \n\
  \n\
";

    /* layout for each widget (generated from jsarmor.xml). */
    var widgets_layout = {
      'main' : '<widget name="main"><div id="main"><main_menu lazy></main_menu><main_button/></div></widget>',
      'main_button' : '<widget name="main_button" init><div id="main_button" onmouseover onclick onmouseout><button><img id="main_button_image"/></button></div></widget>',
      'main_menu' : '<widget name="main_menu"><div id="main_menu" class="menu" onmouseout ><h1 id="title" oninit="menu_title_init">JSArmor</h1><ul><li id="scope" oninit="init_scope_buttons">Set for:<input type="radio" name="radio"/><label>Page</label><input type="radio" name="radio"/><label>Site</label><input type="radio" name="radio"/><label>Domain</label><input type="radio" name="radio"/><label>Global</label></li><li class="block_all" title="Block all scripts.">Block All</li><block_all_settings lazy id="block_all_settings"></block_all_settings><li class="filtered" title="Select which scripts to run. (current site allowed by default, inline scripts always allowed.)">Filtered</li><li class="relaxed" title="Select which scripts to run. (current site allowed by default, inline scripts always allowed.)">Relaxed</li><li class="allow_all" title="Allow everything…">Allow All</li><li id="details_item">Details…</li></ul></div></widget>',
      'block_all_settings' : '<widget name="block_all_settings"><block_inline_scripts id="block_inline_scripts"></block_inline_scripts><checkbox_item label="Pretend Javascript Disabled" id="handle_noscript_tags" 		 title="Interpret noscript tags as if javascript was disabled in opera." 		 state="`handle_noscript_tags" 		 callback="`toggle_handle_noscript_tags"/></checkbox_item></widget>',
      'block_inline_scripts' : '<widget name="block_inline_scripts" ><li><input type="checkbox"/>Block Inline Scripts<div class="right_item">[-2k]</div></li></widget>',
      'checkbox_item' : '<widget name="checkbox_item" title innerText state callback init><li title="title"><input type="checkbox"/></li></widget>',
      'host_table' : '<widget name="host_table"><table id="jsarmor_ftable"></table></widget>',
      'host_table_row' : '<widget name="host_table_row"><tr class="active"><td width="1%">&nbsp;&nbsp;</td><td width="1%"></td><td width="1%"><input type="checkbox" checked="true"></td><td width="1%" class="host_part">code.</td><td class="domain_part">jquery.com</td><td width="1%"></td><td width="1%" class="not_allowed_globally"></td><td width="1%" class="script_count">[1]</td></tr></widget>'
    };


    
})(window.document, window.location, window.opera, window.opera.scriptStorage);	// last_line_tag

