use comrak::nodes::NodeValue;
use comrak::{format_html, parse_document, Anchorizer, Arena, Options};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
struct Heading {
    level: u8,
    line: usize,
    text: String,
    id: String,
}

#[derive(Serialize)]
struct Rendered {
    html: String,
    front_matter: Option<String>,
    headings: Vec<Heading>,
}

fn options() -> Options<'static> {
    let mut o = Options::default();
    let e = &mut o.extension;
    e.strikethrough = true;
    e.table = true;
    e.autolink = true;
    e.tasklist = true;
    e.superscript = true;
    e.subscript = true;
    e.footnotes = true;
    e.inline_footnotes = true;
    e.description_lists = true;
    e.front_matter_delimiter = Some("---".into());
    e.multiline_block_quotes = true;
    e.alerts = true;
    e.math_dollars = true;
    e.math_code = true;
    e.shortcodes = true;
    e.underline = true;
    e.spoiler = true;
    e.highlight = true;
    // `insert` (++text++) is off: it breaks emphasis that starts with "+", e.g. **+ FP8** (comrak 0.55)
    e.wikilinks_title_after_pipe = true;
    // GitHub-style prefix: bare ids like "images" or "title" get stripped by DOMPurify's clobbering guard
    e.header_id_prefix = Some("user-content-".into());
    e.header_id_prefix_in_href = true;
    let r = &mut o.render;
    r.r#unsafe = true; // raw HTML passes through; DOMPurify sanitizes in JS
    r.github_pre_lang = true;
    r.sourcepos = true;
    r.tasklist_classes = true;
    r.figure_with_caption = true;
    o
}

/// Render markdown. Returns JSON `{html, front_matter, headings}`.
#[wasm_bindgen]
pub fn render(md: &str) -> String {
    let opts = options();
    let arena = Arena::new();
    let root = parse_document(&arena, md, &opts);

    let mut front_matter = None;
    let mut headings = Vec::new();
    let mut anchors = Anchorizer::new();
    for node in root.descendants() {
        match &node.data().value {
            NodeValue::FrontMatter(fm) => front_matter = Some(strip_fences(fm)),
            NodeValue::Heading(h) => {
                let text = node.collect_text();
                let id = anchors.anchorize(&text);
                let line = node.data().sourcepos.start.line;
                headings.push(Heading { level: h.level, line, text, id });
            }
            _ => {}
        }
    }

    let mut html = String::new();
    format_html(root, &opts, &mut html).unwrap();
    serde_json::to_string(&Rendered { html, front_matter, headings }).unwrap()
}

fn strip_fences(fm: &str) -> String {
    fm.trim()
        .trim_start_matches("---")
        .trim_end_matches("---")
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_everything() {
        let out = render("---\ntitle: Hi\n---\n# A b\n\n## A b\n\n$x^2$ :rocket: ==hl== ~~s~~\n\n> [!NOTE]\n> n\n\n```mermaid\ngraph TD\n```\n");
        assert!(out.contains(r#""front_matter":"title: Hi""#), "{out}");
        assert!(out.contains(r#""id":"a-b""#) && out.contains(r#""id":"a-b-1""#), "{out}");
        assert!(out.contains(r#"id=\"user-content-a-b\""#), "{out}");
        assert!(out.contains("data-math-style"), "{out}");
        assert!(out.contains("🚀"), "{out}");
        assert!(out.contains("<mark"), "{out}");
        assert!(out.contains("markdown-alert"), "{out}");
        assert!(out.contains(r#"lang=\"mermaid\""#), "{out}");
        assert!(out.contains(r#""line":4"#), "{out}");
        // regression: bold/italic starting with "+" (inside and outside tables)
        let plus = render("**+ FP8 activations** (x)\n\n| a |\n|---|\n| **+ FP8** *+ w* |\n");
        assert_eq!(plus.matches("<strong").count(), 2, "{plus}");
        assert!(plus.contains("<em"), "{plus}");
        let wl = render("see [[Other note|the other]] and [[plain]]");
        assert!(wl.contains("data-wikilink"), "{wl}");
    }
}
