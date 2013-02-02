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
(function(document, location, opera, scriptStorage)
{
    var version = 'jsarmor v1.5.0 (dev)';


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

    // 'block_all'   'filter'   'allow'
    var default_iframe_logic = 'filter';

    
    /********************************* Globals *********************************/

    /* stuff load_global_settings() takes care of */
    var current_host;
    var current_domain;    
    var block_inline_scripts = false;
    var handle_noscript_tags = false;
    var reload_method;
    /* end */

    var iframe_logic;
    var there_is_work_todo = false;    
            
    /************************** Deferred events handling  *****************************/    

    // Sequence of events when loading a page goes:
    // - userjs scripts are run so they have a chance to register events
    // - Page scripts are run:
    //   For each script:
    //     - BeforeExternalScript fires before loading an external script
    //     - BeforeScript fires before executing both inline and external scripts
    //   Scripts which have not been blocked are run, they get a chance to register events.
    // - [...] Page loads, all kinds of stuff can happen: load focus ... 
    // * DOMContentLoaded fires: scripts can start messing with the DOM.
    // - [...] iframes start loading
    //         dynamic content added by scripts gets loaded
    // - document load event fires: document is loaded, browser button stops spinning.
    // - iframes finish loading anytime before or after that.
    
    var async_init_request = false;
    var async_init = false;  // currently only used when running inside iframe
    var sync_init = false;

    function ready()
    {	return (sync_init && async_init);  }
    
    function init()
    {
	// sync_init, async_init both false
	core_init();
	sync_init = true;
	
	if (!async_init_request)
	    async_init_finished();
	if (ready())
	    trigger_deferred_events();
    }

    function async_init_finished()
    {
	// note: unlocking async_init first implies the ordering of events might not be preserved.
	// for example if domcontentloaded fires now, it'll get handled before the queued events.
	// that's fine though, the script handlers take notice something happened even when deferred.
	async_init = true;
	if (sync_init) // ready() then  (can't set async_init yet)
	    trigger_deferred_events();
    }

    var event_queue = [];    
    function trigger_deferred_events()
    {
	// if (event_queue.length) alert("deferred events: " + event_queue.length);
	foreach(event_queue, function(o)
	{
	    o.handler(o.event, true); // deferred call
	});
	event_queue = [];
    }

    function deferred(handler, allow_unhandled_event)
    {
	return function(e)
	{
	    if (ready())
	    {
		handler(e, false); // synchronous call
		return;
	    }
	    
	    // queue it, and block current event if requested
	    event_queue.push({handler: handler, event: e});
	    if (!allow_unhandled_event)
		e.preventDefault();
	};
    }
    
    
    /********************************* Startup ************************************/    
    
    // jsarmor ui's iframe, don't recurse !
    if (window != window.top &&
	window.name == 'jsarmor_iframe')
	return;

    init();
    
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

    /******************************** Normal init *******************************/

    function core_init()
    {
	init_handlers();
	check_script_storage();
	load_global_settings();
    }
	
    function load_global_settings()
    {
	load_global_context(location.hostname);
	init_iframe_logic();
	reload_method = global_setting('reload_method', 'cache');
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

    
    /**************************** Mode and page stuff *************************/

    // reload top window really: with 'filtered' iframe logic, iframes need parent to reload.
    function reload_page()
    {
	if (window != window.top)		// in iframe, no choice there.
	    window.top.location.reload();

	// All of these reload from server ...
	//   location.reload(false);
	//   history.go(0);
	//   location.href = location.href;	
	if (reload_method != 'cache')
	    location.reload(false);		// no need to return i presume.
	
	// hack! simulate click on a link to reload from cache !
	var a = document.createElement('a');
	a.href = location.href;
	document.body.appendChild(a);
	
	// simulateClick() from https://developer.mozilla.org/samples/domref/dispatchEvent.html
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
    
    /***************************** filtering js in iframes **************************/

    var show_ui_in_iframes;    
    var iframe_message_header;
    
    function init_iframe_logic()
    {
	show_ui_in_iframes = global_bool_setting('show_ui_in_iframes', default_show_ui_in_iframes);
	iframe_message_header = "jsarmor lost iframe rescue channel:";    
	
	iframe_logic = global_setting('iframe_logic');
	if (iframe_logic != 'block_all' && iframe_logic != 'filter' && iframe_logic != 'allow')
	    iframe_logic = default_iframe_logic;
	
	if (window == window.top) // not running in iframe ?
	    return;

	// tell parent about us so it can display our host in the menu.
	// for 'filter' iframe_logic, this is also asking for its hostname.
	window.top.postMessage(iframe_message_header + location.href, '*');
	
	// switch mode depending on iframe_logic
	// TODO: add way to override with page setting *only*, which should be safe enough
	
	if (iframe_logic != 'filter')
	{
	    if (iframe_logic == 'block_all')
		iframe_block_all_mode();
	    // 'allow' -> treat as normal page, nothing to do.
	    return;
	}
	
	// 'filter' logic uses parent window's settings to decide what to do with page scripts.
	// for that we need parent's hostname, but because of cross-domain restrictions we can't
	// find out on our own. Wait for msg from parent.
	async_init_request = true;
	return;
    }

    function before_message_handler(before_event)
    {
	var e = before_event.event;
	var m = e.data;
	if (typeof(m) != "string" ||
	    !is_prefix(iframe_message_header, m))
	    return;			// i only care about my children/parent.
	before_event.preventDefault();	// keep this conversation private.

	var content = m.slice(m.indexOf(':') + 1);
	var source = e.source;	// WindowProxy of sender
	// e.origin contains 'http://hostname' of the sender
	if (source === parent.window)
	    message_from_parent(e, content);
	else
	    message_from_iframe(e, content);
    }

    // iframe instance making itself known to us. (works for nested iframes unlike DOM harvesting)
    function message_from_iframe(e, url)
    {
	// log("message from iframe: host=" + url_hostname(url));
	if (iframe_logic == 'filter') // it needs our hostname
	    e.source.postMessage(iframe_message_header + current_host, '*');
	add_iframe(url);			// add to menu so we can block/allow it.
	if (main_ui) // UIFIXME
	    repaint_ui();	
    }
    
    function message_from_parent(e, parent_host)
    {
	// log("message from parent: host=" + parent_host);
	
	// now that we know parent window's hostname we can decide what to do.
	// does our parent allow us ?
	load_global_context(parent_host);
	var allowed = allowed_host(location.hostname);
	clear_domain_nodes();	// wipe out hosts nodes this will have created
	load_global_context(location.hostname);
	
	// alert("iframe " + location.hostname + " allowed: " + allowed);
	if (!allowed)
	    iframe_block_all_mode();
	// else: allowed. treat it as a normal page: current mode applies.
	
	async_init_finished(); // happy now =)
    }

    // can't use set_mode_no_update('block_all'), it would save the setting.
    function iframe_block_all_mode()
    {
	mode = 'block_all';
	block_inline_scripts = true;
	handle_noscript_tags = true;
    }
    
    function add_iframe(url)
    {
	var host = url_hostname(url);
	var domain = get_domain(host);
	var i = new_script(url); // iframe really

	var domain_node = get_domain_node(domain, true);
	var host_node = get_host_node(host, domain_node, true);
	host_node.iframes.push(i);
	return i;
    }
    
    // TODO show iframe placeholder ?
        
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
	dn = (dn ? dn : get_domain_node(get_domain(host), true));
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
      error('mode="' + mode + '", this should not happen!');
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
	assert(domain_node, "get_domain_node() failed! should not happen.");
	var host_node = get_host_node(host, domain_node, false);
	var scripts = host_node.scripts;
	for (var i = scripts.length - 1; i >= 0; i--)
	    if (scripts[i].url == url)
		return scripts[i];
	error("find_script(): should not happen.");
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

    function reload_script(script)
    {
	var clone = script.cloneNode(true);
	script.parentNode.replaceChild(clone, script);
    }
    
    // Handler for both inline *and* external scripts
    function beforescript_handler(e, deferred_call)
    {
      if (e.element.src) // external script
	  return;
      
      if (deferred_call && !block_inline_scripts)	// now we know it's allowed, load it !
      {
	  reload_script(e.element);
	  return;
      }
	
      total_inline++;
      total_inline_size += e.element.text.length;
      
      if (main_ui) //UIFIXME
	  repaint_ui();
      
      if (block_inline_scripts)
	e.preventDefault();
    }

    function beforeextscript_handler(e, deferred_call)
    {
	assert(element_tag_is(e.element, 'script'),
	       "BeforeExternalScript: non <script>: " + e.element.tagName);
	var url = e.element.src;
	var host = url_hostname(url);
	var allowed = allowed_host(host);	

	if (deferred_call && allowed)	// now we know it's allowed, load it !
	{
	    reload_script(e.element);
            return;
	}
	
	add_script(url, host);
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
    function beforeload_handler(ev, deferred_call)
    {	
	var e = ev.event.target;
        if (!e || !e.tagName || !element_tag_is(e, 'script') || !e.src)
	    return; // not an external script.
	assert(!deferred_call,
	       "beforeload_handler() has been deferred. That's extremely strange.");
	
	var host = url_hostname(e.src);
	var script = find_script(e.src, host);

	// FIXME for performance, could remove this
	assert(allowed_host(host),		// sanity check ...
	       "a script from\n" + host + "\nis being loaded even though it's blocked. That's a bug !!");
	
	if (host == current_host)
	    loaded_current_host++; 
	else
	    loaded_external++;
	script.loaded = 1;

	if (nsmenu)
	    repaint_ui();
    }

//UIFIXME    
    function domcontentloaded_handler(e, deferred_call)
    {
        if (!there_is_work_todo &&		// no scripts ?
	    !document.querySelector('iframe'))	// no iframes ?
            return;				// don't show ui.

	if (block_inline_scripts)
	    check_handle_noscript_tags();

	// display ui in frame / iframe ?
	if (window != window.top &&
	    !show_ui_in_iframes)
	    return;
	
	create_iframe();
    }

    /**************************** Handlers setup ***************************/

    function work_todo(f)
    {
	return function(e)
	{
	    there_is_work_todo = true;
	    f(e);
	}
    }

    function init_handlers()
    {
	// deferred: events should be queued until we're initialized
    	opera.addEventListener('BeforeScript',	       work_todo(deferred(beforescript_handler)),		false);
	opera.addEventListener('BeforeExternalScript', work_todo(deferred(beforeextscript_handler)),		false);
	opera.addEventListener('BeforeEvent.load',               deferred(beforeload_handler, true),		false);
	document.addEventListener('DOMContentLoaded',            deferred(domcontentloaded_handler, true),	false);

	// messaging between top window and iframes.
	// FIXME need to make sure page isn't seeing our messages	
	//window.addEventListener('message',	message_handler,	false);
	opera.addEventListener('BeforeEvent.message',			before_message_handler,		false);	
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

    function global_setting(name, default_value)
    {
	var v = scoped_setting(3, name);
	if (default_value)
	    return (v != '' ? v : default_value);
	return v;
    }

    function set_global_setting(name, value)
    {
	set_scoped_setting(3, name, value);
    }

    function global_bool_setting(name, default_value)
    {
	var c = global_setting(name);
	return (c != '' ? c == 'y' : default_value);
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
		my_alert("This file doesn't look like a valid settings file.");
		return;
	    }	    
	    scriptStorage.clear();	// clear current settings.
	    import_settings(a);
	    my_alert("Loaded !");
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



    /********************************* Core ui *********************************/

    // whether to show jsarmor ui inside frames / iframes
    var default_show_ui_in_iframes = false;

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
    function new_widget(name, init_proxy)
    {
	var wrap = new_wrapped_widget(name, init_proxy);
	assert(wrap.children.length <= 1,
	       "new_widget(" + name + "):\n" +
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
	error("parent_widget() couldn't find placeholder for " + widget_name);
    }
    
    
    /**************************** Internal widget functions ***********************/

    // FIXME check for duplicate ids ?
    
    // same as new_widget() but returns the <widget> wrapper. this is necessary if
    // the widget is actually a forest... (.forest is set on the div in this case)
    // init_proxy function is used to pass arguments to widget_init()
    function new_wrapped_widget(name, init_proxy)
    {
	name = name.toLowerCase();
	// do we have this guy in cache ? use that then
	//if (cached_widgets[name])
	// return cached_widgets[name].cloneNode(true);

	var layout = widgets_layout[name];
	assert(layout, "new_widget(" + name + "): the layout for this widget is missing!");
	
	// otherwise create a new one...
	var d = idoc.createElement('foo');
	d.innerHTML = layout;
	var wrap = d.firstChild;	// the <widget> element
	assert(wrap, "new_widget(" + name + "):\n" +
	             "couldn't create this guy, check the html in widgets_layout.");	
	if (wrap.children.length > 1)
	    wrap.forest = true;

	setup_widget_event_handlers(wrap, name);
	call_oninit_handlers(wrap);
	create_nested_widgets(wrap, false);	
	init_widget(wrap, wrap.firstChild, name, init_proxy);
	
	// cached_widgets[id] = d.firstChild;
	//return widget.cloneNode(true);
	return wrap;
    }
    
    function eval_attributes(ph)
    {
	if (!ph)
	    return;

	for (var i = 0; i < ph.attributes.length; i++)
	{
	    var a = ph.attributes[i];
	    if (a.value.charAt(0) == "`")  // "`" means eval attribute 
		ph[a.name] = eval(a.value.slice(1));
	    else
		ph[a.name] = a.value;
	}
    }
    
    // copy attributes from placeholder (or use args_func if available), and call init handler if needed:
    // if widget "foo" has the 'init' attribute, then foo_init(widget) is called.
    // we could call function foo_init() automatically if it exists, but that would open a nice hole:
    // if the page's scripts have such a handler and we didn't define one, now it'd get called !
    function init_widget(wrap, content, name, init_proxy)
    {
	var widget = (content ? content : wrap);
	if (wrap.children.length > 1) // call init on the wrapper for forest widgets.
	    widget = wrap;
	
	if (!wrap.hasAttribute('init'))
	    return;
	if (init_proxy)
	    init_proxy(widget);
	else // no proxy ? widget_init() takes no args then, call it directly.
	    (eval(name + "_init"))(widget);
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
    
    function get_init_proxy(placeholder)
    {
	var name = placeholder.tagName.toLowerCase();
	var fname = name + "_init_proxy";
	if (!function_exists(fname))
	    return null;

	var call_init = eval(fname);
	return function(widget)
	{
	    eval_attributes(placeholder);
	    call_init(widget, placeholder);
	};
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
	    to.push(new_wrapped_widget(n.tagName, get_init_proxy(n)));
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
	assert(!from.children.length, "found a <" + wrapped_widget_name(to) +
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
		}
	    }
	}
    }


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
	ui_init();
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
	assert(a, "split_url(): shouldn't happen");
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
	assert(parent, "get_by_id(): parent is null !!");
	if (parent.id == id)
	    return parent;
	l = parent.getElementsByTagName("*");
	for (var i = 0; i < l.length; i++)
	    if (l[i].id == id)
		return l[i];
	return null;
    }
    
    // find element in parent with that id or class_name
    // supports unparented nodes
    // for parented nodes idoc.querySelector('css selector') is very nice !
    function find_element(parent, class_name)
    {
	assert(class_name, "find_element(): null class_name !");
	if (parent == null)
	    parent = idoc.body;
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
	assert(l.length, fname +"(" + class_name + "):\n couldn't find element by that name !");
	assert(!unique, fname +"(" + class_name + "): multiple matches !");
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

    // FIXME use l.forEach(f) !
    function foreach(l, f)
    {
	for (var i = 0; i < l.length; i++)
	    f(l[i]);
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

    function function_exists(name)
    {
	return eval("typeof " + name) == "function";
    }

    function log(msg)
    {
	var h = "jsarmor (main)  : ";
	if (window != window.top)
	    h = "jsarmor (iframe): ";
	console.log(h + msg);
    }
    
    function my_alert(msg)
    {
	alert("jsarmor:\n\n" + msg);
    }

    function assert(test, msg)
    {
	if (test)
	    return;
	my_alert(msg);
	throw("assertion failed");
    }

    function error(msg)
    {
	my_alert(msg);
	throw("error: " + msg);
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

    var default_autohide_main_button = false;
    var default_menu_display_logic = 'auto';
    
    // can be used to display stuff in jsarmor menu from outside scripts.
    var enable_plugin_api = false;

    /********************************* UI Init *********************************/

    var main_ui = null;
    var autohide_main_button;
    var menu_display_logic;		// auto   delay   click
    var menu_display_timer = null;

    // called only once.
    function ui_init()
    {
	autohide_main_button = global_bool_setting('autohide_main_button', default_autohide_main_button);
	menu_display_logic = global_setting('menu_display_logic', default_menu_display_logic);	
	if (menu_display_logic == 'click')
	    window.addEventListener('click',  function (e) { close_menu(); }, false);
    }
    
    function create_main_ui()
    {
	main_ui = new_widget("main");
    }

    function parent_main_ui()
    {
	idoc.body.appendChild(main_ui);
    }    

    /****************************** widget handlers *****************************/

    function checkbox_item_init(li, id, title, label, state, callback)
    {
	li.id = id;
	li.title = title;
	li.innerHTML += label; // hack
	setup_checkbox_item(li, state, callback);
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
    {
	this.onchange = load_file;
    }
    
    function edit_css_url()
    {
/*	
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
 */
    }

    function save_whitelist()
    {
	var w = find_element(null, "whitelist");
	if (!w)
	    return;
	set_global_setting('whitelist', raw_string_to_list(w.innerText));
	close_menu();
    }

    function whitelist_editor_init(realmenu)
    {
	var t = find_element(realmenu, "whitelist");
	t.innerText = raw_list_to_string(global_setting('whitelist'));
    }

    function edit_whitelist()
    {
	var w = new_widget("whitelist_editor");
	switch_menu(w);
    }
    
    function select_iframe_logic_init(widget)
    {
	var iframe_logic_values = ['block_all', 'filter', 'allow'];
	var f = function (n)
	{
	    set_global_setting('iframe_logic', iframe_logic_values[n]);
	    need_reload = true;
	};

	var index = iframe_logic_values.indexOf(iframe_logic);
	setup_radio_buttons(widget, "iframe_logic", index, f);
    }

    function select_menu_display_logic_init(widget)
    {
	var menu_display_logic_values = ['auto', 'delay', 'click'];
	var f = function (n)
	{
	    set_global_setting('menu_display_logic', menu_display_logic_values[n]);
	    need_reload = true;
	};

	var index = menu_display_logic_values.indexOf(menu_display_logic);
	setup_radio_buttons(widget, "menu_display_logic", index, f);
    }

    function select_reload_method_init(widget)
    {
	var reload_method_values = ['cache', 'normal'];
	var f = function (n)
	{
	   reload_method = reload_method_values[n];
	   set_global_setting('reload_method', reload_method);
	};

	var index = reload_method_values.indexOf(reload_method);
	setup_radio_buttons(widget, "reload_method", index, f);
    }
    
    // returns toggled value, sets setting and updates this.checkbox
    function toggle_global_setting(w, value, setting)
    {
	value = !value;
	w.checkbox.checked = value;	// update ui
	set_global_bool_setting(setting, value);
	return value;
    }
    
    function toggle_show_ui_in_iframes(event)
    {
	show_ui_in_iframes = toggle_global_setting(this, show_ui_in_iframes, 'show_ui_in_iframes');
	need_reload = true;
    }

    function toggle_autohide_main_button(event)
    {
	autohide_main_button = toggle_global_setting(this, autohide_main_button, 'autohide_main_button');
	need_reload = true;
    }

    function go_to_help_page()
    {
	location.href = help_url;
    }    

    function options_menu()
    {
	var w = new_widget("options_menu");
	switch_menu(w);	
    }
    
    /***************************** Details menu *******************************/

    function script_detail_init(w, h, s)
    {
	var img = w.firstChild;
	var link = img.nextSibling;

	var label = strip_http(s.url);
	var max_item_length = 60;	// truncate displayed url if too long        
        if (label.length > max_item_length) { label = label.slice(0, max_item_length) + "…"; }

	link.innerText = label;
	link.href = s.url;
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
	      var w = new_script_detail(h, s[j]);
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
	if (!mouseout_leaving_menu(e, nsmenu) ||
	    menu_display_logic == 'click')
	    return false;
	return true;
    }

    function close_menu(keep_menu)
    {
	show_hide_menu(false);
	if (keep_menu != true) // explicit comparison, guard against weird calls
	    switch_menu(null);
	
	if (need_reload)
	    reload_page();
	if (need_repaint)
	    repaint_ui_now();	
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
    
    function mouseout_leaving_menu(e, menu)
    {
	var reltg = e.relatedTarget;
	if (reltg)
	{
	    // don't think we need this anymore ...
  	    //if (reltg.id == 'main_button')
	    //	return false; // moving back to button, doesn't count
	    while (reltg != menu && reltg.nodeName != 'HTML')
		reltg = reltg.parentNode;
	    if (reltg == menu)
		return false; // moving out of the div into a child layer
	}
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
      if (!nsmenu)
      {
	  create_menu();
	  nsmenu.style.display = 'none';
	  parent_menu();	  
      }
      var d = (show ? 'inline-block' : 'none');	
      if (toggle)
	  d = (nsmenu.style.display == 'none' ? 'inline-block' : 'none');
      nsmenu.style.display = d;      
      resize_iframe();
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
	
	// now add host table	    
	if (mode == 'block_all' ||
	    for_mode != mode)	// is it current mode ?
	    return;
	add_host_table_after(this);
    }
    
    function main_menu_init(menu)
    {
	if (mode == 'block_all')
	    wakeup_lazy_widgets(menu);

	w = find_element(menu, "menu_title");
	w.title = version;
	
	// FIXME put it back one day
	// plugin api
	// if (enable_plugin_api)
	// for (var prop in plugin_items)
	// if (plugin_items.hasOwnProperty(prop))
	// add_menu_item(nsmenu, plugin_items[prop], 0, null);
    }

    function parent_menu()
    {
	var w = find_element(main_ui, "main_menu_sibling");
	w.parentNode.insertBefore(nsmenu, w);
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

    function iframe_info(hn, allowed)
    {
	if (!hn.iframes || !hn.iframes.length)
	    return null;
	var n = hn.iframes.length;
	var title = n + " iframe" + (n>1 ? "s" : "");
	if (iframe_logic != 'filter')
	    title += ". use 'filter' iframe setting to block/allow in the menu.";
	
	if (iframe_logic == 'block_all')
	    allowed = false;
	if (iframe_logic == 'allowed')
	    allowed = true;
	return {title: title, allowed: allowed};
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
	var t = new_widget("host_table");
	item.parentNode.insertBefore(t, item.nextSibling);
	sort_domains();

	var found_not_loaded = false;
	var tr = null;	
	foreach_host_node(function(hn, dn)
	{
	    var d = dn.name;
	    var h = hn.name;
	    var allowed = allowed_host(h);
	    var host_part = h.slice(0, h.length - d.length);
	    var not_loaded = not_loaded_tooltip(hn, allowed);
	    var count = "[" + hn.scripts.length + "]";
	    var helper = hn.helper_host;
	    var iframes = iframe_info(hn, allowed);

	    tr = new_widget("host_table_row");
	    tr = tr.firstChild.firstChild; // skip dummy <table> and <tbody> tags
	    tr.host = h;
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
		var c = (iframes.allowed ? 'iframe' : 'blocked_iframe');
		tr.childNodes[5].className += " " + c;
		tr.childNodes[5].title = iframes.title;
	    }
	    if (host_allowed_globally(h))
		tr.childNodes[6].className += " visible";
	    tr.childNodes[7].innerText = count;

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
    
    /***************************** Main ui *********************************/

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

	if (autohide_main_button)
	    div.className += " autohide";
	
	if (menu_display_logic == 'click')
	    div.onclick = function() { (nsmenu ? close_menu() : show_hide_menu(true)); }
	if (menu_display_logic == 'delay')
	{
	    div.onclick = div.onmouseover;
	    div.onmouseover = function()
	    {  menu_display_timer = setTimeout(main_button_onmouseover, 400); }  // canceled in onmouseout 
	}	
    }
    
    function main_button_onmouseover()
    {
	// console.log("button mouseover");
	if (menu_display_logic != 'click')
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
	if (menu_display_timer)
	{
	    clearTimeout(menu_display_timer);	    
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
			  white-space:nowrap; z-index:99999999; direction:ltr; font-family:Ubuntu;  \n\
			  font-size:small;  margin-bottom:0px; }  \n\
  \n\
/* main button */  \n\
#main_button		{ direction:rtl; border-width: 2px; margin: 0; float: none; }   \n\
#main_button img	{ width:18px; height:18px; } /* only works with img background: not content: */  \n\
  \n\
.autohide		{ visibility:hidden; }  \n\
:hover .autohide	{ visibility:visible }  \n\
  \n\
  \n\
/*************************************************************************************************************/  \n\
  \n\
/* host table */  \n\
#host_table			{ width:100%; }   \n\
#host_table > tr > td		{ padding: 0px 0px 1px 0px;}   \n\
#host_table > tr:hover		{ background:#ddd }  \n\
  \n\
/* hostnames display */  \n\
.td_not_loaded img	{ width:16px; height:16px; }  /* take up space even if all are empty */  \n\
/* .td_checkbox */  \n\
.td_host		{ color:#888; text-align:right; }  \n\
.td_domain		{ color:#333; }  \n\
.helper			{ color:#000; } /* helper domain */  \n\
/* .td_iframe */  \n\
.td_allowed_globally img		{ visibility:hidden; padding: 0px 3px; width:14px; height:14px;  \n\
					  vertical-align:middle; background-size:contain; }  \n\
.td_allowed_globally:hover img		{ visibility:visible; }   \n\
.td_allowed_globally.visible img	{ visibility:visible; }  \n\
.td_script_count		{ text-align:right; }  \n\
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
textarea				{ width:400px; height:300px; }  \n\
  \n\
/* images */  \n\
  \n\
img	{ width:1px; height:1px; vertical-align:middle; background-size:contain; }  \n\
  \n\
.block_all img,  .filtered  img,  .relaxed  img,  .allow_all img { width:18px; height:18px; }  \n\
.block_all img		{ background:-o-skin('Smiley Pacman'); }  \n\
.filtered  img		{ background:-o-skin('Smiley Cool'); }  \n\
.relaxed   img		{ background:-o-skin('Smiley Tongue'); }  \n\
.allow_all img		{ background:-o-skin('Smiley Cry'); }  \n\
  \n\
.allowed img		{ content:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAAVdEVYdENyZWF0aW9uIFRpbWUAMTkvNS8wOcYlgL0AAAGASURBVDiNpZPLK0RRHMc/xz3FxmNBSEosBkVXSpQyFqRYTB4Lq2ujbCby/AuUZDESCyuWUwwp2ciwF3cjbMjWCoW45xoLznXnwcL86tSv7+/7e/+OSCQSZCM5WXkDUitCCA+c3c0dAcYB8xuygeXF0NuG5ujKhacIwexubhEQ9zmmig10LobeHrSf9FuVMv5y5tsWB5o04M0gHC2wHFeajivJ9KzWKHVlIRxXmuFogZU2A6WMid/SdgbGaKzoI08WcXZ3ADABbCZVoFxpKleiXElNcQdaLy806W2Y4+X9kdX4iMa9Nr0AjjJwlEFL1TBT3TsMNc/jKAOrbQUQLBwM8PT67PEytCBtwDy5ihEobaerfhSzsoeS/ErWTya5vb/20+30AK4RATYA1o5m+EgIOgKDbJ1GiF/GgJ+sQEQrSXcwsFJ9jm+Nwdp+jq9iqTO1t8M3TZnvwJVB4FgHObzYS6XYQNAPJFWgpXepzuJrVf5TjuxPX25qTtop/1ey/o2ftG6clPyKKlYAAAAASUVORK5CYII=') }  \n\
.blocked img		{ content:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAAVdEVYdENyZWF0aW9uIFRpbWUAMTkvNS8wOcYlgL0AAAEHSURBVDiNpZNBagIxFIa/iAfoIRSKLXRc1YUL3XXRCwjCFC9QjzK9gOiqV+huNm66Mou2COMhPIB56aImTTIwgvND4OUlf/K/lz/KWksbdFqxga4LlFI+eViMX4BXIDunNPDWW23Xbo9TrnygFIfF+AYoA2IKDUx7q+3R8brhqjXSROa8VgJDl/A9qOajHCMZRrgwsmo+yms9sCdZhlf13z+jq6vZYzhdApv4ACNN0rFG0lISBfGGSwd4/PvAiI5qTRH3QdcVnKQA1m6+f35oElS4IPLBz9P9juZnBNCDj6+h48VWNjKplZJKNzIJKZECh+/pbc7fU4VWLu7K/caXnFr5WrT+jb97bZAgYc+wFgAAAABJRU5ErkJggg==') }  \n\
.not_loaded img		{ content:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADBQTFRFAAAA////AAAAAAAAAAAAAAAAAAAAAAAAkAAAlwAAtAAAvgAAyAAA0QAA2AAA3QAA7lpb0AAAAAh0Uk5TAAAMEx4wP0EqzeGOAAAAQElEQVQIW2MShAImBigAMT7JQxk2Rz5AGP8/KUAZH6FS/z/gZJzaBxO5+wDCMAtiQDPnzH2oCM9eqBrG9wIMDABr1Bip1wrS4AAAAABJRU5ErkJggg==') }  \n\
.iframe	img		{ content:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAAVdEVYdENyZWF0aW9uIFRpbWUAMTkvNS8wOcYlgL0AAAJdSURBVDiNpZPNS1RRGMZ/Zz69M+rAmFY6BZph9ClB1E6tRWGQGwkK+gOEwFlGIAy4yVUjBP0BUeHSIGlVuhAqQ5QKElMhVGYcZ3Q+79xz7tzbYuyO6dIDZ/M+5/2d9zw8R9i2zVGW52Chf3StF4iGGvwDWl1VLukmuYIxCcSnRtqn958X+yfoH12Ln2gODnd1NOH3ubGsat0lwFAVllbTJFLF8amR9ughwJ3YcvxiV8twS1OQggH5ss3Kt/cAdF67S0OdoN4Pye0iP5a2xj/EzkYdwM0nC73Hmxs/XT7XRipvo6sq9OUjDYChVzoCCPgF4aDg+68Nkqlc38dn3dMuAKmXoh2nwqTzimxRIqVCSuU8TUqFIRU7eUkmr2iPhJF6KeqYWOdnQAjB1o6BtWdJavUrfUM7ALRduu3AthVEmjz4fQw4ALcApUzKRu3W59FbnI/4ALgfT9SmAQxp43HtGQygpI40zP/209dbtaYDmpIVlNRrOdhNZzBNE8s0Ma3Dwdrvh8ctsCqC3XSmNkEqsTGZzxWo91soqZCGIrk86zQll2eRRrUe9FrksgVSiY1JByDLxfji/Bya18bvtjCkYmJs0AFMjA1iSIXmtQn4bBbn55DlYtzJAUD4+kj86o2e4ZNtp8mVKmTyCmlWNZ9XEG7wEgq42Vz/w/znmfHMl9FakIQQASASuvI41nqm+0HXhW40TaOyF2W3C3RdZ+nnApsrC2+ziy9iwLpt26V/ADfQCmjBjnu93lDnw8ZjkR4tUA+AXiqQ216fUdnfb4qr76YBHdi0bbsijvqd/wLzRz8kxE0gIwAAAABJRU5ErkJggg==') }  \n\
.blocked_iframe img	{ content:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEgAACxIB0t1+/AAAAAd0SU1FB90CAg8VBIk5W4oAAAI2SURBVDjLpZOxTxsxFIc/u76g5JZDQAURDEgwIQa2bKUbW1jb/wBFgmxs2dkCUljZ2hWY2EqZwpKFIRJEYgBVkQCdBHfnnH3HdWmOpIxYeov9/Pn93u9ZZFnGR5b6f6PVaq0Dddd1q4VCAYA4jomi6ARo1mq189F8MVpBq9VqTk5O7iwsLOA4DsMzIQTWWu7u7vB9f79Wq9XfAQ4ODpqLi4s7nudhjCGOYy4vLwGoVCpMTExQKBTwfZ/b29v97e3teg7Y29tbn5qa+rW0tEQYhlhrAdjc3ATg+PgYIQSO41Aqlej1ejw9PX3d3d09lwCDwaBeLpcJgoAoirDW5hAAay3GGMIwJAgC5ubmGAwG9byJSqmqEILn5+dc9/X1dS5hbW0thyVJgud5KKWqOUBKibWWOI7zxK2tLWZnZwE4Ojoac8oYg5QSADm0aVj2ME5PT8ckjEaSJPljCsD3fZIkIU1TXl9f3w3LaD+klKRpiu/7bxX0+/2TIAhwHCdvWLfbzS91u12MMRhjcByHl5cX+v3+SQ7QWjc7nQ5KKaSUGGNoNBo5oNFoYIxBKYVSik6ng9a6OTZIGxsbzUqlsjM/P4/WmjAMSZKEfy7hui7FYpH7+3va7fb+2dnZm41CiBJwqLX+vLy8/G1lZQXP88ZGWWtNu93m5ubm58XFxaEQopRlWSSyLEMI8QkoA8XV1dX16enp7zMzM19c1wUgDEMeHh5+Pz4+/ri6ujoHNPAny7JUfPQ7/wU6Sj1iFxnCnwAAAABJRU5ErkJggg==') }  \n\
  \n\
/* 'script allowed globally' icon */  \n\
.allowed_globally img		{ content:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABV0RVh0Q3JlYXRpb24gVGltZQAxOS81LzA5xiWAvQAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAI4SURBVDiNlZNNSFRRGIafe+feuToqDWL5U4wmM+Mm0magsM20qEXSImgRhgTR376gTYtoWbQuMpcpuW0RrUIIwdCEMQO1CY0w/6AmlTv3zpyfFre8CVp44CzO4bzP974f5zNWHnUnXNfI+z5x9rAch2Ispjst1zXyhh2LJ44ksasd0Pq/4rJXZnWmEHddN2/5PoHY8NArcyA8YBeIYYLlEN3XyoGOJF8np+IWgF0VRS9PY195C4D+XkAvTaKmh9GbSyFAK6iU0D/miTYeBcD6c6/KIixUn8SoT2KmepAfhhETA9udCA9T6hCgpEYJjTdwBqMhReRwjkh7DqOuiUj2KkZzhvKrO2h/I4SoAGAC6N8A++wDzLYcojBCabCPyrugstlyjOj5xyiht7aWhAAlNVIoIgcz2F0XqbrwBOfcQ/ypl5Re3w8eNqSwjl9DCoUUCiXVdoASGm+0H7k6B0DkUIaay0NUFt7jjfYD4HRfh5rmwIXcIYI78pSfz3rZeH4D7W9iOLXEeu5RGhtC+5sARDO9O0UAJTTVp29T19ePkrD+4lbQ5UQWsyFNaWwwOLdmd3dQfeISdmuWWO4mfmEcsRzEsdOnKH+eCACNaZQMNKEDpVE6glgKBJXFmaAnH98EoqYOvE/j4X8yqrYcGDN3T+r6ljRUPMTaPLpc+uc8GE4NdmM70nIoLs5imUoW19e+xGv3t2EnOncV/oVAygobqwuYShYtS4lO4bv54rfZPY2zqWTRUrLrF4hoKuU62VtvAAAAAElFTkSuQmCC'); }  \n\
  \n\
.menu {  \n\
	padding: 1px 1px; text-align:left;  \n\
	box-shadow: 8px 10px 10px rgba(0,0,0,0.5), inset 2px 3px 3px rgba(255,255,255,0.75);  \n\
	border-radius: 5px; border-width: 2px; border-style: outset; border-color: gray;  \n\
	display:table; font-size:small; background: #ccc;   \n\
}  \n\
  \n\
/* title */  \n\
h1	{ color:#fff; font-weight:bold; font-size: 1em; text-align: center;  \n\
	  margin:0;  \n\
	  background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAYCAYAAAA7zJfaAAAAAXNSR0IArs4c6QAAAAZiS0dEAAAAAAAA+UO7fwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB90BFRUGLEa8gbIAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAUElEQVQI102KOwqAQBDFsm+9/3Fs9RqChdgIVjYi6nxsLLYJCYSc+xTLgFhHhD8t0m5kAQo39Jojj0RuLzquQLUkUuG3qtJmJ9plOyua9uADjaopUrsHkrMAAAAASUVORK5CYII=) repeat-x;}  \n\
  \n\
/* menu item stuff */  \n\
.right_item		{ float:right; }  \n\
  \n\
.menu ul			{ padding:0; margin:0 }  \n\
.menu ul ul			{ margin-left:1em }  \n\
.menu li			{ list-style:none }  \n\
  \n\
.menu > ul > li:hover		{ background:#ddd } /* items active by default */  \n\
.menu > ul > li.inactive:hover	{ background:inherit }  \n\
  \n\
  \n\
/* mode menu item */  \n\
.selected, .menu .selected:hover {  \n\
	background-color: #fa4;  \n\
	padding: 1px; /* for highlighting */  \n\
}  \n\
  \n\
  \n\
/*************************************************************************************************************/  \n\
/* Options menu */  \n\
  \n\
#options_menu		{ min-width:250px; }  \n\
  \n\
.separator	{ height: 1px; display: block; background-color: #bbb; margin-left: auto; margin-right: auto; }  \n\
  \n\
/* import file (make form and button look like a menuitem) */  \n\
#import_settings	{ display:inline-block; position:relative; overflow:hidden; vertical-align:text-bottom }  \n\
#import_settings input	{ display:block; position:absolute; top:0; right:0; margin:0; border:0; opacity:0 }  \n\
  \n\
";

    /* layout for each widget (generated from jsarmor.xml). */
    var widgets_layout = {
      'main' : '<widget name="main"><div id="main"><main_button/></div></widget>',
      'main_button' : '<widget name="main_button" init><div id="main_button" class="main_menu_sibling" onmouseover onclick onmouseout><button><img id="main_button_image"/></button></div></widget>',
      'main_menu' : '<widget name="main_menu" init><div id="main_menu" class="menu" onmouseout ><h1 id="menu_title" >JSArmor</h1><ul><scope_widget></scope_widget><li class="block_all" formode="block_all" title="Block all scripts." oninit="mode_menu_item_oninit"><img>Block All</li><block_all_settings lazy></block_all_settings><li class="filtered" formode="filtered" title="Select which scripts to run. (current site allowed by default, inline scripts always allowed.)" oninit="mode_menu_item_oninit"><img>Filtered</li><li class="relaxed" formode="relaxed" title="Select which scripts to run. (current site allowed by default, inline scripts always allowed.)" oninit="mode_menu_item_oninit"><img>Relaxed</li><li class="allow_all" formode="allow_all" title="Allow everything…" oninit="mode_menu_item_oninit"><img>Allow All</li><li id="details_item" onclick="show_details">Details…</li></ul></div></widget>',
      'host_table' : '<widget name="host_table"><table id="host_table"></table></widget>',
      'host_table_row' : '<widget name="host_table_row"><table><tr  onclick><td width="1%"></td><td width="1%" class="td_not_loaded"><img/></td><td width="1%" class="td_checkbox"><input type="checkbox"></td><td width="1%" class="td_host">code.</td><td class="td_domain">jquery.com</td><td width="1%" class="td_iframe"><img/></td><td width="1%" class="td_allowed_globally allowed_globally"><img/></td><td width="1%" class="td_script_count">[x]</td></tr></table></widget>',
      'details_menu' : '<widget name="details_menu" init><div id="details_menu" class="menu" onmouseout="menu_onmouseout" ><h1 id="menu_title" >Scripts</h1><ul id="menu_content"><li id="last_item" onclick="options_menu">Options…</li></ul></div></widget>',
      'script_detail' : '<widget name="script_detail" host script init><li><img/><a></a></li></widget>',
      'options_menu' : '<widget name="options_menu"><div id="options_menu" class="menu" onmouseout="menu_onmouseout" ><h1 id="menu_title" >Options</h1><ul id="menu_content"><select_iframe_logic></select_iframe_logic><checkbox_item label="Show ui in iframes" id="show_ui_in_iframes" 		     title="" 		     state="`show_ui_in_iframes" 		     callback="`toggle_show_ui_in_iframes"/></checkbox_item><checkbox_item label="Auto-hide main button" 		     title="" 		     state="`autohide_main_button" 		     callback="`toggle_autohide_main_button"/></checkbox_item><select_menu_display_logic></select_menu_display_logic><li id="$id" onclick="edit_whitelist">Edit whitelist…</li><select_reload_method></select_reload_method><li class="separator"></li><li id="$id" onclick="null">Load custom style…</li><li id="$id" onclick="null">Save current style…</li><li class="separator"></li><li id="$id" onclick="export_settings">Save Settings…</li><li><form id="import_settings"><input type=file id=import_btn autocomplete=off oninit="import_settings_init" >Load Settings...</form></li><li id="$id" onclick="reset_settings">Clear All Settings…</li><li class="separator"></li><li id="$id" onclick="go_to_help_page">Help</li><li id="$id" onclick="null">About</li></ul></div></widget>',
      'select_iframe_logic' : '<widget name="select_iframe_logic" init><li id="iframe_logic" class="inactive" title="Block All: disable javascript in iframes. Filter: block if host not allowed in menu. Allow: treat as normal page, current mode applies (permissive here).">Scripts in iframes:<input type="radio" name="radio"/><label>Block All</label><input type="radio" name="radio"/><label>Filter</label><input type="radio" name="radio"/><label>Allow</label></li></widget>',
      'select_menu_display_logic' : '<widget name="select_menu_display_logic" init><li id="menu_display"  class="inactive">Menu popup:<input type="radio" name="radio"/><label>Auto</label><input type="radio" name="radio"/><label>Delay</label><input type="radio" name="radio"/><label>Click</label></li></widget>',
      'select_reload_method' : '<widget name="select_reload_method" init><li id="reload_method" class="inactive" title="Cache: reload from cache (fastest), Normal: slow but sure.">Reload method:<input type="radio" name="radio"/><label>Cache</label><input type="radio" name="radio"/><label>Normal</label></li></widget>',
      'whitelist_editor' : '<widget name="whitelist_editor" init><div class="menu" onmouseout="menu_onmouseout" ><h1 id="menu_title" >Global Whitelist</h1><ul id="menu_content"><li><textarea spellcheck="false" id="whitelist"></textarea></li><li class="inactive"><button onclick="save_whitelist">Save</button><button onclick="close_menu">Cancel</button></li></ul></div></widget>',
      'checkbox_item' : '<widget name="checkbox_item" id title label state callback init><li><input type="checkbox"/></li></widget>',
      'scope_widget' : '<widget name="scope_widget" init><li id="scope" class="inactive">Set for:<input type="radio" name="radio"/><label>Page</label><input type="radio" name="radio"/><label>Site</label><input type="radio" name="radio"/><label>Domain</label><input type="radio" name="radio"/><label>Global</label></li></widget>',
      'block_all_settings' : '<widget name="block_all_settings" init><block_inline_scripts></block_inline_scripts><checkbox_item label="Pretend Javascript Disabled" id="handle_noscript_tags" 		 title="Treat noscript tags as if javascript was disabled in opera. Useful to access the non-javascript version of websites." 		 state="`handle_noscript_tags" 		 callback="`toggle_handle_noscript_tags"/></checkbox_item></widget>',
      'block_inline_scripts' : '<widget name="block_inline_scripts" ><li id="block_inline_scripts"><input type="checkbox"/>Block Inline Scripts<div class="right_item">[-2k]</div></li></widget>'
    };

    /* init proxies (internal use only) */
    function script_detail_init_proxy(w, ph)
    {
        script_detail_init(w, ph.host, ph.script);
    }

    function checkbox_item_init_proxy(w, ph)
    {
        checkbox_item_init(w, ph.id, ph.title, ph.label, ph.state, ph.callback);
    }

    /* functions for creating widgets */
    function new_script_detail(host, script)
    {
      return new_widget("script_detail", function(w)
        {
          script_detail_init(w, host, script);
        });
    }

    function new_checkbox_item(id, title, label, state, callback)
    {
      return new_widget("checkbox_item", function(w)
        {
          checkbox_item_init(w, id, title, label, state, callback);
        });
    }


    
})(window.document, window.location, window.opera, window.opera.scriptStorage);
