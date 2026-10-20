(function () {
  // ---------- Tema ----------
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("tema");
    if (saved) root.setAttribute("data-theme", saved);
  } catch (e) {}
  document.getElementById("theme").addEventListener("click", function () {
    var dark =
      root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("tema", next);
    } catch (e) {}
  });

  // ---------- Estado ----------
  var $ = function (id) {
    return document.getElementById(id);
  };
  var filesF = [],
    fileG = null;
  var data = { nao: [], eu: [], mut: [] };
  var current = "nao",
    shown = 50,
    PAGE = 50;

  // ---------- Upload ----------
  function setFiles(kind, files) {
    files = Array.prototype.slice.call(files).filter(function (f) {
      return /\.json$/i.test(f.name);
    });
    var box = kind === "F" ? $("dropF") : $("dropG");
    var label = box.querySelector(".fname");
    if (!files.length) {
      label.textContent = "Nenhum arquivo escolhido";
      box.classList.remove("ok");
    } else {
      label.textContent =
        files.length === 1
          ? files[0].name
          : files.length + " arquivos escolhidos";
      box.classList.add("ok");
    }
    if (kind === "F") filesF = files;
    else fileG = files[0] || null;
    $("go").disabled = !(filesF.length && fileG);
    $("msg").textContent = "";
  }
  $("fileF").addEventListener("change", function (e) {
    setFiles("F", e.target.files);
  });
  $("fileG").addEventListener("change", function (e) {
    setFiles("G", e.target.files);
  });
  [
    ["dropF", "F"],
    ["dropG", "G"],
  ].forEach(function (p) {
    var el = $(p[0]);
    ["dragenter", "dragover"].forEach(function (ev) {
      el.addEventListener(ev, function (e) {
        e.preventDefault();
        el.classList.add("over");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      el.addEventListener(ev, function (e) {
        e.preventDefault();
        el.classList.remove("over");
      });
    });
    el.addEventListener("drop", function (e) {
      setFiles(p[1], e.dataTransfer.files);
    });
  });

  // ---------- Leitura dos JSON do Instagram ----------
  function readFile(f) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () {
        try {
          res(JSON.parse(r.result));
        } catch (e) {
          rej(new Error('O arquivo "' + f.name + '" não é um JSON válido.'));
        }
      };
      r.onerror = function () {
        rej(new Error('Não foi possível ler "' + f.name + '".'));
      };
      r.readAsText(f);
    });
  }
  function extract(json) {
    var arr = Array.isArray(json)
      ? json
      : json.relationships_following ||
        json.relationships_followers ||
        Object.keys(json)
          .map(function (k) {
            return json[k];
          })
          .filter(Array.isArray)[0] ||
        [];
    var out = [];
    arr.forEach(function (item) {
      (item.string_list_data || []).forEach(function (s) {
        var u = (s.value || item.title || "").trim().toLowerCase();
        if (u) out.push({ user: u, ts: s.timestamp || 0 });
      });
    });
    return out;
  }
  function toMap(list) {
    var m = new Map();
    list.forEach(function (x) {
      if (!m.has(x.user)) m.set(x.user, x);
    });
    return m;
  }

  $("go").addEventListener("click", function () {
    $("msg").textContent = "";
    Promise.all(filesF.map(readFile).concat([readFile(fileG)]))
      .then(function (all) {
        var gJson = all.pop();
        var F = toMap([].concat.apply([], all.map(extract)));
        var G = toMap(extract(gJson));
        if (!F.size || !G.size) {
          throw new Error(
            "Não encontrei usuários. Confira se escolheu os arquivos certos (followers_*.json e following.json).",
          );
        }
        data = { nao: [], eu: [], mut: [] };
        G.forEach(function (x, u) {
          (F.has(u) ? data.mut : data.nao).push(x);
        });
        F.forEach(function (x, u) {
          if (!G.has(u)) data.eu.push(x);
        });
        Object.keys(data).forEach(function (k) {
          data[k].sort(function (a, b) {
            return a.ts - b.ts;
          });
        });
        $("sF").textContent = $("chipA").textContent = F.size;
        $("sG").textContent = $("chipB").textContent = G.size;
        $("sN").textContent = $("tN").textContent = data.nao.length;
        $("sM").textContent = $("tM").textContent = data.mut.length;
        $("tE").textContent = data.eu.length;
        $("results").style.display = "block";
        current = "nao";
        shown = PAGE;
        $("q").value = "";
        document.querySelectorAll(".tab").forEach(function (t) {
          t.setAttribute("aria-selected", t.dataset.k === current);
        });
        render();
        $("results").scrollIntoView({ behavior: "smooth" });
      })
      .catch(function (err) {
        $("msg").textContent = err.message;
      });
  });

  // ---------- Lista ----------
  function esc(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function fmt(ts) {
    return ts ? new Date(ts * 1000).toLocaleDateString("pt-BR") : "";
  }
  function filtered() {
    var q = $("q").value.trim().toLowerCase().replace(/^@/, "");
    return data[current].filter(function (x) {
      return !q || x.user.indexOf(q) > -1;
    });
  }
  function render() {
    var items = filtered();
    var html = items
      .slice(0, shown)
      .map(function (x) {
        var url =
          "https://www.instagram.com/" + encodeURIComponent(x.user) + "/";
        return (
          '<div class="row"><div class="av"><span>' +
          esc(x.user.charAt(0)) +
          "</span></div>" +
          '<a class="u" href="' +
          url +
          '" target="_blank" rel="noopener noreferrer">@' +
          esc(x.user) +
          "</a>" +
          "<time>" +
          fmt(x.ts) +
          "</time>" +
          '<a class="open" href="' +
          url +
          '" target="_blank" rel="noopener noreferrer">Ver perfil</a></div>'
        );
      })
      .join("");
    $("list").innerHTML =
      html ||
      '<div class="empty">' +
        (data[current].length
          ? "Nenhum usuário encontrado nessa busca."
          : "Nada por aqui. Tudo certo nessa lista!") +
        "</div>";
    $("more").hidden = items.length <= shown;
  }
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      current = t.dataset.k;
      shown = PAGE;
      document.querySelectorAll(".tab").forEach(function (o) {
        o.setAttribute("aria-selected", o === t);
      });
      render();
    });
  });
  $("q").addEventListener("input", function () {
    shown = PAGE;
    render();
  });
  $("more").addEventListener("click", function () {
    shown += PAGE;
    render();
  });

  // ---------- Copiar e CSV ----------
  $("copy").addEventListener("click", function () {
    var text = filtered()
      .map(function (x) {
        return "@" + x.user;
      })
      .join("\n");
    var btn = this;
    function done() {
      btn.textContent = "Copiado!";
      setTimeout(function () {
        btn.textContent = "Copiar lista";
      }, 1500);
    }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done);
    else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      done();
    }
  });
  $("csv").addEventListener("click", function () {
    var rows = ["usuario,data,link"].concat(
      filtered().map(function (x) {
        return (
          x.user +
          "," +
          fmt(x.ts) +
          ",https://www.instagram.com/" +
          x.user +
          "/"
        );
      }),
    );
    var blob = new Blob(["\ufeff" + rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lista-" + current + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
})();
