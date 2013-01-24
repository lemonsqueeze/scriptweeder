    /********************************* Core ui *********************************/

    // whether to show jsarmor ui inside frames / iframes
    var default_iframe_ui = false;

    var help_url = "https://github.com/lemonsqueeze/jsarmor/wiki";


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

    // ui template
    var layout;
    
    // layout of interface used in jsarmor's iframe
    function init_layout()
    {
	// use custom layout ?
	var html = global_setting('html');
	html = (html != '' ? html : builtin_html);
	
	// prepend '_' to all ids
	html = html.replace(/ id=\"/g, ' id="_');
	
	layout = idoc.createElement('div');
	layout.style.display = 'none';
	layout.innerHTML = html;
	// needs to be parented for getElementById() to work
	idoc.body.appendChild(layout);

	// set special ids
	idoc.body.id = "body";
    }

    function new_widget(id)
    {
	var w = idoc.getElementById('_' + id);
	if (!w)
	{
	    alert("jsarmor:\n\nnew_widget(" + id + "): couldn't find template by that name");
	    return null;
	}
	if (_get_widget(id))
	{
	    alert("jsarmor:\n\nnew_widget(" + id + "): this id already exists !");
	    return null;	    
	}
	
	// crap, cloneNode doesn't copy event handlers
	var c = w.cloneNode(true);
	de_underscore_ids(c);
	// alert("cloned " + c.id + "!");
	return c;
    }    

    function add_widget(widget_id, parent_id)
    {
	var p = get_widget(parent_id);
	var w = new_widget(widget_id);
	p.appendChild(w);
	return w;
    }

    function get_widget(id)
    {
	var w = idoc.getElementById(id);
	if (w == null)
	    alert("jsarmor:\n\nget_widget(" + id + "): there is no element by that name !");
	return w;
    }

    // unsafe version
    function _get_widget(id)
    {
	return idoc.getElementById(id);
    }

    // remove leading '_' on all ids
    function de_underscore_ids(node)
    {
	if (node.id)
	    node.id = node.id.slice(1);
	var l = node.getElementsByTagName('*');
	for (var i = 0; i < l.length; l++)
	    if (l[i].id)
		l[i].id = l[i].id.slice(1);
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
	var style = global_setting('style');
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

