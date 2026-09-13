/*
 * Adaptador SCORM 1.2 (descubrimiento de API segun la especificacion ADL SCORM 1.2 RTE).
 * El build estatico de este curso ya sabe hablar SCORM: busca window.scorm_type y
 * window.scorm_api. Lo unico que faltaba era alguien que los definiera. Eso hace esto.
 * Debe cargarse ANTES de course.js.
 */
(function () {
  "use strict";

  var MAX_PARENTS = 500;

  function findAPIIn(win) {
    var tries = 0;
    while (win && !win.API && win.parent && win.parent !== win && tries < MAX_PARENTS) {
      tries++;
      win = win.parent;
    }
    return (win && win.API) || null;
  }

  function locateAPI() {
    var api = null;
    try {
      api = findAPIIn(window);
    } catch (e) {}
    if (!api && window.opener) {
      try {
        api = findAPIIn(window.opener);
      } catch (e) {}
    }
    if (!api && window.top !== window) {
      try {
        api = window.top.API || null;
      } catch (e) {}
    }
    return api;
  }

  var api = locateAPI();

  if (!api) {
    // Sin LMS (abierto en local o servido como web normal): el curso funciona igual,
    // simplemente no reporta progreso. course.js ya protege todas sus llamadas SCORM.
    console.info("[scorm] No se encontro API del LMS; el curso se ejecuta sin seguimiento.");
    return;
  }

  // Evita que un LMSFinish doble (uno de course.js, otro del descarga de pagina)
  // provoque un error 101 en LMS estrictos.
  var finished = false;
  var rawFinish = api.LMSFinish;
  api.LMSFinish = function (arg) {
    if (finished) return "true";
    finished = true;
    try {
      return rawFinish.call(api, arg === undefined ? "" : arg);
    } catch (e) {
      return "false";
    }
  };

  try {
    api.LMSInitialize("");
  } catch (e) {
    console.warn("[scorm] LMSInitialize fallo:", e);
  }

  window.scorm_api = api;
  window.scorm_type = "1.2";

  // Marca "incomplete" en el primer lanzamiento para que el LMS registre el intento.
  try {
    var status = api.LMSGetValue("cmi.core.lesson_status");
    if (!status || status === "not attempted" || status === "unknown") {
      api.LMSSetValue("cmi.core.lesson_status", "incomplete");
      api.LMSCommit("");
    }
  } catch (e) {}

  // Red de seguridad: si el alumno cierra la pestana sin pasar por la salida
  // normal del curso, se confirma y cierra la sesion igualmente.
  window.addEventListener("beforeunload", function () {
    if (finished) return;
    try {
      api.LMSCommit("");
      api.LMSFinish("");
    } catch (e) {}
  });
})();
