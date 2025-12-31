export function setDocumentTitle(title: string) {
  document.title = title;
}

function getOrCreateMeta(name: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  return el;
}

function getOrCreateProperty(prop: string) {
  let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", prop);
    document.head.appendChild(el);
  }
  return el;
}

export function setMetaDescription(desc: string) {
  const el = getOrCreateMeta("description");
  el.content = desc;
}

export function setOgTags(opts: {
  title?: string;
  description?: string;
  url?: string;
  image?: string | null;
}) {
  if (opts.title) getOrCreateProperty("og:title").content = opts.title;
  if (opts.description) getOrCreateProperty("og:description").content = opts.description;
  if (opts.url) getOrCreateProperty("og:url").content = opts.url;
  if (opts.image) getOrCreateProperty("og:image").content = opts.image;
  getOrCreateProperty("og:type").content = "article";
}

function getOrCreateLink(rel: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  return el;
}

export function setCanonical(url: string) {
  const el = getOrCreateLink("canonical");
  el.href = url;
}

export function setTwitterTags(opts: {
  title?: string;
  description?: string;
  image?: string | null;
}) {
  const card = getOrCreateMeta("twitter:card");
  card.content = opts.image ? "summary_large_image" : "summary";
  if (opts.title) getOrCreateMeta("twitter:title").content = opts.title;
  if (opts.description) getOrCreateMeta("twitter:description").content = opts.description;
  if (opts.image) getOrCreateMeta("twitter:image").content = opts.image;
}

export function setArticleTimes(opts: {
  publishedTime?: string | null;
  modifiedTime?: string | null;
}) {
  if (opts.publishedTime)
    getOrCreateProperty("article:published_time").content = opts.publishedTime;
  if (opts.modifiedTime) getOrCreateProperty("article:modified_time").content = opts.modifiedTime;
}

function getOrCreateScript(id: string) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  return el;
}

export function setJsonLd(id: string, data: unknown) {
  const el = getOrCreateScript(id);
  el.text = JSON.stringify(data);
}

export function clearJsonLd(id: string) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
