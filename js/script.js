const DOMUS_CONFIG = Object.freeze({
  companyName: "DOMUS CONVENIÊNCIA",
  businessLabel: "DOMUS CONVENIÊNCIA | CAMPINAS, SÃO JOSÉ - SC",
  locationLabel: "Campinas, São José - SC",
  siteUrl: "https://domus-conveniencia.onrender.com/",
  pageTitle: "Domus Conveniência | São José - SC",
  metaDescription: "Conheça a Domus Conveniência em Campinas, São José - SC. Praticidade, produtos e conveniência pertinho de você.",
  ogImage: "assets/images/domus-fachada.jpg",
  instagramUrl: "https://www.instagram.com/domusconveniencia.ofic/",
  whatsappNumber: "554885003330",
  whatsappMessage: "Olá! Encontrei a Domus Conveniência pelo site e gostaria de mais informações.",
  coordinates: Object.freeze({
    latitude: -27.5978249,
    longitude: -48.6068827
  }),
  locationUrl: "https://www.google.com/maps/place/Domus+conveni%C3%AAncia/@-27.5978249,-48.6831004,13z/data=!4m10!1m2!2m1!1sdomos+conveniencia!3m6!1s0x952737da655f590d:0x59d4eefe6db66bfc!8m2!3d-27.5978249!4d-48.6068827!15sChJkb21vcyBjb252ZW5pZW5jaWFaFCISZG9tb3MgY29udmVuaWVuY2lhkgERY29udmVuaWVuY2Vfc3RvcmWaAURDaTlEUVVsUlFVTnZaRU5vZEhsalJqbHZUMjVHYldWRWJGTmFWR1JxWlVjeGVsTnRkM1JOUm5BMFpHdDRlRll6WXhBQuABAPoBBAgAECE!16s%2Fg%2F11zbk43z6d?entry=ttu&g_ep=EgoyMDI2MTAyOC4wIKXMDSoASAFQAw%3D%3D",
  address: "R. Quinze de Novembro, 150 - Sl 21 - Campinas, São José - SC, 88101-440",
  businessHours: "",
  delivery: "",
  pickup: "",
  paymentMethods: "",
  googleRating: 5.0,
  googleReviewCount: 49
});

document.documentElement.classList.add("js");

const metaDescription = document.querySelector('meta[name="description"]');
const ogTitle = document.querySelector('meta[property="og:title"]');
const ogDescription = document.querySelector('meta[property="og:description"]');
const ogImage = document.querySelector('meta[property="og:image"]');
const ogUrl = document.querySelector('meta[property="og:url"]');
const canonicalUrl = document.querySelector('link[rel="canonical"]');
document.title = DOMUS_CONFIG.pageTitle;
if (metaDescription) metaDescription.content = DOMUS_CONFIG.metaDescription;
if (ogTitle) ogTitle.content = DOMUS_CONFIG.pageTitle;
if (ogDescription) ogDescription.content = DOMUS_CONFIG.metaDescription;
if (ogImage) ogImage.content = new URL(DOMUS_CONFIG.ogImage, DOMUS_CONFIG.siteUrl).href;
if (ogUrl) ogUrl.content = DOMUS_CONFIG.siteUrl;
if (canonicalUrl) canonicalUrl.href = DOMUS_CONFIG.siteUrl;

document.querySelectorAll(".wordmark-main").forEach((mark) => {
  mark.textContent = DOMUS_CONFIG.companyName.split(/\s+/)[0];
});
document.querySelectorAll(".wordmark-sub").forEach((mark) => {
  mark.textContent = DOMUS_CONFIG.companyName.split(/\s+/).slice(1).join(" ");
});
document.querySelectorAll("[data-business-label]").forEach((label) => {
  label.textContent = DOMUS_CONFIG.businessLabel;
});
document.querySelectorAll("[data-location-label]").forEach((label) => {
  label.textContent = DOMUS_CONFIG.address || DOMUS_CONFIG.locationLabel;
});
const businessDetails = document.querySelector("#business-details");
let hasBusinessDetails = false;
document.querySelectorAll("[data-business-field]").forEach((field) => {
  const value = DOMUS_CONFIG[field.dataset.businessField];
  if (typeof value === "string" && value.trim()) {
    const output = field.querySelector("dd");
    if (output) {
      output.textContent = value.trim();
      field.hidden = false;
      hasBusinessDetails = true;
    }
  }
});
if (businessDetails) businessDetails.hidden = !hasBusinessDetails;
document.querySelectorAll("[data-company-name]").forEach((label) => {
  label.textContent = DOMUS_CONFIG.companyName;
});

const menuButton = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");

function closeMenu() {
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "Abrir menu");
  siteNav?.classList.remove("is-open");
}

menuButton?.addEventListener("click", () => {
  const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isExpanded));
  menuButton.setAttribute("aria-label", isExpanded ? "Abrir menu" : "Fechar menu");
  siteNav?.classList.toggle("is-open", !isExpanded);
});

siteNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

document.addEventListener("click", (event) => {
  if (menuButton?.getAttribute("aria-expanded") === "true" &&
      !siteNav?.contains(event.target) && !menuButton.contains(event.target)) {
    closeMenu();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 640) closeMenu();
});

const header = document.querySelector(".site-header");
const updateHeaderState = () => header?.classList.toggle("is-scrolled", window.scrollY > 16);
updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });

const { latitude, longitude } = DOMUS_CONFIG.coordinates;
const coordinateQuery = `${latitude},${longitude}`;
const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordinateQuery)}`;
const map = document.querySelector("#location-map");
const routeLinks = document.querySelectorAll("[data-route-link], #directions-link");
const mapProfileLinks = document.querySelectorAll("[data-maps-profile]");

if (map && Number.isFinite(latitude) && Number.isFinite(longitude)) {
  map.src = `https://maps.google.com/maps?q=${encodeURIComponent(coordinateQuery)}&z=17&output=embed`;
}
routeLinks.forEach((link) => {
  if (routeUrl) link.href = routeUrl;
});
mapProfileLinks.forEach((link) => {
  if (DOMUS_CONFIG.locationUrl) link.href = DOMUS_CONFIG.locationUrl;
});

const contactLinks = document.querySelectorAll('[data-contact="instagram"]');
if (DOMUS_CONFIG.instagramUrl) {
  contactLinks.forEach((link) => {
    link.href = DOMUS_CONFIG.instagramUrl;
    link.hidden = false;
  });
}

const whatsappNumber = DOMUS_CONFIG.whatsappNumber.replace(/\D/g, "");
const whatsappLinks = document.querySelectorAll('[data-contact="whatsapp"]');
if (/^55\d{10,11}$/.test(whatsappNumber)) {
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(DOMUS_CONFIG.whatsappMessage)}`;
  whatsappLinks.forEach((link) => {
    link.href = whatsappUrl;
    link.hidden = false;
  });
}

const reviewsSection = document.querySelector("#avaliacoes");
const reviewsLink = document.querySelector("#google-reviews-link");
const reviewScore = document.querySelector("#review-score");
const rating = Number(DOMUS_CONFIG.googleRating);
const reviewCount = Number(DOMUS_CONFIG.googleReviewCount);
const hasRating = Number.isFinite(rating) && rating >= 1 && rating <= 5 &&
  Number.isInteger(reviewCount) && reviewCount > 0;

if (DOMUS_CONFIG.locationUrl && reviewsLink) {
  reviewsLink.href = DOMUS_CONFIG.locationUrl;
  reviewsLink.hidden = false;
}

if (hasRating && reviewScore) {
  const stars = document.querySelector("#review-stars");
  const ratingText = document.querySelector("#review-rating");
  const countText = document.querySelector("#review-count");
  const roundedRating = Math.round(rating);
  if (stars) {
    stars.textContent = "★".repeat(roundedRating) + "☆".repeat(5 - roundedRating);
    stars.setAttribute("aria-label", `${rating.toFixed(1)} de 5 estrelas`);
  }
  if (ratingText) ratingText.textContent = rating.toFixed(1);
  if (countText) countText.textContent = `${reviewCount} avaliações`;
  reviewScore.hidden = false;
}

if ((hasRating || DOMUS_CONFIG.locationUrl) && reviewsSection) {
  reviewsSection.hidden = false;
}

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const revealElements = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}