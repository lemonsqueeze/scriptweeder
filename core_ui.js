function(){   // fake line, keep_editor_happy

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

}   // keep_editor_happy