scriptweeder
============

[Home page](https://github.com/lemonsqueeze/scriptweeder/wiki) is in the wiki now. Or stay here for developper's corner.


Making custom styles
--------------------

There are two kinds of custom styles:
* `.style` files add rules on top of the current stylesheet
* `.css` files replace the whole stylesheet.
.style are preferred: they can be combined with others and will likely work with future versions.

The dev environment makes it very easy to create them:
* Get a fresh copy of the repository (see Hacking below)
* Add your style patch rules at the end of `src/scriptweeder.css` (don't change anything else ! If you want to change a rule, copy it first).
* Add extra images to `img` directory and reference them with `url('../img/whacky_image.png')`.
  To set `width` and `height` automatically, add a `/*img_size*/` comment.
* To test changes, just type `make` and try the generated `scriptweeder.js`.

  Right now you're actually changing the default style, so either use `rescue mode` or make sure you reset custom styles with `Options->Back to default`.
* Type `make custom.style` once you're happy with the changes. 

  Style file is ready in `custom.style` !

Creating a completely new stylesheet is just as easy: just replace the whole .css and type `make`. The generated stylesheet is in `src/scriptweeder.inlined.css`.

For example, this is the source for glowballs:
```
/* mode icons (small) */
.block_all img         { /*img_size*/ background-image:url('../img/block_all_16.png'); }
.filtered  img         { /*img_size*/ background-image:url('../img/filtered_16.png');  }
.relaxed   img         { /*img_size*/ background-image:url('../img/relaxed_16.png');  }
.allow_all img         { /*img_size*/ background-image:url('../img/allow_all_16.png'); }
.menu .block_all img, .menu .filtered  img, 
.menu .relaxed   img, .menu .allow_all img     { margin: 3px }

/* mode icons (fat) */
.fat_icons .block_all img              { /*img_size*/ background-image:url('../img/block_all.png'); }
.fat_icons .filtered  img              { /*img_size*/ background-image:url('../img/filtered.png');  }
.fat_icons .relaxed   img              { /*img_size*/ background-image:url('../img/relaxed.png');  }
.fat_icons .allow_all img              { /*img_size*/ background-image:url('../img/allow_all.png'); }
.fat_icons .menu .block_all img,  .fat_icons .menu .filtered  img, 
.fat_icons .menu .relaxed   img,  .fat_icons .menu .allow_all img      { margin: 4px }
```


Hacking
-------

The extension version is in the `extension` branch.

The script is put together from the different bits and pieces in the `src` directory. You'll need some kind of unix environment with `git`, `perl`, `make` and `base64` (for windows get `cygwin`).

To get a copy of the repository, do
```
git clone 'https://github.com/lemonsqueeze/scriptweeder.git'
```

Then `make` to build.

UI layout is generated from `scriptweeder.ui`, css from `scriptweeder.css`. Image references in the css are turned into `data:` urls automatically, so it's a convenient tool for hacking styles.

UI code lives in `ui.js`, `userjs_ui.js` manages widgets and the injected iframe, and the filtering logic is in `core.js`.


Other stuff
-----------

`utils` directory has a few things which could be useful outside of this project:
  * `google_nojs.js` example showing how to disable javascript but still allow userjs to run. This one does it for google search.
  * `block_event_listeners.js` userjs to block page event listeners.
  * `event_logger.js` userjs to log all events
  * `page_event_logger.js` regular script to see what events page is getting.

`xml_macros` (tools directory) takes care of expanding xml macros. Useful if you need modularity in xml or html. Syntax is inspired from [fxmacro](http://www2.informatik.tu-muenchen.de/~perst/fxmacro/) (couldn't get it to build so ended up writing this instead).


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/lemonsqueeze/scriptweeder/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
