function(){   // fake line, keep_editor_happy

    /***************************** Domain, url utils **************************/    

    function url_hostname(url)
    {
	if (is_prefix("file:", url))
	    return "localhost";
	if (is_prefix("data:", url))  // following can't handle data: urls
	    return current_host;
	
	var p = split_url(url);
	return p[0];
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
	assert(a, "split_url(): couldn't parse url:\n" + u);
	return a.slice(1);
    }
    
    function strip_url_tail(u)
    {
	var a = split_url(u);
	return a[0] + a[1] + a[2]; // host + dir + file
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

    // for 'www.a.b.com' returns
    //    ['www.a.b.com', 'a.b.com', 'b.com', 'com' ]
    function host_suffixes(h)
    {
	var a = [ h ];
	for (var i = h.indexOf('.'); i != -1; i = h.indexOf('.'))
	{
	    h = h.slice(i + 1);
	    a.push(h);
	}
	return a;
    }
    
    function get_domain(host)
    {
	var p = host.split('.');
	var sl = public_suffix_len(p);
	var i = p.length - sl;  // public suffix index
	return p.slice(i - 1).join('.');
    }
    
@include "tld.js"
    
    /**************************** Node functions *******************************/

    function element_tag_is(el, tag)
    {
	return (el.tagName &&
		el.tagName.toLowerCase() == tag);
    }

    // FIXME, optimize all this
    function get_by_id(parent, id)
    {
	if (is_parented(parent))
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
	var p;
	for (p = n; n; n = n.parentNode)
	    p = n;
	p = (p.documentElement ? p.documentElement : p); // stop at html node
	return p;
    }

    function is_parented(n)
    {
	return (element_tag_is(get_root_node(n), 'html'));
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
	foreach_node_down(n, f);
    }

    function foreach_node_down(n, f)
    {
	foreach(n.getElementsByTagName('*'), f);
    }

    function set_class(n, klass)
    {
	n.className += ' ' + klass;
    }

    function unset_class(n, klass)
    {
       var re = RegExp(' ' + klass + '( |$)', 'g'); // crap, 'g' doesn't work here
       var old;
       do
       {
           old = n.className;      
           n.className = n.className.replace(re, '$1');
       }
       while(old != n.className);
    }

    function set_unset_class(n, klass, set)
    {
	(set ? set_class(n, klass) : unset_class(n, klass));
    }

    function has_class(n, klass)
    {
	return (n.className.match(RegExp('(^| )' + klass + '($| )')) != null);
    }
    
    function toggle_class(n, klass)
    {
	set_unset_class(n, klass, !has_class(n, klass));
    }

    function comp_style(n)
    {
	return iwin.getComputedStyle(n)
    }
    
    
    /**************************** List utils *******************************/

    // FIXME use l.forEach(f) !
    function foreach(l, f)
    {
	for (var i = 0; i < l.length; i++)
	    f(l[i]);
    }

    function serialize_name_hash(h)
    {
	return get_keys(h).sort().join(' ');
    }

    function name_hash_to_textarea(h)
    {
	return get_keys(h).sort().join('\n');
    }
    
    function deserialize_name_hash(s)
    {
	var h = new Object();	
	foreach(s.split(' '), function(key)
	{
	    if (key != '')  // "".split(' ') = [""] ...	    
		h[key] = 1;
	});
	return h;
    }

    function textarea_to_name_hash(s)
    {
	var h = new Object();
	var a = textarea_lines_nows(s);
	foreach(a, function(host)
	{
	    if (host != '')
		h[host] = 1;
	});
	return h;
    }    

// FIXME !
    function list_contains(list, str)
    {
      return (list && list.indexOf(' ' + str) != -1);
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

    // make "n items" messages, adding an 's' if needed
    function item_count(n, name)
    {
	return n + " " + name + (n != 1 ? "s" : "");
    }
    
    /**************************** Misc utils *******************************/

    function min(a, b) { return (a < b ? a : b); }
    function max(a, b) { return (a > b ? a : b); }
    function to_int(s) { return parseInt(s); }
    
    function get_size_kb(x, int_only)
    {
	var k = new String(x / 1000);
	var d = k.indexOf('.');
	if (d != -1)
	    return (x >= 1000 || int_only ? k.slice(0, d) : k.slice(0, d + 2));
	return k;
    }

    function cmp_versions(v1, v2)
    {	
	function xform(version)	// "1.5.10-tag" -> [" 1", " 5", "10", "tag" ]
	{
	    var v = version.split('-')[0];
	    var tag = version.split('-')[1];
	    tag = (tag ? tag : "");
	    var r = v.split('.').map(function(s){ return "  ".slice(0, 2 - s.length) + s });
	    r.push(tag);
	    return r;
	}
	
	return (xform(v1) < xform(v2));
    }

    function in_iframe()
    {
	return (window != window.parent &&
		window != window.top);
	// was return (window != window.top);
	// but framesets can override top (!)
	// ex http://cybertech.net.pl/online/astro/khc/@inetBook/gui/index.htm
    }
    
    function delayed(f, time, main_window)
    {
	var win = (main_window ? window : iwin);
	return (function(){ win.setTimeout(f, time); });
    }
    
    function function_defined(name)
    {	
	return (eval("typeof " + name) == 'function');
    }

    function log(msg)
    {
	var h = "scriptweeder userjs (main)  : ";
	if (in_iframe())
	    h = "scriptweeder userjs (iframe): ";
	console.log(h + msg);
    }

    /*
    function page_log(msg)
    {
	var d = document.createElement('div');
	d.style = "color:#fff; background-color:#000";
	d.innerText = msg;
	d.className = 'debug';
	document.body.appendChild(d);
    }
    */

    function debug_log(msg)
    {
	if (debug_mode)
	    log(msg);
    }
    
    function my_alert(msg)
    {
	var title = "ScriptWeeder";
	if (in_iframe())
	    title += " (in iframe)"
	alert(title + "\n\n" + msg);
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
	var reader = new iwin.FileReader();
	
	reader.onload = function(e) { callback(e.target.result, f.name); };
	reader.readAsBinaryString(f);
	//reader.readAsText(f);
	}
    }

    function save_file(s, binary)
    {
	var url = "data:text/plain;base64,";
	if (binary)
	    url = "data:application/binary;base64,";
	location.href = url + window.btoa(s);
    }
    
    // or use Object.keys(obj) if browser supports it.
    function get_keys(obj)
    {
	var keys = [];
	for(var key in obj)
	    keys.push(key);
	return keys;
    }
    

}   // keep_editor_happy    