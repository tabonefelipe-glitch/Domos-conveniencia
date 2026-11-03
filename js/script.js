const DOMUS_CONFIG = {
  companyName: "DOMUS CONVENIÊNCIA",
  instagram: "https://www.instagram.com/domusconveniencia.ofic/",
  coordinates: {
    latitude: -27.5978249,
    longitude: -48.6068827
  },
  whatsappNumber: ""
};

document.documentElement.classList.add("js");

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

const { latitude, longitude } = DOMUS_CONFIG.coordinates;
const encodedCoordinates = `${latitude},${longitude}`;
const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(encodedCoordinates)}`;
const map = document.querySelector("#location-map");
const routeLinks = [document.querySelector("#directions-link"), document.querySelector("#footer-directions-link")];

if (map) {
  map.src = `https://maps.google.com/maps?q=${encodeURIComponent(encodedCoordinates)}&z=16&output=embed`;
}

routeLinks.forEach((link) => {
  if (link) link.href = routeUrl;
});

const instagramLinks = [document.querySelector("#instagram-link"), document.querySelector("#footer-instagram-link")];
instagramLinks.forEach((link) => {
  if (link) link.href = DOMUS_CONFIG.instagram;
});

const whatsappLink = document.querySelector("#whatsapp-link");
const whatsappNumber = DOMUS_CONFIG.whatsappNumber.replace(/\D/g, "");
if (whatsappLink && whatsappNumber) {
  whatsappLink.href = `https://wa.me/${whatsappNumber}`;
  whatsappLink.hidden = false;
}

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

document.title = `${DOMUS_CONFIG.companyName.replace("CONVENIÊNCIA", "Conveniência")} | Praticidade perto de você`;

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