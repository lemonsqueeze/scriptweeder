
#MAKE=make
MAKE=make --no-print-directory

scriptkiddie.js: src/scriptkiddie.js
	cp src/scriptkiddie.js .

src/scriptkiddie.js: FORCE
	@cd src && $(MAKE)

clean:
	@cd src && $(MAKE) clean

FORCE:
