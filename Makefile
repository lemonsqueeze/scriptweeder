
#MAKE=make
MAKE=make --no-print-directory

jsarmor.js: src/jsarmor.js
	cp src/jsarmor.js .

src/jsarmor.js: FORCE
	@cd src && $(MAKE)

clean:
	@cd src && $(MAKE) clean

FORCE:
