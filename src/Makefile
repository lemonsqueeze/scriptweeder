
NAME	= scriptkiddie.js
SRC	= main.js core.js settings.js utils.js userjs_ui.js ui.js
GEN_SRC	= scriptkiddie_style.js scriptkiddie_widgets.js
TMPFILES= scriptkiddie.xml scriptkiddie.inlined.css
ALLSRC	= $(SRC) $(GEN_SRC)
# where we save output from generate_layout.html
GEN_LAYOUT=/home/opera/downloads/default
TOOLS	= ../tools

all: $(NAME)

clean:
	-rm $(NAME) $(GEN_SRC) $(TMPFILES) *~

scriptkiddie.js: $(ALLSRC)
	$(TOOLS)/jpp $<  > $@

scriptkiddie.inlined.css: scriptkiddie.css
	@echo generating $@ from $<
	@../tools/inline_images < $<  > $@

scriptkiddie_style.js: scriptkiddie.inlined.css
	@echo generating $@ from $<
	@echo "    var builtin_style = " > $@
	@echo -n '"' >> $@
	@sed -e 's|$$|  \\n\\|' < $< >> $@ 
	@echo '";' >> $@


# layout generation pipeline:
# - we start with the interface description in scriptkiddie.ui ...
# - then expand the xml macros in there to get scriptkiddie.xml
# - and turn that into js object with the html for each widget.

scriptkiddie.xml: scriptkiddie.ui
	@echo generating $@ from $<
	@$(TOOLS)/xml_macros < $<   > $@

scriptkiddie_widgets.js: scriptkiddie.xml
	@echo generating $@ from $<
	@$(TOOLS)/pack_widgets $<  > $@

