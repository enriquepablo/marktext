PY?=python3
VENV=$(CURDIR)/venv/bin
PELICAN?=$(shell [ -x $(VENV)/pelican ] && echo $(VENV)/pelican || echo pelican)
PIP?=$(shell [ -x $(VENV)/pip ] && echo $(VENV)/pip || echo pip)
PELICANOPTS=

BASEDIR=$(CURDIR)
INPUTDIR?=$(BASEDIR)/content
OUTPUTDIR=$(BASEDIR)/output
CONFFILE=$(BASEDIR)/pelicanconf.py
PUBLISHCONF=$(BASEDIR)/publishconf.py

# publishconf.py does `from pelicanconf import *`, so its directory must be
# importable regardless of where pelican inserts its own paths.
export PYTHONPATH := $(BASEDIR):$(PYTHONPATH)

SSH_HOST?=localhost
SSH_PORT?=22
SSH_USER?=deploy
SSH_TARGET_DIR?=/var/www/site

help:
	@echo 'Makefile for a pelican Web site                                        '
	@echo '                                                                       '
	@echo 'Usage:                                                                 '
	@echo '   make draft                       build all pages (draft + public)   '
	@echo '   make publish                     build only pages with status:public'
	@echo '   make clean                       remove the generated files         '
	@echo '   make rsync_upload                publish-build and upload via rsync  '
	@echo '                                                                       '
	@echo 'Both build targets remove the previous output first.                   '

# Ensure the venv has every package the build needs (idempotent, offline
# when already satisfied).
deps:
	$(PIP) install -q -r $(BASEDIR)/requirements.txt

draft: deps
	rm -rf $(OUTPUTDIR)
	$(PELICAN) $(INPUTDIR) -o $(OUTPUTDIR) -s $(CONFFILE) $(PELICANOPTS)

publish: deps
	rm -rf $(OUTPUTDIR)
	$(PELICAN) $(INPUTDIR) -o $(OUTPUTDIR) -s $(PUBLISHCONF) $(PELICANOPTS)

# Backwards-compatible alias for the draft build.
html: draft

clean:
	[ ! -d "$(OUTPUTDIR)" ] || rm -rf $(OUTPUTDIR)

rsync_upload: publish
	rsync -e "ssh -p $(SSH_PORT)" -P -rvzc --delete $(OUTPUTDIR)/ $(SSH_USER)@$(SSH_HOST):$(SSH_TARGET_DIR)

.PHONY: deps draft publish html help clean rsync_upload
