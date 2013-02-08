// ==UserScript==
// @name jsarmor
// @author lemonsqueeze https://github.com/lemonsqueeze/jsarmor
// @description Block unwanted javascript. NoScript on steroids for opera !
// @license GNU GPL version 2 or later version.
// @published 2012-10-08 11:00
// ==/UserScript==


// This file is put together from the different bits and pieces in the repository.
// Besides code there's css, html and encoded images in there, so it looks a little
// like an extension all packed into one file.
// You can edit it directly if you really want, but if you're going to be hacking
// this thing i'd suggest cloning the repo and working in there instead.
// Then you can just type 'make' and it'll regenerate the whole thing.

// When running as userjs, document and window.document are the same,
// but when running as an extension they're 2 different things, beware !
(function(document, location, opera, scriptStorage)
{
    var version_number = "1.5.0";
    var version_type = "userjs";
    var version_full = "jsarmor v"+ version_number + " (" + version_type + ")";
    

    /************************* Default Settings *******************************/        
    
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

    // 'normal'  or  'cache'
    var default_reload_method = 'cache';
    
    /********************************* Globals *********************************/

    /* stuff load_global_settings() takes care of */
    var current_host;
    var current_domain;    
    var block_inline_scripts = false;
    var handle_noscript_tags = false;
    var reload_method;
    /* end */

    var message_handlers = { };
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
	init_core();
	register_ui();
	sync_init = true;
	// sync_init set
	
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
    
        
    /******************************** Normal init *******************************/

    function init_core()
    {
	setup_event_handlers();
	check_script_storage();
	load_global_settings();
	window.opera.jsarmor = new Object();	// external api
    }
	
    function load_global_settings()
    {
	load_global_context(location.hostname);
	init_iframe_logic();
	reload_method = global_setting('reload_method', default_reload_method);
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

    // running in rescue_mode ?
    function rescue_mode()
    {
	return (location.hash == '#jsarmor');
    }
    
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
    var iframe_message_header = "jsarmor lost iframe rescue channel:";
    var message_topwin_cant_display = "can't help you, i'm a frameset my dear";
    
    function init_iframe_logic()
    {
	show_ui_in_iframes = global_bool_setting('show_ui_in_iframes', default_show_ui_in_iframes);
	message_handlers[iframe_message_header] = iframe_message_handler;
	
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
    
    function iframe_message_handler(e, content)
    {
	var source = e.source;	// WindowProxy of sender
	// e.origin contains 'http://hostname' of the sender
	if (source === top.window)
	    message_from_parent(e, content);
	else
	    message_from_iframe(e, content);
    }

    // iframe instance making itself known to us. (works for nested iframes unlike DOM harvesting)
    function message_from_iframe(e, url)
    {
	// log("message from iframe: host=" + url_hostname(url));
	// fortunately this works even before domcontentloaded
	if (element_tag_is(document.body, 'frameset')) // sorry, can't help you
	{
	    e.source.postMessage(iframe_message_header + message_topwin_cant_display, '*');
	    return;
	}
	if (iframe_logic == 'filter') // it needs our hostname
	    e.source.postMessage(iframe_message_header + current_host, '*');
	add_iframe(url);			// add to menu so we can block/allow it.
	if (main_ui) // UIFIXME
	    repaint_ui();	
    }

    var topwin_cant_display = false;
    function message_from_parent(e, answer)
    {
	assert(!domcontentloaded, "received message from parent after domcontentloaded, that shouldn't happen !!");	
	// log("message from parent: host=" + answer);

	// crap, page uses frames. fall back to normal logic and show ui everywhere.	
	if (answer == message_topwin_cant_display)
	    topwin_cant_display = true;
	else
	    decide_iframe_mode(answer);
		
	async_init_finished(); // happy now =)
    }

    function decide_iframe_mode(parent_host)
    {
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

    function on_helper_blacklist(host)
    {
	var l = global_setting('helper_blacklist');
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
		 !on_helper_blacklist(host)));
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
    var domcontentloaded = false;
    function domcontentloaded_handler(e, deferred_call)
    {
	domcontentloaded = true;

	if (element_tag_is(document.body, 'frameset')) // frames, can't show ui in there !
	    return;
        if (!there_is_work_todo &&			// no scripts ?
	    !document.querySelector('iframe') &&	// no iframes ?
	    !rescue_mode())				// rescue mode, always show ui
            return;				// don't show ui.

	if (block_inline_scripts)
	    check_handle_noscript_tags();

	// don't display ui in iframes
	if (window != window.top &&
	    !topwin_cant_display &&
	    !show_ui_in_iframes)
	    return;
	
	init_ui();
    }

    function before_message_handler(ujs_event)
    {
	var e = ujs_event.event;
	var m = e.data;
	if (typeof(m) != "string")
	    return;
	for (var h in message_handlers)
	{
	    if (is_prefix(h, m))
	    {
		ujs_event.preventDefault();	// keep this conversation private.
		var content = m.slice(h.length);		
		(message_handlers[h])(e, content);
		return;
	    }
	}
	// not for us then.
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

    function setup_event_handlers()
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
	    
	    var val = scriptStorage.getItem(k);
	    if (val && val.indexOf('\n') == -1)	// i refuse to save any setting with newlines in it.
		settings[key] = val;
	}
    }
    
    function export_settings(e, as_text)
    {
	var glob = {};
	var host_settings = {};
	var s = "";
	get_all_settings_by_host(glob, host_settings)

	s += version_full + "\n\n";
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

	save_file(s, !as_text);
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
	
    function parse_settings_file(s)
    {
	var a = s.split('\n');
	if (!import_check_file(a))
	{
	    my_alert("This file doesn't look like a valid settings file.");
	    return;
	}	    
	scriptStorage.clear();	// clear current settings.
	import_settings(a);
	alert("Loaded !");
    }
	
    function reset_settings()
    {
	if (!confirm("WARNING: All settings will be cleared !\n\nContinue ?"))
	    return;
	scriptStorage.clear();
    }

    
    /**************************** Site settings editor stuff *************************/    

    // returns array of sites set to mode
    function all_settings_for_mode(mode)
    {
	var glob = {};
	var host_settings = {};
	var sites = [];
	get_all_settings_by_host(glob, host_settings)
	
	var hosts = get_keys(host_settings).sort();
	for (var i in hosts)
	{
	    var host = hosts[i];
	    if (host_settings[host]['mode'] == mode)
		sites.push(host);
	}
	return sites;
    }
    

    /********************************* Core ui *********************************/

    // whether to show jsarmor ui inside frames / iframes
    var default_show_ui_in_iframes = false;

    // use stored custom style ?
    var enable_custom_style = true;

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

    /****************************** Widget API *************************/

    // layout of interface used in jsarmor's iframe
    function init_layout()
    {
	// allow uppercase widget names, will be convenient later on...
	var n = widgets_layout;
	for (var i in widgets_layout)
	    n[i.toUpperCase()] = widgets_layout[i];
	widgets_layout = n;	
	
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

    // same as new_widget() but returns the <widget> wrapper. this is necessary if
    // the widget is actually a forest... (.forest is set on the div in this case)
    // init_proxy function is used to pass arguments to widget_init()
    function new_wrapped_widget(name, init_proxy)
    {
	name = name.toLowerCase();
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
	create_nested_widgets(wrap, false);
	call_oninit_handlers(wrap);	
	init_widget(wrap, wrap.firstChild, name, init_proxy);
	
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
	    node.oninit = null;  // don't let it get called again.
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
	// use custom style ?
	var use_custom = (enable_custom_style && !rescue_mode());
	var style = (use_custom ? global_setting('style') : '');
	style = (style == '' ? builtin_style : style);

	// style patches
	if (use_custom)
	    style += '\n' + global_setting('style_patch');
	new_style(style);
    }

    function populate_iframe()
    {
	iframe.contentWindow.name = 'jsarmor_iframe';
	iwin = iframe.contentWindow;
	idoc = iwin.document;

	// set doctype, we want strict mode, not quirks mode!
	idoc.open();
	idoc.write("<!DOCTYPE HTML>\n<html><head></head><body></body></html>");
	idoc.close();

	init_style();
	init_layout();
	start_ui();
    }

    function resize_iframe()
    {
	var content = idoc.body.firstChild;
	var width = content.scrollWidth;
	var height = content.scrollHeight;
	
	// submenu uses absolute positioning, need to take it into account.
	if (submenu)
	{
	    var e = submenu;	    
	    if (e.offsetLeft < 0)
	    {
		width += -e.offsetLeft;
		e.style.left = 0;
	    }
	    width = max(width, e.offsetLeft + e.realwidth);
	    if (e.offsetTop < 0)
	    {
		height += -e.offsetTop;
		e.style.top = 0;
	    }
	    height = max(height, e.realheight);
	}

	// extra space for menu shadows
	if (ui_hpos == 'left')
	    width += 30;
	if (ui_vpos == 'top')
	    height += 30;
	
	iframe.style.width = width + 'px';
	iframe.style.height = height + 'px';
    }    	    
    
    var iframe;
    var idoc;
    var iwin;
    function create_iframe()
    {
	iframe = document.createElement('iframe');
	iframe.id = 'jsarmor_iframe';
	iframe.style = "position:fixed !important;background:transparent !important;white-space:nowrap !important;z-index:2147483647 !important;direction:ltr !important;font-family:sans-serif !important; font-size:small !important; margin-bottom:0px !important;" +
 "width: 1px !important; height: 1px !important;"   +
	"margin-top: 0px !important; margin-right: 0px !important; margin-bottom: 0px !important; margin-left: 0px !important; padding-top: 0px !important; padding-right: 0px !important; padding-bottom: 0px !important; padding-left: 0px !important; border-top-width: 0px !important; border-right-width: 0px !important; border-bottom-width: 0px !important; border-left-width: 0px !important; border-top-style: none !important; border-right-style: none !important; border-bottom-style: none !important; border-left-style: none !important; background-color: transparent !important; visibility: visible !important; content: normal !important; outline-width: medium !important; outline-style: none !important; background-image: none !important; min-width: 0px !important; min-height: 0px !important; " +
// useful for layout debugging
//	"border: 1px solid #CCC !important; " +	
	ui_vpos + ':1px !important;' + ui_hpos + ':1px !important;';
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

    function truncate(s, max)
    {
	if (s.length > max)
	    return s.slice(0, max) + "[…]";
	return s;
    }

    function truncate_left(s, max)
    {
	if (s.length > max)
	    return "[…]" + s.slice(s.length - max);
	return s;
    }
    
    // split url into [host, dir, file, tail]
    function split_url(u)
    {
	// FIXME: can't we just use the builtin parser like url_hostname() ?
	//        http://www.joezimjs.com/javascript/the-lazy-mans-url-parsing/
	u = strip_http(u);
	var a = u.match(/^([^/]*)(\/|\/.*\/)([\w-.]*)([^/]*)$/);
	assert(a, "split_url(): shouldn't happen");
	return a.slice(1);
    }
    
    function strip_url_tail(u)
    {
	var a = split_url(u);
	return a[0] + a[1] + a[2]; // host + dir + file
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

    function set_class(n, klass)
    {
	n.className += ' ' + klass;
    }
    
    function unset_class(n, klass)
    {
	n.className = n.className.replace(' ' + klass, '');
    }

    function set_unset_class(n, klass, set)
    {
	(set ? set_class(n, klass) : unset_class(n, klass));
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

    function array_to_list(a)
    {
	return ('. ' + a.join(' '));
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

    // str: text from textarea
    function raw_string_to_list(str)
    {
	var a = textarea_lines_nows(str);
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

    // array of lines from textarea input, all whitespace cut out
    function textarea_lines_nows(str)
    {
	return textarea_lines(no_whitespace(str));
    }

    // array of lines from textarea input
    function textarea_lines(str)
    {
	return (str.split('\r\n'));
    }
    
    /**************************** String functions *******************************/

    function no_whitespace(s)
    {
	return (s.replace(/ */g, ''));
    }
    
    function is_prefix(p, str)
    {
	return (str.slice(0, p.length) == p);
    }
    
    /**************************** Misc utils *******************************/

    function min(a, b) { return (a < b ? a : b); }
    function max(a, b) { return (a > b ? a : b); }
    
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

    function file_loader(callback)
    {
	return function(e) {
	var files = e.target.files; // FileList object
	var f = files[0];
	var reader = new FileReader();
	
	reader.onload = function(e) { callback(e.target.result); };	
	reader.readAsBinaryString(f);
	//reader.readAsText(f);
	}
    }

    function save_file(s, binary)
    {
	var url = "data:text/plain;base64,";
	if (binary)
	    url = "data:application/binary;base64,";
	location.href = url + btoa(s);
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

    var default_ui_position = 'bottom_right';
    var default_autohide_main_button = false;
    var default_transparent_main_button = true;
    var default_fat_icons = false;
    var default_small_font = false;
    var default_menu_display_logic = 'auto';
    var default_show_scripts_in_main_menu = true;
    
    // can be used to display stuff in jsarmor menu from outside scripts.
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
	
	// window.opera.jsarmor.toggle_menu() api for opera buttons etc...
	message_handlers['jsarmor_toggle_menu'] = api_toggle_menu;
	window.opera.jsarmor.toggle_menu = function() { window.postMessage('jsarmor_toggle_menu', '*'); };
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

	idoc.body.className += ' ' + ui_hpos + ' ' + ui_vpos;
	
	repaint_ui_now();
	resize_iframe();
	
	if (rescue_mode())
	    my_alert("Running in rescue mode, custom style disabled.");
    }
    
    function create_main_ui()
    {
	main_ui = new_widget("main_ui");
	set_unset_class(idoc.body, 'fat_icons', fat_icons);	// slightly evil
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
	var load_style = function(s)
	{
	    set_global_setting('style', s);
	    alert("Loaded !");
	    need_reload = true;
	};
	this.onchange = file_loader(load_style);
    }

    function save_current_style()
    {
	save_file(builtin_style, true);
    }

    function edit_style_patch()
    {
	var w = new_editor_window("Patch Style",
				  global_setting('style_patch'),
				  '',
				  function(text)
        {
	   set_global_setting('style_patch', text);
	   need_reload = true;
	   close_menu();
	});
	w.id = 'patch_style';
	switch_menu(w);
    }	
    
    function clear_saved_style_init()
    {	
	if (global_setting('style') == '' &&
	    global_setting('style_patch') == '')
	    this.disabled = true;
    }
    
    function clear_saved_style()
    {	
	set_global_setting('style', '');
	set_global_setting('style_patch', '');
	alert("Cleared !");
	need_reload = true;
    }

    function rescue_mode_link_init()
    {
	var label = (!rescue_mode() ? 'Rescue mode' : 'Leave rescue mode');
	var hash  = (!rescue_mode() ? '#jsarmor' : '#' );
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
	// FIXME !! need_repaint should work there !!
	// need_repaint = true;
	need_reload = true;
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

    function toggle_transparent_main_button(event)
    {
	transparent_main_button = toggle_global_setting(this, transparent_main_button, 'transparent_main_button');
	// need_repaint is all we need !
	need_reload = true;
    }

    function toggle_fat_icons(event)
    {
	fat_icons = toggle_global_setting(this, fat_icons, 'fat_icons');
	// need_repaint is all we need !
	need_reload = true;
    }

    function toggle_small_font(event)
    {
	small_font = toggle_global_setting(this, small_font, 'small_font');
	// need_repaint is all we need !
	need_reload = true;
    }
    
    function toggle_disable_main_button(event)
    {
	disable_main_button = toggle_global_setting(this, disable_main_button, 'disable_main_button');
	// need_repaint is all we need !
	need_reload = true;
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
	var left = (ui_hpos == 'right' ?
		    tr.left - sub.offsetWidth - 3 :
		    tr.right + 2);
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
	if (!menu_shown())
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
	if (iframe_logic == 'allowed')
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
		tr.childNodes[6].className += " visible";
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
    }

    var builtin_style = 
"/* jsarmor stylesheet */  \n\
  \n\
body			{ margin:0px; background:transparent; white-space:nowrap; font-family:Ubuntu,Tahoma,Sans; }  \n\
body.small_font		{ font-size:small; }  \n\
  \n\
#main			{ position:absolute; width:auto; height:auto; margin-bottom:0px; }  \n\
  \n\
/* main button */  \n\
#main_button		{ border-width: 2px; margin: 0; float: none; }   \n\
  \n\
.autohide		{ visibility:hidden; }  \n\
:hover .autohide	{ visibility:visible }  \n\
  \n\
  \n\
/*************************************************************************************************************/  \n\
/* left/right/top/bottom layouts */  \n\
  \n\
body.right		{ direction:rtl; }  \n\
body.right #main	{ direction:ltr; right:0; z-index:1; }  \n\
body.right .submenu	{ z-index:0 }  \n\
body.right #main_button	{ direction:rtl; }  \n\
  \n\
body.left		{ direction:ltr; }  \n\
body.left #main		{ direction:ltr; left:0;  z-index:0; }  \n\
body.left .submenu	{ z-index:1 }  \n\
body.left #main_button	{ direction:ltr; }  \n\
  \n\
body.bottom #main	{ bottom:0; /* bottom align */ }  \n\
body.top #main		{ top:0;    /* top align */ }  \n\
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
.td_not_loaded img		{ width:16px; height:16px; }  /* take up space even if all are empty */  \n\
.fat_icons .td_not_loaded img	{ width:22px; height:22px; }  /* take up space even if all are empty */  \n\
/* .td_checkbox */  \n\
.td_host		{ color:#888; text-align:right; }  \n\
.td_domain		{ color:#333; }  \n\
.helper			{ color:#000; } /* helper domain */  \n\
/* .td_iframe */  \n\
.td_allowed_globally img		{ visibility:hidden; padding: 0px 3px; width:14px; height:14px;  \n\
					  vertical-align:middle; background-size:contain; }  \n\
.td_allowed_globally:hover img		{ visibility:visible; }   \n\
.td_allowed_globally.visible img	{ visibility:visible; }  \n\
.td_script_count			{ text-align:right; }  \n\
  \n\
/* submenu */  \n\
.submenu		{ position:absolute; }  \n\
  \n\
#options_details table				{ width:100% }  \n\
.details_item , .options_item			{ text-align:center; }  \n\
.details_item label, .options_item label	{ display:block; width:92%;  \n\
						  border-radius:6px; padding:1px 5px; text-decoration:none; }  \n\
.details_item label:hover, .options_item label:hover	{ background:#ddd }  \n\
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
img	{ width:1px; height:1px; vertical-align:middle;   \n\
	  background-size:contain; background-repeat:no-repeat; background-position:center }  \n\
  \n\
.block_all img,  .filtered  img,  .relaxed  img,  .allow_all img { width:18px; height:18px; }  \n\
.fat_icons .block_all img, .fat_icons .filtered img, .fat_icons .relaxed img, .fat_icons .allow_all img   \n\
{ width:22px; height:22px; }  \n\
  \n\
.fat_icons .allowed img, .fat_icons .blocked img, .fat_icons .not_loaded img  { width:22px; height:22px; }  \n\
/* left out:  .allowed_globally .*iframe */  \n\
  \n\
.block_all img		{ background-image:-o-skin('Smiley Pacman'); }  \n\
.filtered  img		{ background-image:-o-skin('Smiley Cool'); }  \n\
.relaxed   img		{ background-image:-o-skin('Smiley Tongue'); }  \n\
.allow_all img		{ background-image:-o-skin('Smiley Cry'); }  \n\
  \n\
.allowed img		{ width:16px; height:16px; background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAAVdEVYdENyZWF0aW9uIFRpbWUAMTkvNS8wOcYlgL0AAAGASURBVDiNpZPLK0RRHMc/xz3FxmNBSEosBkVXSpQyFqRYTB4Lq2ujbCby/AuUZDESCyuWUwwp2ciwF3cjbMjWCoW45xoLznXnwcL86tSv7+/7e/+OSCQSZCM5WXkDUitCCA+c3c0dAcYB8xuygeXF0NuG5ujKhacIwexubhEQ9zmmig10LobeHrSf9FuVMv5y5tsWB5o04M0gHC2wHFeajivJ9KzWKHVlIRxXmuFogZU2A6WMid/SdgbGaKzoI08WcXZ3ADABbCZVoFxpKleiXElNcQdaLy806W2Y4+X9kdX4iMa9Nr0AjjJwlEFL1TBT3TsMNc/jKAOrbQUQLBwM8PT67PEytCBtwDy5ihEobaerfhSzsoeS/ErWTya5vb/20+30AK4RATYA1o5m+EgIOgKDbJ1GiF/GgJ+sQEQrSXcwsFJ9jm+Nwdp+jq9iqTO1t8M3TZnvwJVB4FgHObzYS6XYQNAPJFWgpXepzuJrVf5TjuxPX25qTtop/1ey/o2ftG6clPyKKlYAAAAASUVORK5CYII='); }  \n\
.blocked img		{ width:16px; height:16px; background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAAVdEVYdENyZWF0aW9uIFRpbWUAMTkvNS8wOcYlgL0AAAEHSURBVDiNpZNBagIxFIa/iAfoIRSKLXRc1YUL3XXRCwjCFC9QjzK9gOiqV+huNm66Mou2COMhPIB56aImTTIwgvND4OUlf/K/lz/KWksbdFqxga4LlFI+eViMX4BXIDunNPDWW23Xbo9TrnygFIfF+AYoA2IKDUx7q+3R8brhqjXSROa8VgJDl/A9qOajHCMZRrgwsmo+yms9sCdZhlf13z+jq6vZYzhdApv4ACNN0rFG0lISBfGGSwd4/PvAiI5qTRH3QdcVnKQA1m6+f35oElS4IPLBz9P9juZnBNCDj6+h48VWNjKplZJKNzIJKZECh+/pbc7fU4VWLu7K/caXnFr5WrT+jb97bZAgYc+wFgAAAABJRU5ErkJggg==') }  \n\
.not_loaded img		{ width:16px; height:16px; background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADBQTFRFAAAA////AAAAAAAAAAAAAAAAAAAAAAAAkAAAlwAAtAAAvgAAyAAA0QAA2AAA3QAA7lpb0AAAAAh0Uk5TAAAMEx4wP0EqzeGOAAAAQElEQVQIW2MShAImBigAMT7JQxk2Rz5AGP8/KUAZH6FS/z/gZJzaBxO5+wDCMAtiQDPnzH2oCM9eqBrG9wIMDABr1Bip1wrS4AAAAABJRU5ErkJggg==') }  \n\
.iframe	img		{ width:16px; height:16px; background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAAVdEVYdENyZWF0aW9uIFRpbWUAMTkvNS8wOcYlgL0AAAJdSURBVDiNpZPNS1RRGMZ/Zz69M+rAmFY6BZph9ClB1E6tRWGQGwkK+gOEwFlGIAy4yVUjBP0BUeHSIGlVuhAqQ5QKElMhVGYcZ3Q+79xz7tzbYuyO6dIDZ/M+5/2d9zw8R9i2zVGW52Chf3StF4iGGvwDWl1VLukmuYIxCcSnRtqn958X+yfoH12Ln2gODnd1NOH3ubGsat0lwFAVllbTJFLF8amR9ughwJ3YcvxiV8twS1OQggH5ss3Kt/cAdF67S0OdoN4Pye0iP5a2xj/EzkYdwM0nC73Hmxs/XT7XRipvo6sq9OUjDYChVzoCCPgF4aDg+68Nkqlc38dn3dMuAKmXoh2nwqTzimxRIqVCSuU8TUqFIRU7eUkmr2iPhJF6KeqYWOdnQAjB1o6BtWdJavUrfUM7ALRduu3AthVEmjz4fQw4ALcApUzKRu3W59FbnI/4ALgfT9SmAQxp43HtGQygpI40zP/209dbtaYDmpIVlNRrOdhNZzBNE8s0Ma3Dwdrvh8ctsCqC3XSmNkEqsTGZzxWo91soqZCGIrk86zQll2eRRrUe9FrksgVSiY1JByDLxfji/Bya18bvtjCkYmJs0AFMjA1iSIXmtQn4bBbn55DlYtzJAUD4+kj86o2e4ZNtp8mVKmTyCmlWNZ9XEG7wEgq42Vz/w/znmfHMl9FakIQQASASuvI41nqm+0HXhW40TaOyF2W3C3RdZ+nnApsrC2+ziy9iwLpt26V/ADfQCmjBjnu93lDnw8ZjkR4tUA+AXiqQ216fUdnfb4qr76YBHdi0bbsijvqd/wLzRz8kxE0gIwAAAABJRU5ErkJggg==') }  \n\
.blocked_iframe img	{ width:16px; height:16px; background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEgAACxIB0t1+/AAAAAd0SU1FB90CAg8VBIk5W4oAAAI2SURBVDjLpZOxTxsxFIc/u76g5JZDQAURDEgwIQa2bKUbW1jb/wBFgmxs2dkCUljZ2hWY2EqZwpKFIRJEYgBVkQCdBHfnnH3HdWmOpIxYeov9/Pn93u9ZZFnGR5b6f6PVaq0Dddd1q4VCAYA4jomi6ARo1mq189F8MVpBq9VqTk5O7iwsLOA4DsMzIQTWWu7u7vB9f79Wq9XfAQ4ODpqLi4s7nudhjCGOYy4vLwGoVCpMTExQKBTwfZ/b29v97e3teg7Y29tbn5qa+rW0tEQYhlhrAdjc3ATg+PgYIQSO41Aqlej1ejw9PX3d3d09lwCDwaBeLpcJgoAoirDW5hAAay3GGMIwJAgC5ubmGAwG9byJSqmqEILn5+dc9/X1dS5hbW0thyVJgud5KKWqOUBKibWWOI7zxK2tLWZnZwE4Ojoac8oYg5QSADm0aVj2ME5PT8ckjEaSJPljCsD3fZIkIU1TXl9f3w3LaD+klKRpiu/7bxX0+/2TIAhwHCdvWLfbzS91u12MMRhjcByHl5cX+v3+SQ7QWjc7nQ5KKaSUGGNoNBo5oNFoYIxBKYVSik6ng9a6OTZIGxsbzUqlsjM/P4/WmjAMSZKEfy7hui7FYpH7+3va7fb+2dnZm41CiBJwqLX+vLy8/G1lZQXP88ZGWWtNu93m5ubm58XFxaEQopRlWSSyLEMI8QkoA8XV1dX16enp7zMzM19c1wUgDEMeHh5+Pz4+/ri6ujoHNPAny7JUfPQ7/wU6Sj1iFxnCnwAAAABJRU5ErkJggg==') }  \n\
  \n\
/* 'script allowed globally' icon */  \n\
.allowed_globally img		{ width:16px; height:16px; background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABV0RVh0Q3JlYXRpb24gVGltZQAxOS81LzA5xiWAvQAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNAay06AAAAI4SURBVDiNlZNNSFRRGIafe+feuToqDWL5U4wmM+Mm0magsM20qEXSImgRhgTR376gTYtoWbQuMpcpuW0RrUIIwdCEMQO1CY0w/6AmlTv3zpyfFre8CVp44CzO4bzP974f5zNWHnUnXNfI+z5x9rAch2Ispjst1zXyhh2LJ44ksasd0Pq/4rJXZnWmEHddN2/5PoHY8NArcyA8YBeIYYLlEN3XyoGOJF8np+IWgF0VRS9PY195C4D+XkAvTaKmh9GbSyFAK6iU0D/miTYeBcD6c6/KIixUn8SoT2KmepAfhhETA9udCA9T6hCgpEYJjTdwBqMhReRwjkh7DqOuiUj2KkZzhvKrO2h/I4SoAGAC6N8A++wDzLYcojBCabCPyrugstlyjOj5xyiht7aWhAAlNVIoIgcz2F0XqbrwBOfcQ/ypl5Re3w8eNqSwjl9DCoUUCiXVdoASGm+0H7k6B0DkUIaay0NUFt7jjfYD4HRfh5rmwIXcIYI78pSfz3rZeH4D7W9iOLXEeu5RGhtC+5sARDO9O0UAJTTVp29T19ePkrD+4lbQ5UQWsyFNaWwwOLdmd3dQfeISdmuWWO4mfmEcsRzEsdOnKH+eCACNaZQMNKEDpVE6glgKBJXFmaAnH98EoqYOvE/j4X8yqrYcGDN3T+r6ljRUPMTaPLpc+uc8GE4NdmM70nIoLs5imUoW19e+xGv3t2EnOncV/oVAygobqwuYShYtS4lO4bv54rfZPY2zqWTRUrLrF4hoKuU62VtvAAAAAElFTkSuQmCC') }  \n\
  \n\
.menu {  \n\
	padding: 1px 1px; text-align:left; direction:ltr;  \n\
	box-shadow: 8px 10px 10px rgba(0,0,0,0.5), inset 2px 3px 3px rgba(255,255,255,0.75);  \n\
	border-radius: 5px; border-width: 2px; border-style: outset; border-color: gray;  \n\
	display:table; background: #ccc;   \n\
}  \n\
  \n\
/* menu title */  \n\
h1	{ color:#fff; font-weight:bold; font-size: 1em; text-align: center;  \n\
	  margin:0;  \n\
	  background:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAYCAYAAAA7zJfaAAAAAXNSR0IArs4c6QAAAAZiS0dEAAAAAAAA+UO7fwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB90BFRUGLEa8gbIAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAUElEQVQI102KOwqAQBDFsm+9/3Fs9RqChdgIVjYi6nxsLLYJCYSc+xTLgFhHhD8t0m5kAQo39Jojj0RuLzquQLUkUuG3qtJmJ9plOyua9uADjaopUrsHkrMAAAAASUVORK5CYII=') repeat-x;}  \n\
  \n\
/* menu item stuff */  \n\
.right_item		{ float:right; }  \n\
  \n\
ul			{ padding:0; margin:0 }  \n\
ul ul			{ margin-left:1em }  \n\
li			{ list-style:none; border-radius:6px; }  \n\
  \n\
li:hover		{ background:#ddd } /* items active by default */  \n\
li.inactive:hover	{ background:inherit }  \n\
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
#options_menu li:hover	{ background:inherit }  \n\
/* how do we add cell spacing ??  \n\
#options_menu table	{ cell-spacing: 5px; }  \n\
*/  \n\
#options_menu td	{ vertical-align:top; }  \n\
  \n\
.separator	{ height: 1px; display: block; background-color: #bbb; margin-left: auto; margin-right: auto; }  \n\
  \n\
.frame		{ border:1px solid #bbb; margin:10px; padding:9px; position:relative; min-width:200px; }  \n\
.frame_title	{ position:absolute; top:-10px; background: #ccc; }  \n\
  \n\
/* file input form styling: http://www.quirksmode.org/dom/inputfile.html */  \n\
#import_settings, #load_custom_style  \n\
	{ display:inline-block; position:relative; overflow:hidden; vertical-align:text-bottom }  \n\
#import_settings input, #load_custom_style input  \n\
	{ display:block; position:absolute; top:0; right:0; margin:0; border:0; opacity:0 }  \n\
  \n\
.dropdown_setting		{ width:100% }  \n\
.dropdown_setting td + td	{ text-align:right; }  \n\
.dropdown_setting select	{ width:100% }  \n\
  \n\
.button_table  *		{ width:100% }  \n\
  \n\
#patch_style textarea		{ width: 700px; height: 200px; }  \n\
  \n\
/**********************************************************************************************************   \n\
 * transparent button   \n\
 * http://www.dreamtemplate.com/dreamcodes/documentation/buttons_transparent.html  \n\
 */  \n\
  \n\
.tbutton {  \n\
	border: 1px solid rgba(0,0,0,0.2); box-sizing: content-box !important; color: #f5f5f5; cursor: pointer;  \n\
	display: inline-block; padding: 2px 10px; text-align: center; text-decoration: none; white-space: normal;  \n\
	text-shadow: 0 0 5px rgba(0,0,0,0.2), 0 0 1px rgba(0,0,0,0.4); outline: none;   \n\
	-o-transition: all 200ms ease 0ms !important; 	/* Transition */  \n\
	background: none repeat scroll 0 0 rgba(255,255,255,0.04); 	/* Background Color */  \n\
	border-radius: 3px; 	/* Border Rounding */  \n\
	background-clip: padding-box; 	/* Background Clipping */  \n\
	box-shadow: 0 0 3px rgba(255,255,255,0.25) inset, 0 0 1px rgba(255,255,255,0.2), 0 10px 10px rgba(255,255,255,0.08) inset;  \n\
	box-shadow: 0 0 3px rgba(255,255,255,0.25) inset, 0 0 1px rgba(255,255,255,0.2), 0 10px 10px rgba(255,255,255,0.08) inset;  \n\
}  \n\
  \n\
.tbutton:hover {  \n\
	color: #fff; text-shadow: 0 0 5px rgba(0,0,0,0.2), 0 0 1px rgba(0,0,0,0.4);	  \n\
	box-shadow: 0 0 5px rgba(255,255,255,0.45) inset, 0 0 1px rgba(255,255,255,0.2), 0 10px 10px rgba(255,255,255,0.08) inset;  \n\
 }  \n\
  \n\
.tbutton:active {  \n\
	color: #eee;  \n\
	box-shadow: 0 0 5px rgba(255,255,255,0.1) inset, 0 0 1px rgba(255,255,255,0.2), 0 0 4px rgba(0,0,0,0.4) inset, 0 10px 10px rgba(255,255,255,0.08) inset;  \n\
 }  \n\
  \n\
";

    /* layout for each widget (generated from jsarmor.xml). */
    var widgets_layout = {
      'main_ui' : '<widget name="main_ui"><div id="main"><main_button lazy/></div></widget>',
      'main_button' : '<widget name="main_button" init><div id="main_button" class="main_menu_sibling" onmouseover onclick onmouseout><button><img id="main_button_image"/></button></div></widget>',
      'main_menu' : '<widget name="main_menu" init><div id="main_menu" class="menu" onmouseout onmousedown="menu_onmousedown"><h1 id="menu_title" >JSArmor</h1><ul><scope_widget></scope_widget><li class="block_all" formode="block_all" title="Block all scripts." oninit="mode_menu_item_oninit"><img/>Block All</li><block_all_settings lazy></block_all_settings><li class="filtered" formode="filtered" title="Select which scripts to run. (current site allowed by default, inline scripts always allowed.)" oninit="mode_menu_item_oninit"><img/>Filtered</li><li class="relaxed" formode="relaxed" title="Select which scripts to run. (current site allowed by default, inline scripts always allowed.)" oninit="mode_menu_item_oninit"><img/>Relaxed</li><li class="allow_all" formode="allow_all" title="Allow everything…" oninit="mode_menu_item_oninit"><img/>Allow All</li><li id="options_details" class="inactive"><table><tr><td class="options_item"><label onclick="options_menu">Options</label></td><td class="details_item"><label onclick="show_details">Details</label></td></tr></table></li></ul></div></widget>',
      'host_table' : '<widget name="host_table"><table id="host_table"></table></widget>',
      'host_table_row' : '<widget name="host_table_row"><table><tr  onclick onmouseover onmouseout><td width="1%"></td><td width="1%" class="td_not_loaded"><img/></td><td width="1%" class="td_checkbox"><input type="checkbox"/></td><td width="1%" class="td_host">code.</td><td class="td_domain">jquery.com</td><td width="1%" class="td_iframe"><img/></td><td width="1%" class="td_allowed_globally allowed_globally"><img/></td><td width="1%" class="td_script_count">[x]</td></tr></table></widget>',
      'submenu' : '<widget name="submenu" ><div class="submenu menu" onmouseout="menu_onmouseout" onmousedown="menu_onmousedown"><ul id="menu_content"></ul></div></widget>',
      'details_menu' : '<widget name="details_menu" init><div id="details_menu" class="menu" onmouseout="menu_onmouseout" onmousedown="menu_onmousedown"><h1 id="menu_title" >Details</h1><ul id="menu_content"><li id="last_item" onclick="options_menu">Options…</li></ul></div></widget>',
      'script_detail' : '<widget name="script_detail" host_node script iframe file_only init><li><img/><a></a></li></widget>',
      'options_menu' : '<widget name="options_menu"><div id="options_menu" class="menu" onmouseout="menu_onmouseout" ><h1 id="menu_title" >Options</h1><table><tr><td><div class="frame"><div class="frame_title">User Interface</div><checkbox_item label="Auto-hide main button" klass="button_ui_setting"  		   state="`autohide_main_button"  		   callback="`toggle_autohide_main_button"></checkbox_item><checkbox_item label="Transparent button !" klass="button_ui_setting"  		   state="`transparent_main_button"  		   callback="`toggle_transparent_main_button"></checkbox_item><disable_main_button></disable_main_button><checkbox_item label="Fat icons"   		   state="`fat_icons"  		   callback="`toggle_fat_icons"></checkbox_item><checkbox_item label="Small font"   		   state="`small_font"  		   callback="`toggle_small_font"></checkbox_item><checkbox_item label="Script popups in main menu" id="show_scripts_in_main_menu"  		   title="!! experimental !!"  		   state="`show_scripts_in_main_menu"  		   callback="`toggle_show_scripts_in_main_menu"></checkbox_item><select_menu_display_logic></select_menu_display_logic><select_ui_position></select_ui_position></div><div class="frame"><div class="frame_title">Core</div><select_iframe_logic></select_iframe_logic><select_reload_method></select_reload_method><checkbox_item label="Show ui in iframes" id="show_ui_in_iframes"  		   state="`show_ui_in_iframes" title="For debugging mostly."  		   callback="`toggle_show_ui_in_iframes"></checkbox_item></div><div class="frame"><div class="frame_title">Edit Settings</div><table class="button_table"><tr><td><button onclick="edit_site_settings" title="View/edit site specific settings." >Site settings…</button></td></tr><tr><td><button onclick="edit_whitelist" title="" >Global whitelist…</button></td></tr><tr><td><button onclick="edit_blacklist" title="Stuff relaxed mode should never allow by default" >Helper blacklist…</button></td></tr></table></div></td><td><div class="frame"><div class="frame_title">Custom Style</div><table class="button_table"><tr><td><button onclick="edit_style_patch" title="Add rules on top of current stylesheet." >Patch style…</button></td></tr><tr><td><li><form id="load_custom_style"><input type="file" autocomplete="off" oninit="load_custom_style_init" /><button>Load stylesheet…</button></form></li></td></tr><tr><td><button onclick="save_current_style" title="" >Save stylesheet…</button></td></tr><tr><td><button onclick="clear_saved_style" title="" oninit=clear_saved_style_init>Back to default</button></td></tr></table><a oninit="rescue_mode_link_init">Rescue mode</a></div><div class="frame"><div class="frame_title">Import / Export</div><table class="button_table"><tr><td><li><form id="import_settings"><input type="file" autocomplete="off" oninit="import_settings_init" /><button>Load settings…</button></form></li></td></tr><tr><td><button onclick="export_settings_onclick" title="shift+click to view" >Save settings…</button></td></tr><tr><td><button onclick="reset_settings" title="" >Clear Settings…</button></td></tr></table></div><div class="frame"><div class="frame_title"></div><a href="https://github.com/lemonsqueeze/jsarmor">Help</a></div></td></tr></table></div></widget>',
      'select_ui_position' : '<widget name="select_ui_position" init><table id="ui_position" class="dropdown_setting"><tr><td>Position</td><td><select><option value="top_left">top left</option><option value="top_right">top right</option><option value="bottom_left">bottom left</option><option value="bottom_right">bottom right</option></select></td></tr></table></widget>',
      'disable_main_button' : '<widget name="disable_main_button" init><checkbox_item label="Disable main button"  		 title="Install opera button and use it to come back here first."  		 state="`disable_main_button"  		 callback="`toggle_disable_main_button"></checkbox_item></widget>',
      'select_iframe_logic' : '<widget name="select_iframe_logic" init><table id="iframe_logic" class="dropdown_setting"   	 title="Block All: disable javascript in iframes. Filter: block if host not allowed in menu. Allow: treat as normal page, current mode applies (permissive)."><tr><td>Iframe policy</td><td><select><option value="block_all">Block All</option><option value="filter">Filter</option><option value="allow">Allow</option></select></td></tr></table></widget>',
      'select_menu_display_logic' : '<widget name="select_menu_display_logic" init><table id="menu_display"  class="dropdown_setting"><tr><td>Menu popup</td><td><select><option value="auto">Auto</option><option value="delay">Delay</option><option value="click">Click</option></select></td></tr></table></widget>',
      'select_reload_method' : '<widget name="select_reload_method" init><table id="reload_method" class="dropdown_setting"   	 title="Cache: reload from cache (fastest but…). Normal: slow but sure."><tr><td>Reload method</td><td><select><option value="cache">Cache</option><option value="normal">Normal</option></select></td></tr></table></widget>',
      'editor_window' : '<widget name="editor_window" title text default_setting save_callback init><div class="menu editor" ><h1 id="menu_title" >Editor</h1><editor></editor></div></widget>',
      'editor' : '<widget name="editor" text default_setting save_callback init><ul class="editor"><li><my_textarea></my_textarea></li><li class="inactive"><button class="save">Save</button><button onclick="close_menu">Cancel</button><button class="default">Default</button></li></ul></widget>',
      'my_textarea' : '<widget name="my_textarea"><textarea class="textarea" spellcheck="false"></textarea></widget>',
      'site_settings_editor' : '<widget name="site_settings_editor" init><div class="menu editor" ><h1 id="menu_title" >Site Settings</h1><table><tr><td><ul><li class="block_all" formode="block_all" title="Block all scripts." oninit="mode_menu_item_oninit"><img/>Block All</li><li class="filtered" formode="filtered" title="" oninit="mode_menu_item_oninit"><img/>Filtered</li><li class="relaxed" formode="relaxed" title="" oninit="mode_menu_item_oninit"><img/>Relaxed</li><li class="allow_all" formode="allow_all" title="Allow everything…" oninit="mode_menu_item_oninit"><img/>Allow All</li></ul></td><td><editor></editor></td></tr></table></div></widget>',
      'checkbox_item' : '<widget name="checkbox_item" id title label state callback klass init><li><input type="checkbox"/></li></widget>',
      'scope_widget' : '<widget name="scope_widget" init><li id="scope" class="inactive">Set for:<input type="radio" name="radio"/><label>Page</label><input type="radio" name="radio"/><label>Site</label><input type="radio" name="radio"/><label>Domain</label><input type="radio" name="radio"/><label>Global</label></li></widget>',
      'block_all_settings' : '<widget name="block_all_settings" init><block_inline_scripts></block_inline_scripts><checkbox_item label="Pretend Javascript Disabled" id="handle_noscript_tags"  		 title="Treat noscript tags as if javascript was disabled in opera. Useful to access the non-javascript version of websites."  		 state="`handle_noscript_tags"  		 callback="`toggle_handle_noscript_tags"/></checkbox_item></widget>',
      'block_inline_scripts' : '<widget name="block_inline_scripts" ><li id="block_inline_scripts"><input type="checkbox"/>Block Inline Scripts<div class="right_item">[-2k]</div></li></widget>'
    };

    /* init proxies (internal use only) */
    function script_detail_init_proxy(w, ph)
    {
        script_detail_init(w, ph.host_node, ph.script, ph.iframe, ph.file_only);
    }

    function editor_window_init_proxy(w, ph)
    {
        editor_window_init(w, ph.title, ph.text, ph.default_setting, ph.save_callback);
    }

    function editor_init_proxy(w, ph)
    {
        editor_init(w, ph.text, ph.default_setting, ph.save_callback);
    }

    function checkbox_item_init_proxy(w, ph)
    {
        checkbox_item_init(w, ph.id, ph.title, ph.label, ph.state, ph.callback, ph.klass);
    }

    /* functions for creating widgets */
    function new_script_detail(host_node, script, iframe, file_only)
    {
      return new_widget("script_detail", function(w)
        {
          script_detail_init(w, host_node, script, iframe, file_only);
        });
    }

    function new_editor_window(title, text, default_setting, save_callback)
    {
      return new_widget("editor_window", function(w)
        {
          editor_window_init(w, title, text, default_setting, save_callback);
        });
    }

    function new_editor(text, default_setting, save_callback)
    {
      return new_widget("editor", function(w)
        {
          editor_init(w, text, default_setting, save_callback);
        });
    }

    function new_checkbox_item(id, title, label, state, callback, klass)
    {
      return new_widget("checkbox_item", function(w)
        {
          checkbox_item_init(w, id, title, label, state, callback, klass);
        });
    }



    /********************************* Defaults ************************************/

    var default_global_whitelist =
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
    var default_helper_blacklist =     // FIXME add ui to edit ?
    [ 'apis.google.com',	// only used for google plus one
      'widgets.twimg.com',	// twitter
      'static.ak.fbcdn.net'	// facebook
    ];

    
    /********************************* Startup ************************************/    

    function main()
    {
	// jsarmor ui's iframe, don't run in there !
	if (window != window.top && window.name == 'jsarmor_iframe')	// TODO better way of id ?
	    return;
	
	init();
	
	// first run
	if (global_setting('whitelist') == '')
	{	    
	    var load_defaults = confirm(
		"jsarmor up and running !\n\n" +
		"Main button will show up at the bottom right of pages using javascript.\n\n" +
		"Click [OK] to load default settings, or [Cancel] to start from scratch. " +
		"(can change your mind later either way).");

	    set_global_setting('version_number', version_number);
	    set_global_setting('version_type', version_type);	    
	    if (load_defaults)
	    {
		set_global_setting('whitelist',		array_to_list(default_global_whitelist) );
		set_global_setting('helper_blacklist',	array_to_list(default_helper_blacklist) );
	    }
	    else
	    {
		set_global_setting('whitelist',		array_to_list([]) );
		set_global_setting('helper_blacklist',	array_to_list([]) );
	    }
	}

	// upgrade from 1.44 or before
	if (global_setting('version_number') == '')
	{
	    set_global_setting('version_number', version_number);
	    set_global_setting('version_type', version_type);
	    // didn't exist:
	    set_global_setting('helper_blacklist',	array_to_list(default_helper_blacklist) );
	}
	
    }

    main();

})(window.document, window.location, window.opera, window.opera.scriptStorage);
