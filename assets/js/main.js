"use strict";

/**
 * Domorelli Steakhouse — main.js
 * Responsabilidades (aprimoramento progressivo apenas):
 *  1. Vinheta de abertura (controle de estado) + botão "Pular introdução"
 *  2. Navegação móvel acessível (abrir/fechar, Escape, foco)
 *  3. Ano do rodapé
 *  4. Indicação discreta da seção atual (IntersectionObserver, opcional)
 *
 * Nada aqui cria conteúdo essencial: todo o HTML já existe e funciona
 * sem este arquivo.
 */

(function () {
  function initIntro() {
    var intro = document.querySelector("[id='intro']");
    if (!intro) return;

    var skipBtn = document.getElementById("intro-skip");
    var prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    var alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem("domorelli:intro-seen") === "1";
    } catch (err) {
      alreadySeen = false;
    }

    if (prefersReduced || alreadySeen) {
      intro.hidden = true;
      return;
    }

    function markSeen() {
      try {
        sessionStorage.setItem("domorelli:intro-seen", "1");
      } catch (err) {
        /* sessionStorage indisponível: segue sem persistir */
      }
    }

    function closeIntro() {
      intro.hidden = true;
      intro.classList.remove("is-active");
      document.body.style.removeProperty("overflow");
      markSeen();
    }

    intro.hidden = false;
    intro.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Ativa a animação em um frame seguinte para garantir a transição.
    window.requestAnimationFrame(function () {
      intro.classList.add("is-active");
    });

    var autoCloseTimer = window.setTimeout(closeIntro, 2000);

    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        window.clearTimeout(autoCloseTimer);
        closeIntro();
      });
    }

    intro.addEventListener("animationend", function (event) {
      if (event.animationName === "intro-fade-out") {
        window.clearTimeout(autoCloseTimer);
        closeIntro();
      }
    });
  }

  function initMobileNav() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.querySelector("[data-nav]");
    if (!toggle || !nav) return;

    function closeNav() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    function openNav() {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.contains("is-open");
      if (isOpen) {
        closeNav();
      } else {
        openNav();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        closeNav();
        toggle.focus();
      }
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        closeNav();
      });
    });

    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(target) || toggle.contains(target)) return;
      closeNav();
    });
  }

  function initFooterYear() {
    var yearEl = document.querySelector("[data-year]");
    if (!yearEl) return;
    yearEl.textContent = String(new Date().getFullYear());
  }

  function initSectionIndicator() {
    if (!("IntersectionObserver" in window)) return;

    var sections = document.querySelectorAll("main [id]");
    var navLinks = document.querySelectorAll(".site-nav__list a[href^='#']");
    if (!sections.length || !navLinks.length) return;

    var linkById = {};
    navLinks.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      linkById[id] = link;
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = linkById[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (l) {
              l.removeAttribute("aria-current");
            });
            link.setAttribute("aria-current", "true");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach(function (section) {
      if (linkById[section.id]) {
        observer.observe(section);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initIntro();
    initMobileNav();
    initFooterYear();
    initSectionIndicator();
  });
})();
