import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code, Eye, Download, AlertTriangle, Play } from "lucide-react";
import { Sandpack } from "@codesandbox/sandpack-react";
import type { Artifact } from "@/lib/api";

// Функция преобразования файлов артефакта в формат Sandpack
function toSandpackFiles(artifactFiles: Record<string, string>) {
  const files: Record<string, { code: string }> = {};

  const hasReactVite =
    Boolean(artifactFiles["main.tsx"] || artifactFiles["App.tsx"] || artifactFiles["/src/main.tsx"] || artifactFiles["src/main.tsx"]);

  const put = (path: string, code: string) => {
    const p = path.startsWith("/") ? path : `/${path}`;
    files[p] = { code };
  };

  // 1) Нормализация + корректная раскладка под Vite template
  for (const [path, code] of Object.entries(artifactFiles)) {
    const normalized = path.replace(/^\/+/, ""); // убираем ведущие /

    // package.json / конфиги оставляем в корне как есть
    if (
      normalized === "package.json" ||
      normalized === "vite.config.ts" ||
      normalized === "tsconfig.json" ||
      normalized === "src/vite-env.d.ts" ||
      normalized === "vite-env.d.ts"
    ) {
      put(`/${normalized}`, code);
      continue;
    }

    // index.html всегда в корне
    if (normalized === "index.html") {
      put("/index.html", code);
      continue;
    }

    // Для React/Vite: корневые исходники перекидываем в /src/*
    if (hasReactVite && !normalized.includes("/")) {
      const isSource =
        normalized.endsWith(".ts") ||
        normalized.endsWith(".tsx") ||
        normalized.endsWith(".css") ||
        normalized.endsWith(".js") ||
        normalized.endsWith(".jsx");

      if (isSource) {
        put(`/src/${normalized}`, code);
        continue;
      }
    }

    // Остальное — как есть
    put(`/${normalized}`, code);
  }

  // 2) package.json: всегда гарантируем deps + esbuild-wasm
  const ensurePackageJson = (raw?: string) => {
    let pkg: any;
    try {
      pkg = raw ? JSON.parse(raw) : {};
    } catch {
      pkg = {};
    }

    pkg.name ||= "artifact-preview";
    pkg.private = true;

    pkg.scripts ||= { dev: "vite", build: "vite build", preview: "vite preview" };

    pkg.dependencies ||= {};
    pkg.dependencies["react"] ||= "^18.2.0";
    pkg.dependencies["react-dom"] ||= "^18.2.0";
    // КЛЮЧЕВОЕ: Vite в nodebox требует установленный esbuild-wasm
    pkg.dependencies["esbuild-wasm"] ||= "^0.21.5";

    pkg.devDependencies ||= {};
    pkg.devDependencies["vite"] ||= "^5.4.9";
    pkg.devDependencies["@vitejs/plugin-react"] ||= "^4.0.0";
    pkg.devDependencies["typescript"] ||= "^5.0.0";

    return JSON.stringify(pkg, null, 2);
  };

  put("/package.json", ensurePackageJson(files["/package.json"]?.code));

  // 3) Tailwind: отключаем в превью (иначе нужен postcss/tailwind config)
  const cssKeys = ["/src/index.css", "/index.css"];
  for (const cssKey of cssKeys) {
    if (files[cssKey]?.code?.includes("@tailwind")) {
      files[cssKey] = { code: "/* preview mode: tailwind disabled */\n" };
    }
  }

  // 4) Минимальные конфиги под Vite/TS
  if (!files["/vite.config.ts"]) {
    put(
      "/vite.config.ts",
      `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });`
    );
  }

  if (!files["/tsconfig.json"]) {
    put(
      "/tsconfig.json",
      `{
  "compilerOptions": {
    "jsx": "react-jsx",
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": false,
    "types": ["vite/client"]
  }
}`
    );
  }

  if (!files["/src/vite-env.d.ts"]) {
    put("/src/vite-env.d.ts", `/// <reference types="vite/client" />`);
  }

  // 5) Страховка: если React/Vite артефакт, но нет /src/main.tsx — попробуем перекинуть
  if (hasReactVite && !files["/src/main.tsx"] && files["/main.tsx"]) {
    files["/src/main.tsx"] = files["/main.tsx"];
    delete files["/main.tsx"];
  }
  if (hasReactVite && !files["/src/App.tsx"] && files["/App.tsx"]) {
    files["/src/App.tsx"] = files["/App.tsx"];
    delete files["/App.tsx"];
  }
  if (hasReactVite && !files["/src/index.css"] && files["/index.css"]) {
    files["/src/index.css"] = files["/index.css"];
    delete files["/index.css"];
  }

  return files;
}

interface WebsiteArtifactCardProps {
  artifact: Artifact;
  onUpdate?: (artifactId: number, title: string, files: Record<string, string>, deps?: Record<string, string>) => Promise<void>;
}

export function WebsiteArtifactCard({ artifact, onUpdate }: WebsiteArtifactCardProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");
  const [selectedFile, setSelectedFile] = useState<string>(Object.keys(artifact.files)[0] || "");
  const [sandpackError, setSandpackError] = useState<string>("");

  // Обработка ошибок Sandpack
  useEffect(() => {
    const handleSandpackError = (event: ErrorEvent) => {
      if (event.message.includes('sandbox') || event.message.includes('presentation')) {
        setSandpackError('Sandpack временно недоступен из-за ограничений браузера. Попробуйте перезагрузить страницу.');
      }
    };

    window.addEventListener('error', handleSandpackError);
    return () => window.removeEventListener('error', handleSandpackError);
  }, []);

  const handleCopy = async () => {
    try {
      const filesContent = Object.entries(artifact.files)
        .map(([path, content]) => `// ${path}\n${content}`)
        .join("\n\n---\n\n");

      await navigator.clipboard.writeText(filesContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: показать код в alert
      const filesContent = Object.entries(artifact.files)
        .map(([path, content]) => `// ${path}\n${content}`)
        .join("\n\n---\n\n");
      alert(`Код скопирован в буфер обмена:\n\n${filesContent.slice(0, 500)}${filesContent.length > 500 ? '\n\n...' : ''}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    // Создаем архив всех файлов
    const filesContent = Object.entries(artifact.files)
      .map(([path, content]) => `=== ${path} ===\n${content}`)
      .join("\n\n");

    const blob = new Blob([filesContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_project.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-background to-secondary/10 p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md">
            <Code className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{artifact.title}</h3>
            <p className="text-xs text-muted-foreground">
              Веб-сайт • {Object.keys(artifact.files).length} файлов
            </p>
          </div>
        </div>

        {/* Переключатель режимов просмотра */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          <Button
            variant={viewMode === "code" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("code")}
            className="h-7 px-3"
          >
            <Code className="h-3 w-3 mr-1" />
            Код
          </Button>
          <Button
            variant={viewMode === "preview" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("preview")}
            className="h-7 px-3"
          >
            <Eye className="h-3 w-3 mr-1" />
            Превью
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-8"
            title="Скачать все файлы"
          >
            <Download className="h-4 w-4 mr-1" />
            Скачать проект
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8"
            title="Копировать все файлы"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1 text-green-500" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Копировать все
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Code/Preview Viewer */}
      {viewMode === "preview" ? (
        /* Sandpack Preview */
        <div className="rounded-lg overflow-hidden border border-border shadow-inner">
          {sandpackError ? (
            <div className="p-4 text-center text-red-500 dark:text-red-400">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{sandpackError}</p>
            </div>
          ) : (
            <Sandpack
              template="vite-react-ts"
              files={toSandpackFiles(artifact.files)}
              customSetup={{
                dependencies: {
                  "esbuild-wasm": "^0.21.5",
                },
              }}
              options={{
                showNavigator: true,
                showTabs: true,
                showLineNumbers: true,
                editorHeight: 420,
                showConsole: true,
                showConsoleButton: true
              }}
              theme="dark"
            />
          )}
        </div>
      ) : (
        /* Code Viewer */
        <div className="rounded-lg overflow-hidden border border-border shadow-inner bg-slate-50 dark:bg-slate-900">
          <div className="flex border-b border-border">
            {Object.keys(artifact.files).map((filePath) => (
              <button
                key={filePath}
                onClick={() => setSelectedFile(filePath)}
                className={`px-4 py-2 text-sm font-medium border-r border-border last:border-r-0 transition-colors ${
                  selectedFile === filePath
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {filePath.split('/').pop()}
              </button>
            ))}
          </div>

          <div className="p-4">
            {selectedFile && artifact.files[selectedFile] ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {selectedFile}
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const code = artifact.files[selectedFile];
                        navigator.clipboard.writeText(code).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="h-7"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        const blob = new Blob([artifact.files[selectedFile]], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = selectedFile.split('/').pop() || 'file.txt';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      variant="outline"
                      size="sm"
                      className="h-7"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <pre className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md p-4 overflow-x-auto text-sm font-mono text-slate-800 dark:text-slate-200 max-h-96 overflow-y-auto">
                  <code>{artifact.files[selectedFile]}</code>
                </pre>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Выберите файл для просмотра</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>📝 Просмотр и редактирование кода</span>
          {artifact.deps && Object.keys(artifact.deps).length > 0 && (
            <span>📦 {Object.keys(artifact.deps).length} зависимостей</span>
          )}
        </div>
        <span>Создано: {new Date(artifact.createdAt).toLocaleString("ru-RU")}</span>
      </div>
    </div>
  );
}
