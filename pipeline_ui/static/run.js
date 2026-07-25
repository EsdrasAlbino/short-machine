const logEl = document.getElementById("log");
const statusEl = document.getElementById("status");

const source = new EventSource(`/run/${runId}/stream`);

source.onmessage = (event) => {
  logEl.textContent += event.data + "\n";
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

source.onerror = () => {
  statusEl.textContent = "Conexão de log perdida (a execução pode ter terminado).";
  source.close();
};
