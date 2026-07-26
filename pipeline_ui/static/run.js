const logEl = document.getElementById("log");
const statusEl = document.getElementById("status");

const source = new EventSource(`/run/${runId}/stream`);
let buffer = "";

// The server always replays the log file from the start on every new
// connection, so each (re)open must reset our local buffer -- otherwise
// a reconnect (which EventSource does automatically after a drop) would
// duplicate everything already shown.
source.onopen = () => {
  buffer = "";
  logEl.textContent = "";
  statusEl.textContent = "Rodando...";
};

source.onmessage = (event) => {
  buffer += event.data + "\n";
  logEl.textContent = buffer;
  logEl.scrollTop = logEl.scrollHeight;
};

source.addEventListener("done", (event) => {
  const exitCode = event.data;
  statusEl.textContent =
    exitCode === "0"
      ? "Execução concluída com sucesso."
      : `Execução encerrada (código ${exitCode}).`;
  source.close();
});

// Do NOT close the source here -- EventSource retries automatically on
// its own after a dropped connection, and the onopen handler above makes
// that reconnect safe (no duplicated log lines).
source.onerror = () => {
  if (source.readyState === EventSource.CONNECTING) {
    statusEl.textContent = "Conexão perdida, tentando reconectar...";
  }
};
