(   // keep_editor_happy

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

    /**************************** External layout ***********************/

    // cache of widget nodes so we don't have to use innerHTML everytime
    var cached_widgets;
    
    // layout of interface used in jsarmor's iframe
    function init_layout()
    {
	cached_widgets = new Object();

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

    // find element in parent with that id or class_name
    function get_widget(parent, class_name)
    {
	return _get_widget(parent, class_name, false, "get_widget");
    }

    // create ui elements using html strings in widgets_layout
    // FIXME check for duplicate ids ?
    function new_widget(id)
    {
	// do we have this guy in cache ? use that then
	//if (cached_widgets[id])
	// return cached_widgets[id].cloneNode(true);

	var layout = widgets_layout[id];
	if (!layout)
	{
	    alert("jsarmor:\n\nnew_widget(" + id + "): the layout for this widget is missing!");
	    return null;
	}		    

	// otherwise create a new one...
	var d = idoc.createElement('div');
	d.innerHTML = layout;

	// this is a problem if we want to define a widget with several children
	//if (id == "RADIO_BUTTON")
	//var widget = d;
	// else
	    var widget = d.firstChild;
	 
	if (!widget)
	{
	    alert("jsarmor:\n\nnew_widget(" + id + "): couldn't create this guy, check the html in widgets_layout.");
	    return null;
	}

	init_widget_handlers(widget);
	create_nested_widgets(widget);
	
	// cached_widgets[id] = d.firstChild;
	//return widget.cloneNode(true);
	return widget;
    }

    function is_widget(widget)
    {
	return widgets_layout[widget.tagName];
    }

    function create_nested_widgets(widget)
    {
	function widget_needed(n)
	{  return (is_widget(n) && !n.hasAttribute('placeholder'));  }
	
	replace_nodes_if(widget_needed, widget, function(n)
	  { return new_widget(n.tagName); });
    }

    //FIXME add the others
    var is_handler_attribute = { 'onclick':1, 'onmouseover':1, 'onmouseout':1, 'onmousedown':1, 'onload':1};


    // if we load some html like <div onclick="f"> it won't work because the handler
    // will get evaluated in global context, which we do not own as userjs script.
    // so we have a little plumbing to do here ...
    function init_widget_handlers(widget)
    {
	function create_handler(expr)
	{ return eval("function(){" + expr + "}");  }
	
	var l = widget.getElementsByTagName('*');
	for (var i = 0; i < l.length; i++)
	{
	    var node = l[i];
	    for (var j = 0; j < node.attributes.length; j++)
	    {
		var a = node.attributes[j];
		if (is_handler_attribute[a.name])
		    node[a.name] = create_handler(a.value);
	    }
	}
    }

    function _get_widget(parent, class_name, unique, fname)
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
	    alert("jsarmor:\n\n" + fname +"(" + class_name + "):\n couldn't find widget by that name !");
	    return null;
	}	
	if (unique)	// should be unique ?
	{
	    alert("jsarmor:\n\n" + fname +"(" + class_name + "): multiple matches !");
	    return null;
	}
	return l[0];	// return first match.
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

    // FIXME we should know widget_name, we created this thing !
    // FIXME add placeholder_id arg, this only works for unique placeholders ...
    function parent_widget(widget, widget_name, tree) 
    {
	//if (!is_widget(widget))
	//{ alert("jsarmor:\n\nparent_widget() called on non widget: " + widget.tagName); }
	var l = tree.getElementsByTagName('*');
	for (var i = 0; i < l.length; i++)
	{
	    var n = l[i];
	    if (element_tag_is(n, widget_name) &&
		n.hasAttribute('placeholder'))
	    {	// kick placeholder out
		n.parentNode.replaceChild(widget, n);
		return;
	    }
	}
	alert("jsarmor:\n\nparent_widget() couldn't find placeholder for " + widget_name);
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

    /**************************** List functions *******************************/

    function foreach(l, f)
    {
	for (var i = 0; i < l.length; i++)
	    f(l[i]);
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

)   // keep_editor_happy