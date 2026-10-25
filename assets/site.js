/* ==========================================================================
   Nora Ramli — small site behaviours (plain JavaScript, no libraries)
   ========================================================================== */

/* ---------- Phone menu (every page) ----------
   Below 768px the links fold away behind a "Menu" button, which opens them
   and becomes "Close". The Escape key also closes it. Without JavaScript the
   button stays hidden and the links stay visible. */

document.querySelectorAll(".site-header").forEach(function (header) {
  var button = header.querySelector(".menu-toggle");
  if (!button) return;

  function setOpen(open) {
    header.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.textContent = open ? "Close" : "Menu";
  }

  header.classList.add("has-menu");
  button.hidden = false;

  button.addEventListener("click", function () {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && header.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });
});

/* ---------- Painting viewer (Home: "One field, one year") ----------
   One large painting with thumbnails beneath. Choosing a thumbnail swaps
   the large painting with a gentle fade. Nothing moves on its own.
   Also: left/right arrow keys on the thumbnails, and swipe on the painting. */

document.querySelectorAll("[data-viewer]").forEach(function (viewer) {
  var image = viewer.querySelector(".viewer-image");
  var link = viewer.querySelector(".viewer-link");
  var now = viewer.querySelector(".viewer-now");
  var stage = viewer.querySelector(".viewer-stage");
  var buttons = Array.prototype.slice.call(viewer.querySelectorAll(".viewer-thumbs button"));
  var current = 0;

  function show(index) {
    if (index === current) return;
    current = index;
    var b = buttons[index];
    var base = "assets/img/monet-stacks-" + b.dataset.name;

    buttons.forEach(function (other, i) {
      other.setAttribute("aria-pressed", i === index ? "true" : "false");
    });

    // Load the new painting first, then fade it in, so there is no blank flash
    var next = new Image();
    next.sizes = image.sizes;
    next.srcset = base + "-800.jpg 800w, " + base + "-1600.jpg 1600w";
    next.src = base + "-1600.jpg";

    image.classList.add("is-changing");
    var swap = function () {
      if (current !== index) return; // a newer choice has been made
      image.srcset = next.srcset;
      image.src = next.src;
      image.width = Number(b.dataset.w);
      image.height = Number(b.dataset.h);
      image.alt = b.dataset.alt;
      link.href = b.dataset.href;
      now.innerHTML = "<i>" + b.dataset.title + "</i>, 1890–91";
      image.classList.remove("is-changing");
    };
    // Wait for the new painting to be ready and for the fade-out to finish
    var ready = next.decode ? next.decode().catch(function () {}) : Promise.resolve();
    var faded = new Promise(function (resolve) { setTimeout(resolve, 200); });
    Promise.all([ready, faded]).then(swap);
  }

  buttons.forEach(function (button, i) {
    button.addEventListener("click", function () {
      show(i);
    });

    button.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      var step = event.key === "ArrowRight" ? 1 : -1;
      var target = (i + step + buttons.length) % buttons.length;
      show(target);
      buttons[target].focus();
    });
  });

  // Swipe left or right on the painting (phones and tablets)
  var startX = null;
  stage.addEventListener("touchstart", function (event) {
    startX = event.touches[0].clientX;
  }, { passive: true });

  stage.addEventListener("touchend", function (event) {
    if (startX === null) return;
    var distance = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(distance) < 40) return;
    var step = distance < 0 ? 1 : -1;
    show((current + step + buttons.length) % buttons.length);
  });
});

/* ---------- One question, four lenses (Thinking) ----------
   Choosing a lens lights the steps it looks at, dims the rest, and shows
   its text. All the copy is in thinking.html; each lens lists the steps
   it lights (data-lit) and whether the loop lights (data-loop).
   A link such as thinking.html#lens-invert opens with that lens chosen. */

document.querySelectorAll("[data-lens-study]").forEach(function (study) {
  var buttons = Array.prototype.slice.call(study.querySelectorAll("[data-lens]"));
  var views = Array.prototype.slice.call(study.querySelectorAll("[data-lens-view]"));
  var steps = Array.prototype.slice.call(study.querySelectorAll("[data-step]"));
  var loop = study.querySelector(".loop");

  function choose(name) {
    var view = study.querySelector('[data-lens-view="' + name + '"]');
    if (!view) return false;
    var lit = view.dataset.lit.split(" ");

    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.lens === name ? "true" : "false");
    });
    views.forEach(function (v) {
      v.hidden = v !== view;
    });
    steps.forEach(function (s) {
      s.classList.toggle("is-dim", lit.indexOf(s.dataset.step) === -1);
    });
    loop.classList.toggle("is-dim", view.dataset.loop !== "true");
    return true;
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      choose(button.dataset.lens);
    });
  });

  // Arriving from a case: open on that lens and bring the diagram into view
  var fromLink = location.hash.match(/^#lens-(\w+)$/);
  if (fromLink && choose(fromLink[1])) {
    // Wait until the browser has made its own jump to the link, then show the whole diagram
    window.addEventListener("load", function () {
      setTimeout(function () { study.scrollIntoView(); }, 0);
    });
  }
});

/* ---------- The cases (A Closer Look) ----------
   Each card's "Read the case" button opens its detail panel; "Close" shuts it.
   Several may be open at once. Opening a case plays its drawing three times
   (not for visitors who reduce motion). Without JavaScript, every panel stays open
   and the buttons stay hidden.
   A link such as casefiles.html#case-04 opens that card and brings it into view. */

document.querySelectorAll("[data-cases]").forEach(function (grid) {
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".case-card"));
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var ROUND = 3500; // one round of a drawing's animation, with its rest, in milliseconds
  var ROUNDS = 3;   // how many rounds play each time a case is opened

  // When a case is opened, its drawing plays a round, rests, and plays again,
  // three times in all, then rests until the case is closed and opened again.
  // Taking the switch off and straight back on starts the round afresh.
  function play(card) {
    card.classList.remove("is-playing");
    void card.offsetWidth; // lets the browser notice the switch was off
    card.classList.add("is-playing");
  }

  function setOpen(card, open) {
    var button = card.querySelector(".case-toggle");
    var panel = document.getElementById(button.getAttribute("aria-controls"));
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.querySelector(".case-toggle-label").textContent = open ? "Close" : "Read the case";
    button.querySelector(".case-toggle-arrow").textContent = open ? "↑" : "↓";
    panel.hidden = !open;
    card.classList.toggle("is-open", open);

    clearInterval(card.playing);
    card.classList.remove("is-playing");
    if (open && !calm.matches) {
      var played = 1;
      play(card);
      card.playing = setInterval(function () {
        play(card);
        played += 1;
        if (played === ROUNDS) clearInterval(card.playing);
      }, ROUND);
    }
  }

  cards.forEach(function (card) {
    var button = card.querySelector(".case-toggle");
    button.hidden = false;
    setOpen(card, false);
    button.addEventListener("click", function () {
      setOpen(card, button.getAttribute("aria-expanded") !== "true");
    });
  });

  // Arriving from Home or Thinking: open the case named in the link
  function openFromLink() {
    var card = location.hash.match(/^#case-\d+$/) && document.getElementById(location.hash.slice(1));
    if (!card || cards.indexOf(card) === -1) return false;
    setOpen(card, true);
    card.scrollIntoView();
    return true;
  }

  if (location.hash) {
    // Wait until the browser has made its own jump to the link, then settle on the open card
    window.addEventListener("load", function () {
      setTimeout(openFromLink, 0);
    });
  }
  window.addEventListener("hashchange", openFromLink);
});
