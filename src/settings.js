function(){   // fake line, keep_editor_happy

    /************************* Loading/Saving Settings ************************/
    
    function check_script_storage()
    {
	if (!scriptStorage)
	{
	    location.href = "opera:config#widget%20pref";
	    alert("Welcome to scriptweeder !\n\n" +
		  "Extension storage seems to be disabled,\n" +
		  "check widget preferences quota on the following page.");
	}
    }
    
    function scoped_setting(scope, name)
    {
	// to view content -> opera:webstorage  
	var o = scriptStorage.getItem(scoped_prefixes[scope] + name);
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
    
    var scoped_prefixes = ['', '', '', ''];
    
    function init_scope(url)
    {
	scoped_prefixes =
	[strip_url_tail(url) + ':', current_host + ':', current_domain + ':', ''];
	
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
	    hosts = current_host;
	return ' ' + hosts;
    }
    
    function set_hosts_setting(hosts)
    {
	hosts = hosts.replace(/^ */, '');
	if (hosts == '')
	    hosts = ' '; // can't store empty string, would mean current_host.
	if (hosts == current_host)
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
    function do_not_save_setting(k)
    {
	return (k == 'time' ||
		k == 'timestamp' ||
		k == 'top_window_url' ||
		is_prefix("noscript_", k));
    }
    
    function print_setting(host, settings)
    {
	var s = "";
	var prefix = (host == '' ? "" : host + ":");
	for (k in settings)
	{
	    var val = settings[k];
	    if (!do_not_save_setting(k) &&		// old and temp stuff
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
	    s += settings;
	}

	save_file(s, !as_text);
    }

    // make sure file looks like a valid settings file
    function import_check_file(a)
    {
	if (!is_prefix("jsarmor", a[0]) &&
	    !is_prefix("scriptkiddie", a[0]) &&
	    !is_prefix("scriptweeder", a[0]))
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
	    my_alert("This doesn't look like a valid settings file.");
	    return;
	}	    
	scriptStorage.clear();	// clear current settings.
	import_settings(a);
	var vers_settings = global_setting('version_number');
	if (cmp_versions(version_number, vers_settings)) // version_number < vers_settings
	    my_alert("Settings come from a version more recent than mine ! " +
		     "(" + vers_settings + " vs " + version_number + ")\n" +
		     "i might not be able to handle that, better update me instead...");
	
	set_global_setting('version_type', version_type); // keep it consistent
	alert("Loaded !");
	startup_checks(true);   // upgrade settings, no page redirect
	need_reload = true;
    }
	
    function reset_settings()
    {
	if (!confirm("WARNING: All settings will be cleared !\n\nContinue ?"))
	    return;
	scriptStorage.clear();
	need_reload = true;
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

    
    /**************************** old settings conversion  *************************/

    // old format:   whitelist:. code.jquery.com codysherman.com maps.google.com
    // new format:   whitelist:code.jquery.com codysherman.com maps.google.com
    function convert_old_list_settings()
    {
	function convert_setting(key)
	{
	    var  s = global_setting(key);
	    if (s.slice(0, 2) == '. ') // old format ...
	    {
		s = s.slice(2);
		set_global_setting(key, s);
	    }
	}
	
	convert_setting('whitelist');
	convert_setting('helper_blacklist');
	// hosts settings
	for (key in scriptStorage)
	{
	    if (key.indexOf(':hosts') != -1)
		convert_setting(key);
	}		
    }

    
}   // keep_editor_happy


