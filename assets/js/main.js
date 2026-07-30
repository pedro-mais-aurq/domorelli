"use strict";

/**
 * Domorelli Steakhouse — main.js
 * Responsabilidades (aprimoramento progressivo apenas):
 *  1. Vinheta de abertura (controle de estado) + botão "Pular introdução"
 *     — a marca é "queimada" com uma animação procedural de faíscas em Canvas
 *  2. Navegação móvel acessível (abrir/fechar, Escape, foco)
 *  3. Ano do rodapé
 *  4. Indicação discreta da seção atual (IntersectionObserver, opcional)
 *
 * Nada aqui cria conteúdo essencial: todo o HTML já existe e funciona
 * sem este arquivo.
 */

(function () {
  var SPARK_COLORS = ["#fff7df", "#ffd28a", "#ff9a3d", "#d94f16"];
  var MAX_PARTICLES = 180;

  function initIntro() {
    var intro = document.querySelector("[id='intro']");
    if (!intro) return;

    var skipBtn = document.getElementById("intro-skip");
    var plate = intro.querySelector(".intro__plate");
    var mark = intro.querySelector(".intro__mark");
    var ember = intro.querySelector(".intro__ember");
    var prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    var alreadySeen = false;

    try {
      alreadySeen =
        sessionStorage.getItem("domorelli:intro-seen") === "1";
    } catch (err) {
      alreadySeen = false;
    }

    if (prefersReduced || alreadySeen) {
      intro.hidden = true;
      return;
    }

    var introClosed = false;
    var introFinishing = false;
    var fallbackTimer = null;
    var exitTimer = null;
    var animationCancel = null;

    function markSeen() {
      try {
        sessionStorage.setItem("domorelli:intro-seen", "1");
      } catch (err) {
        /* sessionStorage indisponível: segue sem persistir */
      }
    }

    function closeIntro() {
      if (introClosed) return;

      introClosed = true;

      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      if (exitTimer) {
        window.clearTimeout(exitTimer);
        exitTimer = null;
      }

      if (animationCancel) {
        animationCancel();
        animationCancel = null;
      }

      intro.hidden = true;
      intro.setAttribute("aria-hidden", "true");
      intro.classList.remove("is-active");
      document.body.style.removeProperty("overflow");

      markSeen();
    }

    function finishIntro() {
      if (introClosed || introFinishing) return;

      introFinishing = true;

      /*
       * A saída começa somente depois que a marcação,
       * o resfriamento e o repouso da logo branca terminam.
       */
      intro.style.opacity = "0";

      exitTimer = window.setTimeout(closeIntro, 420);
    }

    intro.hidden = false;
    intro.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    /*
     * Neutraliza o fade-out cronometrado pelo CSS antigo.
     * A saída passa a ser controlada pela conclusão real do Canvas.
     */
    intro.style.animation = "none";
    intro.style.opacity = "1";
    intro.style.visibility = "visible";
    intro.style.transition =
      "opacity 380ms cubic-bezier(.22, .61, .36, 1)";

    if (plate) {
      /*
       * Evita que transformações aplicadas ao plate alterem
       * a geometria utilizada para posicionar o Canvas.
       */
      plate.style.animation = "none";
      plate.style.background = "transparent";
      plate.style.boxShadow = "none";
      plate.style.border = "none";
    }

    if (mark) {
      mark.style.animation = "none";
      mark.style.transform = "none";
    }

    window.requestAnimationFrame(function () {
      if (!introClosed) {
        intro.classList.add("is-active");
      }
    });

    /*
     * Rede de segurança. A animação normal deve terminar
     * antes deste tempo.
     */
    fallbackTimer = window.setTimeout(closeIntro, 7600);

    if (skipBtn) {
      skipBtn.addEventListener("click", closeIntro);
    }

    if (ember) {
      ember.style.display = "none";
    }

    if (!plate || !mark) {
      exitTimer = window.setTimeout(closeIntro, 300);
      return;
    }

    var animation = runLogoBrandAnimation(mark, plate);
    animationCancel = animation.cancel;

    animation.promise
      .then(function () {
        /*
         * Pequeno repouso depois da logo completamente branca,
         * antes do fade da introdução.
         */
        exitTimer = window.setTimeout(finishIntro, 180);
      })
      .catch(function () {
        finishIntro();
      });
  }

  /**
   * Anima a marca simulando metal incandescente
   * que esfria progressivamente até branco.
   */
  function runLogoBrandAnimation(mark, plate) {
    var resolvePromise;
    var rejectPromise;

    var promise = new Promise(function (resolve, reject) {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    var cancelled = false;
    var finished = false;

    var rafId = null;

    var canvas = null;
    var ctx = null;

    var maskCanvas = null;

    var revealCanvas = null;
    var revealCtx = null;

    var points = [];
    var particles = [];
    var coolingSpots = [];

    var canvasWidth = 0;
    var canvasHeight = 0;

    var cssWidth = 0;
    var cssHeight = 0;

    var dpr = Math.max(1, window.devicePixelRatio || 1);

    var resizeTimer = null;
    var resizeHandler = null;

    var cancelMarkWait = null;
    var platePositionChanged = false;

    var elapsedTime = 0;
    var lastTimestamp = null;

    var burnComplete = false;
    var burnCompleteAt = null;

    var finalWhite = false;
    var finalWhiteAt = null;

    var IGNITE_MS = 460;
    var IGNITE_TARGET = 0.055;

    var BURN_MS = 2250;

    var COOL_MS = 620;
    var MAX_FINAL_COOL_MS = 820;

    var FINAL_WHITE_HOLD_MS = 620;

    function cancel() {
      if (cancelled || finished) return;

      cancelled = true;
      cleanupLogoAnimation();
    }

    function cleanupLogoAnimation() {
      if (cancelMarkWait) {
        var cancelPendingWait = cancelMarkWait;

        cancelMarkWait = null;
        cancelPendingWait();
      }

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
        resizeHandler = null;
      }

      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
        resizeTimer = null;
      }

      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      if (platePositionChanged) {
        plate.style.removeProperty("position");
      }

      particles.length = 0;
      coolingSpots.length = 0;

      /*
       * A imagem original assume o estado branco somente
       * depois que o Canvas é removido.
       *
       * Isso evita que duas versões da logo, com diferenças
       * de tamanho ou posicionamento, apareçam simultaneamente.
       */
      mark.style.filter = "brightness(0) invert(1)";
    }

    function fail(err) {
      if (finished || cancelled) return;

      finished = true;

      cleanupLogoAnimation();
      rejectPromise(err);
    }

    function succeed() {
      if (finished || cancelled) return;

      finished = true;

      cleanupLogoAnimation();
      resolvePromise();
    }

    function prefersReducedMotion() {
      return window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }

    function canvasSupported() {
      try {
        var test = document.createElement("canvas");

        return Boolean(
          test.getContext &&
          test.getContext("2d")
        );
      } catch (err) {
        return false;
      }
    }

    if (prefersReducedMotion()) {
      mark.style.filter = "brightness(0) invert(1)";

      window.setTimeout(succeed, 60);

      return {
        promise: promise,
        cancel: cancel
      };
    }

    if (!canvasSupported()) {
      fail(new Error("canvas-unsupported"));

      return {
        promise: promise,
        cancel: cancel
      };
    }

    function createIntroCanvas() {
      canvas = document.createElement("canvas");

      canvas.setAttribute("aria-hidden", "true");

      canvas.style.position = "absolute";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "2";
      canvas.style.display = "block";
      canvas.style.opacity = "1";


      ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("2d-context-unavailable");
      }

      var computedPosition =
        window.getComputedStyle(plate).position;

      if (
        !computedPosition ||
        computedPosition === "static"
      ) {
        plate.style.position = "relative";
        platePositionChanged = true;
      }

      /*
       * A logo preta permanece abaixo do Canvas.
       * O Canvas ocupa exatamente a mesma área visual.
       */
      mark.style.position = "relative";
      mark.style.zIndex = "1";

      plate.appendChild(canvas);
    }

    function measureAndPlaceCanvas() {
      dpr = Math.max(
        1,
        window.devicePixelRatio || 1
      );

      /*
       * offsetWidth, offsetHeight, offsetLeft e offsetTop
       * usam o sistema de coordenadas local do plate.
       *
       * getBoundingClientRect poderia incluir transforms
       * aplicados pelo CSS e ampliar o Canvas novamente.
       */
      cssWidth = mark.offsetWidth;
      cssHeight = mark.offsetHeight;

      if (!cssWidth || !cssHeight) {
        throw new Error("mark-not-visible");
      }

      canvas.style.left = mark.offsetLeft + "px";
      canvas.style.top = mark.offsetTop + "px";

      canvas.style.width = cssWidth + "px";
      canvas.style.height = cssHeight + "px";

      canvasWidth = Math.max(
        1,
        Math.round(cssWidth * dpr)
      );

      canvasHeight = Math.max(
        1,
        Math.round(cssHeight * dpr)
      );

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    function loadLogoMask() {
      maskCanvas = document.createElement("canvas");

      maskCanvas.width = canvasWidth;
      maskCanvas.height = canvasHeight;

      var maskCtx = maskCanvas.getContext("2d");

      if (!maskCtx) {
        throw new Error("2d-context-unavailable");
      }

      maskCtx.clearRect(
        0,
        0,
        canvasWidth,
        canvasHeight
      );

      maskCtx.imageSmoothingEnabled = true;

      maskCtx.drawImage(
        mark,
        0,
        0,
        canvasWidth,
        canvasHeight
      );

      var imageData;

      try {
        imageData = maskCtx.getImageData(
          0,
          0,
          canvasWidth,
          canvasHeight
        );
      } catch (err) {
        throw new Error("security-error");
      }

      var data = imageData.data;

      var step = Math.max(
        3,
        Math.round(3.2 * dpr)
      );

      var rawPoints = [];

      var minRaw = Infinity;
      var maxRaw = -Infinity;

      var x;
      var y;

      for (
        y = 0;
        y < canvasHeight;
        y += step
      ) {
        for (
          x = 0;
          x < canvasWidth;
          x += step
        ) {
          var alphaIdx =
            (y * canvasWidth + x) * 4 + 3;

          if (data[alphaIdx] > 40) {
            var nx = x / canvasWidth;
            var ny = y / canvasHeight;

            var wave =
              Math.sin(
                y * 0.065 +
                x * 0.014
              ) * 0.5;

            var jitter =
              Math.random() - 0.5;

            /*
             * Frente inclinada e irregular.
             * A combinação de onda e ruído evita uma
             * revelação retangular ou perfeitamente linear.
             */
            var raw =
              nx -
              ny * 0.16 +
              (wave + jitter) * 0.13;

            if (raw < minRaw) {
              minRaw = raw;
            }

            if (raw > maxRaw) {
              maxRaw = raw;
            }

            rawPoints.push({
              x: x,
              y: y,
              raw: raw,
              threshold: 0,
              revealed: false
            });
          }
        }
      }

      if (!rawPoints.length) {
        throw new Error("empty-mask");
      }

      var range =
        maxRaw - minRaw || 1;

      var i;

      for (
        i = 0;
        i < rawPoints.length;
        i++
      ) {
        rawPoints[i].threshold =
          (rawPoints[i].raw - minRaw) /
          range;
      }

      points = rawPoints;

      revealCanvas =
        document.createElement("canvas");

      revealCanvas.width = canvasWidth;
      revealCanvas.height = canvasHeight;

      revealCtx =
        revealCanvas.getContext("2d");

      if (!revealCtx) {
        throw new Error("2d-context-unavailable");
      }
    }

    function drawRevealSpot(
      px,
      py,
      radius,
      color,
      alpha
    ) {
      revealCtx.save();

      revealCtx.globalAlpha = alpha;
      revealCtx.fillStyle = color;

      revealCtx.beginPath();

      revealCtx.arc(
        px,
        py,
        radius,
        0,
        Math.PI * 2
      );

      revealCtx.fill();
      revealCtx.restore();
    }

    function depositHeat(px, py, now) {
      var radius =
        (2.2 + Math.random() * 1.5) *
        dpr;

      /*
       * A revelação começa incandescente.
       * Ela não começa diretamente branca.
       */
      drawRevealSpot(
        px,
        py,
        radius * 1.18,
        "#d94f16",
        0.52
      );

      drawRevealSpot(
        px,
        py,
        radius,
        "#ff7a24",
        0.92
      );

      drawRevealSpot(
        px,
        py,
        radius * 0.46,
        "#ffd28a",
        0.9
      );

      coolingSpots.push({
        x: px,
        y: py,
        radius: radius,
        bornAt: now,
        stage: 0
      });
    }

    function updateCooling(now) {
      var i;

      for (
        i = coolingSpots.length - 1;
        i >= 0;
        i--
      ) {
        var spot = coolingSpots[i];
        var age = now - spot.bornAt;

        if (age >= COOL_MS) {
          drawRevealSpot(
            spot.x,
            spot.y,
            spot.radius * 1.2,
            "#ffffff",
            1
          );

          coolingSpots.splice(i, 1);
        } else if (
          age >= COOL_MS * 0.68 &&
          spot.stage < 3
        ) {
          drawRevealSpot(
            spot.x,
            spot.y,
            spot.radius * 1.12,
            "#fff7df",
            1
          );

          spot.stage = 3;
        } else if (
          age >= COOL_MS * 0.42 &&
          spot.stage < 2
        ) {
          drawRevealSpot(
            spot.x,
            spot.y,
            spot.radius * 1.08,
            "#ffd28a",
            1
          );

          spot.stage = 2;
        } else if (
          age >= COOL_MS * 0.2 &&
          spot.stage < 1
        ) {
          drawRevealSpot(
            spot.x,
            spot.y,
            spot.radius * 1.04,
            "#ff9a3d",
            1
          );

          spot.stage = 1;
        }
      }
    }

    function completeLogoReveal() {
      revealCtx.globalCompositeOperation =
        "source-over";

      revealCtx.fillStyle = "#ffffff";

      revealCtx.fillRect(
        0,
        0,
        canvasWidth,
        canvasHeight
      );

      revealCtx.globalCompositeOperation =
        "destination-in";

      revealCtx.drawImage(
        maskCanvas,
        0,
        0
      );

      revealCtx.globalCompositeOperation =
        "source-over";
    }

    function createSpark(px, py, biasHot) {
      if (
        particles.length >= MAX_PARTICLES
      ) {
        return;
      }

      var angle =
        Math.random() *
        Math.PI *
        2;

      var speed =
        (0.02 + Math.random() * 0.06) *
        dpr;

      var life =
        280 +
        Math.random() *
        540;

      particles.push({
        x: px,
        y: py,

        vx:
          Math.cos(angle) *
          speed,

        vy:
          Math.sin(angle) *
          speed -
          0.022 * dpr,

        size:
          (0.75 + Math.random() * 2) *
          dpr,

        life: life,
        maxLife: life,

        alpha: 1,

        heat: biasHot
          ? 0.68 + Math.random() * 0.32
          : Math.random(),

        currentSize: 0
      });
    }

    function updateParticles(dt) {
      var i;

      for (
        i = particles.length - 1;
        i >= 0;
        i--
      ) {
        var particle = particles[i];

        particle.life -= dt;

        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        /*
         * Pequena aceleração vertical para cima.
         */
        particle.vy -=
          0.00009 *
          dpr *
          dt;

        particle.x +=
          particle.vx *
          dt;

        particle.y +=
          particle.vy *
          dt;

        var t =
          particle.life /
          particle.maxLife;

        particle.alpha = t;

        particle.currentSize =
          particle.size *
          (0.35 + 0.65 * t);
      }
    }

    function sparkColor(heat) {
      if (heat > 0.75) {
        return SPARK_COLORS[0];
      }

      if (heat > 0.5) {
        return SPARK_COLORS[1];
      }

      if (heat > 0.25) {
        return SPARK_COLORS[2];
      }

      return SPARK_COLORS[3];
    }

    function drawParticles() {
      var i;

      for (
        i = 0;
        i < particles.length;
        i++
      ) {
        var particle = particles[i];

        ctx.globalAlpha = Math.max(
          0,
          Math.min(
            1,
            particle.alpha
          )
        );

        ctx.fillStyle =
          sparkColor(particle.heat);

        ctx.beginPath();

        ctx.arc(
          particle.x,
          particle.y,
          particle.currentSize ||
          particle.size,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

    function easeOutQuad(t) {
      return (
        1 -
        (1 - t) *
        (1 - t)
      );
    }

    function easeInOutCubic(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 -
        Math.pow(
          -2 * t + 2,
          3
        ) /
        2;
    }

    function frontProgressAt(elapsed) {
      if (elapsed <= IGNITE_MS) {
        return (
          IGNITE_TARGET *
          easeOutQuad(
            elapsed /
            IGNITE_MS
          )
        );
      }

      var t =
        (elapsed - IGNITE_MS) /
        BURN_MS;

      if (t >= 1) {
        return 1;
      }

      return (
        IGNITE_TARGET +
        (1 - IGNITE_TARGET) *
        easeInOutCubic(t)
      );
    }

    function resizeIntroCanvas() {
      if (
        cancelled ||
        finished ||
        !canvas
      ) {
        return;
      }

      try {
        var progress = finalWhite
          ? 1
          : frontProgressAt(elapsedTime);

        measureAndPlaceCanvas();
        loadLogoMask();

        coolingSpots.length = 0;
        particles.length = 0;

        var i;

        for (
          i = 0;
          i < points.length;
          i++
        ) {
          if (
            points[i].threshold <=
            progress
          ) {
            points[i].revealed = true;

            drawRevealSpot(
              points[i].x,
              points[i].y,
              3.5 * dpr,
              finalWhite
                ? "#ffffff"
                : "#ff9a3d",
              1
            );
          }
        }

        if (finalWhite) {
          completeLogoReveal();
        }
      } catch (err) {
        fail(err);
      }
    }

    function step(timestamp) {
      if (cancelled || finished) return;

      if (document.hidden) {
        lastTimestamp = null;

        rafId =
          window.requestAnimationFrame(step);

        return;
      }

      var dt =
        lastTimestamp === null
          ? 16
          : Math.min(
            48,
            timestamp - lastTimestamp
          );

      lastTimestamp = timestamp;
      elapsedTime += dt;

      if (!burnComplete) {
        var progress =
          frontProgressAt(elapsedTime);

        var spawned = 0;
        var i;

        /*
         * Todos os pontos alcançados pela frente
         * são depositados no frame.
         *
         * Apenas o número de faíscas visuais é limitado.
         */
        for (
          i = 0;
          i < points.length;
          i++
        ) {
          var point = points[i];

          if (
            !point.revealed &&
            point.threshold <= progress
          ) {
            point.revealed = true;

            depositHeat(
              point.x,
              point.y,
              elapsedTime
            );

            if (
              spawned < 12 &&
              Math.random() < 0.42
            ) {
              createSpark(
                point.x +
                (Math.random() - 0.5) *
                2 *
                dpr,

                point.y +
                (Math.random() - 0.5) *
                2 *
                dpr,

                elapsedTime <=
                IGNITE_MS + 180
              );

              spawned++;
            }
          }
        }

        if (
          elapsedTime >=
          IGNITE_MS + BURN_MS
        ) {
          burnComplete = true;
          burnCompleteAt = elapsedTime;
        }
      }

      updateCooling(elapsedTime);
      updateParticles(dt);

      /*
       * Só transforma a logo em branco puro depois
       * que a combustão terminou e as manchas quentes
       * tiveram tempo para esfriar.
       */
      if (
        burnComplete &&
        !finalWhite &&
        (
          coolingSpots.length === 0 ||
          elapsedTime - burnCompleteAt >=
          MAX_FINAL_COOL_MS
        )
      ) {
        completeLogoReveal();

        finalWhite = true;
        finalWhiteAt = elapsedTime;
      }

      ctx.clearRect(
        0,
        0,
        canvasWidth,
        canvasHeight
      );

      ctx.drawImage(
        revealCanvas,
        0,
        0
      );

      /*
       * Mantém a revelação limitada à silhueta real
       * do SVG.
       */
      ctx.globalCompositeOperation =
        "destination-in";

      ctx.drawImage(
        maskCanvas,
        0,
        0
      );

      ctx.globalCompositeOperation =
        "source-over";

      drawParticles();

      /*
       * A animação só é considerada concluída
       * depois que a logo ficou branca e permaneceu
       * visível durante o tempo definido.
       */
      if (
        finalWhite &&
        elapsedTime - finalWhiteAt >=
        FINAL_WHITE_HOLD_MS
      ) {
        succeed();
        return;
      }

      rafId =
        window.requestAnimationFrame(step);
    }

    function waitForMarkReady() {
      return new Promise(function (
        resolve,
        reject
      ) {
        var settled = false;
        var loadHandler = null;
        var errorHandler = null;

        function cleanupListeners() {
          if (loadHandler) {
            mark.removeEventListener(
              "load",
              loadHandler
            );

            loadHandler = null;
          }

          if (errorHandler) {
            mark.removeEventListener(
              "error",
              errorHandler
            );

            errorHandler = null;
          }

          cancelMarkWait = null;
        }

        function resolveOnce() {
          if (settled) return;

          settled = true;

          cleanupListeners();
          resolve();
        }

        function rejectOnce(err) {
          if (settled) return;

          settled = true;

          cleanupListeners();
          reject(err);
        }

        function validateAndDecode() {
          if (
            !mark.complete ||
            mark.naturalWidth <= 0 ||
            mark.naturalHeight <= 0
          ) {
            rejectOnce(
              new Error(
                "logo-invalid-dimensions"
              )
            );

            return;
          }

          if (
            typeof mark.decode !==
            "function"
          ) {
            resolveOnce();
            return;
          }

          mark
            .decode()
            .then(function () {
              if (
                mark.naturalWidth > 0 &&
                mark.naturalHeight > 0
              ) {
                resolveOnce();
              } else {
                rejectOnce(
                  new Error(
                    "logo-invalid-dimensions"
                  )
                );
              }
            })
            .catch(function () {
              /*
               * Alguns navegadores podem rejeitar
               * decode() mesmo quando a imagem está
               * carregada e utilizável.
               */
              if (
                mark.complete &&
                mark.naturalWidth > 0 &&
                mark.naturalHeight > 0
              ) {
                resolveOnce();
              } else {
                rejectOnce(
                  new Error(
                    "logo-decode-error"
                  )
                );
              }
            });
        }

        loadHandler =
          validateAndDecode;

        errorHandler = function () {
          rejectOnce(
            new Error(
              "logo-load-error"
            )
          );
        };

        cancelMarkWait = function () {
          rejectOnce(
            new Error(
              "logo-load-cancelled"
            )
          );
        };

        if (mark.complete) {
          if (
            mark.naturalWidth > 0 &&
            mark.naturalHeight > 0
          ) {
            validateAndDecode();
          } else {
            rejectOnce(
              new Error(
                "logo-load-error"
              )
            );
          }

          return;
        }

        mark.addEventListener(
          "load",
          loadHandler
        );

        mark.addEventListener(
          "error",
          errorHandler
        );

        /*
         * Fecha a condição de corrida em que a imagem
         * termina de carregar entre a primeira verificação
         * e o registro dos listeners.
         */
        if (mark.complete) {
          if (
            mark.naturalWidth > 0 &&
            mark.naturalHeight > 0
          ) {
            validateAndDecode();
          } else {
            errorHandler();
          }
        }
      });
    }

    /*
     * Estado inicial: logo preta.
     */
    mark.style.filter = "brightness(0)";

    waitForMarkReady()
      .then(function () {
        if (cancelled || finished) return;

        try {
          createIntroCanvas();
          measureAndPlaceCanvas();
          loadLogoMask();
        } catch (err) {
          fail(err);
          return;
        }

        if (cancelled || finished) return;

        resizeHandler = function () {
          if (resizeTimer) {
            window.clearTimeout(
              resizeTimer
            );
          }

          resizeTimer =
            window.setTimeout(
              resizeIntroCanvas,
              140
            );
        };

        window.addEventListener(
          "resize",
          resizeHandler
        );

        rafId =
          window.requestAnimationFrame(
            step
          );
      })
      .catch(function (err) {
        if (!cancelled && !finished) {
          fail(err);
        }
      });

    return {
      promise: promise,
      cancel: cancel
    };
  }

  function initMobileNav() {
    var toggle =
      document.querySelector(
        "[data-nav-toggle]"
      );

    var nav =
      document.querySelector(
        "[data-nav]"
      );

    if (!toggle || !nav) return;

    function closeNav() {
      nav.classList.remove("is-open");

      toggle.setAttribute(
        "aria-expanded",
        "false"
      );
    }

    function openNav() {
      nav.classList.add("is-open");

      toggle.setAttribute(
        "aria-expanded",
        "true"
      );
    }

    toggle.addEventListener(
      "click",
      function () {
        var isOpen =
          nav.classList.contains(
            "is-open"
          );

        if (isOpen) {
          closeNav();
        } else {
          openNav();
        }
      }
    );

    document.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Escape" &&
          nav.classList.contains(
            "is-open"
          )
        ) {
          closeNav();
          toggle.focus();
        }
      }
    );

    nav
      .querySelectorAll("a")
      .forEach(function (link) {
        link.addEventListener(
          "click",
          function () {
            closeNav();
          }
        );
      });

    document.addEventListener(
      "click",
      function (event) {
        var target = event.target;

        if (
          !nav.classList.contains(
            "is-open"
          )
        ) {
          return;
        }

        if (
          nav.contains(target) ||
          toggle.contains(target)
        ) {
          return;
        }

        closeNav();
      }
    );
  }

  function initFooterYear() {
    var yearEl =
      document.querySelector(
        "[data-year]"
      );

    if (!yearEl) return;

    yearEl.textContent =
      String(
        new Date().getFullYear()
      );
  }

  function initSectionIndicator() {
    if (
      !(
        "IntersectionObserver" in
        window
      )
    ) {
      return;
    }

    var sections =
      document.querySelectorAll(
        "main [id]"
      );

    var navLinks =
      document.querySelectorAll(
        ".site-nav__list a[href^='#']"
      );

    if (
      !sections.length ||
      !navLinks.length
    ) {
      return;
    }

    var linkById = {};

    navLinks.forEach(function (link) {
      var id =
        link
          .getAttribute("href")
          .slice(1);

      linkById[id] = link;
    });

    var observer =
      new IntersectionObserver(
        function (entries) {
          entries.forEach(
            function (entry) {
              var link =
                linkById[
                entry.target.id
                ];

              if (!link) return;

              if (
                entry.isIntersecting
              ) {
                navLinks.forEach(
                  function (item) {
                    item.removeAttribute(
                      "aria-current"
                    );
                  }
                );

                link.setAttribute(
                  "aria-current",
                  "true"
                );
              }
            }
          );
        },
        {
          rootMargin:
            "-45% 0px -50% 0px"
        }
      );

    sections.forEach(
      function (section) {
        if (
          linkById[section.id]
        ) {
          observer.observe(section);
        }
      }
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      initIntro();
      initMobileNav();
      initFooterYear();
      initSectionIndicator();
    }
  );
})();