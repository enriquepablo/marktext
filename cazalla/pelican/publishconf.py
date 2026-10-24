import os
from pelicanconf import *  # noqa: F401,F403

SITEURL = os.environ.get("SITEURL", "https://www.cazalla.net")
RELATIVE_URLS = False

# Publish build: only pages with `status: public` are rendered.
BUILD_MODE = "publish"

# All content is pages, so Pelican's article feeds would be empty. The
# vault_metadata plugin generates this RSS feed from the pages instead.
FEED_ALL_ATOM = None
PAGE_FEED_RSS = "feeds/all.rss.xml"
