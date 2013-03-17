function(){   // fake line, keep_editor_happy

    /************************* Default Settings *******************************/        
    
    // default mode on new install
    var default_mode = 'relaxed';

    // block inline scripts by default for block_all mode ?
    var default_block_inline_scripts = true;

    // when inline scripts are blocked, handle <noscript> tags
    // as if javascript was disabled in opera
    var default_handle_noscript_tags = true;

    // 'block_all'   'filter'   'allow'
    var default_iframe_logic = 'filter';

    // 'normal'  or  'cache'
    var default_reload_method = 'normal';
    
    /********************************* Globals *********************************/

    // FIXME this doesn't work for iframes ...
    var debug_mode = (location.hash == '#swdebug');
    var paranoid = false;
    
    /* stuff load_global_settings() takes care of */
    var current_host;
    var current_domain;
    var whitelist;
    var helper_blacklist;
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
    // -       iframes can start loading
    // * DOMContentLoaded fires: scripts can start messing with the DOM.
    //   [...] dynamic content gets loaded
    // - document load event fires: document is loaded, browser button stops spinning.
    // - iframes finish loading anytime before or after that (DOMFrameContentLoaded)
    
    var init_done = false;

    function init()
    {
	check_script_storage();
	load_global_settings();	
	register_ui();
	init_done = true;
    }

    function check_init()
    {
	if (!init_done)
	    init();
    }

    
    /******************************** Normal init *******************************/

    // called once on startup
    function load_global_settings()
    {
	load_global_context(location.href, true);
	
	init_iframe_logic();	
	reload_method = global_setting('reload_method', default_reload_method);
    }
    
    // can be used to check on another page's settings.
    // (normal page settings that is, without iframe logic kicking in)
    // call clear_domain_nodes() afterwards to discard store changes.
    function load_global_context(url, do_startup_checks)
    {
	url = (url ? url : location.href);
	current_host = url_hostname(url);
	current_domain = get_domain(current_host);
	
	init_scope(url);
	init_mode();

	if (do_startup_checks)
	    startup_checks();
	
	whitelist = deserialize_name_hash(global_setting('whitelist'));
	helper_blacklist = deserialize_name_hash(global_setting('helper_blacklist'));
    }

    
    /**************************** Mode and page stuff *************************/

    // running in rescue_mode ?
    function rescue_mode()
    {
	return (location.hash == '#scriptweeder');
    }
    
    // reload top window really: with 'filtered' iframe logic, iframes need parent to reload.
    function reload_page()
    {
	if (window != window.top)		// in iframe, no choice there.
	    window.top.location.reload(false);
	
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

      block_inline_scripts = false;
      handle_noscript_tags = false;      
      if (new_mode == 'block_all')
      {
	  block_inline_scripts = bool_setting('inline', default_block_inline_scripts);
	  handle_noscript_tags = bool_setting('nstags', default_handle_noscript_tags);
      }
    }

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
    var iframe_message_header = "scriptweeder lost iframe rescue channel:";
    var message_topwin_cant_display = "can't help you, i'm a frameset my dear";
    
    function init_iframe_logic()
    {
	// let contained iframes know their parent host.
	if (window == window.top)
	    set_global_setting('top_window_url', location.href);
	
	show_ui_in_iframes = global_bool_setting('show_ui_in_iframes', default_show_ui_in_iframes);
	message_handlers[iframe_message_header] = iframe_message_handler;
	
	iframe_logic = global_setting('iframe_logic');
	if (iframe_logic != 'block_all' && iframe_logic != 'filter' && iframe_logic != 'allow')
	    iframe_logic = default_iframe_logic;

	if (window == window.top) // not running in iframe ?
	    return;
	
	// tell parent about us so it can display our host in the menu.
	window.top.postMessage(iframe_message_header + location.href, '*');
	
	// switch mode depending on iframe_logic
	// TODO: add way to override with page setting *only* ? should be safe enough
	decide_iframe_mode();
    }
    
    function decide_iframe_mode()
    {	
	if (iframe_logic == 'block_all')
	    iframe_block_all_mode();
	else if (iframe_logic == 'filter')
	    use_iframe_parent_mode(true);
	else if (iframe_logic == 'allow')
	    use_iframe_parent_mode(false);
	else
	    assert(false, "decide_iframe_mode(): invalid value for iframe_logic ! (" + iframe_logic + ")");
    }

    // set mode based on parent settings
    function use_iframe_parent_mode(check_allowed)
    {
	// 'filter' logic uses parent window's settings to decide what to do with page scripts.
	var parent_url = get_parent_url();
	var allowed, parent_mode;
	assert(parent_url != '', "parent_url is empty !");
	
	load_global_context(parent_url);		// get parent settings
	parent_mode = mode;	
	if (check_allowed)
	{
	    allowed = allowed_host(location.hostname);	// does parent allow us ?
	    clear_domain_nodes();			// wipe out hosts nodes this will have created
	}
	load_global_context();
	
	// alert("iframe " + location.hostname + " allowed: " + allowed);
	if (parent_mode == 'block_all' ||
	    (check_allowed && !allowed))
	    iframe_block_all_mode();
	else
	    mode = parent_mode;
    }
    
    // can't use set_mode_no_update('block_all'), it would save the setting.
    function iframe_block_all_mode()
    {
	mode = 'block_all';
	block_inline_scripts = true;
	handle_noscript_tags = true;
    }
    
    function get_parent_url()
    {
	// 1) try getting it directly. that won't work cross domain
	try {  return window.top.location.href;  } catch(e) { }
	
	// 2) try document.referrer. not available if referrer disabled in opera ...
	if (document.referrer != "")
	    return document.referrer;
	
	// 3) hack it. this will work unless loading multiple tabs with iframes simultaneously.
	//    the proper way, sending it from top window with postMessage() is far more evil:
	//    we'd need to store and cancel all events until init() finishes, reload blocked scripts
	//    and replay/refire all events in order, hoping things like domcontentloaded can be fired
	//    twice without side effects...
    	return global_setting('top_window_url');
    }
    
    function iframe_message_handler(e, content)
    {
	var source = e.source;	// WindowProxy of sender
	// e.origin contains 'http://hostname' of the sender
	if (source === window.top)
	    message_from_parent(e, content);
	else
	    message_from_iframe(e, content);
    }

    // iframe instance making itself known to us. (works for nested iframes unlike DOM harvesting)
    function message_from_iframe(e, url)
    {
	debug_log("[msg] from iframe: " + url_hostname(url));
	
	// fortunately this works even before domcontentloaded
	if (element_tag_is(document.body, 'frameset')) // sorry, can't help you dear
	{
	    e.source.postMessage(iframe_message_header + message_topwin_cant_display, '*');
	    return;
	}	
	add_iframe(url);			// add to menu so we can block/allow it.
	repaint_ui();	
    }

    var topwin_cant_display = false;
    function message_from_parent(e, answer)
    {
	debug_log("[msg] from parent: " + answer);
	assert(!topwin_cant_display, "topwin_cant_display logic shouldn't get called twice !");
	
	// crap, parent uses frameset, we're not in an iframe actually.
	// -> fall back to normal logic and show ui everywhere.
	// on top of that we need to undo what the iframe logic did.
	// reset mode and reload unduly blocked scripts. (hopefully all of this
	// is happening before domcontentloaded or they won't be too happy).
	// reloading will make status look a little weird ... (script blocked, script loaded)
	topwin_cant_display = true;
	load_global_context();  // reset mode etc
	reload_needed_scripts();
	if (document_ready)
	    init_ui();
    }

    function reload_needed_scripts()
    {
	foreach(blocked_script_elements, function(e)
	{
	    if ((!e.src && !block_inline_scripts) ||		// allowed inline script
		(e.src  && allowed_host(url_hostname(e.src))))  // allowed external script
		reload_script(e);
	});
    }    
    
    function reload_script(script)
    {
	var clone = script.cloneNode(true);
	script.parentNode.replaceChild(clone, script);
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
	whitelist[host] = 1;
	set_global_setting('whitelist', serialize_name_hash(whitelist));
    }
    
    function remove_host(host)
    {
	var l = hosts_setting();
	l = l.replace(' ' + host, '');
	set_hosts_setting(l);
    }

    function global_remove_host(host)
    {
	delete whitelist[host];
	// remove domain also if it's there
	delete whitelist[get_domain(host)];
	set_global_setting('whitelist', serialize_name_hash(whitelist));
    }
    
    function host_allowed_globally(host)
    {
	if (whitelist[host])
	    return true;	
	// whole domain allowed ?
	return (whitelist[get_domain(host)] ? true : false);
    }

    function on_helper_blacklist(host)
    {
	if (helper_blacklist[host])
	    return true;	
	// whole domain blacklisted ?
	return (helper_blacklist[get_domain(host)] ? true : false);
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
	  if (relaxed_mode_allowed_host(h) && !filtered_mode_allowed_host(h))
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

    // external script properties: url, size (if not blocked), loaded
    function new_script(url)
    {
	var o = new Object();
	o.url = url;
	o.size = 0;
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

    function _find_script(url, host)
    {
	var domain = get_domain(host);	
	var domain_node = get_domain_node(domain, false);
	if (!domain_node)
	    return null;
	var host_node = get_host_node(host, domain_node, false);
	if (!host_node)
	    return null;	
	var scripts = host_node.scripts;
	for (var i = scripts.length - 1; i >= 0; i--)
	    if (scripts[i].url == url)
		return scripts[i];
	return null;
    }

    function script_exists(url, host)
    { return _find_script(url, host); }
    
    function find_script(url, host)
    {
	var script = _find_script(url, host);
	assert(script, "find_script() failed, should not happen !");
	return script;
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
    // current host first, then helper hosts, then the rest
    function foreach_host_node(f)
    {
	_foreach_host_node(function (hn, dn)
	{
	    if (hn.name == current_host)
		f(hn, dn);
	});
	_foreach_host_node(function (hn, dn)
	{
	    if (hn.name != current_host && hn.helper_host)
		f(hn, dn);
	});
	_foreach_host_node(function (hn, dn)
	{
	    if (hn.name != current_host && !hn.helper_host)
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

    var blocked_script_elements = []; // for reload_script()

    function block_script(e)
    {
	e.preventDefault();	  
	blocked_script_elements.push(e.element);
    }
    
    // Handler for both inline *and* external scripts
    function beforescript_handler(e)
    {
      check_init();
      if (e.element.src) // external script
      {
	  var url = e.element.src;
	  var host = url_hostname(url);
	  // extension hack: workaround missed beforeexternalscript events
	  if (!script_exists(url, host))
	      beforeextscript_handler(e);

	  // note script size
	  var script = find_script(url, host);
	  script.size = e.element.text.length;	  
	  return;
      }

      debug_log("beforescript");      
      total_inline++;
      total_inline_size += e.element.text.length;
      
      repaint_ui();
      
      if (block_inline_scripts)
	  block_script(e);
    }

    function beforeextscript_handler(e)
    {
	assert(element_tag_is(e.element, 'script'),
	       "BeforeExternalScript: non <script>: " + e.element.tagName);
	check_init();
	
	var url = e.element.src;
	var host = url_hostname(url);
	var allowed = allowed_host(host);

	debug_log("beforeextscript: " + host);	
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
	    block_script(e);
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
	check_init();
	
	var host = url_hostname(e.src);
	var script = find_script(e.src, host);
	debug_log("loaded: " + host);

	if (paranoid)	// sanity check ...
	    assert(allowed_host(host),
		   "a script from\n" + host + "\nis being loaded even though it's blocked. That's a bug !!");
	
	if (host == current_host)
	    loaded_current_host++; 
	else
	    loaded_external++;
	script.loaded = 1;

	if (nsmenu)
	    repaint_ui();
    }

    function domcontentloaded_handler(e)
    {
	debug_log("domcontentloaded");
	doc_ready_handler(true);
    }

    var document_ready = false;
    function doc_ready_handler(dont_log)
    {
	if (!dont_log)
	    debug_log("document ready");
	check_init();
	document_ready = true;
	
	if (block_inline_scripts)
	    check_handle_noscript_tags();
	
	init_ui();
    }

    function before_message_handler(ujs_event)
    {
	var e = ujs_event.event;
	var m = e.data;
	if (typeof(m) != "string")
	    return;
	check_init();
	for (var h in message_handlers)
	{
	    if (is_prefix(h, m))
	    {		
		//debug_log("[msg] " + m);
		ujs_event.preventDefault();	// keep this conversation private.
		var content = m.slice(h.length);		
		(message_handlers[h])(e, content);
		return;
	    }
	}
	// not for us then.
    }

    
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
	if (window != window.top || !bgproc)
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

    /**************************** userjs messaging ***************************/

    var bgproc;
    function ujsfwd_before_message(ujs_event)
    {
	var e = ujs_event.event;
	var m = e.data;
	debug_log("[msg] " + m);
	
	if (m == "scriptweeder bgproc to injected script:")  // hello from bgproc
	{
	    bgproc = e.source;
	    ujs_event.preventDefault(); // keep this private
	    return;
	}       	
	
	if (m && m.scriptweeder) // from userjs, forward to bgproc
	{
	    debug_log("forwarding to bgproc");
	    bgproc.postMessage(m);
	    ujs_event.preventDefault(); // keep this private
	}
	// other msg, leave alone
    }
    
    function ujsfwd_guard()
    {
	// userjs should have caught this one and cancelled it, something funny is going on !    
	//if (m == "scriptweeder background process:")
	//{
	my_alert("WARNING there is something wrong here !\n\n" +
		 "If the userjs version of scriptweeder is installed then it's not working properly, " +
		 "otherwise there's a script on this page trying to pass as scriptweeder !");
	opera.extension.onmessage = null;
	//}
    }
    

    function check_userjs_version()
    {
	var userjs_version = window.opera.scriptweeder.version;
	var pair = userjs_version + ':' + version_number;
	if (userjs_version != version_number &&
	    global_setting('warn_userjs_version') != pair)
	{
	    set_global_setting('warn_userjs_version', pair);
	    my_alert("userjs and extension versions differ:\n" +
		     userjs_version + " vs " + version_number + "\n" +
		     "This may not work, installing matching versions is recommended.");
	}
    }
    
    function forward_to_userjs()
    {
	if (!window.opera.scriptweeder) // userjs is not running
	    return false;

	opera.extension.onmessage = ujsfwd_guard;
	// this is enough for userjs beforeEvent to fire,
	// so no need to forward anything in this direction.
	window.opera.addEventListener('BeforeEvent.message', ujsfwd_before_message, false);
	debug_log("userjs detected, handing over and forwarding");
	
	window.setTimeout(check_userjs_version, 10); // don't do it during async startup
	return true;
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

    function check_document_ready()
    {
	if (document.body)
	    doc_ready_handler();
	else
	    window.setTimeout(check_document_ready, 50);
    }
    
    function setup_event_handlers()
    {
    	window.opera.addEventListener('BeforeScript',	       work_todo(beforescript_handler),		false);
	window.opera.addEventListener('BeforeExternalScript', work_todo(beforeextscript_handler),	false);
	window.opera.addEventListener('BeforeEvent.load',		beforeload_handler,		false);
	document.addEventListener('DOMContentLoaded',		domcontentloaded_handler,	false);
	window.opera.addEventListener('BeforeEvent.message',		before_message_handler,		false);	
	window.setTimeout(check_document_ready, 50);

	opera.extension.onmessage = extension_message_handler; // regular msg handler fires also	
    }


}   // keep_editor_happy
