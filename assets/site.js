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

/* ---------- The seedling hint (Home) ----------
   Each time Home opens, the name shows beside the seedling (set in index.html
   before the page paints), then folds in after a moment, a hint that pointing
   at the seedling brings it back. */

if (document.documentElement.classList.contains("seedling-hint")) {
  setTimeout(function () {
    document.documentElement.classList.remove("seedling-hint");
  }, 1500);
}

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

/* ---------- Pages that flip (At Play: Notes 2 and 4) ----------
   Arrows (and swipe on phones) move between a note's pages, one at a time.
   Without JavaScript, every page shows, one after another. */

document.querySelectorAll("[data-flip]").forEach(function (note) {
  var pages = Array.prototype.slice.call(note.querySelectorAll(".flip-page"));
  var controls = note.querySelector(".flip-controls");
  var prev = note.querySelector(".flip-prev");
  var next = note.querySelector(".flip-next");
  var count = note.querySelector(".flip-count");
  var current = 0;

  function show(index) {
    var before = current;
    current = Math.max(0, Math.min(pages.length - 1, index));
    pages.forEach(function (page, i) {
      page.classList.toggle("is-current", i === current);
      page.setAttribute("aria-hidden", i === current ? "false" : "true");
    });
    // Tells a drawing on the page just turned to that it has come into view (see below)
    if (current !== before) pages[current].dispatchEvent(new CustomEvent("page-shown"));
    count.textContent = (current + 1) + " of " + pages.length;
    prev.disabled = current === 0;
    next.disabled = current === pages.length - 1;
  }

  note.classList.add("is-flipping");
  controls.hidden = false;
  show(0);

  prev.addEventListener("click", function () { show(current - 1); });
  next.addEventListener("click", function () { show(current + 1); });

  var startX = null;
  note.addEventListener("touchstart", function (event) {
    startX = event.touches[0].clientX;
  }, { passive: true });
  note.addEventListener("touchend", function (event) {
    if (startX === null) return;
    var distance = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(distance) < 40) return;
    show(current + (distance < 0 ? 1 : -1));
  });
});

/* ---------- The game shelf (At Play) ----------
   A small picture of each game sits under the intro. Choosing one shows that
   game's plate below, in place, and hides the others; Mangrove Rush shows
   first. The address follows the choice (at-play.html#beach-cleanup), so a link
   can open the page with any game chosen, and Back returns to the last one.
   Without JavaScript, every plate shows, one after another. */

document.querySelectorAll(".play-shelf").forEach(function (shelf) {
  var links = Array.prototype.slice.call(shelf.querySelectorAll("[data-plate]"));
  var plates = links.map(function (link) {
    return document.getElementById(link.getAttribute("data-plate"));
  });
  if (plates.some(function (plate) { return !plate; })) return;

  function show(id) {
    plates.forEach(function (plate, i) {
      var chosen = plate.id === id;
      var appearing = chosen && plate.hidden;
      plate.hidden = !chosen;
      // Tells a drawing on the plate that it has just come into view (see below)
      if (appearing) plate.dispatchEvent(new CustomEvent("plate-shown"));
      plate.classList.toggle("is-shown", chosen);
      if (chosen) links[i].setAttribute("aria-current", "true");
      else links[i].removeAttribute("aria-current");
    });
  }

  // The game named in the address, or else the first
  function fromAddress() {
    var id = location.hash.slice(1);
    return plates.some(function (plate) { return plate.id === id; }) ? id : plates[0].id;
  }

  // (Opened from a link with a game in the address, the page lands on that game.)
  document.body.classList.add("has-shelf");
  show(fromAddress());

  links.forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      var id = link.getAttribute("data-plate");
      if (location.hash !== "#" + id) history.pushState(null, "", "#" + id);
      show(id);
    });
  });

  window.addEventListener("popstate", function () { show(fromAddress()); });
  window.addEventListener("hashchange", function () { show(fromAddress()); });
});

/* ---------- Drawings that draw themselves (At Play: Figs. 1 to 4) ----------
   Each ink sketch marked data-draw draws itself line by line, as if inked by
   hand: each stroke in turn, in the order it sits in the drawing, then the
   labels. Dashed lines (tides, roots, distance marks), which cannot be inked
   one dash at a time, fade in at their turn; a dashed trail behind a mask
   (Fig. 4) is uncovered along its way. A drawing plays once when its game's
   plate comes into view (as the page opens, when it is chosen on the shelf,
   or from a link to it), or when its page of a note is turned to, then
   rests on the finished drawing. Visitors who reduce motion, and anyone
   without JavaScript, see the finished drawings only. */

document.querySelectorAll("[data-draw]").forEach(function (svg) {
  var plate = svg.closest(".play-plate");
  var page = svg.closest(".flip-page");
  var trail = svg.querySelector(".draw-trail");   // a mask that uncovers a dashed trail
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var LINES = 4800;   // milliseconds to ink every line
  var LABEL = 240;    // milliseconds for each label to appear
  var frame = null;

  // Everything to draw, in order. Each line's time follows its length.
  var steps = [];
  svg.querySelectorAll("path, circle, ellipse, text, g[mask]").forEach(function (el) {
    var group = el.closest("g[mask]");
    if (el.closest("defs") || (group && group !== el)) return;
    var tag = el.tagName.toLowerCase();
    if (tag === "text") steps.push({ el: el, kind: "label" });
    else if (el === group) steps.push({ el: el, kind: "trail", length: 300 });
    else {
      var dashed = getComputedStyle(el).strokeDasharray;
      var filled = el.classList.contains("s-fill");
      steps.push({ el: el, kind: dashed && dashed !== "none" ? "fade" : "line", length: el.getTotalLength(), filled: filled });
    }
  });
  var total = steps.reduce(function (sum, step) { return sum + (step.length || 0); }, 0);
  var clock = 0;
  steps.forEach(function (step) {
    step.time = step.kind === "label" ? LABEL : Math.max(80, LINES * step.length / total);
    step.start = clock;
    clock += step.time;
  });
  var duration = clock;

  function set(step, p) {
    if (step.kind === "label" || step.kind === "fade") step.el.style.opacity = String(p);
    else if (step.kind === "trail") { if (trail) trail.style.strokeDashoffset = String(1 - p); }
    else {
      step.el.style.strokeDasharray = step.length + " " + step.length;
      step.el.style.strokeDashoffset = String(step.length * (1 - p));
      // A filled shape (a tree's crown, a cup) is filled once its outline begins
      if (step.filled) step.el.style.fillOpacity = p > 0 ? "" : "0";
    }
  }

  // The finished drawing, just as it is in the page
  function rest() {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    steps.forEach(function (step) {
      step.el.style.strokeDasharray = "";
      step.el.style.strokeDashoffset = "";
      step.el.style.opacity = "";
      step.el.style.fillOpacity = "";
    });
    if (trail) trail.style.strokeDashoffset = "0";
  }

  function hiddenNow() {
    return (plate && plate.hidden) || (page && page.closest(".is-flipping") && !page.classList.contains("is-current"));
  }

  function play() {
    if (calm.matches || hiddenNow()) return;
    if (frame) cancelAnimationFrame(frame);
    var startedAt = performance.now();
    steps.forEach(function (step) { set(step, 0); });
    function tick(now) {
      var elapsed = now - startedAt;
      if (elapsed >= duration || hiddenNow()) return rest();
      steps.forEach(function (step) {
        set(step, Math.max(0, Math.min(1, (elapsed - step.start) / step.time)));
      });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  if (plate) plate.addEventListener("plate-shown", play);
  if (page) page.addEventListener("page-shown", play);
  // In view as the page opens (the first game, or one opened by its link): it draws now
  if (document.body.classList.contains("has-shelf")) play();
});
