import { useEffect, useState } from "react";

type LoadState = "idle" | "loading" | "error";

export default function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");

  useEffect(() => {
    async function loadFiles() {
      setLoadState("loading");

      try {
        const response = await fetch("/files");
        const nextFiles = (await response.json()) as string[];
        setFiles(nextFiles);
        setLoadState("idle");
      } catch {
        setLoadState("error");
      }
    }

    void loadFiles();
  }, []);

  async function playFile(file: string) {
    setSelectedFile(file);

    await fetch("/play", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file }),
    });
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Media server</p>
        <h1>Projector Control</h1>
        <p className="description">
          Browse the local media library and send a file to VLC on the Nebula.
        </p>

        {loadState === "loading" && <p>Loading files…</p>}
        {loadState === "error" && (
          <p>Unable to load the media library from the backend.</p>
        )}

        <ul className="file-list">
          {files.map((file) => (
            <li key={file}>
              <button
                className={selectedFile === file ? "file-button active" : "file-button"}
                onClick={() => void playFile(file)}
                type="button"
              >
                <span>{file}</span>
                <span>Play</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
