(() => {
  "use strict";

  let loading = false;
  let bound = false;

  function getAdminToken() {
    if (window.AlzidanAuth && typeof window.AlzidanAuth.getAdminToken === "function") {
      return String(window.AlzidanAuth.getAdminToken() || "").trim();
    }
    return "";
  }

  function getClient() {
    if (window.AlzidanAdminCore && typeof window.AlzidanAdminCore.getClient === "function") {
      return window.AlzidanAdminCore.getClient();
    }
    if (window.__alzidanConfig && typeof window.__alzidanConfig.getClient === "function") {
      return window.__alzidanConfig.getClient();
    }
    return window.__alzidanSupabaseClient || null;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(text, isError) {
    const el = document.getElementById("admin-pulse-online-status");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = isError ? "#991b1b" : "";
  }

  function formatWhen(raw) {
    const at = Date.parse(String(raw || ""));
    if (!Number.isFinite(at) || at <= 0) return "—";
    try {
      return new Date(at).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return String(raw || "—");
    }
  }

  function formatPhone(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (!d) return String(raw || "—");
    if (d.length === 12 && d.startsWith("966")) return "0" + d.slice(3);
    if (d.length === 9 && d.startsWith("5")) return "0" + d;
    return String(raw || d);
  }

  function whatsAppUrl(phone) {
    let d = String(phone || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length === 9 && d.startsWith("5")) d = "966" + d;
    if (d.startsWith("0") && d.length === 10) d = "966" + d.slice(1);
    return "https://wa.me/" + d;
  }

  function renderRows(payload) {
    const body = document.getElementById("admin-pulse-online-body");
    const countEl = document.getElementById("admin-pulse-online-count");
    if (!body) return;
    const online = Number(payload && payload.online != null ? payload.online : 0) || 0;
    const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
    if (countEl) {
      countEl.textContent =
        "المتواجدون: " + String(online) + " · بأرقام معروفة: " + String(rows.length);
    }
    if (!rows.length) {
      body.innerHTML =
        '<tr><td colspan="4" class="hint">لا جوالات مسجّلة متصلة الآن.</td></tr>';
      return;
    }
    body.innerHTML = rows
      .map((row) => {
        const phone = String(row.phone || "").trim();
        const wa = whatsAppUrl(phone);
        const phoneCell = phone
          ? esc(formatPhone(phone)) +
            (wa
              ? ' <a class="btn btn-outline btn-sm" href="' +
                esc(wa) +
                '" target="_blank" rel="noopener">واتساب</a>'
              : "")
          : "—";
        return (
          "<tr>" +
          '<td dir="ltr">' +
          phoneCell +
          "</td>" +
          "<td>" +
          esc(row.display_name || "—") +
          "</td>" +
          "<td>" +
          esc(row.branch_key || "—") +
          "</td>" +
          "<td>" +
          esc(formatWhen(row.last_seen_at)) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  async function loadRows() {
    if (loading) return;
    const token = getAdminToken();
    const sb = getClient();
    if (!token) {
      setStatus("سجّل دخول الإدارة أولاً.", true);
      return;
    }
    if (!sb || typeof sb.rpc !== "function") {
      setStatus("تعذر الاتصال بقاعدة البيانات.", true);
      return;
    }
    loading = true;
    setStatus("جاري التحميل…");
    try {
      const res = await sb.rpc("admin_pulse_online_v1", { p_token: token });
      if (res.error) throw res.error;
      const data = res.data && typeof res.data === "object" ? res.data : {};
      if (data.ok === false) {
        throw new Error(data.error || "فشل التحميل");
      }
      renderRows(data);
      setStatus("تم التحديث.");
    } catch (error) {
      console.error("PULSE_ONLINE", error);
      setStatus(error && error.message ? String(error.message) : "تعذر التحميل.", true);
    } finally {
      loading = false;
    }
  }

  function bind() {
    if (bound) return;
    const reload = document.getElementById("admin-pulse-online-reload");
    if (!reload) return;
    reload.addEventListener("click", () => {
      void loadRows();
    });
    bound = true;
  }

  function init() {
    if (!document.getElementById("admin-pulse-online-section")) return;
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.AlzidanAdminPulseOnline = { load: loadRows };
})();
