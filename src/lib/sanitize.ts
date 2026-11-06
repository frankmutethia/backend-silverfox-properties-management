import sanitizeHtml from "sanitize-html";
import { config } from "../config.js";

// Mirrors the frontend's cleanRichHtml allowlist (src/lib/local-services.ts).
const formattingTags = [
  "p",
  "div",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ol",
  "ul",
  "li",
  "h2",
  "h3",
  "blockquote",
  "span",
];

const fontSizes: Record<string, string> = { "2": "14px", "3": "16px", "4": "18px", "5": "24px" };

const allowedStyles = {
  "*": {
    "font-size": [/^(14|16|18|24)px$/],
    "font-family": [/^(serif|sans-serif)$/],
    "font-weight": [/^(bold|700)$/],
    "font-style": [/^italic$/],
  },
};

const uploadsPrefix = () => `${config.PUBLIC_URL}/uploads/`;

export function isAllowedImageSource(src: string) {
  return /^https:\/\//i.test(src) || src.startsWith(uploadsPrefix());
}

function clean(html: string, images: boolean) {
  return sanitizeHtml(html, {
    allowedTags: images ? [...formattingTags, "img"] : formattingTags,
    allowedAttributes: {
      "*": ["style"],
      img: ["src", "alt"],
    },
    allowedStyles,
    allowedSchemes: ["https", "http"],
    allowedSchemesAppliedToAttributes: ["src"],
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "svg", "math", "title"],
    transformTags: {
      font: (_tag, attribs) => {
        const styles: string[] = [];
        const size = fontSizes[attribs.size ?? ""];
        if (size) styles.push(`font-size:${size}`);
        if (attribs.face === "serif" || attribs.face === "sans-serif") styles.push(`font-family:${attribs.face}`);
        const attributes: Record<string, string> = styles.length ? { style: styles.join(";") } : {};
        return { tagName: "span", attribs: attributes };
      },
      img: (_tag, attribs) => ({
        tagName: "img",
        attribs: { src: attribs.src ?? "", alt: (attribs.alt ?? "").trim().slice(0, 150) },
      }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImageSource(frame.attribs.src ?? ""),
  });
}

export const sanitizeRichText = (html: string) => clean(html, false);
export const sanitizeArticle = (html: string) => clean(html, true);

const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function plainText(html: string) {
  const text = sanitizeHtml(html.replace(/<(br|\/p|\/div|\/li|\/h2|\/h3)\b[^>]*>/gi, " $&"), {
    allowedTags: [],
    allowedAttributes: {},
  });
  return text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => entities[match] ?? match).replace(/\s+/g, " ").trim();
}

export function imagesIn(html: string) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => ({
    alt: /\balt="([^"]*)"/i.exec(match[0])?.[1] ?? "",
  }));
}
