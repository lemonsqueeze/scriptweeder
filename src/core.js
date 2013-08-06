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
	if (location.hash == '#swblockall' && !in_iframe())
	    force_block_all_mode();
	
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

	init_filter();
	if (!allowed_host(current_host))  // block inline scripts if current_host not allowed
            block_inline_scripts = true;	
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
	if (in_iframe())		// in iframe, no choice there.
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

    function force_block_all_mode()
    {
	mode = 'block_all';
	block_inline_scripts = true;
	handle_noscript_tags = true;
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
    var msg_header_iframe = "scriptweeder iframe rescue channel:";
    var msg_header_iframe_script = "scriptweeder iframe script:";
    var msg_header_iframe_script_loaded = "scriptweeder iframe script loaded:";
    var msg_header_parent = "scriptweeder iframe parent:";
    var message_topwin_cant_display = "can't help you dear, i'm a frameset";
    
    function init_iframe_logic()
    {
	// let contained iframes know their parent host.
	if (!in_iframe())
	    set_global_setting('top_window_url', location.href);
	
	show_ui_in_iframes = global_bool_setting('show_ui_in_iframes', default_show_ui_in_iframes);
	// TODO clean this up
	message_handlers[msg_header_iframe] = message_from_iframe;
	message_handlers[msg_header_iframe_script] = message_add_iframe_script;
	message_handlers[msg_header_iframe_script_loaded] = message_iframe_script_loaded;	
	message_handlers[msg_header_parent] = message_from_parent;
	
	iframe_logic = global_setting('iframe_logic');
	if (iframe_logic != 'block_all' && iframe_logic != 'filter' && iframe_logic != 'allow')
	    iframe_logic = default_iframe_logic;

	if (!in_iframe())
	    return;
	
	// tell parent about us so it can display our host in the menu.
	window.top.postMessage(msg_header_iframe + location.href, '*');
	
	// switch mode depending on iframe_logic
	// TODO: add way to override with page setting *only* ? should be safe enough
	decide_iframe_mode();
    }
    
    function decide_iframe_mode()
    {	
	if (iframe_logic == 'block_all')	        
	    force_block_all_mode();  // can't use set_mode_no_update('block_all'), it would save the setting.
	else if (iframe_logic == 'filter')
	    use_iframe_parent_mode(true);
	else if (iframe_logic == 'allow')
	    use_iframe_parent_mode(false);
	else
	    assert(false, "decide_iframe_mode(): invalid value for iframe_logic ! (" + iframe_logic + ")");
    }

    // set mode based on parent settings
    var parent_url;
    var parent_domain;
    function use_iframe_parent_mode(check_allowed)
    {
	// 'filter' logic uses parent window's settings to decide what to do with page scripts.
	parent_url = get_parent_url();
	parent_domain = get_domain(url_hostname(parent_url));
	assert(parent_url != '', "parent_url is empty !");
	
	var parent = merge_parent_settings(parent_url, check_allowed);
	var parent_mode = parent.mode;
	var allowed = parent.allows_us;
	
	// alert("iframe " + location.hostname + " allowed: " + allowed);
	if (parent_mode == 'block_all' ||
	    (check_allowed && !allowed))
	    force_block_all_mode();        // can't use set_mode_no_update('block_all'), it would save the setting.
	else
	    mode = parent_mode;
    }
        
    function get_parent_url()
    {
	// 1) try getting it directly. that won't work cross domain
	try {  return window.top.location.href;  } catch(e) { }
	
	// 2) try document.referrer. not available if referrer disabled in opera ...
	if (window.parent == window.top && document.referrer != "")
	    return document.referrer;
	
	// 3) hack it. this will work unless loading multiple tabs with iframes simultaneously.
	//    the proper way, sending it from top window with postMessage() is far more evil:
	//    we'd need to store and cancel all events until init() finishes, reload blocked scripts
	//    and replay/refire all events in order, hoping things like domcontentloaded can be fired
	//    twice without side effects...
    	return global_setting('top_window_url');
    }

    // add scripts from iframes to menu
    function message_add_iframe_script(e, url)
    {
	add_script(url, url_hostname(url));
	repaint_ui();	
    }

    // script loaded event from iframe, update menu
    function message_iframe_script_loaded(e, o)
    {
	// FIXME: stats: main window doesn't know about iframes' inline script sizes ...
	//alert("size:"+size+" url:"+url);
	var ev = { from_iframe:true, size:o.size, event:{ target:{ tagName:'script', src:o.url } } };
	beforeload_handler(ev);
    }
    
    // iframe instance making itself known to us. (works for nested iframes unlike DOM harvesting)
    function message_from_iframe(e, url)
    {
	debug_log("[msg] from iframe: " + url_hostname(url));
	
	// fortunately this works even before domcontentloaded
	if (element_tag_is(document.body, 'frameset')) // sorry, can't help you dear
	{
	    e.source.postMessage(msg_header_parent + message_topwin_cant_display, '*');
	    return;
	}	
	add_iframe(url);			// add to menu so we can block/allow it.
	repaint_ui();	
    }

    var topwin_cant_display = false;
    function message_from_parent(e, answer)
    {
	debug_log("[msg] from parent: " + answer);
	assert(!topwin_cant_display, "topwin_cant_display logic shouldn't get called twice !\n" +
	       location.href + "\n" + parent_url);
	
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

	stats.iframes++;
	if (!allowed_iframe(host))
	    stats.iframes_blocked++;
	
	var domain_node = get_domain_node(domain, true);
	var host_node = get_host_node(host, domain_node, true);
	host_node.iframes.push(i);
	return i;
    }
    
    // TODO show iframe placeholder ?
        
    
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
	n.related = is_related_domain(domain);
	n.helper = helper_domain(domain);
	n.hosts = [];
	domain_nodes.push(n);
	return n;
    }

    function is_related_domain(d)
    {
	return (related_domains(d, current_domain) ||
	        (parent_domain && related_domains(d, parent_domain))); // for iframes, make parent related
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
	n.inline = 0;
	n.inline_size = 0;
	n.helper_host = relaxed_mode_helper_host(host, domain_node); // caching
	hosts.push(n);
	return n;
    }

    function clear_domain_nodes()
    {
	domain_nodes = [];
    }

    function add_inline_script(code)
    {
	stats.inline++;
	stats.inline_size += code.length;
	
	var dn = get_domain_node(current_domain, true);
	var hn = get_host_node(current_host, dn, true);		// ensure host node is created so it shows up in menu
	hn.inline++;
	hn.inline_size += code.length;
    }
    
    function add_script(url, host)
    {
	stats.total++;
	if (!allowed_host(host))
	    stats.blocked++;
	
	var domain = get_domain(host);
	var s = new_script(url);

	var domain_node = get_domain_node(domain, true);
	var host_node = get_host_node(host, domain_node, true);
	host_node.scripts.push(s);

	// TODO: iframe scripts will show up in the menu only if it's allowed, but when toggling an iframe
	//       update happens after reload. instant update would be really cool ...
	if (in_iframe() && mode != 'block_all') 	// tell parent so it can display script in the menu.
	    window.top.postMessage(msg_header_iframe_script + url, '*');
	
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

    // call f(script, hn, dn) for every script (arbitrary order)
    function foreach_script(f)
    {
	_foreach_host_node(function(hn, dn)
	{
	    foreach(hn.scripts, function(s)
	    {
		f(s, hn, dn);
	    });
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

    var stats = { blocked: 0,        // no. ext scripts blocked 
		  loaded: 0,	     // no. ext scripts loaded
		  total: 0,	     // no. ext scripts
		  total_size: 0,     // cummulated size of all external scripts
                  inline: 0,         // no. inline scripts
		  inline_size: 0,    // cummulated size of all inline scripts
		  iframes: 0,
		  iframes_blocked: 0
                };

    var blocked_script_elements = []; // for reload_script()

    function block_script(e)
    {
	e.preventDefault();	  
	blocked_script_elements.push(e.element);
    }
    
    // Handler for both inline *and* external scripts
    function beforescript_handler(e)
    {
	if (e.element.src) // external script, note script size
	{
	    var url = e.element.src;
	    var script = find_script(url, url_hostname(url));
	    script.size = e.element.text.length;
	    return;
	}
	
	check_init();
	debug_log("beforescript");
	add_inline_script(e.element.text);
	
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
	
	debug_log("beforeextscript: " + host);	
	add_script(url, host);
	
        if (!allowed_host(host))
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
	if (ev.from_iframe)
	    script.size = ev.size; // hack it in
	else // sanity check ...
	    assert(allowed_host(host),
		   "a script from\n" + host + "\nis being loaded even though it's blocked. That's a bug !!");

	stats.loaded++;
	stats.total_size += script.size;
	script.loaded = 1;

	if (nsmenu)
	    repaint_ui();
	if (in_iframe()) 	// tell parent so it can update menu
	    window.top.postMessage({ header: msg_header_iframe_script_loaded,
		                     size: script.size, url: e.src }, '*');
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

    function before_message_handler(ue)
    {
	var e = ue.event;
	var m = e.data;
	var header, data;
	if (typeof(m) == "string")
	{
	    var d = m.indexOf(':');
	    if (d == -1)
		return;
	    header = m.slice(0, d+1);
	    data = m.slice(d+1);
	}
	else // object
	{
	    if (!m.header)
		return;
	    header = m.header;
	    data = m;
	}
	
	check_init();
	if (!message_handlers[header])
	    return;
	if (e.source == window)
	{
	    error("Looks like a script on this page is trying to forge ScriptWeeder messages, " +
		  "something funny is going on !");
	    return;
	}
	//debug_log("[msg] " + m);
	ue.preventDefault();	// keep this conversation private.
	(message_handlers[header])(e, data);
	return;
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
    
    function check_document_ready()
    {
	if (document.body)
	    doc_ready_handler();
	else
	    window.setTimeout(check_document_ready, 50);
    }
    
    function setup_event_handlers()
    {
    	opera.addEventListener('BeforeScript',	       work_todo(beforescript_handler),		false);
	opera.addEventListener('BeforeExternalScript', work_todo(beforeextscript_handler),	false);
	opera.addEventListener('BeforeEvent.load',		beforeload_handler,		false);
	document.addEventListener('DOMContentLoaded',		domcontentloaded_handler,	false);
	opera.addEventListener('BeforeEvent.message',		before_message_handler,		false);
	window.setTimeout(check_document_ready, 50);

	init_extension_messaging();
    }


}   // keep_editor_happy
