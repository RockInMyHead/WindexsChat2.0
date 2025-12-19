import { useState, useEffect } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview
} from "@codesandbox/sandpack-react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code, Eye, Download, AlertTriangle } from "lucide-react";
import type { Artifact } from "@/lib/api";

interface WebsiteArtifactCardProps {
  artifact: Artifact;
  onUpdate?: (artifactId: number, title: string, files: Record<string, string>, deps?: Record<string, string>) => Promise<void>;
}

export function WebsiteArtifactCard({ artifact, onUpdate }: WebsiteArtifactCardProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [sandpackError, setSandpackError] = useState<string | null>(null);

  // Дополнительная обработка iframe после монтирования (страховка)
  useEffect(() => {
    if (sandpackError) return; // Не патчим если уже есть ошибка

    const timer = setTimeout(() => {
      const iframes = document.querySelectorAll('iframe[title*="Sandpack"]');
      iframes.forEach((iframe) => {
        // Убеждаемся что sandbox правильный (без allow-presentation)
        const currentSandbox = iframe.getAttribute('sandbox') || '';
        if (currentSandbox.includes('allow-presentation')) {
          iframe.setAttribute('sandbox', [
            'allow-scripts',
            'allow-same-origin',
            'allow-forms',
            'allow-modals',
            'allow-downloads'
          ].join(' '));
        }

        // Убираем allow атрибут если он есть
        if (iframe.hasAttribute('allow')) {
          iframe.removeAttribute('allow');
        }

        // Убеждаемся что allowFullScreen отключен
        iframe.removeAttribute('allowfullscreen');
      });
    }, 2000); // Даем время Sandpack загрузиться

    return () => clearTimeout(timer);
  }, [artifact.id, sandpackError]);

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
    const filesContent = Object.entries(artifact.files)
      .map(([path, content]) => `// ${path}\n${content}`)
      .join("\n\n---\n\n");
    
    await navigator.clipboard.writeText(filesContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // Создаем ZIP-подобную структуру (или просто объединяем файлы)
    const filesContent = Object.entries(artifact.files)
      .map(([path, content]) => `// ${path}\n${content}`)
      .join("\n\n---\n\n");
    
    const blob = new Blob([filesContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
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

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("preview")}
            className="h-8"
          >
            <Eye className="h-4 w-4 mr-1" />
            Превью
          </Button>
          <Button
            variant={viewMode === "code" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("code")}
            className="h-8"
          >
            <Code className="h-4 w-4 mr-1" />
            Код
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-8"
            title="Скачать код"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8"
            title="Копировать код"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Sandpack Editor */}
      <div className="rounded-lg overflow-hidden border border-border shadow-inner">
        {sandpackError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <h4 className="text-lg font-semibold mb-2">Ошибка загрузки редактора</h4>
            <p className="text-sm text-muted-foreground mb-4">{sandpackError}</p>
            <Button
              onClick={() => setSandpackError(null)}
              variant="outline"
              size="sm"
              className="mb-4"
            >
              Попробовать еще раз
            </Button>
            <div className="text-xs bg-muted p-3 rounded max-w-full overflow-x-auto">
              <strong>Код проекта:</strong>
              <pre className="mt-2 whitespace-pre-wrap text-left">
                {Object.entries(artifact.files).map(([path, content]) => (
                  <div key={path} className="mb-2">
                    <div className="font-medium text-blue-600">{path}:</div>
                    <div className="text-gray-700 font-mono text-xs">{content.slice(0, 200)}{content.length > 200 ? '...' : ''}</div>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        ) : (
          <SandpackProvider
            template="react-ts"
            files={artifact.files}
            customSetup={{
              dependencies: {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "tailwindcss": "^3.4.0",
                ...artifact.deps
              }
            }}
            options={{
              activeFile: "/src/App.tsx",
              visibleFiles: viewMode === "code" ? undefined : ["/src/App.tsx", "/src/index.css"],
              closableTabs: false,
            }}
            theme="auto"
          >
            <SandpackLayout>
              {viewMode === "code" && (
                <SandpackCodeEditor
                  showTabs={true}
                  showLineNumbers={true}
                  showInlineErrors={false}
                  closableTabs={false}
                  style={{ height: "500px" }}
                />
              )}
              <SandpackPreview
                showOpenInCodeSandbox={false}
                showOpenNewtab={false}
                showRefreshButton={true}
                showNavigator={viewMode === "preview"}
                style={{ height: viewMode === "code" ? "400px" : "500px" }}
                iframeProps={{
                  // Важно: без allow-presentation (Safari не поддерживает)
                  sandbox: [
                    "allow-scripts",
                    "allow-same-origin",
                    "allow-forms",
                    "allow-modals",
                    "allow-downloads",
                    // убраны: "allow-popups", "allow-presentation"
                  ].join(" "),
                  // Убираем permission policy предупреждения
                  allow: "",
                  allowFullScreen: false as any,
                  // Дополнительные атрибуты для стабильности
                  referrerPolicy: "no-referrer",
                  loading: "lazy" as any,
                }}
                onError={(error) => {
                  console.error('Sandpack preview error:', error);
                  if (error?.message?.includes('sandbox') || error?.message?.includes('presentation')) {
                    setSandpackError('Sandpack временно недоступен из-за ограничений браузера. Попробуйте перезагрузить страницу.');
                  }
                }}
              />
            </SandpackLayout>
          </SandpackProvider>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>✨ Интерактивный редактор и превью</span>
          {artifact.deps && Object.keys(artifact.deps).length > 0 && (
            <span>📦 {Object.keys(artifact.deps).length} зависимостей</span>
          )}
        </div>
        <span>Создано: {new Date(artifact.createdAt).toLocaleString("ru-RU")}</span>
      </div>
    </div>
  );
}
