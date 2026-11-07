import slugify from "slugify";

export const toSlug = (value) =>
  slugify(String(value).replace(/&/g, " and "), { lower: true, strict: true }).slice(0, 150).replace(/-+$/, "") ||
  "item";

// Returns `base`, or `base-2`, `base-3`... the first one not used by another document.
export const uniqueSlug = async (Model, source, excludeId) => {
  const base = toSlug(source);
  for (let attempt = 1; ; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const filter = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
    if (!(await Model.exists(filter))) return slug;
  }
};
