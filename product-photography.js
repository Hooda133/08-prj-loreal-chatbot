/* Real photographed L'Oréal product packaging, matched to the exact catalog ID.
 * The artwork is served from original rights holders' URLs rather than copied.
 * Third-party images remain third-party copyrighted assets; educational demo only.
 * The fragrance image shows Lancôme (a L'Oréal Groupe brand), not L'Oréal Paris.
 */
(function () {
  "use strict";
  const loreal = "https://www.lorealparisusa.com/-/media/project/loreal/brand-sites/oap/americas/us/products/";
  const sources = Object.freeze({
    "radiant-cleanser": loreal + "skin-care/facial-cleansers/revitalift-radiant-smoothing-cream-cleanser/radiant-smoothing-cream-cleanser/071249135655_t1.png",
    "glycolic-cleanser": loreal + "skin-care/facial-cleansers/revitalift-derm-intensives-glycolic-acid-cleanser/071249419854_t1-new.png",
    "ha-serum": loreal + "skin-care/facial-moisturizers/revitalift-derm-intensives-pure-hyaluronic-acid-serum/071249377512_t1.png?hash=5FA22869120F108DA5CD76DF0A6C39F2&w=500",
    "vitamin-c-serum": loreal + "skin-care/face-serums/vitamin-c-vitamin-e-salicylic-acid-serum/3600524053352_t1.png",
    "glycolic-serum": loreal + "skin-care/face-serums/revitalift-derm-intensives-10-pure-glycolic-acid-serum/071249403600-t1-new.png",
    "peptide-serum": loreal + "skin-care/face-serums/revitalift-triple-power-age-defying-serum/071249703212-t1.png",
    "hydra-genius": loreal + "skin-care/facial-moisturizers/hydra-genius-daily-liquid-care-normal-dry-skin/daily-liquid-care-normal-dry-skin/071249339190_t1.png",
    "fragrance-free": loreal + "skin-care/facial-moisturizers/revitalift-triple-power-anti-aging-moisturizer-fragrance-free/new-assets-2026/071249396339_t1-with-seal.png",
    "night-moisturizer": loreal + "skin-care/facial-moisturizers/revitalift-triple-power-rich-night-moisturizer/071249706855-t3-new-%281%29.png",
    "bright-spf": loreal + "skin-care/facial-moisturizers/revitalift-derm-intensives-broad-spectrum-spf-50-invisible-uv-fluid/071249683491-t1.png",
    "triple-spf": loreal + "skin-care/facial-moisturizers/revitalift-triple-power-moisturizer-spf-30/071249700341/071249696057-t1.png",
    "plump-shampoo": loreal + "hair-care/shampoo/hyaluron-plump-hydrating-shampoo-paraben-free/2026-assets/071249673478_01-neww.png",
    "plump-conditioner": loreal + "hair-care/conditioner/hyaluron-plump-hydrating-conditioner-paraben-free-12-6oz/2025-assets/071249665695/071249665695_t1-new.png",
    "plump-leave-in": loreal + "hair-care/hair-serum/hyaluron-plump-moisture-plump-serum-paraben-free/2025-assets/071249666210_01-new.png",
    "pure-shampoo": loreal + "hair-care/shampoo/hyaluron-pure-purifying-shampoo/2025-assets/071249680667/071249680667_t1-new.png",
    "pure-conditioner": loreal + "hair-care/shampoo/hyaluron-pure-purifying-conditioner/2025-assets/071249680674/071249680674_t1-new.png",
    "dream-shampoo": loreal + "hair-care/shampoo/elvive-dream-lengths-restoring-shampoo-for-long-damaged-hair/20-03-25/071249383612_t1-new.png",
    "dream-conditioner": loreal + "hair-care/conditioner/elvive-dream-lengths-conditioner-for-long-damaged-hair/conditioner-for-long-damaged-hair-mini/20-03-25/071249383742_t1-new.png",
    "dream-leave-in": loreal + "hair-care/hair-treatments/elvive-dream-lengths-no-haircut-cream-leave-in-conditioner/20-03-25/071249384466_t1-new.png",
    "lumi-glotion": loreal + "makeup/face/highlighters/true-match-lumi-glotion-natural-glow-enhancer/medium/new-assets-08-11-26/071249363126_t1-new.png",
    "true-match": loreal + "makeup/face/foundation-makeup/true-match-super-blendable-makeup/c3-creamy-natural/c3---light-medium/071249671610_t1-%281%29.png",
    "lash-paradise": loreal + "makeup/eye/mascara/voluminous-lash-paradise-washable-mascara/200-blackest-black/new-images/071249343265-t1-new.png",
    "colour-riche": loreal + "makeup/lip-color/lipstick/colour-riche-lipcolour/atf-v2-2024/071249256206_t1-v2.png",
    // La vie est belle (Lancôme / L'Oréal Groupe). Photo courtesy retailer.
    "lancome-fragrance": "https://giantchemistharbourtown.com.au/cdn/shop/files/47da1d99c288de68a23d3ecd3518f2df_d4963df8-7025-47db-95fd-3b2e317bc170.jpg?v=1746770282"
  });
  const labels = Object.freeze({
    "lancome-fragrance": "Lancôme La vie est belle Eau de Parfum — L'Oréal Groupe"
  });
  function urlFor(id) { return Object.hasOwn(sources, id) ? sources[id] : null; }
  function getName(id) {
    return labels[id] || (window.BeautyCatalog || []).find(item => item.id === id)?.name || id;
  }
  function wire(photo, id, { eager = false, decorative = false } = {}) {
    const src = urlFor(id);
    if (!src) {
      photo.hidden = true;
      return photo;
    }
    photo.classList.add("real-product-photo");
    photo.alt = decorative ? "" : getName(id) + " — real product packaging";
    photo.decoding = "async";
    photo.loading = eager ? "eager" : "lazy";
    if (eager) photo.fetchPriority = "high";
    photo.addEventListener("error", () => {
      photo.hidden = true;
      // Make failure explicit rather than substituting a fake bottle.
      const frame = photo.parentElement;
      if (frame) {
        frame.classList.add("product-photo-missing");
        if (!frame.querySelector(".product-photo-fallback")) {
          const label = document.createElement("span");
          label.className = "product-photo-fallback";
          label.textContent = "Photo unavailable";
          label.setAttribute("aria-hidden", "true");
          frame.appendChild(label);
        }
      }
    }, { once: true });
    photo.src = src;
    return photo;
  }
  function create(id, { decorative = false, eager = false, className = "" } = {}) {
    const img = document.createElement("img");
    if (className) img.className = className;
    return wire(img, id, { decorative, eager });
  }
  document.querySelectorAll("img[data-product-photo]").forEach(img => {
    const decorative = img.closest('[aria-hidden="true"]') !== null || img.getAttribute("alt") === "";
    wire(img, img.dataset.productPhoto, {
      decorative,
      eager:img.dataset.priority === "high"
    });
  });
  window.BeautyPhotography = Object.freeze({ urlFor, create, getName, sources });
})();
