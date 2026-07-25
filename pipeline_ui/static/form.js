const form = document.getElementById("pipeline-form");
const errorBox = document.getElementById("error");
const presetSelect = document.getElementById("preset-select");

function showError(message) {
  errorBox.textContent = message || "";
}

function fillForm(config) {
  document.getElementById("run_name").value = config.run_name || "";
  document.getElementById("profile_url").value = config.download?.profile_url || "";
  document.getElementById("video_count").value = config.download?.video_count || "";
  document.getElementById("logo_path").value = config.edit?.logo_path || "";
  document.getElementById("icon_path").value = config.edit?.icon_path || "";
  document.getElementById("watermark_region").value = config.edit?.watermark_region || "";
  document.getElementById("captions_enabled").checked = !!config.edit?.captions_enabled;
  document.getElementById("integration_id").value = config.schedule?.integration_id || "";
  document.getElementById("posts_per_day").value = config.schedule?.posts_per_day || "";
  document.getElementById("times_utc").value = (config.schedule?.times_utc || []).join(",");
}

function clearForm() {
  form.reset();
}

presetSelect.addEventListener("change", async () => {
  showError("");
  const name = presetSelect.value;
  if (!name) {
    clearForm();
    return;
  }
  const res = await fetch(`/api/presets/${encodeURIComponent(name)}`);
  if (!res.ok) {
    showError("Não foi possível carregar o preset.");
    return;
  }
  fillForm(await res.json());
});

document.getElementById("save-btn").addEventListener("click", async () => {
  showError("");
  const res = await fetch("/save-preset", { method: "POST", body: new FormData(form) });
  const data = await res.json();
  if (!res.ok) {
    showError(data.error || "Erro ao salvar preset.");
    return;
  }
  showError("");
  if (![...presetSelect.options].some((o) => o.value === data.run_name)) {
    const opt = document.createElement("option");
    opt.value = data.run_name;
    opt.textContent = data.run_name;
    presetSelect.appendChild(opt);
  }
  presetSelect.value = data.run_name;
});

document.getElementById("run-btn").addEventListener("click", async () => {
  showError("");
  const res = await fetch("/run", { method: "POST", body: new FormData(form) });
  const data = await res.json();
  if (!res.ok) {
    showError(data.error || "Erro ao iniciar a execução.");
    return;
  }
  window.location.href = `/run/${data.run_id}`;
});
