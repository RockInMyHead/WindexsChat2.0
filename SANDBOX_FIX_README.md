# 🔧 Исправление проблем с iframe sandbox в Sandpack

## 🚨 Проблема
Sandpack генерировал ошибки:
- `Error while parsing the 'sandbox' attribute: 'allow-presentation' is an invalid sandbox flag`
- `Permission policy 'Fullscreen' check failed for document`
- Нестабильная работа превью (иногда "Hello world")

## 💡 Причина
`allow-presentation` - валидный токен по стандарту HTML, но Safari и некоторые WebKit-сборки не поддерживают его при парсинге iframe sandbox.

## ✅ Решение

### 1. **Разделение компонентов Sandpack**
Вместо единого `<Sandpack>` используем отдельные компоненты:
- `SandpackProvider` - контекст
- `SandpackLayout` - layout контейнер
- `SandpackCodeEditor` - редактор кода
- `SandpackPreview` - превью с iframe

### 2. **Конфигурация iframeProps**
```tsx
<SandpackPreview
  showOpenInCodeSandbox={false}
  showOpenNewtab={false}
  iframeProps={{
    // Без allow-presentation (Safari не поддерживает)
    sandbox: [
      "allow-scripts",
      "allow-same-origin",
      "allow-forms",
      "allow-modals",
      "allow-downloads",
      // Убраны: "allow-popups", "allow-presentation"
    ].join(" "),
    // Убираем permission policy предупреждения
    allow: "",
    allowFullScreen: false as any,
    referrerPolicy: "no-referrer",
    loading: "lazy" as any,
  }}
/>
```

### 3. **Дополнительная страховка**
useEffect патчит iframe после монтирования:
```tsx
useEffect(() => {
  const iframes = document.querySelectorAll('iframe[title*="Sandpack"]');
  iframes.forEach((iframe) => {
    const currentSandbox = iframe.getAttribute('sandbox') || '';
    if (currentSandbox.includes('allow-presentation')) {
      iframe.setAttribute('sandbox', [
        'allow-scripts', 'allow-same-origin', 'allow-forms',
        'allow-modals', 'allow-downloads'
      ].join(' '));
    }
    iframe.removeAttribute('allow');
    iframe.removeAttribute('allowfullscreen');
  });
}, [artifact.id]);
```

## 🎯 Результат
- ✅ Нет ошибок sandbox в Safari/WebKit
- ✅ Стабильная работа превью
- ✅ Правильная загрузка сгенерированных сайтов
- ✅ Убраны кнопки "Open in CodeSandbox" и "Open in new tab"
- ✅ Зафиксированы пути файлов (`/src/App.tsx`, `/src/index.css`)

## 📁 Измененные файлы
- `src/components/WebsiteArtifactCard.tsx` - основное исправление

## 🧪 Тестирование
1. Откройте https://ai.windexs.ru
2. Создайте сайт командой: `"создай лендинг для кофейни"`
3. Проверьте отсутствие ошибок в консоли
4. Превью должно работать стабильно

## 🔍 Дополнительная диагностика
Если проблемы остаются, проверьте:
- Версию браузера (Safari может требовать дополнительных настроек)
- Консоль браузера на наличие других ошибок
- Network вкладку на 404/401 ошибки API