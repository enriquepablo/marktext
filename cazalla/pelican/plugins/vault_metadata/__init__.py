"""
Vault Metadata plugin for Pelican.

Builds a page tree from the filesystem (inferring slug and path from file
location) and makes it available to templates as `page_tree`. Attaches
nav_parent, nav_prev, nav_next, nav_child to each page for directional
navigation. Only `title` (and optionally `order`) frontmatter is required.
"""

import os
import logging
from collections import defaultdict

from pelican import signals
from pelican.contents import Page
from pelican.writers import Writer

logger = logging.getLogger(__name__)

# Absolute path to the content directory, set in on_initialized.
_content_path = None

# Pages and context captured for the RSS feed, set in on_page_generator_finalized.
_feed_pages = None
_feed_context = None


def _rel_source_path(page):
    """Return source_path relative to the content directory.

    Pelican may give us an absolute path; normalise it so the rest of the
    plugin always works with paths like "one-thing/page-one-one.md".
    """
    src = page.source_path
    if _content_path and os.path.isabs(src):
        src = os.path.relpath(src, _content_path)
    return src


def _infer_slug_and_parent_dir(page):
    """Return (slug, parent_dir) inferred from the page's source path."""
    src = _rel_source_path(page)
    slug = os.path.splitext(os.path.basename(src))[0]
    parent_dir = os.path.dirname(src).replace(os.sep, "/").strip("/")
    return slug, parent_dir


def on_content_object_init(sender):
    """Inject site_path into page metadata so PAGE_URL/PAGE_SAVE_AS work.

    site_path includes a trailing slash for all non-root pages so that:
      PAGE_URL     = "{site_path}"             →  "one-thing/"  or  ""
      PAGE_SAVE_AS = "{site_path}index.html"   →  "one-thing/index.html"  or  "index.html"
    """
    if not isinstance(sender, Page):
        return
    rel_src = _rel_source_path(sender)
    slug, parent_dir = _infer_slug_and_parent_dir(sender)
    if rel_src == "index.md":
        site_path = ""
    else:
        full_path = f"{parent_dir}/{slug}" if parent_dir else slug
        site_path = f"{full_path}/"
    sender.metadata["site_path"] = site_path

    # Resolve our own draft/public status from the frontmatter. New pages
    # default to "draft"; the site root defaults to "public" so publish builds
    # always have a home page unless index.md sets a status explicitly.
    #
    # Then neutralise Pelican's native status handling: our custom value
    # "draft" would otherwise divert the file to drafts/, and "public" isn't a
    # Pelican status at all (it would be skipped). Everything is marked
    # "published" here; on_page_generator_finalized does the real filtering.
    web_status = sender.metadata.get("status")
    if web_status:
        web_status = str(web_status).strip().lower()
    else:
        web_status = "public" if rel_src == "index.md" else "draft"
    sender.web_status = web_status
    sender.status = "published"


def _build_page_tree(pages):
    """Build tree from filesystem paths.

    index.md is treated as the virtual root (full_path = "").  All other
    root-level pages have parent_dir "" which resolves to the index node via
    page_at[""]; they are children of index, not its siblings.

    Returns (roots, page_at, children_of) where:
      - roots: direct children of the index page, sorted by order
      - page_at: maps full_path -> node  (index lives at "")
      - children_of: maps parent_dir -> sorted list of child nodes
                     (index is never added as a child of anything)
    """
    children_of = defaultdict(list)
    page_at = {}

    for page in pages:
        rel_src = _rel_source_path(page)
        slug, parent_dir = _infer_slug_and_parent_dir(page)
        try:
            order = float(page.metadata.get("order", 0))
        except (ValueError, TypeError):
            order = 0.0

        is_index = rel_src == "index.md"
        if is_index:
            full_path = ""
            node_parent_dir = None   # index has no parent
        else:
            full_path = f"{parent_dir}/{slug}" if parent_dir else slug
            node_parent_dir = parent_dir

        node = {
            "page": page,
            "children": [],
            "slug": slug,
            "parent_dir": node_parent_dir,
            "full_path": full_path,
            "order": order,
        }
        page_at[full_path] = node
        if not is_index:
            children_of[parent_dir].append(node)

    for siblings in children_of.values():
        siblings.sort(key=lambda n: n["order"])

    for full_path, node in page_at.items():
        node["children"] = children_of.get(full_path, [])

    return children_of.get("", []), page_at, children_of


def _attach_navigation(page_at, children_of):
    """Attach nav_parent, nav_prev, nav_next, nav_child to each page."""
    for node in page_at.values():
        page = node["page"]
        parent_dir = node["parent_dir"]  # None for index

        if parent_dir is None:
            # index page: no parent, no siblings
            page.nav_parent = None
            page.nav_prev = None
            page.nav_next = None
        else:
            parent_node = page_at.get(parent_dir)
            page.nav_parent = parent_node["page"] if parent_node else None

            siblings = children_of.get(parent_dir, [])
            idx = next(
                (i for i, s in enumerate(siblings) if s["full_path"] == node["full_path"]),
                -1,
            )
            page.nav_prev = siblings[idx - 1]["page"] if idx > 0 else None
            page.nav_next = siblings[idx + 1]["page"] if idx < len(siblings) - 1 else None

        page.nav_child = node["children"][0]["page"] if node["children"] else None


def on_page_generator_finalized(page_generator):
    """Filter by build mode, build page tree, attach navigation, inject context.

    BUILD_MODE == "publish": only pages with web_status "public" are kept, so
    drafts are neither written nor linked in navigation. BUILD_MODE == "draft"
    (the default) keeps everything.
    """
    mode = page_generator.settings.get("BUILD_MODE", "draft")
    if mode == "publish":
        def is_public(p):
            return getattr(p, "web_status", "draft") == "public"

        page_generator.pages = [p for p in page_generator.pages if is_public(p)]
        page_generator.hidden_pages = [
            p for p in page_generator.hidden_pages if is_public(p)
        ]
        # generate_output writes the .pages attribute; keep context in sync too.
        page_generator.context["pages"] = page_generator.pages
        logger.info(
            "vault_metadata: publish build — %d public page(s)",
            len(page_generator.pages),
        )

    pages = page_generator.pages + page_generator.hidden_pages
    roots, page_at, children_of = _build_page_tree(pages)
    _attach_navigation(page_at, children_of)
    page_generator.context["page_tree"] = roots
    logger.info("vault_metadata: built page tree with %d root nodes", len(roots))

    # Capture pages for the RSS feed (Pelican's built-in feeds cover only
    # articles). Most-recently-touched first.
    global _feed_pages, _feed_context
    _feed_pages = sorted(
        page_generator.pages,
        key=lambda p: getattr(p, "modified", None) or p.date,
        reverse=True,
    )
    _feed_context = page_generator.context


def on_finalized(pelican):
    """Write an RSS feed of pages, if PAGE_FEED_RSS is set."""
    feed_path = pelican.settings.get("PAGE_FEED_RSS")
    if not feed_path or not _feed_pages:
        return
    writer = Writer(pelican.output_path, settings=pelican.settings)
    writer.write_feed(_feed_pages, _feed_context, feed_path, feed_type="rss")
    logger.info(
        "vault_metadata: wrote RSS feed (%d items) to %s",
        len(_feed_pages),
        feed_path,
    )


def on_initialized(pelican):
    global _content_path
    _content_path = pelican.settings.get("PATH", "")
    metadata_dir = pelican.settings.get("VAULT_METADATA_DIR", "")
    if not metadata_dir:
        logger.debug("VAULT_METADATA_DIR not set; skipping YAML metadata.")
        return
    logger.info("vault_metadata: metadata dir: %s", metadata_dir)
    # TODO: walk metadata_dir, parse YAML files, build merged tree


def add_vault_metadata_to_context(generator):
    generator.context["vault_metadata"] = {}


def register():
    signals.initialized.connect(on_initialized)
    signals.content_object_init.connect(on_content_object_init)
    signals.page_generator_finalized.connect(on_page_generator_finalized)
    signals.generator_init.connect(add_vault_metadata_to_context)
    signals.finalized.connect(on_finalized)
