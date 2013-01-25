
NAME	= jsarmor.js
SRC	= core.js core_ui.js builtin_ui.js
GEN_SRC	= jsarmor.css.js jsarmor.html.js
ALLSRC	= $(SRC) $(GEN_SRC)
# where we save output from generate_layout.html
GEN_LAYOUT=/home/opera/downloads/default

all: $(NAME)

clean:
	-rm $(NAME) $(GEN_SRC) *~

jsarmor.js: $(ALLSRC)
	./jpp core.js > $@

jsarmor.css.js: jsarmor.css
	@echo generating $@
	@echo "    var builtin_style = " > $@
	@echo -n '"' >> $@
	@sed -e 's|$$|  \\n\\|' < $< >> $@ 
	@echo '";' >> $@

# layout
quick_ui.html: jsarmor.ui generate_layout.html
	@echo generating $@
	@grep -n textarea generate_layout.html | head -2 | cut -d: -f1 | \
	(read f ; read g; head -n $$f generate_layout.html ; cat jsarmor.ui; \
	tail -n +$$g generate_layout.html) > $@

$(GEN_LAYOUT): quick_ui.html
	@(echo "regen layout !    open file://`pwd`/quick_ui.html"; exit 1)

jsarmor.html: $(GEN_LAYOUT)
	@echo generating $@
	@cat $(GEN_LAYOUT) | sed -e 's|>|>\n|g' > $@

jsarmor.html.js: jsarmor.html
	@echo generating $@
	@echo "    var builtin_html = " > $@
	@echo -n "'" >> $@
	@sed -e 's|$$|  \\n\\|' < $< >> $@ 
	@echo "';" >> $@


