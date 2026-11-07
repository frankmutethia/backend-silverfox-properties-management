import sanitizeHtml from "sanitize-html";

// Mirrors the website editor's allowlist.
const formattingTags = [
  "p", "div", "br", "b", "strong", "i", "em", "u", "ol", "ul", "li", "h2", "h3", "blockquote", "span",
];

const fontSizes = { 2: "14px", 3: "16px", 4: "18px", 5: "24px" };

const allowedStyles = {
  "*": {
    "font-size": [/^(14|16|18|24)px$/],
    "font-family": [/^(serif|sans-serif)$/],
    "font-weight": [/^(bold|700)$/],
    "font-style": [/^italic$/],
  },
};

const clean = (html, images) =>
  sanitizeHtml(html, {
    allowedTags: images ? [...formattingTags, "img"] : formattingTags,
    allowedAttributes: { "*": ["style"], img: ["src", "alt"] },
    allowedStyles,
    allowedSchemes: ["https"],
    allowedSchemesAppliedToAttributes: ["src"],
    allowProtocolRelative: false,
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "svg", "math", "title"],
    transformTags: {
      font: (_tag, attribs) => {
        const styles = [];
        const size = fontSizes[attribs.size];
        if (size) styles.push(`font-size:${size}`);
        if (attribs.face === "serif" || attribs.face === "sans-serif") styles.push(`font-family:${attribs.face}`);
        return { tagName: "span", attribs: styles.length ? { style: styles.join(";") } : {} };
      },
      img: (_tag, attribs) => ({
        tagName: "img",
        attribs: { src: attribs.src ?? "", alt: (attribs.alt ?? "").trim().slice(0, 150) },
      }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !/^https:\/\//i.test(frame.attribs.src ?? ""),
  });

export const sanitizeRichText = (html) => clean(html, false);
export const sanitizeArticle = (html) => clean(html, true);

const entities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

export const plainText = (html) =>
  sanitizeHtml(html.replace(/<(br|\/p|\/div|\/li|\/h2|\/h3)\b[^>]*>/gi, " $&"), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => entities[match] ?? match)
    .replace(/\s+/g, " ")
    .trim();

export const imagesIn = (html) =>
  [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => ({ alt: /\balt="([^"]*)"/i.exec(match[0])?.[1] ?? "" }));

export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
