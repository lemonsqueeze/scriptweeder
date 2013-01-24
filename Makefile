
NAME	= jsarmor.js
SRC	= core.js core_ui.js builtin_ui.js
GEN_SRC	= jsarmor.css.js jsarmor.html.js
ALLSRC	= $(SRC) $(GEN_SRC)

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

jsarmor.html.js: jsarmor.html
	@echo generating $@
	@echo "    var builtin_html = " > $@
	@echo -n "'" >> $@
	@sed -e 's|$$|  \\n\\|' < $< >> $@ 
	@echo "';" >> $@

