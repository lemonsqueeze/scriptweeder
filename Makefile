
#MAKE=make
MAKE=make --no-print-directory

scriptkiddie.js: FORCE
	@cd src && $(MAKE) $@
	cp src/$@ .

# Using the dev environment to make custom styles easily
custom.style: FORCE
	@cd src && $(MAKE) $@
	cp src/$@ .

clean:
	@cd src && $(MAKE) clean

FORCE:
