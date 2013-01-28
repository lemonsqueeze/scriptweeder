
NAME	= jsarmor.js
SRC	= core.js utils.js core_ui.js builtin_ui.js
GEN_SRC	= jsarmor_style.js jsarmor_widgets.js
TMPFILES= jsarmor.xml.bad jsarmor.xml jsarmor_widgets.xml tools/quick_ui.html
ALLSRC	= $(SRC) $(GEN_SRC)
# where we save output from generate_layout.html
GEN_LAYOUT=/home/opera/downloads/default

all: $(NAME)

clean:
	-rm $(NAME) $(GEN_SRC) $(TMPFILES) *~

jsarmor.js: $(ALLSRC)
	tools/jpp core.js > $@

jsarmor_style.js: jsarmor.css
	@echo generating $@
	@echo "    var builtin_style = " > $@
	@echo -n '"' >> $@
	@sed -e 's|$$|  \\n\\|' < $< >> $@ 
	@echo '";' >> $@


#
# layout generation pipeline
#
# 1) we start with the interface description in jsarmor.ui ...
# 2) then expand the xml macros in there to get jsarmor.xml
#    (this is not straightforward atm...)
tools/quick_ui.html: tools/generate_layout.html jsarmor.ui 
	@echo generating $@
	@grep -n textarea $< | head -2 | cut -d: -f1 | \
	(read f ; read g; head -n $$f $< ; cat jsarmor.ui; \
	tail -n +$$g $<) > $@

$(GEN_LAYOUT): tools/quick_ui.html
	@(echo "regen layout !    open file://`pwd`/tools/quick_ui.html"; exit 1)

jsarmor.xml.bad: $(GEN_LAYOUT)
	@echo getting content from $<
# make it somewhat readable
	@cat $(GEN_LAYOUT) | sed -e 's|>|>\n|g' > $@

jsarmor.xml: jsarmor.xml.bad
	@echo generating $@
# remove comments and fixup non xml html tags
	@cat $< | \
	sed -e 's|<!--[^>]*-->||mg' | \
	sed -e 's|<img\([^>]*\)>|<img\1/>|g'     | \
	sed -e 's|<input\([^>]*\)>|<input\1/>|g'   \
	> $@


# 3) and turn that into js object with the html for each widget !
jsarmor_widgets.js: jsarmor.xml
	@echo generating $@
	@tools/pack_widgets $<  > $@

