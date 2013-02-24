
NAME	= scriptweeder.js
SRC	= main.js core.js settings.js utils.js userjs_ui.js ui.js
GEN_SRC	= scriptweeder_style.js scriptweeder_widgets.js
TMPFILES= scriptweeder.xml scriptweeder.inlined.css custom.style
ALLSRC	= $(SRC) $(GEN_SRC)
# where we save output from generate_layout.html
GEN_LAYOUT=/home/opera/downloads/default
TOOLS	= ../tools

all: $(NAME)

clean:
	-rm $(NAME) $(GEN_SRC) $(TMPFILES) *~

scriptweeder.js: $(ALLSRC)
	$(TOOLS)/jpp $<  > $@

scriptweeder.inlined.css: scriptweeder.css
	@echo generating $@ from $<
	@../tools/inline_images < $<  > $@

scriptweeder_style.js: scriptweeder.inlined.css
	@echo generating $@ from $<
	@echo "    var builtin_style = " > $@
	@echo -n '"' >> $@
	@sed -e 's|$$|  \\n\\|' < $< >> $@ 
	@echo '";' >> $@


# Layout generation pipeline:
# - we start with the interface description in scriptweeder.ui ...
# - then expand the xml macros in there to get scriptweeder.xml
# - and turn that into js object with the html for each widget.

scriptweeder.xml: scriptweeder.ui
	@echo generating $@ from $<
	@$(TOOLS)/xml_macros < $<   > $@

scriptweeder_widgets.js: scriptweeder.xml
	@echo generating $@ from $<
	@$(TOOLS)/pack_widgets $<  > $@

###################################################################

# using the dev environment to make style patches easily
custom.style : $(NAME)
	@echo generating $@ from $<
	@git diff ../$(NAME) | grep -v '^+++' | grep '^+' |  \
	 sed -e 's/^+//'  | sed -e 's|\\n\\$$||' > $@
