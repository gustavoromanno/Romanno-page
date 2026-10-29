/* Hero 3D — partículas soltas que se organizam numa rede conforme a página rola.
   Metáfora: processo bagunçado → sistema organizado. Cores: prata → verde Romanno.
   Roda só enquanto o hero está visível; respeita prefers-reduced-motion. */
(function () {
  var canvas = document.getElementById("heroCanvas");
  var hero = document.querySelector(".hero");
  if (!canvas || !hero) return;
  if (!window.THREE) { canvas.remove(); return; }

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { canvas.remove(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // As cores vêm do canvas, para a mesma animação servir ao hero claro da home
  // e ao hero escuro do Finanças R. Sem atributo, fica como sempre foi.
  function corDoCanvas(attr, padrao) {
    var v = canvas.getAttribute(attr);
    return new THREE.Color(/^#[0-9a-fA-F]{6}$/.test(v || "") ? v : padrao);
  }
  var SILVER = corDoCanvas("data-cor-inicio", "#9AA1A6"),
      GREEN  = corDoCanvas("data-cor-fim", "#1C3B2E");
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  camera.position.z = 9;
  var group = new THREE.Group(); scene.add(group);

  // destino ordenado: pontos numa esfera geodésica (vértices únicos do icosaedro)
  var ico = new THREE.IcosahedronGeometry(2.4, 3).attributes.position.array;
  var seen = {}, target = [];
  for (var i = 0; i < ico.length; i += 3) {
    var k = ico[i].toFixed(3) + "," + ico[i + 1].toFixed(3) + "," + ico[i + 2].toFixed(3);
    if (!seen[k]) { seen[k] = 1; target.push(ico[i], ico[i + 1], ico[i + 2]); }
  }
  var N = target.length / 3;

  // origem caótica
  var chaos = new Float32Array(N * 3);
  for (i = 0; i < N; i++) {
    var r = 2.5 + Math.random() * 4.5, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
    chaos[i * 3] = r * Math.sin(ph) * Math.cos(th) * 1.4;
    chaos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    chaos[i * 3 + 2] = r * Math.cos(ph);
  }

  // conexões: pares próximos no estado ordenado
  var pairs = [];
  for (i = 0; i < N; i++) for (var j = i + 1; j < N; j++) {
    var dx = target[i * 3] - target[j * 3], dy = target[i * 3 + 1] - target[j * 3 + 1], dz = target[i * 3 + 2] - target[j * 3 + 2];
    if (dx * dx + dy * dy + dz * dz < .62 * .62) pairs.push(i, j);
  }

  // sprite redondo para os pontos (sem isso o WebGL desenha quadrados)
  var dot = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.55, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 32, 0, 6.283); g.fill();
    return new THREE.CanvasTexture(c);
  })();

  var pos = new Float32Array(N * 3);
  var pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  var pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: .11, map: dot, transparent: true, opacity: .9, depthWrite: false, sizeAttenuation: true }));
  group.add(pts);

  var lpos = new Float32Array(pairs.length * 3);
  var lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
  var lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ transparent: true, opacity: 0 }));
  group.add(lines);

  var ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, .008, 6, 200), new THREE.MeshBasicMaterial({ transparent: true, opacity: .35 }));
  ring.rotation.set(1.2, .3, 0); group.add(ring);

  // poeira de fundo
  var D = 420, da = new Float32Array(D * 3);
  for (i = 0; i < D; i++) { da[i * 3] = (Math.random() - .5) * 26; da[i * 3 + 1] = (Math.random() - .5) * 14; da[i * 3 + 2] = (Math.random() - .5) * 10 - 3; }
  var dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(da, 3));
  var dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: .05, map: dot, transparent: true, opacity: .45, depthWrite: false, color: SILVER }));
  scene.add(dust);

  var mx = 0, my = 0, tick = 0, level = reduce ? 1 : 0, visible = true, running = false, last = 0;

  function resize() {
    var w = hero.clientWidth, h = hero.clientHeight, mob = w < 1020;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    group.position.set(mob ? 1.4 : 2.1, mob ? 2.2 : .9, 0);
    group.scale.setScalar(mob ? .55 : 1.05);
    pts.material.opacity = mob ? .55 : .9; dust.material.opacity = mob ? .3 : .45;
  }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function frame(dt) {
    // progresso: carrega ~35% sozinho ao abrir; o resto vem com o scroll até sair do hero
    var p = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * .7)));
    var goal = reduce ? 1 : Math.min(1, .5 + p * .5 + Math.min(tick / 3, 1) * .12);
    level += (goal - level) * (reduce ? 1 : .05);
    var e = ease(level);

    for (var i = 0; i < N * 3; i++) {
      var wob = (1 - e) * Math.sin(tick * .8 + i) * .25;
      pos[i] = chaos[i] + (target[i] - chaos[i]) * e + wob;
    }
    pg.attributes.position.needsUpdate = true;
    for (var p2 = 0; p2 < pairs.length; p2++) {
      var a = pairs[p2] * 3;
      lpos[p2 * 3] = pos[a]; lpos[p2 * 3 + 1] = pos[a + 1]; lpos[p2 * 3 + 2] = pos[a + 2];
    }
    lg.attributes.position.needsUpdate = true;

    var col = SILVER.clone().lerp(GREEN, Math.max(0, (e - .35) / .65));
    pts.material.color.copy(col);
    lines.material.color.copy(col);
    ring.material.color.copy(col);
    lines.material.opacity = Math.max(0, (e - .72) / .28) * .5;
    ring.material.opacity = .12 + e * .3;

    group.rotation.y += dt * (.12 + (1 - e) * .15);
    group.rotation.x += ((my * .4) - group.rotation.x) * .04;
    ring.rotation.z += dt * .08;
    dust.rotation.y += dt * .01;
    camera.position.x += (mx * .6 - camera.position.x) * .04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  function loop(t) {
    if (!visible) { running = false; return; }
    var dt = Math.min(.05, (t - last) / 1000); last = t; tick += dt;
    frame(dt);
    requestAnimationFrame(loop);
  }
  function start() { if (running || reduce) return; running = true; last = performance.now(); requestAnimationFrame(loop); }

  addEventListener("resize", function () { resize(); frame(0); });
  addEventListener("pointermove", function (ev) { mx = ev.clientX / innerWidth - .5; my = ev.clientY / innerHeight - .5; }, { passive: true });
  if (reduce) addEventListener("scroll", function () { frame(0); }, { passive: true });

  // pausa quando o hero sai da tela ou a aba fica oculta
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting && !document.hidden; if (visible) start(); }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { visible = !document.hidden; if (visible) start(); });

  resize(); frame(0); start();
})();
