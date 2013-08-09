function(){   // fake line, keep_editor_happy

    /********************************* Defaults ************************************/

    var default_global_whitelist =
    { 'localhost':1,
      'maps.google.com':1,
      'maps.gstatic.com':1,
//    'ajax.googleapis.com':1,   // no need, relaxed mode will enable it
      's.ytimg.com':1,
      'code.jquery.com':1,
      'z-ecx.images-amazon.com':1,
      'st.deviantart.net':1,
      'static.tumblr.com':1,
      'codysherman.com':1
    };

    // Stuff we don't want to allow in relaxed mode which would otherwise be.
    var default_helper_blacklist =     // FIXME add ui to edit ?
    { 'apis.google.com':1,	// only used for google plus one
      'widgets.twimg.com':1,	// twitter
      'static.ak.fbcdn.net':1	// facebook
    };   

    function default_filter_settings()
    {
	set_global_setting('whitelist',             serialize_name_hash(default_global_whitelist) );
	set_global_setting('helper_blacklist',      serialize_name_hash(default_helper_blacklist) );
    }

    
    /***************************** Host filtering *****************************/

    var whitelist;
    var helper_blacklist;
    var allow_current_host;		// current host allowed by default in filtered mode ?
    var local_hosts;			// hosts allowed for this site/url/domain

    function init_filter()
    {
	whitelist = deserialize_name_hash(global_setting('whitelist'));
	helper_blacklist = deserialize_name_hash(global_setting('helper_blacklist'));
	allow_current_host = global_bool_setting('allow_current_host', true);
	local_hosts = hosts_setting();
    }	
    
    function allow_host(host)
    {
	if (list_contains(local_hosts, host))
	    return;
	local_hosts = local_hosts + ' ' + host
	set_hosts_setting(local_hosts);
    }

    function global_allow_host(host)
    {
	whitelist[host] = 1;
	set_global_setting('whitelist', serialize_name_hash(whitelist));
    }
    
    function remove_host(host)
    {
	local_hosts = local_hosts.replace(' ' + host, '');
	set_hosts_setting(local_hosts);
    }

    function global_remove_host(host)
    {
	// remove host and all its suffixes if present
	foreach(host_suffixes(host), function(s)
	{
	    delete whitelist[s];
	});
	set_global_setting('whitelist', serialize_name_hash(whitelist));	
    }
    
    function host_allowed_globally(host)
    {
	var s = host_suffixes(host);
	for (var i = 0; i < s.length; i++)
	    if (whitelist[s[i]])
		return true;
	return false;
    }

    function on_helper_blacklist(host)
    {
	var s = host_suffixes(host);
	for (var i = 0; i < s.length; i++)
	    if (helper_blacklist[s[i]])
		return true;
	return false;
    }
    
    function host_allowed_locally(host)
    {
	return list_contains(local_hosts, host);
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

    function allowed_host(host)
    {
      if (mode == 'block_all') return false; 
      if (mode == 'filtered')  return filtered_mode_allowed_host(host);
      if (mode == 'relaxed')   return relaxed_mode_allowed_host(host); 
      if (mode == 'allow_all') return true;
      error('mode="' + mode + '", this should not happen!');
    }
    
    // allow every host allowed in relaxed mode, except host
    function relaxed_mode_to_filtered_mode(host)
    {
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

    // allow every host except host
    function allow_all_mode_to_filtered_mode(host)
    {
	foreach_host_node(function(hn)
	{
	  var h = hn.name;
	  if (!filtered_mode_allowed_host(h))
	  {
	      if (h == host)
		  remove_host(h);
	      else
		  allow_host(h);
	  }
	});      
    }        

    /* iframe stuff */
    function merge_parent_settings(parent_url, check_allowed)
    {
	var o = {};
	load_global_context(parent_url);		// get parent settings
	o.mode = mode;
	var parent_hosts = local_hosts;
	if (check_allowed)
	{
	    o.allows_us = allowed_host(location.hostname);	// does parent allow us ?
	    clear_domain_nodes();			// wipe out hosts nodes this will have created
	}
	load_global_context();
	local_hosts = parent_hosts;			// use parent settings, it knows about our scripts
	return o;
    }

    // for main window use, iframes can't use that
    function allowed_iframe(host)
    {
	if (iframe_logic == 'block_all')
	    return false;
	if (iframe_logic == 'allow')
	    return true;
	return allowed_host(host);
    }
    
}   // keep_editor_happy
